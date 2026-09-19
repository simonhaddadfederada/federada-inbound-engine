# REPORTE TÉCNICO Y FUNCIONAL COMPLETO — Federada Inbound Engine

Fecha del reporte: 19 de septiembre de 2026.
Generado revisando el repositorio real (código, tests, migraciones, configuración desplegada), no solo la memoria de la conversación.

---

# 1. OBJETIVO GENERAL DEL PROYECTO

Este es un sistema de captación y calificación de leads **inbound** para un asesor comercial independiente de **Federada Salud** (obra social/prepaga) en Mendoza, Argentina, llamado Simón Haddad.

La idea central: cuando una persona muestra interés voluntario (llena un formulario, comenta una palabra clave en Instagram, escribe un mensaje directo), el sistema:
1. Recoge datos básicos de calificación (situación laboral, localidad, intención de plazo, etc.) — **nunca datos médicos**.
2. Calcula un puntaje ("score") con reglas fijas, sin IA, para saber qué tan caliente está el lead.
3. Si el lead es "CONTACTAR AHORA", avisa al asesor por Telegram de inmediato.
4. El asesor toma la conversación de venta personalmente desde ahí — el sistema **no reemplaza la venta ni cotiza automáticamente**.

Principio de diseño explícito: arquitectura **event-driven** (webhooks + funciones que se ejecutan una vez por evento), no un agente corriendo en loop consumiendo tokens de IA. Reglas determinísticas para todo lo que se pueda resolver sin IA; IA reservada para fases futuras (generación de contenido, clasificación de texto ambiguo).

El resultado final buscado es un embudo multicanal (landing propia, Instagram, Facebook, WhatsApp, Meta Ads, Google) que alimenta un CRM simple y un motor de scoring, con reportes de qué contenido funciona y automatización de publicación en fases posteriores.

---

# 2. ESTADO ACTUAL EN UNA FRASE

**Fase 1 (formulario propio → lead → score → alerta) está terminada, desplegada en producción y verificada de punta a punta; Fase 2 (Instagram) tiene todo el código funcionando y probado, pero está bloqueada para recibir tráfico real porque la app de Meta necesita pasar el proceso de "App Review" (verificación de negocio + videos de demostración, ambos pendientes del lado del usuario); las Fases 3, 4 y 5 (contenido con IA, analítica, automatización ampliada) todavía no se empezaron a construir.**

---

# 3. ARQUITECTURA ACTUAL

## Componentes

- **Landing page propia** (`index.html`, HTML/CSS/JS estático, sin build, sin framework) publicada en **GitHub Pages**.
- **Página de política de privacidad** (`privacidad.html`), publicada en el mismo sitio.
- **Backend**: Supabase Edge Functions (runtime Deno), sin servidor propio, sin proceso persistente.
- **Base de datos**: PostgreSQL gestionado por Supabase.
- **Notificaciones**: Telegram Bot API (mensajes push al asesor).
- **Canal adicional (Fase 2)**: Webhooks oficiales de la API de Instagram (Meta), sin scraping.
- **Control de versiones**: GitHub (repositorio público).
- **CLI usadas para desplegar/administrar**: Supabase CLI, `git`.

No hay ningún proceso que corra 24/7 en una computadora ni en un servidor propio. Todo se dispara por eventos HTTP (un webhook de Meta, o un `fetch` desde la landing page) hacia Edge Functions serverless.

## Diagrama de flujo (Fase 1 — formulario)

```
Persona
  ↓ llena el formulario
Landing page (index.html, GitHub Pages)
  ↓ fetch POST (JSON)
Edge Function "intake-landing" (Supabase, Deno)
  ↓ valida consentimiento → calcula score (reglas fijas) → upsert
Tabla "leads" (Postgres, Supabase)
  ↓ si score_band = contactar_ahora
Telegram Bot API → mensaje al asesor
```

## Diagrama de flujo (Fase 2 — Instagram, código listo pero sin tráfico real todavía)

```
Persona comenta o escribe DM a la cuenta de Instagram del negocio
  ↓
Meta envía un webhook (POST firmado con HMAC-SHA256)
  ↓
Edge Function "instagram-webhook" (Supabase, Deno)
  ↓ verifica firma → detecta palabra clave (reglas fijas) → dedup → upsert lead
Tabla "leads" (Postgres, Supabase)
  ↓ SIEMPRE (no solo si es "contactar ahora")
Telegram Bot API → mensaje al asesor con el texto y el usuario de Instagram
```

**Nota importante:** este segundo flujo está construido y probado con webhooks *simulados* (firmados correctamente a mano), pero Meta todavía no envía tráfico real porque la app está en modo "Sin publicar" (ver sección 8 y 19).

## Automatizaciones / cron jobs / agentes

- **No existe ningún cron job todavía.** Los reportes diarios/semanales de la Fase 4 y el motor de contenido de la Fase 3 están solo diseñados en la documentación, no implementados.
- **No existe ningún agente de IA corriendo.** No se usa ningún modelo de IA en el código actual — el scoring, la validación y la detección de palabras clave son 100% reglas fijas en TypeScript.
- Las únicas "automatizaciones" activas hoy son los dos webhooks (event-driven, no en loop).

## Modelos de IA utilizados

**Ninguno todavía.** El proyecto está diseñado para usar la API de Anthropic (Claude) recién en la Fase 3 (generación de contenido) y para clasificación de texto libre ambiguo en canales de mensajería (Fase 2 avanzada). No hay ninguna llamada a un modelo de IA en el código actual.

## Herramientas externas usadas para construir/administrar (no forman parte del producto en producción)

- Deno CLI (para correr tests localmente).
- Supabase CLI (para desplegar funciones, aplicar migraciones, gestionar secrets).
- Un servidor HTTP estático de Python (`python3 -m http.server`), usado solo para previsualizar la landing localmente durante el desarrollo — no se usa en producción.

---

# 4. TECNOLOGÍAS UTILIZADAS

| Categoría | Tecnología | Versión / detalle |
|---|---|---|
| Lenguaje backend | TypeScript | ejecutado sobre Deno |
| Runtime backend | Deno | 2.9.7 (confirmado con `deno --version`) |
| Frontend | HTML + CSS + JavaScript vanilla | sin framework, sin build step |
| Base de datos | PostgreSQL | gestionado por Supabase (versión gestionada por el proveedor, no fijada por el proyecto) |
| Backend-as-a-service | Supabase | Edge Functions + Postgres + Auth (Auth no se usa) |
| Librería cliente DB | `@supabase/supabase-js` | `2.45.4` (importada vía `esm.sh` dentro de las Edge Functions) |
| Testing | `Deno.test` + `https://deno.land/std@0.224.0/assert` | sin framework externo (Jest, Vitest, etc.) |
| CLI de despliegue | Supabase CLI | `2.117.0` |
| Hosting frontend | GitHub Pages | rama `main`, carpeta raíz |
| Control de versiones | Git + GitHub | repositorio: `simonhaddadfederada/federada-inbound-engine` |
| Notificaciones | Telegram Bot API | HTTP directo (`fetch`), sin SDK |
| Mensajería/redes | API de Instagram (Meta Graph API / "Instagram API with Instagram Login") | versión de webhook usada: `v26.0` (vista en el panel de Meta) |
| IA | Ninguna integrada aún | planeada: API de Anthropic (Claude) |
| No hay | Node.js, npm, ningún `package.json` | el proyecto no usa Node en ningún punto — todo corre en Deno |

