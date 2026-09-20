# Reel Engine V3

## Reglas generales del motor (aplican a cualquier Reel, no a uno puntual)

- Estructura por **beats** de 1-3 segundos (`scripts/render_reel_asset.py`),
  no escenas largas estáticas. Duración total objetivo: 8-18s.
- Cada beat tiene su propia composición: pregunta, stat con barra
  resaltadora, línea de desarrollo, punch de cierre, CTA — nunca el mismo
  layout dos veces seguidas.
- Entrada tipo "pop" (~0.3s, con leve overshoot) en vez de fades lentos.
- Fondo con paneo/zoom continuo + un acento circular con blur que cambia
  de posición por beat — nunca se siente una placa fija.
- **Safe areas reales** (en 1080×1920): no se pone texto/CTA en los
  primeros 260px (tapados por hora/perfil), los últimos 340px (caption +
  controles de Reels) ni los últimos 150px de la derecha (columna de
  like/comentario/compartir/guardar).
- Texto secundario más grande (40-44px) y con poca densidad — solo
  conceptos, nunca el guion completo en pantalla.
- `variant_style` (pregunta/dinero_perdido/mito/dato_curioso) permite
  renderizar la misma idea con distintos ángulos y comparar cuál
  convierte mejor — se guarda por content_piece, junto con
  `parent_content_piece_id` cuando deriva de una pieza original.

## Audio — decidido y en producción (20/09/2026)

### Voz en off — ElevenLabs "Melanie", plan Starter (USD 6/mes)

Historial real de la decisión, en orden:

1. `say` de macOS (gratis): descartado — sin acento argentino.
2. Azure AI Speech (`es-AR-ElenaNeural`/`TomasNeural`, ~USD 0/mes a
   nuestro volumen dentro del free tier): funcionó técnicamente
   (probado con audio real), pero Simón lo escuchó y le pareció
   **demasiado robótico**, no suena naturalmente argentino.
3. ElevenLabs plan **Free**: probado con las voces de la biblioteca
   comunitaria (Agustín, Melanie, acento argentino real) — **bloqueado**:
   la propia API devuelve `"Free users cannot use library voices via the
   API. Please upgrade your subscription."` (comprobado con una llamada
   real, no documentación).
4. ElevenLabs plan **Starter (USD 6/mes, autorizado y contratado por
   Simón)**: desbloquea las voces de biblioteca vía API. Se generaron
   Agustín y Melanie con el mismo guion real — **Simón eligió Melanie**
   ("Ecommerce Voice", acento argentino, voice_id `bN1bDXgDIGX5lw0rtY2B`).

**Sincronización real**: se usa el endpoint `with-timestamps` de
ElevenLabs, que devuelve el tiempo exacto de cada carácter sintetizado.
`scripts/render_reel_asset.py` agrupa esos caracteres en palabras y arma
la duración real de cada beat a partir de ahí — nunca un tiempo inventado.

**Costo real**: a nuestra cadencia (~6.000-12.000 caracteres/mes),
sobra margen dentro de los 30.000 caracteres/mes que incluye el plan
Starter — no se espera pagar de más.

### Música de fondo

No se descargó ningún archivo de terceros (evita cualquier duda de
copyright). Camino recomendado para V3: generar un fondo simple
programáticamente (tonos/pulsos sintetizados con Python, 100% original,
costo cero, cero riesgo legal) y mezclarlo bajo la voz con ffmpeg.
Alternativa de mayor calidad de producción: bibliotecas con licencia
(Epidemic Sound / Artlist, ~USD 10-15/mes) — no se contrató, queda
pendiente si en algún momento se quiere subir la producción.

## Material visual

Se evitó cualquier stock/imagen/video de terceros. El motor usa
únicamente: tipografía (Red Hat), color de marca, formas geométricas
generadas (blur/acentos) y texto — sin depender de que Simón se filme.
La arquitectura no impide sumar más adelante clips reales de Simón
hablando a cámara (se integrarían como `video_ref` de fondo en vez del
degradé generado), pero no es necesario para que el motor funcione hoy.
