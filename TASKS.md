# Lista de tareas

Se marca ✅ solo cuando algo fue efectivamente probado, no solo escrito.

## Seguridad
- [x] **RLS activado en las 4 tablas** (`supabase/migrations/0002_enable_rls.sql`) — se detectó que la clave pública podía leer y escribir libremente (nombres y teléfonos incluidos) porque la migración inicial nunca activó Row Level Security. Verificado antes y después del fix con inserciones/lecturas reales: antes la clave pública leía todo, ahora devuelve vacío y rechaza inserciones (`42501`); la clave secreta y las Edge Functions siguen funcionando exactamente igual (probado con el formulario real después del cambio).

## Máquina de leads inbound — nuevo foco (20/09/2026)
- [x] **Bloque 1: captura de lead de fricción mínima** — landing rediseñada como flujo de 3 pasos (edad, cobertura actual, WhatsApp obligatorio), scoring rediseñado para medir intención en vez de cantidad de formulario completado (ver `docs/scoring.md`). 36 tests automáticos. Probado de punta a punta **tres veces**: contra la función desplegada por curl, simulando taps reales en el navegador local, y desde la URL pública de producción — en los tres casos: lead guardado con score 80/`contactar_ahora` y alerta de Telegram confirmada por el usuario. Datos de prueba borrados en cada caso.
- [x] **Bloque 2: motor de contenido V1** — tabla `content_pieces` (`supabase/migrations/0004_content_pieces.sql`) con formato, hook, guion, CTA, palabra clave, audiencia, hipótesis, fecha sugerida, estado (borrador/aprobado/publicado/descartado) y columnas de métricas para cargar después. Primera tanda real insertada y verificada por API: 3 reels, 2 carruseles, 5 stories, 2 posts = 12 piezas, todas en estado `borrador` a la espera de que Simón las revise y apruebe. Cada pieza apunta a un problema/duda real (aportes, monotributo, cartilla, mitos de precio, grupo familiar) con una palabra clave de captura (APORTES/PLAN/CARTILLA/INFO), no contenido genérico. **Bug de seguridad encontrado y corregido en el momento**: la tabla se creó sin RLS y la clave pública podía escribir filas libremente (verificado con una inserción real, código 201); se cerró con `0005_rls_content_pieces.sql` y se confirmó después que la clave pública ya no puede leer ni escribir, mientras que las Edge Functions (service role) siguen funcionando igual.
- [x] **Bloque 3: Activación V1 (atribución de leads a contenido)** — cada `content_piece` tiene ahora `landing_url` propio (`?source=instagram&content=<slug>`), `channel` y `capture_mechanism`. La landing lee `source`/`content` de la URL de forma invisible (sin agregar pasos) y los manda a `intake-landing`, que resuelve la pieza por slug y guarda `content_piece_id` + `origin_channel` en el lead (`0006_atribucion_contenido.sql`). La alerta de Telegram ahora muestra `Origen` y `Contenido` (formato + hook) + `CTA` cuando el lead viene atribuido, sin ensuciarse cuando no. Las 5 piezas de story se adaptaron para usar el link directo (mecanismo de mayor conversión, sin pasar por DM); las 7 piezas de reel/carousel/post mantienen CTA por palabra clave ya que Instagram no permite links clickeables en esos formatos — Simón comparte el `landing_url` manualmente cuando le escriben. Revisión humana: sin dashboard nuevo, se usa la tabla `content_pieces` directo en Supabase Table Editor (`docs/revision-contenido.md`), con estados borrador/aprobado/publicado/descartado y una columna `published_ref` para guardar la referencia real una vez publicada. 42 tests automáticos (2 nuevos). **Probado de punta a punta de verdad**: request real a la función desplegada con `contentSlug=reel-aportes-dependencia` → lead guardado con `content_piece_id` igual al id real de esa pieza y `origin_channel=instagram` (verificado por API) → alerta de Telegram con Origen/Contenido/CTA **confirmada por Simón**. Datos de prueba borrados después.
- [x] **Bloque 4: Motor de marketing V1** — capacidades reales de Meta verificadas contra documentación oficial (`docs/capacidades-meta.md`): publicar cualquier formato requiere `instagram_business_content_publish` + App Review, hoy no lo tenemos. Se agregó `content_config` (cadencia editable sin tocar código: reels/día, stories/día, carruseles y posts por semana, horarios, `auto_publish`, presupuesto diario de IA), `ai_usage_log` + `_shared/ai_budget.ts` (enforcement real del presupuesto antes de cualquier llamado a IA autónomo), `_shared/novelty.ts` (anti-repetición de hooks/temas/CTA), `_shared/scheduling.ts` (horarios reales en America/Argentina/Mendoza), pipeline de estados completo (`borrador→listo→programado→publicado→medido→ganador/normal/perdedor`), `parent_content_piece_id` (familias de contenido), vista `content_performance` (leads por contenido calculado en vivo desde la atribución real, no a mano). 3 funciones nuevas desplegadas y **probadas en vivo**: `content-generator` (bloqueado de forma segura sin `ANTHROPIC_API_KEY`, confirmado con cola vacía y con cola llena), `content-analyzer` (confirma que faltan datos con 0 piezas publicadas), `publish-content` (con `auto_publish=false` nunca publica, confirmado). Adapters de Instagram (`_shared/publishers/instagram.ts`) construidos y en estado `blocked` con el motivo exacto. Se generó un asset real (fondo de story 1080x1920 con degradé de marca, sin herramientas pagas) aplicado a las 14 piezas de story. Cola ampliada de 12 a **25 piezas reales** (7 reels, 14 stories, 2 carruseles, 2 posts) cubriendo genuinamente 7 días, con 2 piezas demostrando el mecanismo de "familia de contenido" (`parent_content_piece_id`). 60 tests automáticos (18 nuevos). RLS verificado en las 3 tablas nuevas. Pendiente y a cargo de Simón: decidir `ANTHROPIC_API_KEY`/presupuesto real, decidir si activar Cron de Supabase, y completar el App Review de Meta para desbloquear publicación real.
- [x] **Bloque 5: Desbloqueo + Adquisición** —
  - **Objetivo 2 (automatización 24/7)**: verificado que `pg_cron`/`pg_net` están disponibles en el plan actual (no una feature paga aparte). Activados 3 cron jobs reales en la nube: `content-generator-daily` (06:00 Mendoza), `content-analyzer-daily` (07:00 Mendoza), `publish-content-every-30-min`. Secreto interno guardado en Supabase Vault, nunca en texto plano en git. **Probado en vivo**: se disparó manualmente el mismo `net.http_post` que usa el cron y se confirmó la respuesta real (200, `waiting_approval`) guardada por Postgres.
  - **Objetivo 3 (Meta App Review)**: checklist operativo completo en `docs/checklist-app-review.md`, con los 3 videos, textos y URLs ya preparados. Se identificó (a confirmar con Simón) que "Standard Access" podría permitir publicar/leer insights en la propia cuenta SIN esperar App Review — instrucciones de 10 minutos para probarlo.
  - **Objetivo 4 (Meta Lead Ads V1)**: formulario de fricción mínima diseñado (`docs/meta-lead-ads.md`), migración `0010_meta_ads_atribucion.sql` (campaign_id/adset_id/ad_id/form_id), Edge Function `meta-leadgen-webhook` desplegada. **Bug real encontrado y corregido**: la función se desplegó primero con verificación JWT activada, lo que hubiera bloqueado silenciosamente todos los webhooks reales de Meta (que no mandan credenciales de Supabase) — se corrigió con `--no-verify-jwt`, igual que `instagram-webhook`. Probado 🟡 con un payload simulado firmado de forma independiente: firma inválida rechazada, lead guardado con atribución real del anuncio, degradación correcta sin `META_PAGE_ACCESS_TOKEN` (guarda la atribución igual, avisa que hay que revisar a mano), duplicados ignorados, alerta de Telegram con la línea "Anuncio: ..." confirmada por Simón.
  - **Deuda técnica marcada**: hoy Simón tiene que responder manualmente por DM el link cuando alguien comenta/escribe la palabra clave en un reel/post/carrusel (Bloque 3). Se preparó el adapter bloqueado `_shared/autoresponder/instagram.ts` (`replyWithLandingLink`) para automatizar esa respuesta apenas `instagram_business_manage_messages` esté aprobado para enviar, no solo recibir.
  - 70 tests automáticos (10 nuevos). Objetivo 1 (Claude API) quedó en propuesta, sin gasto ni cuenta creada — pendiente de autorización de Simón.
