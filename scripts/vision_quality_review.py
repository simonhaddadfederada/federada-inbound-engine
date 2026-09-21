"""Vision Quality Review (Bloque 19) — segunda capa REAL de revisión
visual, usando la Anthropic API ya contratada (mismo presupuesto,
AI_DAILY_BUDGET_USD).

Estado: código real, PROBADO EN VIVO localmente (con la ANTHROPIC_API_KEY
del .env). Para que corra sola en GitHub Actions falta UNA sola acción de
Simón: agregar ANTHROPIC_API_KEY como secret de GitHub (ya existe como
secret de Supabase, para content-generator, pero el worker de render
cloud corre en GitHub Actions, un entorno distinto). Hasta entonces se
usa como herramienta de validación manual (como se probó acá), no
integrada al pipeline automático — pedido explícito: "hasta que V2 esté
probado, las piezas nuevas pueden seguir usando el renderer estable
actual".

Costo real por revisión (medido, no estimado): un frame comprimido a
~600px de ancho, JPEG calidad 70, mandado como imagen a
claude-haiku-4-5 con un prompt corto — ver el costo real impreso al
correr esto, no un número inventado.
"""

import base64
import io
import json
import urllib.error
import urllib.request

MODEL = "claude-haiku-4-5-20251001"
MAX_WIDTH = 640

CRITERIA = [
    "scroll_stopping", "composicion", "jerarquia", "legibilidad_movil", "exceso_texto",
    "branding", "naturalidad_instagram", "estetica_comercial", "apariencia_ia", "cta",
    "uso_de_imagen", "balance", "nivel_profesional",
]

_PROMPT = """Sos un director de arte de una agencia de marketing digital evaluando \
una pieza real para Instagram de un asesor de seguros de salud (marca: Federada, \
azul #001489 y magenta #F04E98, tipografía Red Hat).

Evaluá la imagen adjunta. Devolvé SOLO un JSON (sin texto alrededor, sin \
```), con esta forma exacta:
{"scores": {"scroll_stopping": 0-10, "composicion": 0-10, "jerarquia": 0-10, \
"legibilidad_movil": 0-10, "exceso_texto": 0-10, "branding": 0-10, \
"naturalidad_instagram": 0-10, "estetica_comercial": 0-10, "apariencia_ia": 0-10, \
"cta": 0-10, "uso_de_imagen": 0-10, "balance": 0-10, "nivel_profesional": 0-10}, \
"correcciones": ["máximo 3 sugerencias concretas y breves"]}

"apariencia_ia": 10 = no parece generado por IA/plantilla, 0 = se nota mucho. \
Sé exigente y específico, no optimista por defecto."""


def _load_env():
    import os
    env = dict(os.environ)
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(repo_root, ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env.setdefault(k, v)
    return env


def _compress_image(image_path: str) -> bytes:
    from PIL import Image
    img = Image.open(image_path).convert("RGB")
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def evaluate_visual_quality(image_path: str, api_key: str = None) -> dict:
    """Manda una versión comprimida de image_path (frame de Reel o slide
    de post/carrusel) a Claude con visión y pide una evaluación real
    estructurada. Devuelve {"ok": True, "scores": {...}, "average":
    ..., "correcciones": [...], "usage": {...}} o {"ok": False, "error": ...}
    — nunca inventa un score si la llamada falla."""
    env = _load_env()
    key = api_key or env.get("ANTHROPIC_API_KEY")
    if not key:
        return {"ok": False, "error": "Falta ANTHROPIC_API_KEY."}

    image_bytes = _compress_image(image_path)
    image_b64 = base64.b64encode(image_bytes).decode("ascii")

    body = json.dumps({
        "model": MODEL,
        "max_tokens": 400,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                {"type": "text", "text": _PROMPT},
            ],
        }],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body, method="POST",
        headers={
            "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"Anthropic {e.code}: {e.read().decode()[:300]}"}

    text = data["content"][0]["text"].strip()
    if text.startswith("```"):
        text = text.strip("`").split("\n", 1)[-1]
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"ok": False, "error": f"Respuesta no era JSON válido: {text[:300]}"}

    scores = parsed.get("scores", {})
    average = round(sum(scores.values()) / len(scores), 2) if scores else 0.0
    usage = data.get("usage", {})
    # Precios reales de claude-haiku-4-5 (input/output por millón de
    # tokens) — el costo se calcula, no se inventa.
    cost_usd = (usage.get("input_tokens", 0) * 1.00 + usage.get("output_tokens", 0) * 5.00) / 1_000_000
    return {
        "ok": True,
        "scores": scores,
        "average": average,
        "ready": average >= 7.5,
        "correcciones": parsed.get("correcciones", []),
        "usage": usage,
        "cost_usd": round(cost_usd, 6),
    }
