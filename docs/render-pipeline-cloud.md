# Renderer en la nube (Bloque 16)

Objetivo: separar el sistema en dos partes independientes.

- **RENDERER** (genera assets: posts, carruseles, Reels con voz/música) →
  GitHub Actions.
- **PUBLISHER** (publica en Instagram, mide, analiza) → Supabase, ya
  existente y probado en vivo (Bloque 10/15).

El publicador nunca cambió: sigue siendo `supabase/functions/publish-content`,
gateado por `content_config.auto_publish` (todavía `false`).

## Por qué GitHub Actions y no Railway/Fly.io

| | GitHub Actions | Railway / Fly.io |
|---|---|---|
| Costo real | **USD 0/mes** — el repo es público, y GitHub da minutos **ilimitados y gratis** en runners Linux/Windows/macOS estándar para repos públicos (política real de GitHub, verificado contra `api.github.com/repos/...` → `visibility: public`). Solo un repo privado consume de una cuota mensual. | No es gratis de verdad: Railway requiere plan pago (~USD 5/mes mínimo) una vez agotado el crédito de prueba; Fly.io tiene una asignación gratis chica que hoy no cubre mucho más que una VM mínima 24/7. Estimado real: **USD 5-15/mes**. |
| Complejidad | Baja: un archivo `.yml`, sin Dockerfile, sin gestionar un servidor. Secrets nativos de GitHub (cifrados, nunca en logs). | Media/alta: hay que containerizar, desplegar, y resolver cómo apagarlo cuando no hay trabajo (si no, corre 24/7 y cobra igual). |
| Robustez | Entorno limpio en cada corrida (sin drift), timeout propio configurable, logs 90 días. El cron de GitHub es "best-effort" (puede atrasarse unos minutos bajo carga) — irrelevante para publicar contenido, no para algo con latencia crítica. | Pensado para servicios siempre encendidos / baja latencia — no aporta nada extra para un trabajo batch de un par de minutos, unas pocas veces al día. |
| Límites | Ninguno relevante a nuestro volumen (1-5 renders/día, ~1-3 min cada uno). | Ninguno relevante tampoco, pero ya cobrando. |

**Conclusión real**: para un trabajo batch (no 24/7, no baja latencia) y con
el repo público, GitHub Actions cubre el volumen sin costo — se descarta
Railway/Fly.io sin necesidad de gastar nada, tal como se pidió.

## Confirmado en vivo (20/09/2026)

Dos corridas reales, programadas (`schedule`, no disparadas a mano),
100% headless en un runner `ubuntu-latest` de GitHub Actions —
verificado con el log real de cada una (runs `35539187266` y
`35540596353`, ambas `conclusion: success`): `pip install Pillow
imageio-ffmpeg` alcanza sin instalar nada más (el mismo paquete trae un
binario de ffmpeg precompilado para Linux), el worker reclamó piezas
`render_pendiente` reales, las renderizó y las subió a Supabase Storage
— las URLs públicas devuelven 200 sin autenticación. **Esto prueba que
el render de posts/carruseles/Stories corre sin ninguna computadora
local.** Los Reels específicamente siguen bloqueados en la nube por un
secret de ElevenLabs mal cargado (ver el chat / `FINAL_STATUS.md`) — no
es un problema de la arquitectura, la misma key funciona perfecto desde
un entorno donde está bien cargada.

## Arquitectura

```
content_pieces (status=render_pendiente, render_spec)
        │
        ▼
GitHub Actions (cron */30 min + workflow_dispatch)
  scripts/cloud_render_worker.py
        │  reclama 1 pieza (UPDATE atómico, evita doble render)
        │  ElevenLabs (voz + música) → ffmpeg (mezcla + video)
        ▼
Supabase Storage (bucket "content-assets", público)
        │  video_ref = URL pública
        ▼
content_pieces (status=listo)
        │
        ▼
supabase/functions/publish-content (YA EXISTENTE, sin cambios)
  cron cada 30 min, gateado por auto_publish (sigue en false)
```

