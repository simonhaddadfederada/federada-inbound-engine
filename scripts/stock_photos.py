"""Integración con Pexels (Bloque 19 — Creative Director V2).

Por qué Pexels y no otra cosa (investigado, sin contratar nada):
- Pexels API: gratis, licencia "Pexels License" — uso comercial permitido,
  sin atribución obligatoria, sin límite práctico razonable (200
  requests/hora, 20.000/mes en el tier gratis — sobra para nuestro
  volumen). Requiere una API key gratis (registrarse en
  pexels.com/api con email, sin tarjeta).
- Alternativas evaluadas: Pixabay (licencia similar, API similar,
  también gratis) y Unsplash (API gratis pero con límite más bajo en el
  tier de desarrollo — 50 requests/hora — y requiere aprobación para
  producción). Pexels es el mejor balance licencia/límite/simplicidad.
- Descartado: Google Images / bancos sin licencia clara / cualquier
  fuente que no garantice uso comercial explícito.

ESTADO: código real, no probado en vivo — necesita que Simón cree una
cuenta gratis en pexels.com/api y pegue la key como PEXELS_API_KEY
(mismo patrón que los demás secrets: .env local + Supabase/GitHub
secrets). Sin esa key, search_photo() devuelve un error claro, nunca
inventa una URL de foto.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request

PEXELS_API_BASE = "https://api.pexels.com/v1"


def search_photo(query: str, api_key: str, orientation: str = "portrait"):
    """Busca UNA foto relevante en Pexels. orientation: 'portrait'
    (Reels/Stories, 1080x1920) o 'landscape'/'square' según el formato.
    Devuelve {"ok": True, "url": ..., "photographer": ..., "pexels_id": ...,
    "src_url": ...} o {"ok": False, "error": ...} — nunca inventa un
    resultado si la búsqueda no encuentra nada o la key es inválida."""
    if not api_key:
        return {"ok": False, "error": "Falta PEXELS_API_KEY (Simón todavía no creó la cuenta gratis)."}

    params = urllib.parse.urlencode({"query": query, "per_page": 1, "orientation": orientation})
    req = urllib.request.Request(
        f"{PEXELS_API_BASE}/search?{params}",
        headers={"Authorization": api_key},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"Pexels {e.code}: {e.read().decode()[:200]}"}

    photos = data.get("photos", [])
    if not photos:
        return {"ok": False, "error": f"Pexels no encontró fotos para '{query}'."}

    photo = photos[0]
    size_key = "portrait" if orientation == "portrait" else "landscape"
    return {
        "ok": True,
        "url": photo["src"].get(size_key, photo["src"]["original"]),
        "photographer": photo["photographer"],
        "pexels_id": photo["id"],
        "src_url": photo["url"],  # link a la página de Pexels, para atribución/trazabilidad
        "license": "Pexels License — uso comercial permitido, atribución no obligatoria",
    }


def download_photo(photo_url: str, out_path: str):
    urllib.request.urlretrieve(photo_url, out_path)
    return out_path
