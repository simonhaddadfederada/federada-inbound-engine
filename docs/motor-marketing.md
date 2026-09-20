# Motor de marketing V1 (Bloque 4)

## Configuración de cadencia

Tabla `content_config` (una sola fila, id=1), editable desde el Table
Editor de Supabase sin tocar código: `reels_per_day`, `stories_per_day`,
`carousels_per_week`, `posts_per_week`, `min_days_buffer`, `slot_times`
(horarios por formato, hora local de Mendoza), `auto_publish`,
`ai_daily_budget_usd`.

Defaults actuales (moderados, fáciles de subir cuando quieras): 1 reel/día,
2 stories/día, 2 carruseles/semana, 2 posts/semana, buffer mínimo 7 días.

## Las 3 funciones

Las tres requieren el header `x-internal-secret` con el valor del secret
`INTERNAL_FUNCTIONS_SECRET` (ya configurado en Supabase). No son públicas
como `intake-landing` — nadie con la clave anon puede dispararlas.

- **content-generator**: mide cuántos días de contenido futuro hay en cola.
  Si alcanza `min_days_buffer`, no hace nada. Si no alcanza, intenta
  generar una tanda nueva con Claude — pero hoy no hay `ANTHROPIC_API_KEY`
  configurada, así que devuelve `action: "blocked"` explicando eso, sin
  inventar contenido. **Probado en vivo**: con la cola vacía devolvió
  `blocked` correctamente; con la cola llena (25 piezas / 7 días) devolvió
  `action: "none"`.
- **content-analyzer**: calcula con SQL (vista `content_performance`,
  basada en `leads.content_piece_id` real) qué contenido generó más leads.
  Con menos de 3 piezas publicadas y medidas, no saca conclusiones
  todavía (para no sobreajustar a un solo caso). **Probado en vivo**:
  con 0 piezas publicadas devolvió correctamente que faltan datos.
- **publish-content**: busca piezas en estado `programado` ya vencidas.
  Con `auto_publish = false` (el estado actual) nunca llama a ningún
  adapter de Meta, solo informa cuáles están esperando aprobación.
  **Probado en vivo**: devolvió `waiting_approval` sin publicar nada.

## Lo que falta para que esto corra solo (y quién lo decide)

1. **ANTHROPIC_API_KEY + confirmar `ai_daily_budget_usd`** (hoy en USD 2.00
   por día como default conservador) — necesita que Simón decida si quiere
   pagar esto y cuánto. Sin esto, `content-generator`/`content-analyzer`
   siguen "bloqueados" de forma segura, tal como están probados hoy.
2. **Cron real** que llame a `content-generator` (ej. una vez por día) y a
   `content-analyzer` (ej. una vez por semana). Supabase tiene una función
   de Cron nativa, pero activarla depende del plan del proyecto — no se
   activó todavía porque implica una decisión de Simón, no una decisión
   técnica trivial.
3. **Permiso `instagram_business_content_publish` + App Review aprobado**
   para que `publish-content` deje de estar bloqueado en los 4 formatos
   (ver `docs/capacidades-meta.md`).
4. Cuando 1-3 estén resueltos, cambiar `content_config.auto_publish` a
   `true` es la única acción necesaria para habilitar la publicación
   automática — y solo publicará lo que ya esté en estado `programado`.

## Asset generado automáticamente

`assets/generated/story-template-brand.png`: fondo vertical 1080x1920 con
degradé de los colores de marca, generado por código (sin herramientas
pagas). Las 14 piezas de story ya apuntan a este asset en `asset_ref`.
Es un fondo reutilizable, no un asset final con texto — el texto
(hook/CTA) se agrega con el editor nativo de historias de Instagram al
momento de publicar, usando el copy que ya está en `content_pieces`.
