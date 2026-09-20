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

## Automatización 24/7 — YA ACTIVA (Bloque 5)

Se verificó (no se asumió) que `pg_cron` y `pg_net` están disponibles en
el plan actual — son extensiones de Postgres, no una feature paga aparte
(`0009_cron_extensions.sql`). Se activaron 3 jobs corriendo en la nube,
sin depender de que la computadora de Simón esté prendida:

| Job | Frecuencia | Hora Mendoza |
|---|---|---|
| `content-generator-daily` | 1 vez por día | 06:00 |
| `content-analyzer-daily` | 1 vez por día | 07:00 |
| `publish-content-every-30-min` | cada 30 min | — |

El secreto interno (`INTERNAL_FUNCTIONS_SECRET`) se guarda en Supabase
Vault y el cron lo lee de ahí — nunca quedó en texto plano en ningún
archivo versionado. **Probado en vivo de verdad**: se disparó manualmente
el mismo `net.http_post` que usa el cron y se confirmó la respuesta real
guardada por Postgres (200, `{"ok":true,"action":"waiting_approval",...}`).

## ANTHROPIC_API_KEY — activado y verificado (20/09/2026)

Cuenta creada por Simón, USD 5 de crédito, recarga automática apagada a
propósito. Key guardada como secret de Supabase (nunca en git). Antes de
usarla de verdad se probó, en este orden:

1. **Enforcement del presupuesto con la key YA configurada**: se insertó
   un gasto simulado de USD 2.00 (el límite exacto) en `ai_usage_log` y
   se llamó a `content-generator` real — respondió `blocked` sin llegar a
   tocar la API de Anthropic. Se borró el gasto simulado.
2. **Generación real de prueba**: se detectó y corrigió un bug real en el
   camino (Claude devolvía el JSON envuelto en \`\`\`json, y el parser no
   lo esperaba — se agregó `slugify()` para los slugs, que además traían
   tildes/espacios sin sanitizar, y se reforzó el prompt para que el CTA y
   el `keyword` de cada pieza sean siempre consistentes entre sí). Tras el
   fix, 3 corridas reales, 11 piezas generadas, 0 rechazadas por las
   reglas de variedad. Costo real total: **USD 0.0276** (modelo
   `claude-haiku-4-5-20251001`, ~17-19 segundos por corrida).
3. Cola actual: **30 piezas**, cubriendo **8 días** (por encima del
   mínimo de 7).

El cron diario (`content-generator-daily`, 06:00 Mendoza, activado en el
Bloque 5) ya va a generar solo, de verdad, la próxima vez que la cola baje
de 7 días — no hace falta ninguna acción extra para "activarlo".

## Lo que falta para publicar de verdad (y quién lo decide)

1. **Permiso `instagram_business_content_publish` + App Review aprobado**
   (o, más rápido: probar si Standard Access ya alcanza para publicar en
   la propia cuenta — ver `docs/checklist-app-review.md`) para que
   `publish-content` deje de estar bloqueado en los 4 formatos.
2. Cuando eso esté resuelto, cambiar `content_config.auto_publish` a
   `true` es la única acción necesaria para habilitar la publicación
   automática — y solo publicará lo que ya esté en estado `programado`.

## Asset generado automáticamente

`assets/generated/story-template-brand.png`: fondo vertical 1080x1920 con
degradé de los colores de marca, generado por código (sin herramientas
pagas). Las 14 piezas de story ya apuntan a este asset en `asset_ref`.
Es un fondo reutilizable, no un asset final con texto — el texto
(hook/CTA) se agrega con el editor nativo de historias de Instagram al
momento de publicar, usando el copy que ya está en `content_pieces`.
