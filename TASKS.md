# Lista de tareas

Se marca ✅ solo cuando algo fue efectivamente probado, no solo escrito.

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
- [ ] Verificación del negocio en Business Manager (requisito para el App Review)
- [ ] Política de privacidad publicada (requisito para el App Review)
- [ ] Enviar la solicitud de App Review
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