No hay ningún framework de frontend (React, Vue, etc.) ni backend tradicional (Express, Fastify) — deliberadamente, para mantener todo simple y sin build steps.

---

# 5. ESTRUCTURA DEL PROYECTO

```
federada-inbound-engine/
├── .env                          (real, con secrets, IGNORADO por git)
├── .env.example                  (nombres de variables, sin valores)
├── .gitignore
├── README.md                     documentación general del proyecto
├── TASKS.md                      checklist de tareas por fase, con estado real
├── index.html                    landing page pública con el formulario
├── privacidad.html               política de privacidad + instrucciones de eliminación de datos
├── docs/
│   ├── architecture.md           arquitectura completa y las 5 fases
│   ├── accounts-and-apis.md      qué cuentas crear, paso a paso, qué es gratis
│   ├── costs.md                  desglose de costos por fase
│   ├── scoring.md                explicación en palabras del sistema de puntaje
│   ├── setup-fase-1.md           guía paso a paso de despliegue de la Fase 1
│   ├── setup-fase-2.md           estado y pasos pendientes de la Fase 2 (Instagram)
│   └── reporte-tecnico-2026-09-19.md   este mismo reporte
├── .claude/
│   └── launch.json               config local para previsualizar la landing (no productivo)
└── supabase/
    ├── config.toml               configuración del proyecto Supabase (generado por `supabase init`)
    ├── migrations/
    │   └── 0001_init.sql          esquema completo de la base de datos
    └── functions/
        ├── _shared/               lógica de negocio compartida entre funciones
        │   ├── types.ts               tipos TypeScript compartidos (Lead, canales, etc.)
        │   ├── scoring.ts             cálculo de puntaje (reglas fijas)
        │   ├── scoring.test.ts        6 tests
        │   ├── intake.ts              validación del formulario de landing
        │   ├── intake.test.ts         6 tests
        │   ├── telegram.ts            envío de alertas + formateo de mensajes
        │   ├── telegram.test.ts       8 tests
        │   ├── meta_signature.ts      verificación de firma HMAC de webhooks de Meta
        │   ├── meta_signature.test.ts 5 tests
        │   ├── instagram_events.ts    parseo de payloads de Instagram + detección de keywords
        │   └── instagram_events.test.ts 6 tests
        ├── intake-landing/
        │   └── index.ts           Edge Function que recibe el formulario de la landing
        └── instagram-webhook/
            └── index.ts           Edge Function que recibe webhooks de Instagram
```

## Qué hace cada archivo importante

- **`supabase/functions/_shared/scoring.ts`**: única fuente de verdad del cálculo de puntaje. Exporta `computeScore()`, `SCORE_WEIGHTS`, `SCORE_BANDS`, `bandForScore()`. No depende de nada externo (función pura).
- **`supabase/functions/_shared/intake.ts`**: valida el JSON que manda el formulario (consentimiento obligatorio, al menos nombre o teléfono, valores permitidos), y arma el input para el scoring.
- **`supabase/functions/_shared/telegram.ts`**: envía mensajes vía HTTP a la API de Telegram; incluye `formatLeadAlert()` (alertas de la landing) y `formatInstagramAlert()` (alertas de Instagram), ambas con escape de HTML para evitar que texto de usuarios rompa el formato o inyecte HTML.
- **`supabase/functions/_shared/meta_signature.ts`**: implementa la verificación HMAC-SHA256 que exige Meta para confirmar que un webhook es legítimo, con comparación en tiempo constante (protección contra timing attacks).
- **`supabase/functions/_shared/instagram_events.ts`**: interpreta el payload crudo que manda Meta (comentarios y mensajes directos) y lo normaliza a un formato interno común; detecta palabras clave.
- **`supabase/functions/intake-landing/index.ts`**: Edge Function pública (HTTP), llamada directamente por el `fetch` del formulario. Sin autenticación de usuario (usa la `anon key` pública), pero sí valida el payload.
- **`supabase/functions/instagram-webhook/index.ts`**: Edge Function pública que responde al *handshake* GET de verificación de Meta y procesa los eventos POST reales.
- **`supabase/migrations/0001_init.sql`**: crea las 4 tablas del sistema y los tipos `enum` asociados.

---

# 6. FUNCIONALIDADES QUE YA FUNCIONAN

### 6.1 Formulario de landing → lead → score → alerta
- **Qué hace**: recibe los datos de un formulario web, valida consentimiento, calcula un score con reglas fijas, guarda el lead, y si es "contactar ahora" avisa por Telegram.
- **Cómo se activa**: la persona llena y envía el formulario en `index.html`.
- **Entrada**: JSON con nombre, localidad, situación laboral, aporte aproximado, cobertura individual/familiar, plazo de intención, teléfono (opcional), consentimiento, campaña/post de origen.
- **Salida**: JSON de respuesta con `lead_id`, `score`, `band`, y estado de la notificación; efecto secundario: fila nueva/actualizada en `leads`, y mensaje de Telegram si corresponde.
- **Dónde guarda datos**: tabla `leads` en Postgres (Supabase).
- **✅ FUNCIONA Y FUE PROBADO**: probado tres veces distintas — (1) vía `curl` directo contra la función desplegada, (2) llenando el formulario real en un navegador local, (3) llenando el formulario real desde la URL pública de GitHub Pages. En los tres casos se verificó que el lead apareció en la tabla `leads` con el score correcto y que llegó el mensaje real de Telegram (confirmado por el usuario). Los leads de prueba se borraron después de cada verificación.

### 6.2 Lógica de puntaje (scoring)
- **Qué hace**: suma puntos fijos según señales de intención (ver sección 11).
- **Cómo se activa**: se llama internamente desde `intake-landing` e `instagram-webhook`.
- **✅ FUNCIONA Y FUE PROBADO**: 6 tests automáticos (`scoring.test.ts`) cubriendo cada banda y el límite de respuestas contadas, más verificación manual con los leads reales de la sección 6.1.

### 6.3 Webhook de Instagram (comentarios + DMs)
- **Qué hace**: recibe eventos de Instagram, verifica su firma, detecta palabras clave, evita duplicados, guarda el lead, y **siempre** (no solo si es "contactar ahora") avisa por Telegram.
- **Cómo se activa**: Meta llama a la URL del webhook cuando hay un comentario o DM nuevo en la cuenta de Instagram conectada (@simoonhaddad).
- **Entrada**: JSON firmado que manda Meta (formato "Instagram Graph API webhook").
- **Salida**: JSON con la lista de eventos procesados; efecto secundario: fila en `leads`, fila en `events_log` (dedup), fila en `notifications_log`, mensaje de Telegram.
- **⚠️ IMPLEMENTADO PERO NO VERIFICADO CON TRÁFICO REAL DE META** — la lógica interna sí está ✅ **PROBADA**: se armó un payload idéntico al formato real de Meta, se firmó con HMAC-SHA256 calculado de forma independiente (Python, no con el propio código), y se envió por `curl` contra la función ya desplegada. El resultado fue correcto: firma validada, lead guardado, alerta de Telegram recibida de verdad. También se probó que una firma inválida se rechaza (401) y que un evento repetido no se vuelve a procesar ni notifica dos veces.
  Lo que falta para la verificación 100% real: que Meta mismo entregue un webhook real (bloqueado por el estado "Sin publicar" de la app — ver sección 19).

