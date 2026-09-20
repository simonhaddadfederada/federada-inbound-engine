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

### Preset de voz definitivo (elegido 20/09/2026, no volver a comparar)

`MELANIE_ENERGICA` en `scripts/render_reel_asset.py` — única fuente de
verdad, reutilizar tal cual en todo Reel nuevo:

```python
{
  "voice_id": "bN1bDXgDIGX5lw0rtY2B",  # Melanie
  "model_id": "eleven_v3",             # unico modelo con audio tags
  "voice_settings": {
    "stability": 0.3, "similarity_boost": 0.8,
    "style": 0.45, "use_speaker_boost": True, "speed": 1.05,
  },
}
```

Dirección de guion: `[curious]` al inicio del hook, `[upbeat]` antes del
CTA — nunca más de 1-2 tags por guion, nunca gritos ni actuación
exagerada. Los audio tags NO se leen en voz alta (verificado: ocupan
~48ms de silencio real en el timing, no texto hablado).

### Música + mezcla (20/09/2026)

**Eleven Music**, incluida en el mismo plan Starter (~900 créditos/min,
irrelevante a la duración de un Reel de 15-20s). Se pidió activar el
permiso `music_generation` en la API key (no estaba habilitado por
default). Mezcla real con `ffmpeg` en `mix_voice_and_music()`:

- `sidechaincompress`: la música se atenúa automáticamente cuando
  Melanie habla (ducking real, no un volumen fijo).
- Volumen base de música después del ducking: **0.60** (subido desde
  0.45 a pedido de Simón — se percibe más presente sin competir con la
  voz, ducking/fades/normalización sin tocar).
- `afade` de entrada/salida cortos (0.25s / 0.5s).
- `loudnorm` (integrated loudness -16 LUFS, true peak -1.5 dB) para
  normalizar y evitar clipping en la salida final.

**Probado de punta a punta**: Reel real de ~19.7s, video H.264 + audio
AAC mezclado, mostrado a Simón antes de cualquier publicación.

### Duración — hallazgo real sobre el límite del recorte (20/09/2026)

`build_tts_script()` corrigió un bug real: antes se unían los beats con
`". ".join(...)`, y como cada beat ya termina en su propio signo
("estás**?**", "médica**.**"), el guion mandado a ElevenLabs quedaba con
puntuación **doble** ("estás?.", "médica.."), lo que el modelo lee como
dos pausas seguidas. Corregido (unión simple, sin signos de más) +
`tail_buffer_ms` bajado de 500 a 250. **Medido con una llamada real
instrumentada**: con `eleven_v3`/Melanie Enérgica los huecos entre beats
ya eran casi cero (0.00s) — el motor NO estaba perdiendo tiempo en
silencios de sobra; casi toda la duración es habla real a un ritmo
natural (~0.35-0.46s por palabra). El hook (~4.1s) y el CTA (~4.8s) sin
tocar ya suman ~9s de los ~16s pedidos como objetivo. Bajar de ~20s a
15-17s manteniendo intacto el guion, los subtítulos, el CTA, el hook y
sin acelerar la voz no es matemáticamente posible con este contenido —
requeriría necesariamente tocar alguna de esas partes protegidas. Con
los ajustes que sí eran seguros (puntuación + buffer) se logró bajar a
~19.7s.

## Material visual

Se evitó cualquier stock/imagen/video de terceros. El motor usa
únicamente: tipografía (Red Hat), color de marca, formas geométricas
generadas (blur/acentos) y texto — sin depender de que Simón se filme.
La arquitectura no impide sumar más adelante clips reales de Simón
hablando a cámara (se integrarían como `video_ref` de fondo en vez del
degradé generado), pero no es necesario para que el motor funcione hoy.
