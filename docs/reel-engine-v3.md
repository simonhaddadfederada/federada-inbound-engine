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

## Audio — investigado, NO contratado todavía

### Voz en off

Probé la opción gratis del sistema (`say` de macOS) — **no sirve**: no
tiene ninguna voz con acento argentino (solo España/México) y sí sería
necesario un tono neutro/artificial, lejos de "natural rioplatense".

**Recomendación**: Azure AI Speech, voces neuronales dedicadas
**`es-AR-ElenaNeural`** (mujer) y **`es-AR-TomasNeural`** (hombre) — acento
argentino real, calidad neuronal moderna.

- **Costo**: USD 16 por millón de caracteres (voces Neural estándar).
  Azure da **500.000 caracteres gratis por mes** de forma continua.
- **Costo por Reel**: un guion de voz de ~150-250 caracteres cuesta
  **menos de USD 0.005** (medio centavo) — dentro del free tier siempre.
- **Costo mensual estimado a nuestra cadencia** (1-2 reels/día ≈
  30-60/mes × ~200 caracteres): ~6.000-12.000 caracteres/mes — **muy por
  debajo del free tier, esencialmente USD 0/mes** salvo que subamos el
  volumen en un orden de magnitud.
- Alternativa de mayor naturalidad conversacional: **ElevenLabs** (sin
  acento argentino específico, planes mensuales desde ~USD 5, no tiene
  sentido a nuestro volumen tan chico frente al pago-por-uso de Azure).

**No creé la cuenta ni cargué nada — necesito tu autorización** para dar
de alta Azure (aunque el costo real esperado sea prácticamente cero,
sigue siendo crear una cuenta con un método de pago cargado).

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