### 6.4 Verificación de firma HMAC de webhooks
- **✅ FUNCIONA Y FUE PROBADO**: 5 tests automáticos, incluyendo un vector de prueba HMAC-SHA256 calculado de forma completamente independiente con Python (no reutilizando la propia implementación), para evitar una verificación circular.

### 6.5 Detección de palabras clave
- **✅ FUNCIONA Y FUE PROBADO**: 6 tests automáticos cubriendo comentarios, mensajes directos, eventos sin texto (ignorados correctamente) y múltiples eventos en un mismo payload.

### 6.6 Landing page pública
- **✅ FUNCIONA Y FUE PROBADO**: publicada en GitHub Pages, confirmado HTTP 200 en producción, formulario probado end-to-end (ver 6.1). Incluye enlace a la política de privacidad.

### 6.7 Política de privacidad + instrucciones de eliminación de datos
- **✅ FUNCIONA Y FUE PROBADO**: publicada, HTTP 200 confirmado, cargada como URL oficial en la configuración de la app de Meta.

---

# 7. FLUJO COMPLETO ACTUAL

**Canal landing (Fase 1) — flujo completo de punta a punta, verificado:**

1. Una persona entra a `https://simonhaddadfederada.github.io/federada-inbound-engine/` (por ejemplo, desde un link compartido).
2. Llena el formulario (nombre, localidad, situación laboral, etc.) y tilda el consentimiento.
3. El navegador manda un `fetch POST` a la Edge Function `intake-landing`.
4. La función valida los datos, calcula el score con reglas fijas, y guarda/actualiza el lead en la tabla `leads`.
5. Si el score cae en la banda "contactar_ahora", la función manda un mensaje de Telegram al asesor con nombre, localidad, teléfono, situación y plazo.
6. El asesor recibe la notificación en su teléfono y contacta personalmente al lead.

Este flujo llega **de punta a punta** y está confirmado con pruebas reales (no simuladas) en los tres pasos críticos: formulario real → base de datos real → Telegram real.

**Canal Instagram (Fase 2) — flujo construido pero incompleto en producción:**

1. Una persona comentaría una publicación o mandaría un DM a la cuenta de Instagram del negocio.
2. Meta llamaría al webhook `instagram-webhook`.
3. La función verificaría la firma, detectaría palabras clave, guardaría el lead y avisaría por Telegram.

**Este flujo llega hasta el paso 3 solamente en pruebas simuladas.** En la práctica, hoy Meta no envía ningún evento real porque la app sigue en estado "Sin publicar" — se probó explícitamente: una persona comentó "APORTES" en una publicación real desde otra cuenta de Instagram, y no se generó ningún evento en el webhook. Por lo tanto, **no existe hoy un flujo de punta a punta con tráfico real de Instagram** — solo con webhooks simulados (firmados a mano, indistinguibles técnicamente de uno real para la función, pero no disparados por una interacción real de Instagram).

---

# 8. INTEGRACIONES EXTERNAS

### Supabase
- **Para qué se usa**: base de datos Postgres + hosting de las Edge Functions.
- **Estado**: ✅ activo en producción, proyecto real creado por el usuario (plan Free).
- **Autenticación**: configurada vía `SUPABASE_URL`, `SUPABASE_ANON_KEY` (pública, embebida en la landing) y `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo en las Edge Functions).
- **Permisos**: la `service_role key` bypassea RLS por diseño (uso normal en backend). La `anon key` **no tiene ninguna política de RLS restringiéndola** (ver hallazgo de seguridad en sección 19/20 — riesgo real, no teórico).
- **Webhook**: no aplica (Supabase no manda webhooks al sistema, es al revés).
- **Limitación actual**: el proyecto Free se pausa automáticamente tras ~7 días sin ningún request.

### Telegram
- **Para qué se usa**: notificar al asesor en tiempo real.
- **Estado**: ✅ activo y probado con mensajes reales.
- **Autenticación**: token de bot (`TELEGRAM_BOT_TOKEN`) + chat id (`TELEGRAM_CHAT_ID`), ambos guardados como secrets de Supabase y en `.env` local.
- **Permisos**: ninguno especial, es un bot personal.
- **Webhook**: no se usa un webhook de Telegram (solo se envían mensajes salientes vía `sendMessage`, no se reciben).
- **Limitación**: ninguna relevante para este volumen de uso.

### Meta / Instagram
- **Para qué se usa**: recibir comentarios y DMs de la cuenta de Instagram profesional del negocio (@simoonhaddad) vía webhook oficial.
- **Estado**: 🟡 código y configuración técnica completos, pero **bloqueado para tráfico real** — la app sigue en modo desarrollo ("Sin publicar").
- **Autenticación configurada**: sí — app creada en Meta for Developers (App ID visible en `.env`, oculto en este reporte), secreto de la app guardado como secret de Supabase, cuenta de Instagram agregada y aceptada como "tester".
- **Permisos solicitados**: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages` (los tres en estado "Listo para prueba" — acceso estándar, no avanzado).
- **Webhook**: configurado y verificado por Meta (handshake de verificación confirmado, campos `comments` y `messages` suscritos).
- **Limitaciones actuales**:
  - La app se convirtió en "Tech Provider" de Meta (decisión irreversible, aceptada explícitamente por el usuario) para poder solicitar acceso avanzado.
  - Falta completar la **verificación de negocio** (requiere datos legales reales del usuario).
  - Falta grabar **3 videos de demostración** (uno por permiso) para la solicitud de App Review.
  - Hasta que Meta apruebe el acceso avanzado (proceso que declara Meta como de 2 a 4 semanas), solo se reciben eventos de cuentas con rol en la app (los "testers"), no del público general.
- **Facebook Messenger, Meta Lead Ads, WhatsApp Business**: ❌ no implementados todavía (solo mencionados en la documentación de fases futuras).

### GitHub / GitHub Pages
- **Para qué se usa**: control de versiones y hosting gratuito de la landing page + política de privacidad.
- **Estado**: ✅ activo, repositorio público, Pages configurado sobre la rama `main`, carpeta raíz.
- **Autenticación**: se usó un Personal Access Token de grano fino (permiso "Contents: Read and write", acotado a este único repositorio, con expiración) solo durante la sesión de configuración — nunca quedó guardado en el repositorio ni en la configuración de git (`.git/config` solo contiene la URL, sin token).

### Anthropic (Claude API)
- **Estado**: ❌ no integrado todavía. Reservado para la Fase 3.

---

# 9. VARIABLES DE ENTORNO

Todas viven en `.env` (real, ignorado por git) y `.env.example` (plantilla sin valores). Los mismos secrets también están cargados como "secrets" de Supabase para que las Edge Functions los puedan leer en producción.