- [ ] WhatsApp Business Cloud API como canal de conversación (futuro cercano)
- [ ] Flujo guiado por botones para Instagram (máx. 2-3 preguntas) una vez que Meta apruebe el acceso

## Fase 0 — Fundaciones
- [x] Estructura del repositorio
- [x] README completo
- [x] `.env.example`
- [x] Documentación de arquitectura, cuentas y costos
- [ ] Cuenta de GitHub creada y repo subido (a cargo del usuario)

## Fase 1 — Captación propia (formulario → lead → score → alerta)
- [x] Esquema de base de datos (`supabase/migrations/0001_init.sql`)
- [x] Lógica de puntaje (`scoring.ts`) + tests automáticos
- [x] Landing page con formulario (`landing/index.html`)
- [x] Edge Function `intake-landing` (recibe el formulario, guarda el lead, calcula score)
- [x] Helper de Telegram para notificaciones
- [x] Cuenta de Supabase creada por el usuario
- [x] Bot de Telegram creado por el usuario — probado, el mensaje de prueba llegó ✅
- [x] Migración aplicada en el proyecto real de Supabase — verificado con curl contra las 4 tablas (200 OK) ✅
- [x] Edge Function desplegada en el proyecto real
- [x] Landing page publicada en GitHub Pages — https://simonhaddadfederada.github.io/federada-inbound-engine/ (probado desde la URL real, lead confirmado en la base y limpiado después)
- [x] **Prueba end-to-end real**: lead "Prueba Real" enviado a la función
      desplegada → score 105 → `contactar_ahora` → guardado en `leads`
      (verificado vía REST API) → alerta de Telegram recibida y confirmada
      por el usuario ✅ **Fase 1 funcionando de punta a punta.**

