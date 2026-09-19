# Federada Inbound Engine

Sistema de captación y calificación de leads **inbound** para un asesor comercial
de Federada Salud (Mendoza, Argentina).

## Qué es esto (y qué NO es)

- **NO** es un cotizador automático ni reemplaza la conversación de venta.
- **SÍ** es un sistema que detecta interés voluntario (alguien escribió, comentó
  una palabra clave, llenó un formulario) y hace un primer filtro de preguntas
  para llegar a vos ya con la información básica y un puntaje de qué tan
  caliente está el lead. Vos tomás la conversación de venta a partir de ahí.

## Principio de diseño: event-driven, no loops

Nada de este sistema queda "corriendo" esperando. Todo se dispara por:

- **Webhooks**: alguien manda un mensaje, comenta o llena un formulario → se
  ejecuta una función, hace su trabajo, y termina.
- **Cron jobs**: solo para tareas que de verdad son periódicas (el resumen
  diario, el análisis semanal). Nada de sondeos (polling) innecesarios.
- **Reglas determinísticas primero**: el cálculo del puntaje de un lead es
  aritmética simple y documentada, no una decisión de IA. Es gratis,
  predecible y se puede explicar en una frase.
- **IA solo donde agrega valor real**: redactar contenido, interpretar texto
  libre ambiguo, resumir el desempeño de la semana. Nunca para decidir si
  alguien es "caliente" — eso lo decide el puntaje.

## Arquitectura (Fase 1)

```
Persona llena el formulario (landing page, HTML estático)
        │  fetch POST
        ▼
Supabase Edge Function "intake-landing"
        │  1. valida los datos y el consentimiento
        │  2. calcula el score (reglas fijas, sin IA)
        │  3. guarda/actualiza el lead en Postgres
        │  4. si score = CONTACTAR AHORA → notifica por Telegram
        ▼
Tabla `leads` en Supabase (Postgres)        Telegram (tu chat privado con el bot)
```

Ver el diagrama y la explicación completa de todas las fases en
[`docs/architecture.md`](docs/architecture.md).

## Fases del proyecto

| Fase | Objetivo | Estado |
|---|---|---|
| 1 | Formulario propio → lead → preguntas → score → alerta Telegram | 🔨 en construcción |
| 2 | Instagram DM, comentarios con palabra clave, Facebook, WhatsApp Business, Meta Lead Ads | ⏳ pendiente |
| 3 | Motor de contenido (ideas + CTAs medibles) | ⏳ pendiente |
| 4 | Métricas por pieza, reporte diario y semanal automático | ⏳ pendiente |
| 5 | Automatización ampliada por módulos, con aprobación humana configurable | ⏳ pendiente |

Detalle de tareas en [`TASKS.md`](TASKS.md).

## Stack y por qué se eligió cada pieza

Ver el detalle completo y las alternativas consideradas en
[`docs/architecture.md`](docs/architecture.md). Resumen:

- **Supabase** (Postgres + Edge Functions + cron): base de datos y lógica en
  un solo lugar, tier gratis generoso, vista tipo planilla para editar leads
  a mano sin saber SQL.
- **GitHub Pages**: hosting gratis de la landing page (HTML estático, sin build).
- **Telegram Bot**: alertas instantáneas y gratis cuando aparece un lead
  "CONTACTAR AHORA", sin depender de la aprobación de Meta.
- **API de Claude (Anthropic)**: solo a partir de la Fase 3, para generación
  de contenido y clasificación de texto libre. Pago por uso con tope diario.
- **Meta Graph API / WhatsApp Cloud API**: única vía permitida para
  Instagram, Facebook y WhatsApp — nunca scraping. Fase 2.

## Cuentas y permisos necesarios

Ver [`docs/accounts-and-apis.md`](docs/accounts-and-apis.md) para el paso a
paso de cada cuenta, qué es gratis y qué tiene costo.

## Estructura del repositorio

```
federada-inbound-engine/
├── README.md                    este archivo
├── TASKS.md                     lista de tareas por fase
├── .env.example                 variables de entorno necesarias (nunca poner claves reales acá)
├── index.html                    landing page con el formulario (raíz, para GitHub Pages)
├── docs/
│   ├── architecture.md          arquitectura completa y diagramas
│   ├── accounts-and-apis.md     cuentas, permisos, paso a paso
│   ├── costs.md                 qué es gratis, qué tiene costo, límites
│   ├── scoring.md                cómo funciona el puntaje de leads
│   └── setup-fase-1.md           guía paso a paso de despliegue
└── supabase/
    ├── migrations/               esquema de la base de datos (SQL)
    └── functions/
        ├── _shared/              lógica compartida (score, tipos, telegram)
        │   ├── scoring.ts / scoring.test.ts
        │   ├── intake.ts / intake.test.ts
        │   ├── telegram.ts / telegram.test.ts
        │   └── types.ts
        └── intake-landing/       función que recibe el formulario
            └── index.ts
```

## Cómo se prueba

Cada componente se prueba antes de pasar al siguiente:

1. **Lógica de puntaje**: tests automáticos con Deno (`deno test`), sin
   depender de ninguna cuenta externa.
2. **Función de captación end-to-end**: una vez que crees tu proyecto de
   Supabase y tu bot de Telegram (ver `docs/accounts-and-apis.md`), probamos
   juntos con un envío real desde la landing page y verificamos que:
   - el lead aparece en la tabla `leads`,
   - el score calculado es el esperado,
   - si corresponde, te llega el mensaje de Telegram.

No se da nada por "andando" sin haberlo visto funcionar de verdad.

Guía paso a paso para desplegar la Fase 1 en tu propia cuenta de Supabase y
tu bot de Telegram: [`docs/setup-fase-1.md`](docs/setup-fase-1.md).

## Variables de entorno

Ver [`.env.example`](.env.example). Ninguna clave se guarda en el código:
todo se configura como *environment variable* o *secret* de Supabase.
