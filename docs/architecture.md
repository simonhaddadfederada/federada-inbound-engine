# Arquitectura completa

## Principios

1. **Event-driven**: cada componente se despierta por un webhook o un cron,
   hace su trabajo, y termina. No hay ningún proceso corriendo en loop
   consumiendo tokens de IA ni recursos de servidor.
2. **Determinístico antes que IA**: si una decisión se puede tomar con una
   regla fija (¿dejó el teléfono? ¿contestó 3 preguntas?), se toma con una
   regla fija. La IA se reserva para tareas que de verdad la necesitan:
   redactar, clasificar texto libre ambiguo, resumir.
3. **Consentimiento explícito**: no se guarda teléfono ni se avanza la
   conversación sin que la persona haya aceptado ser contactada. No se
   pregunta ni se infiere información médica.
4. **Todo en environment variables**: ninguna clave, token o contraseña se
   escribe en el código fuente.

## Fase 1 — Captación propia (lo que se construye primero)

```
┌─────────────────┐      POST (fetch)      ┌───────────────────────────┐
│  Landing page    │ ─────────────────────▶ │ Edge Function             │
│  (HTML estático, │                        │ "intake-landing"          │
│  GitHub Pages)   │                        │                           │
└─────────────────┘                        │ 1. valida payload         │
                                             │ 2. valida consentimiento  │
                                             │ 3. calcula score (regla   │
                                             │    fija, sin IA)          │
                                             │ 4. upsert en tabla leads  │
                                             │ 5. si score = CONTACTAR   │
                                             │    AHORA → Telegram       │
                                             └─────────────┬─────────────┘
                                                            │
                                        ┌───────────────────┴───────────────────┐
                                        ▼                                       ▼
                              Postgres (Supabase)                    Telegram Bot API
                              tabla `leads`                          (tu chat privado)
                              tabla `conversation_state`
                              tabla `events_log` (dedup)
```

Por qué el formulario y no un chat con IA en la Fase 1: un formulario
estructurado consigue exactamente los mismos datos (nombre, localidad,
situación laboral, aporte, individual/familiar, plazo, teléfono) sin
necesitar ningún modelo de lenguaje. Es más barato, más rápido de construir, y 100% predecible. El chat guiado (con botones, no texto libre) llega en la
Fase 2 para Instagram/WhatsApp, donde no existe la opción de un formulario
web.

## Fase 2 — Canales de Meta

Se agregan fuentes de eventos nuevas, todas vía webhook oficial:

- **Instagram**: mensajes directos y comentarios con palabra clave, vía
  Instagram Graph API (Messaging + Comments).
- **Facebook Page**: mensajes de Messenger y comentarios, vía Graph API.
- **Meta Lead Ads**: formulario nativo de Meta, vía Leadgen webhook.
- **WhatsApp Business**: vía WhatsApp Cloud API (oficial de Meta).

Todos estos webhooks llegan a un único endpoint por canal en Supabase Edge
Functions, que:

1. Verifica la firma del webhook (evita eventos falsos).
2. Revisa `events_log` para no procesar el mismo evento dos veces
   (Meta reintenta el envío si no responde rápido).
3. Si es un comentario o mensaje con palabra clave (ej: "APORTES", "PLAN"),
   dispara el mismo flujo de preguntas que la landing page, pero con
   respuestas de botones/quick-replies en vez de un formulario web — sigue
   sin necesitar IA para esto.
4. Si el mensaje es texto libre ambiguo (ej: alguien escribe "hola, cuánto
   sale?"), ahí sí se usa un modelo económico (Haiku) solo para clasificar
   la intención y decidir si conviene iniciar el flujo de preguntas.

## Fase 3 — Motor de contenido

Un cron (ej. una vez por semana) genera un lote de ideas de contenido con
IA, basado en los temas del brief (aportes, monotributo, dependencia,
diferencias obra social/prepaga, errores frecuentes, cartilla, FAQ, casos
prácticos, contenido local de Mendoza). Cada idea sale con:

- Formato sugerido (reel, carrusel, story, post).
- Copy en tono argentino natural.
- Un CTA medible (ej. "Escribime APORTES").

Esto se genera **por lote** (batch), no en tiempo real, y se guarda para tu
revisión antes de publicar (aprobación humana en la Fase 1-3).

## Fase 4 — Analítica y optimización

- Un cron diario arma un resumen corto: qué funcionó, qué no, qué repetir,
  qué probar mañana.
- Un cron semanal arma un análisis estratégico mayor.
- Las métricas de cada pieza (impresiones, alcance, likes, guardados,
  comentarios, DMs, leads, leads calificados, ventas) se cargan vía la
  API de Meta Insights cuando esté disponible, o manualmente al principio.
- Los leads calificados y las ventas pesan más que los likes en cualquier
  priorización.

## Fase 5 — Automatización ampliada por módulos

Cada módulo (auto-responder, auto-publicar, auto-ajustar campañas) se puede
activar o desactivar de forma independiente, y arranca siempre con
aprobación humana obligatoria antes de publicar o gastar. Se habilita
módulo por módulo, nunca todo junto.

## Anti-duplicados y manejo de errores

- Toda tabla de eventos entrantes tiene una restricción `unique` por
  `(canal, id_externo_del_evento)` — si Meta reenvía el mismo webhook, se
  ignora.
- Los leads se identifican por `(canal, id_de_conversación_externo)` para
  poder hacer upsert en vez de duplicar filas.
- Toda función registra errores en su propia tabla de logs; un error en una
  función nunca debe tumbar el resto del sistema (cada webhook es
  independiente).

## Costo de tokens de IA

- No se manda el historial completo de la conversación a la IA. Cada lead
  guarda su `conversation_state` como datos estructurados (JSON), no como
  texto de chat.
- Clasificación simple → modelo económico (Haiku).
- Generación de contenido/estrategia → modelo más capaz, pero en batch, no
  por cada mensaje.
- Tope de gasto diario configurable (ver `.env.example`,
  `AI_DAILY_BUDGET_USD`) — cuando se implemente la Fase 3, la función que
  llama a la IA revisa el gasto acumulado del día antes de cada llamada.
