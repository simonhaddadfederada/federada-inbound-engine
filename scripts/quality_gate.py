"""Quality Gate V1 (Bloque 18).

IMPORTANTE, para no prometer de más: esto es una heurística determinística
sobre datos medibles (longitud de texto, variedad de layout, presencia de
CTA/hook/branding) — NO es un juicio visual real ("¿esto se ve profesional
a simple vista?"). Eso requeriría un modelo con visión (Claude/GPT con
imágenes) o un servicio de evaluación de diseño, ninguno de los dos
contratado en este bloque (habría sido un gasto nuevo). Se documenta así
para no hacer pasar una heurística de texto por una revisión de diseño
real — ver docs/creative-director.md.

Sirve para atrapar los problemas objetivos y automatizables: exceso de
texto, falta de CTA, layout repetido/genérico, hook demasiado largo para
leerse en 2 segundos. No atrapa "esto es feo" en el sentido estético.
"""

CRITERIA = [
    "scroll_stopping", "claridad_2s", "calidad_profesional", "naturalidad_instagram",
    "identidad_federada", "jerarquia_visual", "variedad_visual", "legibilidad_movil",
    "cta", "no_parece_ia",
]

_GENERIC_LAYOUTS = {"placa_clasica", "glow_orbital"}

_BRIEF_MARKERS = (
    "contar que", "contar un", "mostrar en", "explicar que", "explicar el",
    "comparar dos", "responder la", "cerrar invitando", "cerrar con", "tip:",
)


def _score_scroll_stopping(layout_style, hook):
    score = 6.0
    if layout_style not in _GENERIC_LAYOUTS:
        score += 2.0
    if "?" in hook or hook.isupper():
        score += 1.0
    return min(10.0, score)


def _score_claridad_2s(hook):
    words = len(hook.split())
    if words <= 12:
        return 10.0
    if words <= 18:
        return 8.0
    if words <= 24:
        return 6.0
    return 4.0


def _score_calidad_profesional(piece):
    missing = [k for k in ("hook", "cta") if not (piece.get(k) or "").strip()]
    return 4.0 if missing else 9.0


def _score_naturalidad_instagram(script):
    lowered = (script or "").strip().lower()
    if any(lowered.startswith(m) or f" {m}" in lowered[:120] for m in _BRIEF_MARKERS):
        return 3.0
    return 9.0


def _score_identidad_federada():
    # El renderer aplica Red Hat + paleta Federada por construcción — no
    # hay forma de que una pieza generada por este pipeline la incumpla.
    return 10.0


def _score_jerarquia_visual(piece):
    has_hook = bool((piece.get("hook") or "").strip())
    has_cta = bool((piece.get("cta") or "").strip())
    return 9.0 if (has_hook and has_cta) else 5.0


def _score_variedad_visual(layout_style, recent_layout_styles):
    if layout_style in (recent_layout_styles or []):
        return 5.0
    return 9.0 if layout_style not in _GENERIC_LAYOUTS else 7.0


def _score_legibilidad_movil(hook, script):
    hook_ok = len(hook) <= 90
    script_ok = len((script or "")) <= 700
    if hook_ok and script_ok:
        return 9.0
    if hook_ok or script_ok:
        return 6.5
    return 4.0


def _score_cta(piece):
    cta = (piece.get("cta") or "").strip()
    keyword = (piece.get("keyword") or "").strip()
    if cta and keyword and keyword.upper() in cta.upper():
        return 10.0
    if cta:
        return 6.0
    return 0.0


def _score_no_parece_ia(layout_style):
    # Proxy débil a propósito (ver docstring del módulo): una composición
    # no genérica al menos evita el look "plantilla" más obvio.
    return 8.0 if layout_style not in _GENERIC_LAYOUTS else 5.5


def score_piece(piece: dict, creative_direction: dict, recent_layout_styles=None) -> dict:
    """piece: dict con hook/cta/keyword/script. creative_direction: el
    dict que devuelve creative_director.decide_creative_direction().
    recent_layout_styles: layouts usados por las últimas N piezas del
    mismo formato, para penalizar repetición consecutiva real."""
    layout_style = creative_direction.get("layout_style", "")
    hook = piece.get("hook", "")
    script = piece.get("script", "")

    scores = {
        "scroll_stopping": _score_scroll_stopping(layout_style, hook),
        "claridad_2s": _score_claridad_2s(hook),
        "calidad_profesional": _score_calidad_profesional(piece),
        "naturalidad_instagram": _score_naturalidad_instagram(script),
        "identidad_federada": _score_identidad_federada(),
        "jerarquia_visual": _score_jerarquia_visual(piece),
        "variedad_visual": _score_variedad_visual(layout_style, recent_layout_styles),
        "legibilidad_movil": _score_legibilidad_movil(hook, script),
        "cta": _score_cta(piece),
        "no_parece_ia": _score_no_parece_ia(layout_style),
    }
    average = sum(scores.values()) / len(scores)
    return {"scores": scores, "average": round(average, 2), "ready": average >= 7.0}
