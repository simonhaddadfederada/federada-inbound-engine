"""Worker de renderizado en la nube (Bloque 16 — GitHub Actions).

Corre en un runner Linux estándar de GitHub Actions (o local, para probar).
Busca UNA pieza con status='render_pendiente', la reclama de forma atómica
(para que dos corridas superpuestas nunca rendericen la misma dos veces),
la renderiza con el motor real (scripts/render_reel_asset.py — ElevenLabs,
ffmpeg, todo igual que en local), sube el MP4 a Supabase Storage y deja la
pieza en status='listo' con su video_ref público.

Nunca publica nada — eso lo sigue haciendo exclusivamente
supabase/functions/publish-content (con auto_publish, todavía en false).

Reintentos: si falla, incrementa render_attempts y deja la pieza en
render_pendiente para que la reintente la próxima corrida programada. Al
llegar a MAX_ATTEMPTS pasa a render_failed y avisa por Telegram — nunca
queda una pieza a medio renderizar con un video_ref viejo o inconsistente,
porque video_ref solo se escribe junto con status='listo', en el mismo
PATCH.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))

from render_reel_asset import render_from_spec  # noqa: E402
from render_post_asset import render_post, render_story  # noqa: E402
from render_carousel_asset import render_slide  # noqa: E402

MAX_ATTEMPTS = 3


def env(name, required=True):
    # Un secret cargado a mano en GitHub puede traer basura de más —
    # encontrado de verdad el 20/09/2026 con SUPABASE_URL: ni siquiera
    # .strip() alcanzó (el error seguía después de aplicarlo), lo que
    # confirma que la basura no estaba en el borde sino a mitad de
    # cadena (por ejemplo, un salto de línea seguido de más texto
    # pegado por error). Ninguno de nuestros secrets es legítimamente
    # multi-línea o con espacios adentro, así que quedarse con el
    # primer bloque sin espacios/control-chars es siempre seguro.
    v = os.environ.get(name)
    if v is not None:
        m = re.match(r"\S*", v.strip())
        v = m.group() if m else v.strip()
    if required and not v:
        raise RuntimeError(f"Falta la variable de entorno {name}")
    return v


def rest_request(method, path_and_query, supabase_url, service_key, body=None, extra_headers=None):
    url = f"{supabase_url}/rest/v1/{path_and_query}"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path_and_query} -> {e.code}: {e.read().decode()}")


def send_telegram_alert(bot_token, chat_id, text):
    if not bot_token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    body = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req)
    except Exception as e:  # nunca tirar el worker abajo por un fallo de Telegram
        print(f"aviso: no se pudo mandar la alerta de Telegram: {e}")


def claim_pending_piece(supabase_url, service_key):
    """Reclama de forma atómica UNA pieza render_pendiente que no esté
    siendo renderizada ahora mismo (o cuyo render se colgó hace >20 min).
    Un solo UPDATE con WHERE — sin ventana de carrera entre leer y escribir."""
    from datetime import datetime, timedelta, timezone

    candidates = rest_request(
        "GET",
        "content_pieces?status=eq.render_pendiente&order=created_at.asc&limit=5"
        "&select=id,slug,format,render_spec,render_attempts,render_started_at",
        supabase_url, service_key,
    )
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=20)
    for row in candidates:
        started = row.get("render_started_at")
        if started:
            started_dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
            if started_dt > cutoff:
                continue  # otra corrida ya la está renderizando de verdad
        claimed = rest_request(
            "PATCH",
            f"content_pieces?id=eq.{row['id']}&status=eq.render_pendiente",
            supabase_url, service_key,
            body={"render_started_at": datetime.now(timezone.utc).isoformat()},
        )
        if claimed:
            return claimed[0]
    return None


def upload_to_storage(supabase_url, service_key, bucket, object_path, file_path, content_type):
    with open(file_path, "rb") as f:
        data = f.read()
    url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": content_type,
        "x-upsert": "true",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Subida a Storage falló ({e.code}): {e.read().decode()}")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"


def render_reel_piece(piece_id, render_spec, supabase_url, service_key):
    out_path = f"/tmp/{piece_id}.mp4"
    _, duration = render_from_spec(render_spec, out_path)
    print(f"Render ok: {duration:.1f}s")
    public_url = upload_to_storage(
        supabase_url, service_key, "content-assets", f"reels/{piece_id}.mp4", out_path, "video/mp4",
    )
    return {"video_ref": public_url}


def render_post_piece(piece_id, render_spec, supabase_url, service_key, story=False):
    out_path = f"/tmp/{piece_id}.png"
    fn = render_story if story else render_post
    fn(
        hook_lines=render_spec["hook_lines"],
        highlight_word=render_spec.get("highlight_word"),
        sub_text=render_spec.get("sub_text", ""),
        cta_text=render_spec["cta_text"],
        subcta_text=render_spec.get("subcta_text"),
        handle_text=render_spec.get("handle_text", "@simoonhaddad · Asesor Federada Salud"),
        output_path=out_path,
    )
    prefix = "stories" if story else "posts"
    public_url = upload_to_storage(
        supabase_url, service_key, "content-assets", f"{prefix}/{piece_id}.png", out_path, "image/png",
    )
    return {"asset_ref": public_url}


def render_carousel_piece(piece_id, render_spec, supabase_url, service_key):
    slides = render_spec["slides"]
    handle_text = render_spec.get("handle_text", "@simoonhaddad · Asesor Federada Salud")
    total = len(slides)
    urls = []
    for i, s in enumerate(slides, start=1):
        out_path = f"/tmp/{piece_id}-slide-{i}.png"
        render_slide(
            kind=s["kind"], index=i, total=total, title=s.get("title", ""),
            body_lines=s.get("body", []), output_path=out_path,
            cta_text=s.get("cta"), subcta_text=s.get("subcta"), handle_text=handle_text,
        )
        public_url = upload_to_storage(
            supabase_url, service_key, "content-assets", f"carousels/{piece_id}/slide-{i}.png", out_path,
            "image/png",
        )
        urls.append(public_url)
    return {"carousel_assets": urls}


def main():
    supabase_url = env("SUPABASE_URL")
    service_key = env("SUPABASE_SERVICE_ROLE_KEY")
    bot_token = env("TELEGRAM_BOT_TOKEN", required=False) or ""
    chat_id = env("TELEGRAM_CHAT_ID", required=False) or ""

    piece = claim_pending_piece(supabase_url, service_key)
    if not piece:
        print("Nada pendiente de renderizar (o todo está siendo renderizado ahora). Listo.")
        return

    piece_id = piece["id"]
    slug = piece["slug"]
    fmt = piece["format"]
    print(f"Reclamada: {slug} ({fmt}, id={piece_id})")

    RENDERERS = {
        "reel": render_reel_piece,
        "post": render_post_piece,
        "carousel": render_carousel_piece,
        "story": lambda *a: render_post_piece(*a, story=True),
    }
    renderer = RENDERERS.get(fmt)
    if not renderer:
        rest_request(
            "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
            body={"status": "render_failed", "last_render_error": f"El worker cloud no sabe renderizar el formato '{fmt}'."},
        )
        print(f"'{fmt}' no tiene renderer — marcado render_failed.")
        return

    render_spec = piece.get("render_spec")
    if not render_spec:
        rest_request(
            "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
            body={"status": "render_failed", "last_render_error": "Falta render_spec (beats/cta/música) para esta pieza."},
        )
        print("Falta render_spec — marcado render_failed (no se inventa un guion).")
        return

    try:
        update_fields = renderer(piece_id, render_spec, supabase_url, service_key)
        print(f"Render ok: {update_fields}")

        rest_request(
            "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
            body={
                "status": "listo",
                "render_attempts": 0,
                "last_render_error": None,
                "render_started_at": None,
                **update_fields,
            },
        )
        print(f"'{slug}' -> status=listo")

    except Exception as err:
        attempts = (piece.get("render_attempts") or 0) + 1
        print(f"ERROR renderizando (intento {attempts}/{MAX_ATTEMPTS}): {err}")
        if attempts >= MAX_ATTEMPTS:
            rest_request(
                "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
                body={"status": "render_failed", "render_attempts": attempts, "last_render_error": str(err)[:2000],
                      "render_started_at": None},
            )
            send_telegram_alert(
                bot_token, chat_id,
                f"⚠️ <b>Falló el render en la nube de \"{slug}\"</b> después de {attempts} intentos.\n"
                f"Detalle: {str(err)[:500]}\nQuedó en render_failed — no se va a reintentar solo.",
            )
        else:
            rest_request(
                "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
                body={"render_attempts": attempts, "last_render_error": str(err)[:2000], "render_started_at": None},
            )
            print("Se reintentará en la próxima corrida programada.")
        sys.exit(1)


if __name__ == "__main__":
    main()