| Variable | Existe | Uso |
|---|---|---|
| `SUPABASE_URL` | ✅ | URL del proyecto de Supabase |
| `SUPABASE_PROJECT_REF` | ✅ (solo en `.env`, no en `.env.example`) | referencia del proyecto para el CLI |
| `SUPABASE_ANON_KEY` | ✅ | clave pública, usada desde la landing page |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | clave secreta, solo usada server-side en las Edge Functions |
| `TELEGRAM_BOT_TOKEN` | ✅ | token del bot de notificaciones |
| `TELEGRAM_CHAT_ID` | ✅ | chat id del asesor |
| `META_FACEBOOK_APP_ID` | ✅ | ID de la app principal de Meta for Developers |
| `META_APP_ID` | ✅ | ID de la app de Instagram (distinto del anterior) |
| `META_APP_SECRET` | ✅ | secreto de la app de Instagram, usado para verificar firmas de webhook |
| `META_WEBHOOK_VERIFY_TOKEN` | ✅ | token elegido por el usuario para el handshake de verificación del webhook |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | ✅ | ID numérico de la cuenta de Instagram conectada |
| `META_PAGE_ID` | ✅ | ID de la Página de Facebook vinculada |
| `META_PAGE_ACCESS_TOKEN` | ❌ falta | pensada para Fase 2 avanzada (Facebook Messenger) |
| `WHATSAPP_PHONE_NUMBER_ID` | ❌ falta | Fase 2, WhatsApp (no implementado) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ❌ falta | Fase 2, WhatsApp (no implementado) |
| `ANTHROPIC_API_KEY` | ❌ falta | Fase 3, motor de contenido (no implementado) |
| `AI_DAILY_BUDGET_USD` | ✅ (valor por defecto `5`) | tope de gasto diario para IA, todavía sin uso real porque no hay llamadas a IA |
| `TIMEZONE` | ✅ (`America/Argentina/Mendoza`) | pensada para futuros cron jobs (Fase 4), sin uso real todavía |

No hay ninguna variable opcional marcada explícitamente como tal en el código — todas las existentes se leen con `Deno.env.get(...)` y se maneja el caso de que falten con un error claro (por ejemplo, en `intake-landing` si faltan `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` responde HTTP 500 con un mensaje explicando qué falta).

**Ningún valor real de estas variables se incluye en este reporte.**

---

# 10. BASE DE DATOS / CRM

**Dónde está**: Postgres administrado por Supabase (proyecto real, región `sa-east-1`, São Paulo).

## Esquema (de `supabase/migrations/0001_init.sql`)

### Tabla `leads`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | autogenerado |
| `created_at` / `updated_at` | timestamptz | `updated_at` se actualiza solo por un trigger |
| `source_channel` | enum `lead_channel` | `landing`, `instagram`, `facebook`, `whatsapp`, `meta_ads`, `google`, `email`, `referido`, `otro` |
| `campaign`, `post_ref` | text | origen de campaña/publicación |
| `external_thread_id` | text | id de conversación en el canal de origen; junto con `source_channel` tiene un `UNIQUE` — esto es lo que permite hacer *upsert* en vez de duplicar |
| `name`, `locality` | text | |
| `employment_type` | text con `CHECK` | `dependencia`, `monotributo`, `particular` o `null` |
| `contribution_approx` | text | aporte aproximado, en texto libre |
| `coverage_for` | text con `CHECK` | `individual` o `grupo_familiar` |
| `intent_timeframe` | text con `CHECK` | `inmediato`, `1_3_meses`, `mas_de_3_meses`, `sin_definir` |
| `phone` | text | opcional |
| `explicit_info_request` | boolean | si pidió info explícitamente |
| `answers_completed` | int | cantidad de campos de calificación contestados |
| `consent`, `consent_at` | boolean / timestamptz | consentimiento explícito, obligatorio |
| `score` | int | calculado por `scoring.ts` |
| `score_band` | enum `score_band` | `frio`, `tibio`, `caliente`, `contactar_ahora` |
| `status` | enum `lead_status` | `nuevo`, `en_conversacion`, `calificado`, `contactado`, `en_negociacion`, `ganado`, `perdido`, `descartado` |
| `last_contact_at`, `next_followup_at` | timestamptz | seguimiento comercial — **existen las columnas pero nada del código las escribe todavía**; están pensadas para que el asesor las actualice manualmente desde el Table Editor de Supabase, o para una futura función de seguimiento |
| `notes` | text | notas libres; también usada por el webhook de Instagram para guardar el texto del comentario/mensaje con el prefijo `[comment]` o `[message]` |
| `outcome` | text con `CHECK` | `venta`, `no_venta`, `pendiente` o `null` — **no hay ninguna pantalla ni función que la actualice todavía**; es un campo para carga manual futura |

### Tabla `conversation_state`
Pensada para guardar el estado de una conversación guiada por botones (Fase 2 avanzada). **Existe en el esquema pero ningún código la usa todavía** — es infraestructura preparada, no una funcionalidad activa.

### Tabla `events_log`
Deduplicación de eventos entrantes. `UNIQUE(source, event_key)` — si Meta reintenta un webhook ya procesado, la segunda inserción falla por violación de constraint (código `23505`), y el código lo interpreta como "ya procesado" en vez de como un error real. **Verificado con test real** (ver sección 18).

### Tabla `notifications_log`
Historial de cada intento de notificación (Telegram), con éxito/fallo y detalle del error si lo hubo. Usada por ambas Edge Functions.

## Relaciones
`conversation_state.lead_id` y `notifications_log.lead_id` son foreign keys hacia `leads.id` (con `ON DELETE CASCADE` y `ON DELETE SET NULL` respectivamente).

## Deduplicación
Dos mecanismos distintos y complementarios:
1. `events_log` evita procesar el mismo evento de webhook dos veces.
2. El `UNIQUE(source_channel, external_thread_id)` en `leads` hace que un mismo lead (mismo canal + misma conversación) se actualice (`upsert`) en vez de duplicarse.

## Seguimiento y consentimiento
El consentimiento es obligatorio para guardar un lead (`consent: true` es requisito en la validación del formulario). El seguimiento comercial (`status`, `last_contact_at`, `next_followup_at`, `outcome`) tiene las columnas listas en la base, pero **hoy se gestionaría manualmente desde el Table Editor de Supabase** — no hay ninguna pantalla ni automatización que las actualice.

---

# 11. LEAD SCORING

Implementado en `supabase/functions/_shared/scoring.ts`, 100% determinístico (sin IA), verificado con 6 tests automáticos.

## Puntos que suma

| Señal | Puntos |
|---|---|
| Inició la conversación voluntariamente | +10 |
| Por cada pregunta de calificación contestada (máximo 6 contadas) | +5 c/u (máx. +30) |
| Está en relación de dependencia o es monotributista | +20 |
| Intención de cambio inmediata | +25 |
| Intención de cambio en 1 a 3 meses | +15 |
| Dejó teléfono voluntariamente | +15 |
| Pidió explícitamente información/cotización | +10 |

**Máximo posible: 110 puntos** (10+30+20+25+15+10).

## Bandas (rangos inclusivos)

| Banda | Rango |
|---|---|
| `frio` | 0 – 20 |
| `tibio` | 21 – 45 |
| `caliente` | 46 – 70 |
| `contactar_ahora` | 71 en adelante |

Solo cuando la banda es `contactar_ahora` se dispara la alerta de Telegram **en el flujo de la landing**. En el flujo de Instagram, en cambio, se decidió explícitamente notificar **siempre** que hay una interacción nueva (comentario o DM), sin importar la banda — porque el volumen esperado por ese canal es más bajo y cada interacción ahí se considera valiosa por sí misma (decisión tomada con el usuario, ver sección 21).

