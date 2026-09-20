"""Activa AUTO_PUBLISH=true en content_config (Bloque 17).

Autorizado explícitamente por Simón ("activar AUTO_PUBLISH=true") una vez
confirmado que el render/publicación de Reels corre 100% en la nube. El
sandbox de Claude Code bloquea esta acción en particular (cambio de
feature flag que activa publicación automática real) — la corre Simón.

Después de esto, supabase/functions/publish-content (cron cada 30 min)
va a publicar solo cualquier content_piece en status='programado' con
scheduled_at ya vencido. El failsafe (0021_publish_failsafe.sql) apaga
auto_publish solo si hay 3 publicaciones consecutivas fallidas.
"""

import json
import urllib.request

env = {}
with open("/Users/simonhaddad/Desktop/federada-inbound-engine/.env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k] = v

url = f"{env['SUPABASE_URL']}/rest/v1/content_config?id=eq.1"
body = json.dumps({"auto_publish": True}).encode("utf-8")
req = urllib.request.Request(url, data=body, method="PATCH", headers={
    "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
    "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
})
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print("auto_publish:", result[0]["auto_publish"])
    print("consecutive_publish_failures:", result[0]["consecutive_publish_failures"])
