# Federada Inbound Engine — Estado final (modo autónomo, 20/09/2026)

Generado al cierre de una sesión de trabajo autónomo explícitamente autorizada por Simón. Evidencia real, no simulada — cada afirmación de "funciona" tiene un link, un ID o un log real detrás.

## Resumen

El sistema **genera, renderiza, publica, mide y analiza** contenido de forma automatizada, con dos piezas reales ya publicadas en Instagram. La generación de assets (posts/carruseles/Stories) ya corre 100% en GitHub Actions, **confirmado con dos corridas reales y programadas, sin ningún proceso local** (Simón podría apagar su Mac ahora mismo y esas corridas seguirían solas). Los Reels son la única excepción: el código es el mismo y funciona (probado localmente con la key real), pero en la nube el secret `ELEVENLABS_API_KEY` está mal cargado — arreglarlo es una acción de un minuto que solo Simón puede hacer. `AUTO_PUBLISH` sigue en `false`: falta esa única pieza para que la condición que el propio Simón puso ("todo corriendo en la nube") sea 100% cierta.

## Qué funciona hoy, probado de verdad

| Pieza | Estado | Evidencia |
|---|---|---|
| Generación de guion/copy (Anthropic) | ✅ cloud, cron diario | `content-generator`, corre sola hace días |
| Render de posts/carruseles/Stories | ✅ cloud, confirmado headless | 2 corridas reales y programadas de GitHub Actions (runs `35539187266`, `35540596353`), sin ningún proceso local — 4 Stories renderizadas y subidas a Storage ahí mismo, URLs públicas verificadas (200 sin auth) |
| Render de Reels (voz+música+ducking) | 🟡 cloud bloqueado por 1 secret | Funciona localmente con la key real; en GitHub Actions falla por `ELEVENLABS_API_KEY` mal cargado |
| Storage de assets | ✅ cloud | Bucket `content-assets`, URLs públicas verificadas (200 sin auth) |
| Publicación en Instagram | ✅ cloud, probado en vivo 2 veces | Post real + Reel real, ambos públicos |
| Medición de resultados | ✅ cloud, cron cada 2h | `content-metrics-sync` |
| Análisis / feedback loop | ✅ cloud, cron diario | `content-analyzer`, guardrail anti-conclusiones-apuradas ya probado |
| Failsafe de auto-publicación | ✅ implementado, no ejercido en vivo | 3 fallos seguidos apagan `auto_publish` solos + Telegram |
| Failsafe de render | ✅ implementado y ejercido en vivo | Reintentos acotados + `render_failed` + Telegram |

## Publicaciones reales

- Post: [instagram.com/p/Ddg2QaxlFgK](https://www.instagram.com/p/Ddg2QaxlFgK/)
- Reel: [instagram.com/reel/DdhZLRJCmbj](https://www.instagram.com/reel/DdhZLRJCmbj/)

## Bugs reales encontrados y corregidos en esta sesión

1. `publish-content` leía `INSTAGRAM_BUSINESS_USER_ID` (variable que nunca existió) en vez de `INSTAGRAM_BUSINESS_ACCOUNT_ID` — nunca se había notado porque `auto_publish` siempre estuvo en `false`.
2. El publicador usaba `piece.cta` (el llamado a la acción corto) como caption real de Instagram, en vez de `piece.script`.
3. **Bug sistémico**: el prompt de `content-generator` nunca aclaraba que `script` debía ser la caption publicable — salía como nota de producción en tercera persona ("Contar un caso típico..."). Corregido en el prompt (ya desplegado) y a mano en las 12 piezas ya afectadas.
4. Secret `SUPABASE_URL` cargado en GitHub con basura de más (salto de línea + texto pegado por error) — el código ahora sanea cualquier secret quedándose con el primer bloque sin espacios/control-chars, sin importar dónde esté la basura.
5. `render_post` (usado por posts y Stories) reventaba si `subcta_text` era `None` — corregido.

## Qué necesita Simón (acción física, nadie más puede hacerla)

**Una sola cosa bloquea la autonomía completa**: el secret `ELEVENLABS_API_KEY` en GitHub Actions no tiene el valor correcto (confirmado: la misma key funciona perfecto contra la API real desde acá). Sin poder leer o escribir secrets de GitHub por API, no hay forma de corregirlo sin que Simón entre a:

`github.com/simonhaddadfederada/federada-inbound-engine/settings/secrets/actions` → editar `ELEVENLABS_API_KEY` → pegar el valor real (está en su `.env` local, variable `ELEVENLABS_API_KEY`).

Una vez hecho eso, los Reels se renderizan solos en la nube igual que los demás formatos — no hace falta ningún otro cambio de código.

## Contenido real generado y listo para revisión

12 piezas pasaron por el pipeline completo (render real + caption real) y quedaron en estado `listo`, esperando que Simón las revise y las programe: 2 posts, 3 carruseles, 6 Stories, 1 Reel. Todas usan hooks/CTAs ya aprobados anteriormente — ningún dato nuevo inventado. 4 Stories más quedaron a propósito en `render_pendiente` (sin procesar a mano) para que las tome la primera corrida real de GitHub Actions.

## Por qué AUTO_PUBLISH sigue en false

Simón autorizó activarlo "si y solo si" todo corre en la nube. Hoy eso no es 100% cierto: el render de Reels específicamente depende de que se corrija el secret de ElevenLabs. Apenas esa corrección esté hecha y una corrida real de GitHub Actions confirme un Reel renderizado sin la Mac, activarlo es una decisión de una sola línea (`content_config.auto_publish = true`) — el failsafe (3 fallos seguidos lo apaga solo) ya está listo para ese momento.

## Alcance no perseguido a propósito (evita perfeccionismo infinito)

- **Imágenes fotorrealistas / personas / escenas**: no se contrató ningún servicio de generación de imágenes con IA (hubiera sido un gasto nuevo, no autorizado). Se mejoró en cambio el sistema de diseño programático (Pillow): 2 nuevos tipos de slide de carrusel (`stat`, `comparison`) para variedad editorial real. Si en el futuro se quiere subir la producción visual con fotos/ilustraciones reales, la opción más simple sería una API de generación de imágenes (~USD 10-20/mes según volumen) — no evaluada en detalle porque implica gasto nuevo.
- **Automatizar "guion → beats" para Reels**: hoy cada Reel se arma con un `render_spec` (beats/CTA/música) escrito a mano a partir del hook/script/CTA ya aprobado — igual que se venía haciendo desde el principio. Automatizar ese paso con otra llamada a Claude es el siguiente salto real de autonomía, no se apuró acá.
- **Cadencia/config**: los valores de `content_config` (1 reel/día, 2 stories/día, 2 carruseles y posts/semana) ya eran razonables — no se tocaron sin motivo.