Los números son un punto de partida documentado, pensados para ajustarse con datos reales una vez que haya volumen de uso (esto está explícito en `docs/scoring.md`, no es un valor "mágico" ni validado estadísticamente todavía).

---

# 12. AUTOMATIZACIONES

| Automatización | Disparador | Acción | Frecuencia | ¿Usa IA? | Estado |
|---|---|---|---|---|---|
| Captación por landing | `fetch POST` desde el formulario | validar → calcular score → guardar → notificar | por evento (cada envío) | No | ✅ Activa en producción |
| Captación por Instagram | Webhook POST de Meta | verificar firma → detectar keyword → guardar → notificar | por evento (cada comentario/DM) | No | 🟡 Código listo, sin tráfico real de Meta todavía |
| Reporte diario de contenido | (ninguno) | (ninguna) | diaria (planeada) | Sí (planeada) | ❌ No implementado |
| Reporte semanal estratégico | (ninguno) | (ninguna) | semanal (planeada) | Sí (planeada) | ❌ No implementado |
| Generación de ideas de contenido | (ninguno) | (ninguna) | semanal (planeada, en batch) | Sí (planeada) | ❌ No implementado |

No hay consumo de tokens de IA hoy porque no hay ninguna automatización que use IA implementada todavía.

---

# 13. USO DE IA

**Estado actual: cero uso de IA en el código del proyecto.** Todo lo construido hasta ahora (validación, scoring, detección de palabras clave, verificación de firmas) es determinístico, explícitamente para no gastar tokens en decisiones que no lo necesitan — esto fue un principio de diseño pedido desde el inicio.

### Tareas determinísticas (ya implementadas)
- Cálculo de score.
- Validación de formularios.
- Detección de palabras clave en comentarios/DMs.
- Verificación de firmas de webhook.

### Tareas que usarán IA (diseñadas, no implementadas)
- Clasificación de mensajes de texto libre ambiguo en DMs/comentarios que no contienen una palabra clave exacta (Fase 2 avanzada) — modelo económico sugerido (ej. un modelo "Haiku" de Claude).
- Generación de ideas de contenido (Fase 3) — modelo más capaz sugerido para esta tarea (ej. un modelo "Sonnet"), pero en **batch semanal**, no por request.
- Resúmenes diarios/semanales de desempeño (Fase 4).

No hay prompts escritos todavía en el código — son solo menciones de diseño en `docs/architecture.md`.

### Oportunidades para reducir tokens (ya incorporadas al diseño, aunque no haya código de IA todavía)
- No se pasa nunca el historial completo de una conversación a un modelo — el estado se guarda estructurado (tabla `conversation_state`, sin usar todavía) en vez de como texto de chat.
- Modelos baratos para clasificación simple, modelos más caros solo para generación de contenido importante.
- Generación de contenido en lote (batch) en vez de una llamada por evento.
- Tope de gasto diario configurable (`AI_DAILY_BUDGET_USD`), aunque hoy no hay ningún código que lo verifique porque no hay llamadas de IA todavía.

---

# 14. PUBLICACIÓN Y REDES SOCIALES

| Ítem | Estado |
|---|---|
| Instagram — recibir comentarios/DMs | 🟡 EN DESARROLLO (código listo, bloqueado por App Review de Meta) |
| Instagram — publicar contenido | ❌ NO IMPLEMENTADO |
| Instagram — responder comentarios/DMs automáticamente | ❌ NO IMPLEMENTADO (decisión explícita: v1 solo notifica, no responde) |
| Facebook — cualquier integración | ❌ NO IMPLEMENTADO |
| WhatsApp Business | ❌ NO IMPLEMENTADO |
| Meta Ads / Lead Ads | ❌ NO IMPLEMENTADO |
| Formularios propios | ✅ FUNCIONA (landing page) |
| Generación/publicación de contenido | ❌ NO IMPLEMENTADO (Fase 3) |
| Analíticas de contenido (impresiones, alcance, etc.) | ❌ NO IMPLEMENTADO (Fase 4) |

---

# 15. NOTIFICACIONES

**Canal actual: Telegram, únicamente.** No hay WhatsApp, email ni dashboard de notificaciones.

- **Landing**: se notifica solo cuando el lead cae en la banda `contactar_ahora`. Formato: mensaje con emoji 🚨, score, nombre, localidad, teléfono, situación laboral, plazo y canal — todo con escape de HTML para evitar inyección si el usuario puso caracteres especiales en el formulario.
- **Instagram**: se notifica en **toda** interacción nueva (comentario o DM), la caiga o no en una banda alta. Formato: mensaje con emoji 📸, tipo (comentario/DM), usuario (o ID numérico si no está disponible, como pasa en los DMs), texto del mensaje, y una marca 🔑 si contiene una palabra clave.
- **Estado**: ✅ probado con mensajes reales llegando al Telegram del usuario, en ambos flujos.

---

# 16. HOSTING Y EJECUCIÓN

- **Dónde corre**: 100% en la nube. La landing page vive en GitHub Pages; el backend (Edge Functions + base de datos) vive en la infraestructura de Supabase.
- **¿Depende de la computadora del usuario?** No. Una vez desplegado, nada de esto necesita que la computadora del usuario esté prendida.
- **¿Qué procesos necesitan permanecer activos?** Ninguno — no hay ningún proceso "de larga duración"; todo son funciones serverless que se despiertan por evento y terminan.
- **¿Qué pasa si se cierra Claude Code?** Nada — Claude Code (esta herramienta) se usó únicamente para *construir y desplegar* el sistema. El sistema en sí no depende de que Claude Code, ni ninguna sesión de IA, siga corriendo.
- **¿Qué pasa si se apaga la computadora del usuario?** Nada — el sistema sigue funcionando igual, porque no corre en esa computadora.
- **¿Cómo se reinicia el sistema?** No hace falta "reiniciarlo" en el sentido tradicional — las Edge Functions se despiertan solas con cada request. La única situación de "reinicio" relevante es si el proyecto Free de Supabase se pausa por inactividad (~7 días sin ningún request) — en ese caso, hay que reactivarlo manualmente desde el dashboard de Supabase con un clic.
- **¿Existe auto-restart?** No aplica en el sentido de un servidor tradicional — las funciones serverless no se "caen", se ejecutan bajo demanda.

---

# 17. COSTOS

| Servicio | Tipo | Costo actual |
|---|---|---|
| GitHub + GitHub Pages | GRATIS | $0 |
| Supabase (plan Free) | GRATIS (con el límite de pausa por inactividad) | $0 |
| Telegram Bot API | GRATIS | $0 |
| Meta for Developers / Graph API / webhooks | GRATIS | $0 (el costo de Meta sería solo si se corre pauta paga, que no está implementado) |
| WhatsApp Cloud API | VARIABLE (no implementado) | No aplica todavía; Meta cobra por conversación superado un umbral gratuito — hay que confirmar el precio vigente al momento de activarlo |
| API de Anthropic (Claude) | VARIABLE (no implementado) | $0 hoy porque no hay ninguna llamada de IA en el código |
| Dominio propio | FIJO (opcional, no comprado) | ~USD 10–15/año si se decide comprar uno |

**Costo total actual del proyecto: $0.** Todo corre en tiers gratuitos.

---

# 18. PRUEBAS REALIZADAS

