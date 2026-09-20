"""Convierte hook/script/cta (lo que ya genera content-generator) en un
render_spec de Reel (beats/cta_text/subcta_text/música) sin intervención
manual — Bloque 17.

Determinístico a propósito, no otra llamada a un LLM: cero costo nuevo,
cero secret nuevo que pedirle a Simón, y un comportamiento 100%
reproducible/testeable. Funciona bien cuando "script" ya es texto
narrable en primera persona (el caso normal desde que se corrigió el
prompt de content-generator, ver 7565882) — con piezas viejas escritas
como nota de producción en tercera persona el resultado es más torpe
pero sigue siendo un Reel válido, nunca un crash.
"""

import re
from typing import Optional

MUSIC_PROMPT_DEFAULT = (
    "Modern minimal instrumental background music, subtle rhythmic pulse, clean, "
    "commercial energy but understated, suitable for a health insurance brand, "
    "no vocals, no lyrics, no epic orchestral elements, no drums, unobtrusive"
)
HANDLE_DEFAULT = "@simoonhaddad · Asesor Federada Salud"

_CTA_SPLIT_RE = re.compile(r"\s+(y|si)\s+", re.IGNORECASE)


def _split_sentences(text: str):
    text = text.replace("\n", " ").strip()
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def _split_cta(cta: str):
    """'Escribime PLAN y vemos qué te conviene' -> ('Escribime PLAN', 'y vemos qué te conviene').
    Sin conector reconocido, todo el CTA queda en cta_text (subcta None)."""
    m = _CTA_SPLIT_RE.search(cta)
    if not m:
        return cta.strip(), None
    return cta[: m.start()].strip(), cta[m.start() + 1:].strip()


def generate_beats_from_script(hook: str, script: str, cta: str, keyword: Optional[str] = None) -> dict:
    hook_text = hook.strip().rstrip(".")
    is_question = "?" in hook_text
    hook_beat = {
        "type": "question" if is_question else "hook_punch",
        "text": hook_text.upper(),
        "spoken": f"[curious] {hook_text}" if is_question else hook_text,
    }
    if keyword and keyword.upper() in hook_text.upper():
        hook_beat["highlight"] = keyword.upper()

    sentences = _split_sentences(script)
    cta_lower = cta.lower()
    # descarta oraciones que ya son básicamente el CTA repetido al final del script
    body_sentences = [s for s in sentences if s.lower()[:20] not in cta_lower][:3]

    types_cycle = ["stat", "line", "hook_punch"]
    middle_beats = [
        {
            "type": types_cycle[min(i, len(types_cycle) - 1)],
            "text": sentence.upper() if len(sentence) < 60 else sentence,
            "spoken": sentence,
        }
        for i, sentence in enumerate(body_sentences)
    ]

    cta_text, subcta_text = _split_cta(cta)
    cta_beat = {"type": "cta", "spoken": f"[upbeat] {cta}"}

    return {
        "beats": [hook_beat, *middle_beats, cta_beat],
        "cta_text": cta_text,
        "subcta_text": subcta_text,
        "handle_text": HANDLE_DEFAULT,
        "music_prompt": MUSIC_PROMPT_DEFAULT,
    }
