# Creative Director / Design Quality V1 (Bloque 18)

Objetivo: que el sistema deje de asumir "Reel = fondo azul + texto",
"carrusel = 6 placas iguales", y tome una decisión visual real antes de
renderizar — sin tocar cron/publicación/analytics/storage/failsafe/
auto_publish, y sin contratar ningún servicio nuevo.

## Qué es y qué NO es

`scripts/creative_director.py` y `scripts/quality_gate.py` son
**determinísticos**, igual que `auto_beats.py`: reglas reales sobre
`hook_type`/`theme`/`format` (que ya pone `content-generator`), no otra
llamada a un LLM. Cero secret nuevo, cero costo nuevo, 100% reproducible.

**Esto NO es un director de arte con ojos.** No mira la imagen resultante
ni juzga si "se ve linda" — elige entre una biblioteca real de layouts
con un criterio explícito (ver tabla abajo), y el quality gate mide
propiedades de texto/estructura (longitud, CTA, repetición), no estética.
Un juicio visual real requeriría un modelo con visión (Claude/GPT con
imágenes) evaluando el render final — no contratado en este bloque
(gasto nuevo, no autorizado). Documentado acá como mejora futura.

## Creative Director — reglas reales

| hook_type | Reel | Post | Story | Carrusel |
|---|---|---|---|---|
| dinero | `glow_orbital` | `big_stat` | `big_stat` | `dato_impacto` |
| miedo | `big_shape_focus` | `editorial` | `editorial` | `narrativa` |
| curiosidad | `glow_orbital` | `placa_clasica` | `placa_clasica` (o `pregunta_directa` si el hook tiene "?") | `narrativa` |
| educativo | `grid_pulse` | `editorial` | `editorial` | `dato_impacto` |
| faq | `grid_pulse` | `placa_clasica` | `placa_clasica` | `listicle` |
| mito | `split_diagonal` | `editorial` | `editorial` | `mito_comparacion` |

Cada pieza guarda su decisión completa en `content_pieces.creative_direction`
(concepto visual, emoción, estilo, jerarquía, foco, ritmo, y **por qué
frena el scroll** — una justificación real, no una frase genérica).

## Biblioteca de layouts (todo Pillow, cero foto/stock/IA de imágenes)

**Reels (4 estilos)** — `render_reel_asset.py`, función `build_background(style=...)`:
- `glow_orbital` (el original): acento circular con blur que orbita — cálido, orgánico.
- `split_diagonal`: corte diagonal magenta/navy — tensión visual, para hooks de alerta.
- `grid_pulse`: grilla tenue + acento chico que pulsa — estética de dato/información.
- `big_shape_focus`: una forma redondeada grande y descentrada — declaración fuerte, sin ruido.

**Posts (3 estilos)** — `render_post_asset.py`:
- `placa_clasica` (`render_post`, el original): stack centrado hook→sub→CTA.
- `big_stat` (`render_big_stat`): número/frase corta protagonista sobre un bloque de acento.
- `editorial` (`render_editorial`): composición asimétrica — eyebrow + título alineado a la izquierda + bloque de acento en la esquina, como una revista, no un anuncio.

**Stories (4 estilos)** — mismas funciones que Posts + canvas 1080x1920:
- `placa_clasica`, `big_stat`, `editorial` (iguales, con más margen para la UI de Instagram).
- `pregunta_directa` (`render_big_stat` con `accent_glyph="?"`): el mismo layout de dato, con un signo de pregunta gigante y tenue de marca de agua.

**Carruseles (4 familias)** — `render_carousel_asset.py`, 6 tipos de slide (`cover`/`content`/`cta`/`stat`/`comparison`/`listicle`) combinados en secuencias:
- `narrativa`: cover → content → content → content → cta.
- `mito_comparacion`: cover → comparison×N → cta (cada mito con su "SE DICE" / "LA REALIDAD").
- `dato_impacto`: cover → stat → content → cta (abre con el número más fuerte).
- `listicle`: cover → listicle×N (insignia numerada) → cta — para ideas tipo "3 preguntas"/"5 cosas".

## Quality Gate

`scripts/quality_gate.py`, 10 criterios (0-10), promedio ≥7 para quedar
`listo`. Guardado en `content_pieces.quality_scores`/`quality_score`.
Si un Reel puntúa <7: se recompone UNA vez con un estilo visual distinto
(nunca un loop infinito) y se queda con el resultado. Posts/carruseles/
Stories no tienen recomposición automática todavía (su contenido sigue
siendo armado a mano, no por `auto_beats`) — quedan `listo` igual, con el
score bajo visible para revisión humana.

## Integrado en el pipeline real, sin romper nada

Wireado en `cloud_render_worker.py` — mismo worker de siempre, mismo cron
de GitHub Actions, mismo failsafe. Para Reels con `render_spec` ya armado
a mano (`visual_style` ya presente), se respeta tal cual — el Creative
Director solo decide cuando no hay una elección explícita. Para
posts/carruseles/Stories, el contenido (`render_spec`) lo sigue armando
una persona (o `auto_beats` a futuro) eligiendo la función de layout —
`creative_director.decide_creative_direction()` le dice **cuál** conviene.

## Prueba real: antes vs. después

- **Reel** `reel-error-elegir-por-precio` (hook_type `miedo`): mismo
  guion exacto, estilo visual `glow_orbital` (genérico) → `big_shape_focus`
  (recomendado por la regla de `miedo`). Archivos enviados en el chat.
- **Carrusel** `carousel-3-preguntas-antes-de-cambiar`: mismas 3
  preguntas, familia `narrativa` (3 slides "content" iguales, mucho
  espacio vacío) → familia `listicle` (insignia numerada, jerarquía
  clara). Archivos enviados en el chat.

Ninguna de las dos piezas de prueba se publicó ni se tocó su estado real
en producción — se generaron copias aparte para comparar.

## Alcance no perseguido a propósito (evita perfeccionismo infinito / gasto nuevo)

- **Fotografía / B-roll / imágenes generadas por IA**: no implementado.
  Requeriría un servicio pago (generación de imágenes o banco de stock
  con licencia comercial, ~USD 10-30/mes según volumen) — no contratado.
  El "medio" real disponible hoy es texto protagonista + gráficos/
  iconografía programática, documentado explícitamente en cada
  `creative_direction.medio`, nunca se finge que hay una foto.
- **Evaluación visual real (juicio estético con IA de visión)**: el
  quality gate es una heurística de texto/estructura, no un juicio de
  "esto se ve profesional". Una mejora futura real sería una llamada a
  un modelo con visión sobre el render final — gasto nuevo, no evaluado
  en detalle acá.
- **Auto-composición de carruseles**: `auto_beats.py` solo existe para
  Reels. Carruseles siguen necesitando que alguien arme las slides — el
  Creative Director les dice qué familia/layout usar, no genera el
  contenido de cada slide solo.
