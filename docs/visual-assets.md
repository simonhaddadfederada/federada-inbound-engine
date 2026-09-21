# Biblioteca visual + Vision Quality Review (Bloque 19 — Creative Director V2)

## Fuentes de imagen evaluadas (ninguna contratada — cero gasto nuevo)

| Fuente | Licencia | Costo | Límite free | Elegida |
|---|---|---|---|---|
| **Pexels API** | Pexels License — uso comercial permitido, sin atribución obligatoria | Gratis | 200 req/hora, 20.000/mes | ✅ (ver `scripts/stock_photos.py`) |
| Pixabay API | Similar a Pexels | Gratis | Similar | Alternativa válida, no implementada |
| Unsplash API | Uso comercial permitido | Gratis | 50 req/hora en tier dev, requiere aprobación para producción | Descartada por el límite/aprobación |
| Google Images / bancos sin licencia | — | — | — | **Descartada explícitamente**, pedido de Simón |
| Generación de imágenes con IA | — | Gasto nuevo | — | No evaluada en detalle — ninguna API ya contratada (Anthropic, ElevenLabs) genera imágenes |

**Acción única pendiente de Simón** (igual que con GitHub Actions/secrets
anteriores): crear una cuenta gratis en [pexels.com/api](https://www.pexels.com/api/)
(email, sin tarjeta) y pegar la key como `PEXELS_API_KEY` en `.env` +
Supabase/GitHub secrets. Sin esa key, `stock_photos.py` no inventa
ninguna foto — devuelve un error claro.

## Qué existe HOY sin esa key: iconografía propia

`scripts/icon_assets.py` — 4 ilustraciones dibujadas con Pillow (persona
con celular, documento/recibo conceptual, familia, cruz médica),
compuestas como acento visual grande y sutil sobre los layouts
existentes (nunca los reemplaza). Registradas en la tabla real
`visual_assets` (Bloque 19, `0023_visual_assets.sql`) con su metadata
completa (categoría, licencia, sujetos, emoción, usos recomendados).

## Biblioteca visual reutilizable

Tabla `visual_assets` (RLS: solo `service_role`) + `scripts/asset_library.py`:
`register_asset()` guarda cualquier recurso (propio o de stock, misma
tabla) con toda la metadata pedida; `pick_asset_for_category()` elige el
menos usado recientemente de una categoría real (evita repetir siempre
la misma imagen) — **probado en vivo**: 4 assets propios registrados de
verdad, rotación de uso confirmada con una llamada real (`times_used`
0→1).

## Vision Quality Review — segunda capa real

`scripts/vision_quality_review.py`, usa Anthropic (`claude-haiku-4-5`,
ya contratado) con visión: manda una versión comprimida (≤640px, JPEG
calidad 70) de la pieza renderizada + un prompt corto, pide 13 criterios
0-10 + hasta 3 correcciones concretas, en JSON.

**Probado en vivo 4 veces** (no simulado): Reel V1/V2 y carrusel V1/V2
reales — ver resultados en el chat. Costo real medido:
**~USD 0.0024-0.0028 por revisión** (986 tokens de imagen + prompt,
~275-280 tokens de respuesta, tarifas reales de `claude-haiku-4-5`:
USD 1/millón input, USD 5/millón output — [anthropic.com/claude/haiku](https://www.anthropic.com/claude/haiku)).
A esa tarifa, revisar cada pieza generada (≈1-2/día) cuesta centavos por
mes, muy por debajo de `AI_DAILY_BUDGET_USD`.

**Hallazgo real, no maquillado**: el modelo evaluó los íconos propios
como "parecen assets de plantilla genérica" y recomendó explícitamente
foto real como siguiente paso — la propia revisión confirma que la
iconografía Pillow es una mejora incremental honesta, no el salto final
a "nivel de agencia". Eso requiere las fotos reales (Pexels, pendiente
de la key).

## Por qué NO está integrado al pipeline automático todavía

Pedido explícito: "hasta que Creative Director V2 esté probado, las
piezas nuevas pueden seguir usando el renderer estable actual". Este
bloque queda como herramienta de validación probada (4 corridas reales)
pero **no wireada** en `cloud_render_worker.py` — se integra
progresivamente en un bloque futuro, y wirear el Vision Quality Review
en la nube además necesita que `ANTHROPIC_API_KEY` exista como secret de
GitHub Actions (hoy solo existe como secret de Supabase, para
`content-generator` — un entorno distinto). Se documenta como la
siguiente acción, no se pide ahora para no abrir un frente nuevo de
gestión de secrets en medio de este bloque.
