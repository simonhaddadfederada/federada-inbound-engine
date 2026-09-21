"""Creative Director V1 (Bloque 18) — decisión creativa estructurada
ANTES de renderizar, guardada junto a la pieza (content_pieces.creative_direction).

Determinístico a propósito, igual que auto_beats.py: sin LLM nuevo, sin
secret nuevo, 100% reproducible y auditable. Usa hook_type/theme/format
(ya los pone content-generator) para elegir, con criterio, entre una
biblioteca real de estilos visuales — no rota mecánicamente, no asume
"Reel = fondo azul + texto".

Falta a propósito: fotografía/ilustración/B-roll real. No se contrató
ningún servicio de generación de imágenes ni stock (hubiera sido un
gasto nuevo, no autorizado) — documentado como mejora futura en
docs/creative-director.md. El "medio" que puede elegir hoy es texto
protagonista / iconografía / motion (Ken Burns + acentos), nunca "foto"
ni "video real" porque no existen esos recursos sin gasto nuevo.
"""

from typing import Optional

REEL_STYLES = ["glow_orbital", "split_diagonal", "grid_pulse", "big_shape_focus"]
POST_STYLES = ["placa_clasica", "big_stat", "editorial"]
STORY_STYLES = ["placa_clasica", "big_stat", "editorial", "pregunta_directa"]
CAROUSEL_FAMILIES = ["narrativa", "mito_comparacion", "dato_impacto", "listicle"]

# hook_type -> (estilo reel, estilo post, estilo story si no es pregunta, familia carrusel)
_RULES = {
    "dinero": ("glow_orbital", "big_stat", "big_stat", "dato_impacto"),
    "miedo": ("big_shape_focus", "editorial", "editorial", "narrativa"),
    "curiosidad": ("glow_orbital", "placa_clasica", "placa_clasica", "narrativa"),
    "educativo": ("grid_pulse", "editorial", "editorial", "dato_impacto"),
    "faq": ("grid_pulse", "placa_clasica", "placa_clasica", "listicle"),
    "mito": ("split_diagonal", "editorial", "editorial", "mito_comparacion"),
}
_DEFAULT_RULE = ("glow_orbital", "placa_clasica", "placa_clasica", "narrativa")

_EMOTION_BY_HOOK_TYPE = {
    "dinero": "expectativa (plata que ya es tuya)",
    "miedo": "alerta / urgencia calma",
    "curiosidad": "intriga",
    "educativo": "claridad / alivio",
    "faq": "resolución",
    "mito": "sorpresa / corrección",
}

_RECURSO_KEYWORDS = [
    # (recurso, palabras clave a buscar en hook+theme+script)
    ("documento", ["aporte", "recibo", "sueldo", "monotributo", "cuota", "categoría"]),
    ("familia", ["familia", "hijo", "hijos", "pareja", "grupo familiar"]),
    ("persona_celular", ["celular", "app", "whatsapp", "trámite", "trámites", "escribime", "mensaje"]),
    ("medico", ["médic", "consultorio", "salud", "cobertura médica", "prestador", "cartilla"]),
]


def _pick_recurso_principal(piece: dict) -> str:
    """Elige el recurso visual principal por CRITERIO SEMÁNTICO (contenido
    real de la pieza), no solo por hook_type — texto plano solo si nada
    del contenido sugiere un recurso más concreto (sigue siendo válido:
    'texto puro cuando sea la mejor opción', no la opción por defecto)."""
    text = " ".join([
        piece.get("hook", ""), piece.get("theme", ""), piece.get("script", ""),
    ]).lower()
    for recurso, keywords in _RECURSO_KEYWORDS:
        if any(kw in text for kw in keywords):
            return recurso
    return "texto_puro"


_WHY_STOPS_SCROLL = {
    "glow_orbital": "movimiento orgánico cálido — se siente humano, no una placa fija",
    "split_diagonal": "corte diagonal genera tensión visual inmediata, coherente con un hook de alerta",
    "grid_pulse": "estética de dato/información — comunica 'esto es preciso', no genérico",
    "big_shape_focus": "una sola forma dominante fuerza la mirada a un solo punto, sin ruido",
    "big_stat": "el número ocupa la mayor parte del cuadro — se entiende en menos de 1 segundo",
    "editorial": "composición asimétrica, no centrada — se lee como contenido editorial, no como anuncio",
    "placa_clasica": "jerarquía probada (hook -> idea -> CTA), sin distraer del mensaje",
    "pregunta_directa": "la pregunta ocupa casi todo el cuadro — invita a responder de inmediato",
    "narrativa": "desarrollo secuencial, bueno para explicar algo paso a paso",
    "mito_comparacion": "contraste lado a lado (se dice / la realidad) — el formato más claro para desmentir algo",
    "dato_impacto": "abre con el número más fuerte, no lo entierra en el medio",
    "listicle": "estructura numerada — comunica 'esto es una lista concreta', invita a seguir deslizando",
}


def decide_creative_direction(piece: dict) -> dict:
    """piece: dict con al menos format/hook/cta, idealmente también
    hook_type/theme/keyword (ya los genera content-generator)."""
    fmt = piece.get("format")
    hook_type = (piece.get("hook_type") or "").lower()
    hook = piece.get("hook", "")
    theme = piece.get("theme", "")

    reel_style, post_style, story_style, carousel_family = _RULES.get(hook_type, _DEFAULT_RULE)
    if fmt == "story" and "?" in hook:
        story_style = "pregunta_directa"

    layout_style = {
        "reel": reel_style,
        "post": post_style,
        "story": story_style,
        "carousel": carousel_family,
    }.get(fmt, reel_style)

    recurso_principal = _pick_recurso_principal(piece)
    medio = (
        "texto protagonista, sin recurso visual adicional (fue la mejor opción para este contenido)"
        if recurso_principal == "texto_puro"
        else f"iconografía propia '{recurso_principal}' como acento visual + texto protagonista"
    )

    why = _WHY_STOPS_SCROLL.get(layout_style, "composición distinta a la placa genérica")
    if recurso_principal != "texto_puro":
        why += f"; el ícono de '{recurso_principal}' da un punto de referencia visual concreto, no solo tipografía"

    return {
        "concepto_visual": f"'{theme or hook_type or fmt}' resuelto en un solo golpe visual, sin párrafos",
        "emocion_principal": _EMOTION_BY_HOOK_TYPE.get(hook_type, "interés"),
        "hook_visual": hook,
        "recurso_principal": recurso_principal,
        "estilo_composicion": layout_style,
        "medio": medio,
        "jerarquia": "hook -> idea -> CTA, en ese orden, nada compite con el hook",
        "foco_principal": "el hook y el CTA — todo lo demás es soporte",
        "ritmo": "cambio visual cada 2-4s" if fmt == "reel" else "una sola idea por pieza",
        "cta": piece.get("cta", ""),
        "por_que_frena_scroll": why,
        "layout_style": layout_style,
    }