## Fase 2 — Canales de Meta
- [x] Business Manager con Página de Facebook e Instagram vinculados
- [x] App de Meta for Developers creada (`Federada Inbound Engine`, App ID `1113996954538798`)
- [x] Permisos de Instagram agregados (`instagram_business_basic`, `manage_comments`, `manage_messages`)
- [x] Cuenta de Instagram agregada y aceptada como tester
- [x] Webhook de Instagram (comentarios + DM, detección de palabra clave) — código escrito, 15 tests automáticos (firma HMAC + parseo de eventos), desplegado y **probado con un webhook simulado firmado de verdad**: guardó el lead y mandó la alerta de Telegram
- [x] Webhook verificado y registrado en Meta (handshake ✓, campos `comments` y `messages` suscritos)
- [ ] **Bloqueado por Meta, no por nosotros**: la app está "Sin publicar" y necesita pasar el **App Review** de Meta (2-4 semanas) para recibir eventos reales de personas que no sean testers — ver [`docs/setup-fase-2.md`](docs/setup-fase-2.md). Confirmado con una prueba real: un comentario desde otra cuenta no generó ningún evento, tal como advierte Meta.
- [x] Política de privacidad e instrucciones de eliminación de datos publicadas (`privacidad.html`) y cargadas en la configuración de la app
- [x] Solicitud de App Review creada (`submission_id 1114055364532957`), textos de "Uso permitido" y "Gestión de datos" completos
- [ ] Verificación del negocio en Business Manager — **a cargo del usuario**, necesita datos legales reales
- [ ] Grabar los 3 videos de demostración (uno por permiso) — **a cargo del usuario**, instrucciones exactas en `docs/setup-fase-2.md`
- [ ] Cargar los videos y enviar la solicitud de App Review
- [ ] Webhook de Facebook Messenger
- [ ] Webhook de Meta Lead Ads
- [ ] WhatsApp Business Cloud API conectado
- [ ] Flujo de preguntas por botones/quick-replies (sin IA) para estos canales
- [ ] Clasificador liviano con IA solo para mensajes de texto libre ambiguo

## Fase 3 — Motor de contenido
- [ ] Cron semanal de generación de ideas de contenido (batch, con IA)
- [ ] Plantilla de cada idea: formato, copy, CTA medible
- [ ] Panel/tabla de revisión y aprobación humana antes de publicar
- [ ] Integración de API de Anthropic con tope de gasto diario

## Fase 4 — Analítica y optimización
- [ ] Tabla de métricas por pieza de contenido
- [ ] Carga de métricas (manual al inicio, luego vía API de Meta Insights)
- [ ] Cron diario: resumen de qué funcionó / qué no / qué probar
- [ ] Cron semanal: análisis estratégico mayor
- [ ] Priorización de leads calificados y ventas por encima de likes

## Fase 5 — Automatización ampliada
- [ ] Feature flags por módulo (auto-responder, auto-publicar, etc.)
- [ ] Aprobación humana configurable por módulo
- [ ] Panel de control simple para activar/desactivar módulos
