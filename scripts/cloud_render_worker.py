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
import sys
import urllib.error
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))

from render_reel_asset import render_from_spec  # noqa: E402

MAX_ATTEMPTS = 3


def env(name, required=True):
    # .strip(): un secret cargado a mano en GitHub a veces trae un salto de
    # línea de sobra al final (copiando la línea completa desde una
    # terminal) — encontrado de verdad el 20/09/2026 con SUPABASE_URL,
    # que rompía urllib con "URL can't contain control characters".
    v = os.environ.get(name)
    if v is not None:
        v = v.strip()
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


def upload_to_storage(supabase_url, service_key, bucket, object_path, file_path):
    with open(file_path, "rb") as f:
        data = f.read()
    url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "video/mp4",
        "x-upsert": "true",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Subida a Storage falló ({e.code}): {e.read().decode()}")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"


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

    if fmt != "reel":
        rest_request(
            "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
            body={"status": "render_failed", "last_render_error": f"El worker cloud todavía solo renderiza reels, no {fmt}."},
        )
        print(f"'{fmt}' todavía no está soportado en el worker cloud — marcado render_failed.")
        return

    render_spec = piece.get("render_spec")
    if not render_spec:
        rest_request(
            "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
            body={"status": "render_failed", "last_render_error": "Falta render_spec (beats/cta/música) para esta pieza."},
        )
        print("Falta render_spec — marcado render_failed (no se inventa un guion).")
        return

    out_path = f"/tmp/{piece_id}.mp4"
    try:
        _, duration = render_from_spec(render_spec, out_path)
        print(f"Render ok: {duration:.1f}s")

        object_path = f"reels/{piece_id}.mp4"
        public_url = upload_to_storage(supabase_url, service_key, "content-assets", object_path, out_path)
        print(f"Subido: {public_url}")

        rest_request(
            "PATCH", f"content_pieces?id=eq.{piece_id}", supabase_url, service_key,
            body={
                "status": "listo",
                "video_ref": public_url,
                "render_attempts": 0,
                "last_render_error": None,
                "render_started_at": None,
            },
        )
        print(f"'{slug}' -> status=listo, video_ref={public_url}")

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
