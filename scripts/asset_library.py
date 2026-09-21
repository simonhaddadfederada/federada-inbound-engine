"""Biblioteca visual reutilizable (Bloque 19) — registro y consulta de
visual_assets. Funciona igual para íconos propios (hoy) y fotos de stock
(cuando exista PEXELS_API_KEY) — mismo esquema, mismo storage.
"""

import json
import urllib.error
import urllib.request


def _headers(service_key):
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def register_asset(supabase_url, service_key, category, source, license_text, storage_url,
                    orientation=None, subjects=None, emotion=None, recommended_uses=None, external_ref=None):
    """Guarda metadata de un asset visual (propio o de stock) para poder
    reutilizarlo después sin repetir siempre el mismo."""
    body = {
        "category": category, "source": source, "license": license_text, "storage_url": storage_url,
        "orientation": orientation, "subjects": subjects, "emotion": emotion,
        "recommended_uses": recommended_uses, "external_ref": external_ref,
    }
    req = urllib.request.Request(
        f"{supabase_url}/rest/v1/visual_assets", data=json.dumps(body).encode(), method="POST",
        headers=_headers(service_key),
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())[0]


def pick_asset_for_category(supabase_url, service_key, category):
    """Elige el asset MENOS usado recientemente de esa categoría (evita
    repetir siempre la misma imagen) y marca el uso. None si no hay
    ninguno registrado todavía para esa categoría."""
    url = (
        f"{supabase_url}/rest/v1/visual_assets?category=eq.{category}"
        "&order=times_used.asc,last_used_at.asc.nullsfirst&limit=1"
    )
    req = urllib.request.Request(url, headers=_headers(service_key))
    with urllib.request.urlopen(req) as resp:
        rows = json.loads(resp.read())
    if not rows:
        return None
    asset = rows[0]

    from datetime import datetime, timezone
    patch_req = urllib.request.Request(
        f"{supabase_url}/rest/v1/visual_assets?id=eq.{asset['id']}",
        data=json.dumps({
            "times_used": asset["times_used"] + 1,
            "last_used_at": datetime.now(timezone.utc).isoformat(),
        }).encode(),
        method="PATCH", headers=_headers(service_key),
    )
    with urllib.request.urlopen(patch_req):
        pass
    return asset