`render_spec` (jsonb) trae los beats/cta/música — el mismo formato que ya
usaba `scripts/render_reel_asset.py` a mano. **Lo que todavía NO existe**:
un paso automático que convierta `hook`/`script`/`cta` (el guion en
prosa que ya genera `content-generator`) en ese `render_spec` estructurado
— hoy se arma a mano, igual que se armó cada Reel hasta ahora. Es el
próximo bloque real de trabajo si se quiere autonomía completa; no se
inventó ni se apuró acá.

## Storage: por qué Supabase Storage y no seguir con GitHub Pages

GitHub Pages exigía: generar el asset → `git commit` (con el binario) →
`git push` → esperar el rebuild de Pages → recién ahí la URL queda
pública. Eso es lento, imposible de automatizar bien desde un runner sin
credenciales de escritura al repo, y ensucia el historial de git con
MP4s/PNGs para siempre (nunca se compactan solos).

Supabase Storage: subida directa por API (sin commit), URL pública
instantánea, fácil de limpiar (`DELETE` de un objeto puntual), y
trazable por diseño (`reels/<content_piece_id>.mp4`). Bucket público
porque la Content Publishing API de Meta necesita bajar el `video_url`
sin ninguna credencial — ya era público en GitHub Pages, no es una
regresión de privacidad (`0019_render_pipeline.sql`). RLS: lectura
pública, escritura solo con `service_role` (verificado con un intento
real de escritura con la `anon key`: rechazado con 403).

Los Reels ya publicados siguen sirviendo desde GitHub Pages (no se migró
nada retroactivamente, no hacía falta).

## Triggers: por qué cron + workflow_dispatch (opción C)

- **Cron programado** (`*/30 * * * *`, misma cadencia que
  `publish-content-every-30-min`): cubre la operación normal sin que
  nadie tenga que disparar nada a mano.
- **`workflow_dispatch`**: permite forzar una corrida inmediata (para
  probar, o si Simón carga una pieza urgente) sin esperar hasta 30 min.
- Se descartó un polling más agresivo (cada 1-5 min) por ser innecesario
  para nuestro volumen — sería "polling absurdo" sin ningún beneficio
  real, tal como se pidió evitar.

## Failsafe

- **Reclamo atómico** (`render_started_at`, `0020_render_claim.sql`): un
  solo `UPDATE ... WHERE status='render_pendiente'` — si dos corridas se
  solapan, la segunda no encuentra nada para reclamar. Además,
  `concurrency: render-content` en el workflow evita que dos corridas de
  este mismo workflow arranquen en paralelo.
- **Reintentos acotados**: hasta `MAX_ATTEMPTS=3` corridas (una por cada
  vez que el cron pasa), incrementando `render_attempts` y guardando
  `last_render_error` real (nunca inventado).
- **`render_failed`**: al agotar los reintentos, la pieza pasa a este
  estado y se avisa por Telegram — **nunca** vuelve a intentarse sola, ni
  queda en un estado ambiguo.
- **Nunca publicar con asset incompleto**: `video_ref` y `status=listo`
  se escriben juntos, en el mismo `PATCH` — no hay ningún estado
  intermedio donde una pieza tenga `status=listo` sin su video real. Y
  `publish-content` solo mira piezas `programado` (no `listo` ni
  `render_pendiente`), así que una pieza sin renderizar nunca puede
  publicarse por accidente — sigue haciendo falta el paso humano de
  aprobar y programar.

## AUTO_PUBLISH

Sigue en `false`. Con este bloque, la generación de contenido YA puede
correr sin la Mac — pero la conversión guion→beats todavía es manual, así
que `AUTO_PUBLISH` no se activa todavía (ver cierre en el chat para el
detalle exacto de qué falta).
