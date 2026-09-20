# Lista de tareas

Se marca ✅ solo cuando algo fue efectivamente probado, no solo escrito.

## Seguridad
- [x] **RLS activado en las 4 tablas** (`supabase/migrations/0002_enable_rls.sql`) — se detectó que la clave pública podía leer y escribir libremente (nombres y teléfonos incluidos) porque la migración inicial nunca activó Row Level Security. Verificado antes y después del fix con inserciones/lecturas reales: antes la clave pública leía todo, ahora devuelve vacío y rechaza inserciones (`42501`); la clave secreta y las Edge Functions siguen funcionando exactamente igual (probado con el formulario real después del cambio).

## Máquina de leads inbound — nuevo foco (20/09/2026)
- [x] **Bloque 1: captura de lead de fricción mínima** — landing rediseñada como flujo de 3 pasos (edad, cobertura actual, WhatsApp obligatorio), scoring rediseñado para medir intención en vez de cantidad de formulario completado (ver `docs/scoring.md`). 36 tests automáticos. Probado de punta a punta **tres veces**: contra la función desplegada por curl, simulando taps reales en el navegador local, y desde la URL pública de producción — en los tres casos: lead guardado con score 80/`contactar_ahora` y alerta de Telegram confirmada por el usuario. Datos de prueba borrados en cada caso.
- [x] **Bloque 2: motor de contenido V1** — tabla `content_pieces` (`supabase/migrations/0004_content_pieces.sql`) con formato, hook, guion, CTA, palabra clave, audiencia, hipótesis, fecha sugerida, estado (borrador/aprobado/publicado/descartado) y columnas de métricas para cargar después. Primera tanda real insertada y verificada por API: 3 reels, 2 carruseles, 5 stories, 2 posts = 12 piezas, todas en estado `borrador` a la espera de que Simón las revise y apruebe. Cada pieza apunta a un problema/duda real (aportes, monotributo, cartilla, mitos de precio, grupo familiar) con una palabra clave de captura (APORTES/PLAN/CARTILLA/INFO), no contenido genérico. **Bug de seguridad encontrado y corregido en el momento**: la tabla se creó sin RLS y la clave pública podía escribir filas libremente (verificado con una inserción real, código 201); se cerró con `0005_rls_content_pieces.sql` y se confirmó después que la clave pública ya no puede leer ni escribir, mientras que las Edge Functions (service role) siguen funcionando igual.
- [ ] Meta Lead Ads: diseño del formulario corto + infraestructura de webhook (análisis prioritario, sin pautar)
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
