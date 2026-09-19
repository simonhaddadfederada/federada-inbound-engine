# Cuentas, APIs y permisos

Ninguna de estas cuentas la puedo crear yo por vos — son cuentas personales
o de tu negocio y algunas piden verificación de identidad. Te dejo el paso a
paso de cada una. Cuando la tengas creada, avisame y seguimos con la
configuración técnica juntos.

## Necesarias para la Fase 1 (todas gratis)

### 1. GitHub
- Para qué: guardar el código con historial de cambios, y hostear la
  landing page gratis con GitHub Pages.
- Paso a paso: crear cuenta en github.com → crear un repositorio privado
  o público llamado `federada-inbound-engine`.
- Costo: **$0**.

### 2. Supabase
- Para qué: base de datos (tabla de leads) y las funciones que procesan
  cada evento.
- Paso a paso: crear cuenta en supabase.com (podés entrar con tu cuenta de
  GitHub) → "New project" → elegí una contraseña para la base de datos y
  guardala en un lugar seguro (gestor de contraseñas, no en el código) →
  elegí la región más cercana (South America / São Paulo si está
  disponible).
- Datos que vas a necesitar pasarme (como variables de entorno, nunca en el
  chat en texto plano si podés evitarlo — mejor los cargamos directo en la
  configuración de Supabase/GitHub):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` (pública, se usa desde la landing page)
  - `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo la usan las Edge Functions)
- Costo: **$0** en el plan Free (hasta 500MB de base de datos, 2GB de
  transferencia, más que suficiente para empezar). Ojo: un proyecto free
  se "pausa" si pasa una semana sin ningún request — no es un problema una
  vez que el sistema esté recibiendo leads reales, pero puede pasar
  durante las pruebas iniciales si dejamos el proyecto quieto mucho tiempo.

### 3. Telegram (bot para tus alertas)
- Para qué: que te llegue un mensaje instantáneo cuando un lead es
  "CONTACTAR AHORA".
- Paso a paso:
  1. Abrí Telegram y buscá el usuario `@BotFather`.
  2. Mandale `/newbot`, elegí un nombre y un username para tu bot.
  3. Te va a dar un `TELEGRAM_BOT_TOKEN` — guardalo.
  4. Mandale cualquier mensaje a tu bot nuevo desde tu cuenta de Telegram
     (así el bot "sabe" a quién responderte).
  5. Para obtener tu `TELEGRAM_CHAT_ID`, te voy a pasar un comando simple
     para correr una vez que tengas el token.
- Costo: **$0**, sin límites relevantes para este uso.

## Necesarias para la Fase 2 (canales de Meta)

### 4. Meta for Developers + Business Manager
- Para qué: es la puerta de entrada obligatoria para usar la API oficial de
  Instagram, Facebook y WhatsApp. No hay forma de integrarlos sin esto.
- Paso a paso (a alto nivel, te guío en detalle cuando lleguemos a la Fase 2):
  1. Crear cuenta en business.facebook.com (Business Manager) si no la
     tenés.
  2. Verificar tu negocio (Meta puede pedir documentación — puede tardar
     días).
  3. Crear una app en developers.facebook.com, vinculada a tu Business
     Manager.
  4. Vincular tu Página de Facebook y tu cuenta de Instagram profesional/
     creador a esa app.
  5. Pedir los permisos necesarios: `pages_messaging`,
     `instagram_manage_messages`, `instagram_manage_comments`,
     `leads_retrieval` (para Lead Ads), `whatsapp_business_messaging`.
     Algunos permisos requieren "App Review" de Meta (revisión manual).
- Costo: **$0** por el acceso a la API. El único costo real es la pauta
  publicitaria que vos decidas invertir (Meta Ads), que nunca se ejecuta
  sola — este sistema solo lee resultados, no gasta presupuesto por su
  cuenta.

### 5. WhatsApp Business Cloud API
- Para qué: recibir y responder mensajes de WhatsApp de forma automatizada
  y oficial (no es el WhatsApp normal del celu).
- Paso a paso: se habilita dentro de la misma app de Meta for Developers,
  usando un número de teléfono dedicado (puede ser un número nuevo, no el
  que ya usás en WhatsApp personal).
- Costo: Meta cobra por conversación una vez superado un umbral gratuito
  mensual. El precio exacto cambia con el tiempo — antes de activar esto
  te muestro el precio vigente en ese momento para que decidas.

## Necesaria para la Fase 3 (contenido con IA)

### 6. API de Anthropic (Claude)
- Para qué: generar ideas de contenido y clasificar texto libre.
- Paso a paso: crear cuenta en console.anthropic.com → generar una API key
  → cargar una tarjeta con un límite de gasto bajo para empezar.
- Costo: pago por uso (tokens). Te aviso el costo estimado antes de activar
  esta fase, y configuramos un tope diario (`AI_DAILY_BUDGET_USD` en
  `.env.example`).

## Opcional, cualquier momento

### 7. Dominio propio
- Para qué: que la landing page se vea en `www.tudominio.com.ar` en vez de
  `tuusuario.github.io`.
- Costo: aproximadamente USD 10–15 por año. Se puede posponer indefinidamente
  sin que afecte el funcionamiento del sistema.

### 8. Google Search Console + Google Business Profile
- Para qué: SEO local, aparecer en búsquedas de Mendoza.
- Costo: **$0**.
