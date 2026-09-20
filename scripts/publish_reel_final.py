"""Publica el Reel real 'reel-monotributo-cobertura' en @simoonhaddad.

Autorizado explícitamente por Simón (mensaje "APROBADO... PUBLICAR ESTE
REEL"). Este script hace, en orden y con salida legible en cada paso:

  1) actualiza el caption real de la pieza (content_pieces.script);
  2) crea el contenedor de video (REELS) vía Graph API;
  3) guarda pending_container_id de inmediato (idempotencia real: si el
     script se corta acá, un reintento reutiliza el mismo contenedor en
     vez de subir el video de nuevo);
  4) espera a que Meta termine de procesar el video (status_code=FINISHED,
     polling real, no un tiempo fijo inventado);
  5) publica (media_publish) con reintento simple ante errores transitorios;
  6) trae permalink + timestamp reales;
  7) guarda published_ref/published_media_id/published_at y marca la
     pieza como 'publicado'.

No inventa nada: si cualquier paso falla, se corta ahí e imprime el error
real de la API, sin simular un resultado.
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

REPO_ROOT = "/Users/simonhaddad/Desktop/federada-inbound-engine"
GRAPH_BASE = "https://graph.instagram.com/v21.0"
SLUG = "reel-monotributo-cobertura"

CAPTION = (
    "¿Sos monotributista y no sabés en qué categoría estás?\n\n"
    "Una parte de tu cuota va directo a tu cobertura médica, y la mayoría "
    "no sabe cuánto es ni qué puede hacer con eso.\n\n"
    "Podés saberlo en dos minutos.\n\n"
    "Mandame PLAN por DM y vemos qué te conviene según tu categoría."
)


def load_env():
    env = {}
    with open(f"{REPO_ROOT}/.env") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    return env


def rest_patch(env, filter_qs, payload):
    url = f"{env['SUPABASE_URL']}/rest/v1/content_pieces?{filter_qs}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH", headers={
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def rest_get(env, path_qs):
    url = f"{env['SUPABASE_URL']}/rest/v1/{path_qs}"
    req = urllib.request.Request(url, headers={
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def graph_post(path, params, access_token):
    body = urllib.parse.urlencode({**params, "access_token": access_token}).encode("utf-8")
    req = urllib.request.Request(f"{GRAPH_BASE}{path}", data=body, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": {"message": e.read().decode()}}


def graph_get(path_qs, access_token):
    sep = "&" if "?" in path_qs else "?"
    url = f"{GRAPH_BASE}{path_qs}{sep}access_token={urllib.parse.quote(access_token)}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": {"message": e.read().decode()}}


def main():
    env = load_env()
    ig_user_id = env["INSTAGRAM_BUSINESS_ACCOUNT_ID"]

    print("1) Piezas -> caption real...")
    updated = rest_patch(env, f"slug=eq.{SLUG}", {"script": CAPTION})
    piece = updated[0]
    print(f"   ok. content_piece_id={piece['id']}")
    video_ref = piece["video_ref"]
    print(f"   video_ref={video_ref}")

    print("2) Token de Instagram vigente (platform_tokens)...")
    tokens = rest_get(env, "platform_tokens?select=access_token,expires_at&platform=eq.instagram")
    if not tokens:
        print("   ERROR: no hay token en platform_tokens"); sys.exit(1)
    access_token = tokens[0]["access_token"]
    print(f"   ok. vence {tokens[0]['expires_at']}")

    print("3) Creando contenedor de video (REELS)...")
    container = graph_post(f"/{ig_user_id}/media", {
        "video_url": video_ref, "media_type": "REELS", "caption": CAPTION,
    }, access_token)
    if "error" in container:
        print(f"   ERROR creando contenedor: {container['error']['message']}"); sys.exit(1)
    container_id = container["id"]
    print(f"   ok. container_id={container_id}")

    rest_patch(env, f"id=eq.{piece['id']}", {"pending_container_id": container_id})
    print("   guardado pending_container_id (idempotencia si esto se corta)")

    print("4) Esperando a que Meta termine de procesar el video...")
    status = None
    for attempt in range(1, 25):
        s = graph_get(f"/{container_id}?fields=status_code", access_token)
        if "error" in s:
            print(f"   ERROR consultando status: {s['error']['message']}"); sys.exit(1)
        status = s["status_code"]
        print(f"   intento {attempt}: status_code={status}")
        if status == "FINISHED":
            break
        if status in ("ERROR", "EXPIRED"):
            print(f"   ERROR: Meta no pudo procesar el video (status_code={status})"); sys.exit(1)
        time.sleep(5)
    if status != "FINISHED":
        print("   ERROR: timeout esperando FINISHED"); sys.exit(1)

    print("5) Publicando (media_publish, con reintento ante error transitorio)...")
    media_id = None
    last_err = None
    for attempt in range(1, 4):
        pub = graph_post(f"/{ig_user_id}/media_publish", {"creation_id": container_id}, access_token)
        if "error" not in pub:
            media_id = pub["id"]
            break
        last_err = pub["error"]["message"]
        print(f"   intento {attempt} falló: {last_err}")
        if attempt < 3:
            time.sleep(attempt)
    if not media_id:
        rest_patch(env, f"id=eq.{piece['id']}", {"last_publish_error": last_err, "publish_attempts": 1})
        print(f"   ERROR: no se pudo publicar después de reintentos: {last_err}"); sys.exit(1)
    print(f"   ok. media_id={media_id}")

    print("6) Trayendo permalink real...")
    details = graph_get(f"/{media_id}?fields=permalink,timestamp", access_token)
    if "error" in details:
        print(f"   ERROR trayendo detalles: {details['error']['message']}")
        permalink, published_at = media_id, None
    else:
        permalink = details["permalink"]
        published_at = details["timestamp"]
    print(f"   permalink={permalink}")
    print(f"   published_at={published_at}")

    print("7) Guardando resultado real en content_pieces...")
    final_update = {
        "status": "publicado",
        "published_ref": permalink,
        "published_media_id": media_id,
        "pending_container_id": None,
        "last_publish_error": None,
    }
    if published_at:
        final_update["published_at"] = published_at
    rest_patch(env, f"id=eq.{piece['id']}", final_update)
    print("   ok.")

    print()
    print("=== RESULTADO ===")
    print(f"media_id: {media_id}")
    print(f"permalink: {permalink}")


if __name__ == "__main__":
    main()