| Prueba | Resultado | Notas |
|---|---|---|
| 31 tests automáticos (`deno test`) sobre toda la lógica compartida | ✅ 31/31 pasan | Desglose: 6 scoring, 6 intake, 8 telegram, 5 meta_signature, 6 instagram_events |
| Vector HMAC-SHA256 calculado con Python para validar `meta_signature.ts` | ✅ coincide | Evita verificación circular (no se usó la misma implementación para generar y verificar) |
| Envío real de formulario vía `curl` contra la función desplegada | ✅ | Lead guardado, score correcto, notificación exitosa |
| Envío real de formulario desde un navegador local (servidor estático) | ✅ | Mismo resultado, confirmado visualmente |
| Envío real de formulario desde la URL pública de GitHub Pages | ✅ | Confirmado en producción real, lead borrado después |
| Handshake GET de verificación del webhook de Instagram | ✅ | Devuelve el `challenge` correcto con el token válido, 403 con uno inválido |
| POST simulado y firmado (Python) contra `instagram-webhook` desplegado | ✅ | Firma válida → procesado y notificado; firma inválida → 401; evento repetido → no duplicado ni renotificado |
| Verificación de lead guardado vía REST API después de cada prueba | ✅ | Y borrado del dato de prueba en cada caso |
| Comentario real de una persona (@si.moncho, cuenta sin rol en la app) en una publicación real de @simoonhaddad | ❌ no generó ningún evento en el webhook | Resultado esperado: confirma que Meta no entrega webhooks reales mientras la app esté "Sin publicar" |
| **Verificación de si la tabla `leads` tiene RLS activo** | ❌ **RLS no está activo** | Se insertó una fila con la `service_role key` y se comprobó que la `anon/publishable key` (la misma que está en el HTML público de la landing) puede leerla completa, incluyendo nombre y teléfono. Ver hallazgo detallado en la sección 19 y 20. Fila de prueba borrada. |

**Ningún resultado de este reporte fue asumido — cada afirmación de "funciona" en este documento corresponde a una prueba real ejecutada y confirmada, no a una expectativa de que el código "debería" funcionar.**

---

# 19. ERRORES / PROBLEMAS ACTUALES

### 🔴 ALTA — No hay Row Level Security (RLS) activo en ninguna tabla
- **Problema**: la clave pública (`anon`/`publishable key`), que está embebida directamente en el código fuente de la landing page (visible para cualquiera que inspeccione la página), puede leer **y probablemente escribir/borrar** libremente en las 4 tablas (`leads`, `conversation_state`, `events_log`, `notifications_log`), porque la migración nunca activó RLS ni definió políticas.
- **Causa probable**: la migración inicial se enfocó en crear el esquema funcional y no incluyó `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` ni políticas de acceso.
- **Impacto**: cualquier persona que abra las herramientas de desarrollador del navegador en la landing page, encuentre la URL de Supabase y la `anon key`, puede leer los nombres, teléfonos y notas de **todos** los leads guardados — un problema real de privacidad de datos personales, no teórico (se verificó insertando y leyendo un dato de prueba con la clave pública).
- **Solución propuesta**: activar RLS en las 4 tablas y agregar una política que solo permita `INSERT` a la `anon key` (para que la landing pueda seguir mandando formularios) pero **no** `SELECT`, `UPDATE` ni `DELETE`; todas las lecturas/escrituras posteriores deberían hacerse solo con la `service_role key` desde las Edge Functions o desde el Table Editor de Supabase (autenticado). Esto no requiere cambiar el código de las Edge Functions actuales, porque ya usan la `service_role key`.
- **Prioridad**: 🔴 alta — se recomienda resolver antes de compartir la landing page ampliamente.

### 🔴 ALTA — App de Instagram bloqueada para tráfico real
- **Problema**: la app de Meta está en modo "Sin publicar"; solo procesa eventos de cuentas con rol en la app (testers), no del público general.
- **Causa**: Meta exige pasar el proceso de App Review (verificación de negocio + videos de demostración) para los permisos avanzados de Instagram solicitados.
- **Impacto**: el canal de Instagram no puede generar leads reales todavía.
- **Solución propuesta**: completar la verificación de negocio y grabar los 3 videos pendientes (instrucciones detalladas en `docs/setup-fase-2.md`), ambos a cargo del usuario porque requieren su identidad legal real y grabaciones de su propia cuenta.
- **Prioridad**: 🔴 alta, pero **fuera del control del código** — es un trámite administrativo de Meta.

### 🟡 MEDIA — No hay CI/CD automático
- **Problema**: los 31 tests se corren manualmente con `deno test`; no hay ningún workflow de GitHub Actions que los corra automáticamente en cada push.
- **Impacto**: es posible subir un cambio que rompa un test sin darse cuenta hasta correrlos manualmente.
- **Solución propuesta**: agregar un workflow simple de GitHub Actions que corra `deno test` en cada push/PR.
- **Prioridad**: 🟡 media.

### 🟡 MEDIA — Los números de scoring no están validados con datos reales
- **Problema**: los pesos y bandas del scoring (sección 11) son un punto de partida razonable, pero no hay todavía suficiente volumen real de leads para confirmar si el umbral de "contactar ahora" es el correcto.
- **Impacto**: podría haber falsos positivos/negativos en la calificación hasta que se ajuste con datos reales.
- **Solución propuesta**: revisar los números después de acumular unas semanas de uso real (ya está anticipado en `docs/scoring.md`).
- **Prioridad**: 🟡 media.

### 🟢 BAJA — El preview local de la landing tuvo un bug de entorno
- **Problema**: la herramienta de previsualización local (`python3 -m http.server` a través de la herramienta de desarrollo) falló varias veces con un error de permisos (`PermissionError` al llamar `os.getcwd()`), no relacionado con el código del proyecto sino con el entorno de la sesión de Claude Code.
- **Impacto**: ninguno en producción — se resolvió sirviendo la landing desde otra carpeta y usando el navegador real (Chrome) para verificar visualmente.
- **Prioridad**: 🟢 baja, informativo.

### 🟢 BAJA — No hay token de larga duración de Instagram guardado
- **Problema**: se generó un token de acceso de usuario de Instagram de corta duración (1 hora) durante las pruebas, pero no se guardó ni se convirtió a uno de larga duración (60 días).
- **Impacto**: ninguno hoy, porque el flujo actual de Instagram solo *lee* eventos vía webhook y no necesita llamar de vuelta a la API de Instagram. Sería necesario recién cuando se implemente una función que responda activamente (por ejemplo, contestar un comentario desde la API).
- **Prioridad**: 🟢 baja — atender cuando se construya esa funcionalidad.

---

# 20. SEGURIDAD Y RIESGOS

