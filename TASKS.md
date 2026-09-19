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
- [ ] Edge Function desplegada en el proyecto real
- [ ] Landing page publicada en GitHub Pages
- [ ] **Prueba end-to-end real**: enviar el formulario de verdad y confirmar
      que (a) el lead aparece en la tabla `leads` con el score correcto,
      (b) si corresponde, llega la alerta de Telegram

## Fase 2 — Canales de Meta
- [ ] Cuenta de Meta Business verificada
- [ ] App de Meta for Developers creada
- [ ] Webhook de Instagram (DM + comentarios con palabra clave)
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
