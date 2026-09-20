# Federada Inbound Engine — Estado final (20/09/2026)

Evidencia real, no simulada — cada afirmación de "funciona" tiene un link, un run ID o un log real detrás.

## Resumen

El sistema **genera, renderiza, publica, mide y analiza** contenido de forma automatizada. Los 4 formatos (posts, carruseles, Stories, Reels) se renderizan 100% en GitHub Actions — **confirmado con corridas reales y programadas, sin ningún proceso local**, incluyendo Reels con voz Melanie, música y ducking, y con el paso "guion → beats" ahora automático (antes manual). Falta un solo interruptor para que el sistema publique y reintente contenido sin supervisión: `AUTO_PUBLISH=true`, que el sandbox de Claude Code bloqueó ejecutar directamente — queda en `scripts/activate_auto_publish.py`, listo para que Simón lo corra.

## Qué funciona hoy, probado de verdad

| Pieza | Estado | Evidencia |
|---|---|---|
| Generación de guion/copy (Anthropic) | ✅ cloud, cron diario | `content-generator` |
| Guion → beats automático (Reels) | ✅ cloud, confirmado headless | `auto_beats.py`, generado en vivo para `reel-afiliacion-tardanza-8b695496` dentro de la misma corrida de GitHub Actions |
| Render de posts/carruseles/Stories | ✅ cloud, confirmado headless | Runs `35539187266`, `35540596353` — sin ningún proceso local |
| Render de Reels (voz Melanie + música + ducking) | ✅ cloud, confirmado headless | Run `35543626660` (conclusion: success) — 2 Reels reales, 25.4s y 22.5s, subidos a Storage, URLs públicas verificadas (200 sin auth), frames revisados a mano |
| Storage de assets | ✅ cloud | Bucket `content-assets` |
| Publicación en Instagram | ✅ cloud, probado en vivo 2 veces | Post real + Reel real, ambos públicos (ver abajo) |
| Medición de resultados | ✅ cloud, cron cada 2h | `content-metrics-sync` |
| Análisis / feedback loop | ✅ cloud, cron diario | `content-analyzer` |
| Failsafe de auto-publicación | ✅ implementado, no ejercido en vivo | 3 fallos seguidos apagan `auto_publish` solos + Telegram |
| Failsafe de render | ✅ implementado y ejercido en vivo | Reintentos acotados + `render_failed` + Telegram |
| AUTO_PUBLISH=true | ⏳ bloqueado por el sandbox | `scripts/activate_auto_publish.py` listo — lo corre Simón |

## Publicaciones reales

- Post: [instagram.com/p/Ddg2QaxlFgK](https://www.instagram.com/p/Ddg2QaxlFgK/)
- Reel: [instagram.com/reel/DdhZLRJCmbj](https://www.instagram.com/reel/DdhZLRJCmbj/)
- 2 Reels más renderizados 100% en la nube y programados, esperando el switch de `AUTO_PUBLISH` para publicarse solos (uno ya vencido — publicaría en el primer tick del cron apenas se active).

## Bugs reales encontrados y corregidos en esta sesión

1. `publish-content` leía `INSTAGRAM_BUSINESS_USER_ID` (variable que nunca existió) en vez de `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
2. El publicador usaba `piece.cta` (corto) como caption real de Instagram, en vez de `piece.script`.
3. **Bug sistémico**: el prompt de `content-generator` nunca aclaraba que `script` debía ser la caption publicable — salía como nota de producción en tercera persona. Corregido en el prompt y a mano en las piezas ya afectadas.
4. Secret `SUPABASE_URL` cargado en GitHub con basura de más (salto de línea + texto pegado por error) — el código ahora sanea cualquier secret quedándose con el primer bloque sin espacios/control-chars.
5. `render_post` (usado por posts y Stories) reventaba si `subcta_text` era `None`.
6. Secret `ELEVENLABS_API_KEY` mal cargado en GitHub (**corregido por Simón**) — bloqueaba específicamente el render de Reels en la nube.

## Qué necesita Simón ahora mismo (única acción física restante)

Correr un solo script, ya preparado y commiteado:

```bash
python3 /Users/simonhaddad/Desktop/federada-inbound-engine/scripts/activate_auto_publish.py
```

Esto activa `AUTO_PUBLISH=true` (bloqueado para mí por el sandbox — es un cambio de feature flag que activa publicación automática real, la misma categoría de acción que ya requirió que Simón corriera la primera publicación real a mano). Con eso:

- El Reel de prueba `reel-afiliacion-tardanza-8b695496` (guion→beats automático, ya programado con fecha vencida) se publica solo en el próximo tick del cron (cada 30 min) — esa es la prueba real completa pendiente.
- La cadencia real queda activa: 15 piezas más (2 posts, 3 carruseles, 10 Stories, 1 Reel) ya están `programado` y espaciadas en los próximos ~8 días.
- El failsafe (3 fallos seguidos) ya está armado para apagar `auto_publish` solo si algo sale mal.

## Contenido real listo/programado

- **16 piezas** `programado` con fecha futura real y espaciada (2 posts, 3 carruseles, 10 Stories, 1 Reel).
- **1 pieza** `programado` con fecha vencida a propósito (el Reel de validación).
- **6 Reels** y **6 Stories** siguen en `borrador` — contenido de reserva para cuando se consuma la cola actual; no hacía falta tocarlos ahora.

## Alcance no perseguido a propósito (evita perfeccionismo infinito)

- **Imágenes fotorrealistas / personas / escenas**: no se contrató ningún servicio de generación de imágenes con IA (gasto nuevo, no autorizado). Se mejoró el sistema de diseño programático (Pillow) con 2 slides de carrusel nuevas (`stat`, `comparison`). Si se quiere subir la producción visual con fotos reales más adelante, la opción más simple es una API de generación de imágenes (~USD 10-20/mes) — no evaluada en detalle porque implica gasto nuevo.
- **Guion → beats para formatos que no son Reel**: posts/carruseles/Stories siguen usando directamente hook/cta (ya son piezas simples de una sola idea, no necesitan beats).
- **Cadencia/config**: los valores de `content_config` ya eran razonables — no se tocaron sin motivo.