- **Credenciales**: ninguna credencial real quedó en el código fuente ni en el historial de git — se verificó explícitamente (`.env` está en `.gitignore` y confirmado como ignorado; los tokens temporales usados para configurar GitHub/Supabase/Meta durante la sesión se usaron vía variables de entorno de proceso, nunca escritos en archivos versionados).
- **Permisos de API de Meta**: acotados a los 3 permisos estrictamente necesarios para el caso de uso (`instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`); no se pidió ningún permiso de publicación ni de administración de anuncios.
- **Exposición de endpoints**: las dos Edge Functions (`intake-landing`, `instagram-webhook`) están desplegadas con `--no-verify-jwt` (necesario porque las llaman usuarios anónimos o Meta, no usuarios logueados), pero `instagram-webhook` verifica la firma HMAC en cada request, e `intake-landing` valida estrictamente el payload (consentimiento obligatorio, valores permitidos).
- **RLS deshabilitado (ver sección 19)**: este es el hallazgo de seguridad más importante de este reporte — la clave pública puede leer todos los datos personales guardados. Se recomienda resolverlo antes de escalar el tráfico a la landing.
- **Spam / abuso del formulario**: no hay ningún límite de tasa (rate limiting) ni CAPTCHA en `intake-landing` — alguien podría mandar formularios repetidos con datos falsos. No implementado, riesgo bajo-medio dado el volumen esperado hoy.
- **Límites de APIs**: no se ha llegado a ningún límite de Supabase, Telegram ni Meta todavía, dado el volumen de pruebas (unos pocos leads de prueba, todos borrados).
- **Duplicados**: cubiertos por diseño (ver sección 10).
- **Datos personales**: el sistema explícitamente evita pedir o inferir información médica; sí guarda nombre, teléfono, localidad y situación laboral — datos personales comunes, protegidos hoy solo por no ser trivialmente descubribles, pero **no protegidos por RLS** (ver arriba).
- **Riesgo de bloqueo de cuentas de Meta**: bajo, porque no se hace scraping ni automatización no autorizada — todo pasa por la API oficial de Meta con las credenciales propias del negocio.
- **Acciones automáticas peligrosas**: no existen — el sistema no publica contenido, no responde automáticamente en Instagram, no gasta presupuesto publicitario ni modifica campañas. Todo lo que hace es leer eventos y notificar por Telegram.

---

# 21. DECISIONES IMPORTANTES QUE TOMAMOS

- **Arquitectura event-driven en vez de un agente en loop**: para no consumir tokens de IA ni recursos de forma continua; todo se dispara por webhooks o llamadas puntuales.
- **Scoring 100% determinístico, sin IA**: porque es una decisión que se puede explicar con una fórmula simple y auditable, y no necesita el costo ni la variabilidad de un modelo de IA.
- **Supabase como backend único** (base de datos + funciones) en vez de separar un servidor propio: para minimizar la cantidad de piezas de infraestructura que mantener.
- **Landing page como HTML estático sin build**, en vez de un framework: simplicidad y cero configuración de build para una landing chica.
- **Telegram en vez de WhatsApp o email para las alertas internas**: es gratis, instantáneo, y no depende de la aprobación de Meta (que puede tardar semanas) — se puede tener funcionando en minutos.
- **Fase 1 (landing) antes que Fase 2 (Instagram)**: porque no depende de la aprobación de terceros y se puede probar de punta a punta de inmediato.
- **Instagram v1: solo notificar, nunca auto-responder**: decisión explícita del usuario para evitar que el sistema "hable" en su nombre desde el primer día; se dejó como pregunta explícita y el usuario eligió la opción más conservadora.
- **Convertirse en "Tech Provider" de Meta**: paso obligatorio e irreversible para poder pedir acceso avanzado a los permisos de Instagram; se le explicó al usuario que era irreversible antes de que decidiera continuar.
- **Verificar cada integración con pruebas reales antes de darla por terminada**: principio explícito pedido por el usuario desde el inicio ("nunca inventes que una integración funciona: verificála"), aplicado de forma consistente durante todo el proyecto.

---

# 22. COSAS QUE DESCARTAMOS

- **Auto-responder comentarios/DMs de Instagram automáticamente en la v1**: se consideró explícitamente (opción presentada al usuario) y se descartó a favor de "solo notificar", para minimizar el riesgo de que el sistema publique o escriba algo indebido antes de que el asesor lo revise.
- **Google Sheets / Airtable como base de datos en vez de Supabase**: mencionados como alternativas en la documentación inicial, pero se eligió Supabase por escalar mejor a futuro sin tener que migrar, y por tener una vista tipo planilla igual de accesible para alguien sin conocimientos técnicos.
- **Usar la contraseña maestra de Postgres para conectar el CLI**: se evitó pedirle al usuario la contraseña de la base de datos; en cambio, se resolvió con un token de acceso de Supabase con permisos acotados y expiración corta.
- **Scraping de Instagram/Facebook**: explícitamente prohibido desde el planteo original del proyecto — todo pasa por APIs oficiales.

---

# 23. PENDIENTES

Ordenado por prioridad real (no solo por fase):

```
[ ] 🔴 Activar RLS en las 4 tablas de Supabase y restringir el acceso de la anon key (seguridad, ver sección 19)
[ ] 🔴 Completar la verificación de negocio de Meta Business (datos legales reales del usuario)
[ ] 🔴 Grabar los 3 videos de demostración para el App Review de Instagram
[ ] 🔴 Enviar la solicitud de App Review una vez completos los dos puntos anteriores
[ ] 🟡 Agregar un workflow de CI (GitHub Actions) que corra los 31 tests en cada push
[ ] 🟡 Implementar Facebook Messenger (webhook similar al de Instagram)
[ ] 🟡 Implementar Meta Lead Ads
[ ] 🟡 Implementar WhatsApp Business Cloud API
[ ] 🟡 Diseñar e implementar el flujo de preguntas guiado por botones/quick-replies para Instagram/WhatsApp (hoy solo se detecta la palabra clave, no se hace la calificación completa por ese canal)
[ ] 🟡 Clasificador liviano con IA para mensajes de texto libre ambiguo (Fase 2 avanzada)
[ ] 🟢 Motor de contenido con IA en batch (Fase 3)
[ ] 🟢 Reportes diarios/semanales automáticos (Fase 4)
[ ] 🟢 Carga de métricas de contenido (Fase 4)
[ ] 🟢 Feature flags por módulo y panel de control (Fase 5)
[ ] 🟢 Considerar agregar rate limiting/CAPTCHA al formulario de landing
[ ] 🟢 Evaluar comprar un dominio propio
```

---

# 24. PRÓXIMOS 5 PASOS RECOMENDADOS

1. **Activar RLS en Supabase y restringir la `anon key`.**
   - Por qué: es el único hallazgo de seguridad real y activo del proyecto; expone datos personales de leads.
   - Dificultad: baja (unas pocas líneas de SQL).
   - Tiempo estimado: 15–30 minutos.
   - Dependencia: ninguna, se puede hacer ya mismo.

2. **Completar la verificación de negocio en Meta Business Suite.**
   - Por qué: es el bloqueo principal para que la Fase 2 reciba tráfico real.
   - Dificultad: media (depende de tener a mano documentación legal/fiscal).
   - Tiempo estimado: 15–40 minutos de carga + tiempo de revisión de Meta (variable, puede tardar días).
   - Dependencia: datos legales reales del usuario.

3. **Grabar y subir los 3 videos de demostración del App Review.**
   - Por qué: junto con el punto 2, es lo único que falta para enviar la solicitud de revisión.
   - Dificultad: baja-media (solo requiere seguir el guion ya escrito en `docs/setup-fase-2.md`).
   - Tiempo estimado: 30–60 minutos.
   - Dependencia: acceso al teléfono del usuario y a su cuenta de Instagram.

4. **Enviar la solicitud de App Review y esperar la resolución de Meta.**
   - Por qué: desbloquea el canal de Instagram para tráfico real.
   - Dificultad: baja (ya está casi todo cargado).
   - Tiempo estimado: unos minutos para enviar; 2 a 4 semanas de espera de Meta.
   - Dependencia: puntos 2 y 3 completos.

5. **Agregar un workflow de CI simple (GitHub Actions) que corra los 31 tests en cada push.**
   - Por qué: evita subir un cambio que rompa algo sin darse cuenta, ahora que el proyecto tiene código real corriendo en producción.
   - Dificultad: baja.
   - Tiempo estimado: 20–30 minutos.
   - Dependencia: ninguna.

---

# 25. QUÉ NECESITA SABER OTRO ASISTENTE DE IA

Si vas a continuar este proyecto, tené en cuenta lo siguiente:

- **No es un proyecto de un desarrollador**: el usuario (Simón Haddad) es un asesor comercial, no programador. Explicá cada decisión técnica en lenguaje simple, y no des por sentado que entiende jerga de desarrollo.
- **No asumas que podés instalar cosas o generar gastos sin avisar**: el usuario pidió explícitamente que se le avise antes de instalar algo pago o generar cualquier gasto. Todo lo construido hasta ahora es gratis.
- **Nunca inventes que algo funciona sin probarlo de verdad.** Esta fue una instrucción explícita y repetida del usuario, y se siguió estrictamente durante todo el proyecto: cada afirmación de "funciona" en este reporte corresponde a una prueba real ejecutada, no a una suposición. Mantené ese estándar.
- **No hagas scraping ni bots de interacción no autorizados** en Instagram, Facebook o LinkedIn — es una restricción explícita del proyecto desde su planteo original. Todo pasa por APIs oficiales.
- **No pidas ni infieras información médica** de los leads — el proyecto es explícito en que no se debe recolectar ni preguntar por diagnósticos ni datos de salud, solo información comercial/laboral.
- **El scoring es determinístico a propósito** — no reemplaces la lógica de `scoring.ts` por una llamada a un modelo de IA sin que el usuario lo pida explícitamente; es una decisión de diseño central del proyecto (bajo costo, auditable, sin variabilidad).
- **Hay un problema de seguridad activo sin resolver** (RLS deshabilitado, sección 19 y 20) — si vas a tocar la base de datos o agregar funcionalidad nueva, resolvé o al menos mencioná este punto antes de agregar más datos personales al sistema.
- **La Fase 2 (Instagram) no está bloqueada por un error de código** — está bloqueada por un trámite administrativo de Meta (App Review) que depende de la identidad legal del usuario y de grabaciones que solo él puede hacer. No trates de "arreglarlo" con más código.
- **El repositorio no usa Node.js en ningún punto** — todo el backend corre en Deno. Si vas a agregar dependencias, usá imports de URL (`esm.sh`, `deno.land/std`) como el resto del proyecto, no asumas que hay un `package.json`.
- **Cada decisión de scope se tomó explícitamente con el usuario** (por ejemplo, "solo notificar en Instagram, no auto-responder") — si vas a cambiar el comportamiento de algo ya construido, preguntale primero en vez de asumir.
- **El usuario prefiere que las cosas se guarden en Supabase con secrets, nunca hardcodeadas** — mantené ese patrón para cualquier credencial nueva.

---

# 26. COMANDOS ÚTILES

**Instalar dependencias**: no aplica — el proyecto no tiene `package.json` ni gestor de paquetes; los imports se resuelven directo desde URLs (Deno).

**Correr los tests**:
```bash
deno test supabase/functions/_shared/
```

**Correr los tests de un solo archivo**:
```bash
deno test supabase/functions/_shared/scoring.test.ts
```

**Chequear tipos de una función**:
```bash
deno check supabase/functions/instagram-webhook/index.ts
```

**Previsualizar la landing localmente** (sin build):
```bash
python3 -m http.server 4173 --directory .
```

**Desplegar una Edge Function**:
```bash
supabase functions deploy intake-landing --no-verify-jwt
supabase functions deploy instagram-webhook --no-verify-jwt
```

**Aplicar migraciones de base de datos**:
```bash
supabase db push
```

**Cargar/actualizar secrets en Supabase**:
```bash
supabase secrets set NOMBRE_VARIABLE="valor"
```

**Ver logs de las funciones**: no se encontró un subcomando `logs` en la versión actual del CLI (`2.117.0`) bajo `supabase functions` — hay que revisar los logs desde el dashboard web de Supabase (Project → Edge Functions → nombre de la función → Logs).

**"Ejecutar en producción"**: no aplica como comando — el sistema ya está desplegado y corriendo en Supabase/GitHub Pages; no hay un paso de "arrancar el servidor".

**Git**: flujo estándar (`git add`, `git commit`, `git push`); el repositorio remoto es `https://github.com/simonhaddadfederada/federada-inbound-engine`.

---

# 27. RESUMEN FINAL

| Área | Estado |
|---|---|
| Backend | ✅ listo (Fase 1), 🟡 parcial (Fase 2, código listo sin tráfico real) |
| Base de datos | 🟡 parcial (esquema y datos funcionan, pero falta RLS — ver seguridad) |
| Meta (cuenta/app) | 🟡 parcial (app creada, permisos pedidos, falta App Review) |
| Instagram | 🟡 parcial (webhook probado con eventos simulados, no con tráfico real) |
| Facebook | ❌ pendiente |
| WhatsApp | ❌ pendiente |
| CRM | 🟡 parcial (esquema completo, seguimiento manual, sin pantalla propia) |
| Lead scoring | ✅ listo y probado (Fase 1); aplicado también en Instagram |
| IA | ❌ pendiente (no integrada todavía, diseño listo para Fase 3) |
| Notificaciones | ✅ listo y probado (Telegram) |
| Hosting | ✅ listo (100% en la nube, sin dependencia de ninguna computadora) |
| Automatización 24/7 | ✅ listo en el sentido de "event-driven sin loops"; no hay cron jobs implementados todavía |

---

# INFORMACIÓN QUE NO PUDISTE DETERMINAR

- **Los valores reales de todas las credenciales y tokens** (por diseño, no se leyeron para este reporte).
- **El nombre legal completo o CUIT del usuario** — no está en el código ni en la configuración, solo se usó "Simón Haddad" como nombre en algunos formularios de Meta, mencionado explícitamente por el usuario en la conversación.
- **El estado exacto de la verificación de negocio en Meta a la fecha de este reporte** — depende de acciones que el usuario todavía no completó al momento de escribir esto; no se puede confirmar desde el código ni la configuración local.
- **Si la cuenta de Instagram (@simoonhaddad) tiene publicaciones suficientes/activas para las pruebas de video del App Review** — no se verificó el contenido real de esa cuenta de Instagram.
- **El volumen real de tráfico esperado** (cantidad de leads por semana/mes) — no hay datos históricos porque el sistema recién se desplegó.
- **Si existe algún otro repositorio, documento o cuenta relacionado al proyecto fuera de lo revisado** (por ejemplo, un CRM externo, una cuenta de WhatsApp Business ya creada, etc.) — este reporte se basa únicamente en lo que existe en este repositorio y en lo confirmado durante la sesión de trabajo.
- **La fecha exacta en la que Meta resolverá la verificación de negocio o el App Review** — depende enteramente de Meta, fuera del control del proyecto.
