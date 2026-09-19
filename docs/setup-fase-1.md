# Puesta en marcha de la Fase 1 (paso a paso)

Esto se hace **una sola vez**. Después de esto, el sistema queda funcionando
solo — no hace falta repetir nada de esto para cada lead nuevo.

El CLI de Supabase ya está instalado en esta máquina en `~/.local/bin/supabase`
(versión 2.117.0, verificado). Si abrís una terminal nueva y el comando
`supabase` no se encuentra, usá la ruta completa `~/.local/bin/supabase` o
agregá esta línea a tu `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## 1. Crear el bot de Telegram

1. En Telegram, buscá `@BotFather` y mandale `/newbot`.
2. Elegí un nombre y un username para el bot (ej. `FederadaLeadsBot`).
3. Copiá el token que te da (`TELEGRAM_BOT_TOKEN`).
4. Mandale un mensaje cualquiera a tu bot nuevo (ej. "hola") desde tu cuenta
   personal de Telegram — si no le escribís primero, el bot no te puede
   escribir a vos.
5. Para obtener tu `TELEGRAM_CHAT_ID`, corré esto (reemplazando el token):

```bash
curl -s "https://api.telegram.org/bot<TU_TOKEN>/getUpdates"
```

   En la respuesta JSON buscá `"chat":{"id":...}` — ese número es tu
   `TELEGRAM_CHAT_ID`.

## 2. Crear el proyecto de Supabase

1. Entrá a supabase.com, creá una cuenta (podés usar tu GitHub).
2. "New project" → elegí un nombre (ej. `federada-inbound-engine`), una
   contraseña de base de datos (guardala en un gestor de contraseñas), y la
   región más cercana.
3. Cuando el proyecto esté listo, andá a **Project Settings → API** y
   copiá:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡nunca la pongas en
     la landing page ni en ningún archivo público!)
4. Andá a **Project Settings → General** y copiá el `Reference ID` del
   proyecto (`SUPABASE_PROJECT_REF`).

## 3. Conectar el CLI con tu proyecto

Desde la carpeta del repositorio (`~/Desktop/federada-inbound-engine`):

```bash
supabase login
supabase link --project-ref <SUPABASE_PROJECT_REF>
```

## 4. Aplicar el esquema de base de datos

```bash
supabase db push
```

Esto crea las tablas `leads`, `conversation_state`, `events_log` y
`notifications_log` en tu proyecto real. Después, entrá al **Table Editor**
de Supabase y confirmá que las 4 tablas están ahí — es la vista tipo
planilla donde vas a poder ver y editar leads a mano.

## 5. Cargar los secrets (nunca en el código)

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<tu_token>
supabase secrets set TELEGRAM_CHAT_ID=<tu_chat_id>
```

(`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles
automáticamente dentro de las Edge Functions, no hace falta cargarlos.)

## 6. Desplegar la función

```bash
supabase functions deploy intake-landing --no-verify-jwt
```

`--no-verify-jwt` es necesario porque este endpoint lo llama gente anónima
desde la landing page (no están logueados). La función igual solo acepta
pedidos con la `anon key` pública de tu proyecto — no está abierta a
cualquiera sin ningún control.

## 7. Conectar la landing page con la función real

En [`landing/index.html`](../landing/index.html), reemplazá:

```js
const ENDPOINT_URL = "https://TU-PROYECTO.functions.supabase.co/intake-landing";
const SUPABASE_ANON_KEY = "TU_ANON_KEY";
```

por tu URL real (te la muestra `supabase functions deploy` al terminar) y tu
`anon key` real.

## 8. Publicar la landing page en GitHub Pages

1. Subí el repo a GitHub (`git remote add origin ...`, `git push`).
2. En GitHub: **Settings → Pages → Source** → elegí la carpeta `/landing` en
   la rama `main`.
3. GitHub te da una URL tipo `https://tuusuario.github.io/federada-inbound-engine/`.

## 9. Prueba end-to-end real (no te la doy por hecha sin verla)

Con la función ya desplegada, corré (reemplazando la URL y la anon key):

```bash
curl -i -X POST "https://TU-PROYECTO.functions.supabase.co/intake-landing" \
  -H "content-type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -H "authorization: Bearer TU_ANON_KEY" \
  -d '{
    "name": "Prueba Real",
    "locality": "Mendoza Capital",
    "employmentType": "dependencia",
    "coverageFor": "individual",
    "intentTimeframe": "inmediato",
    "phone": "261-000-0000",
    "consent": true
  }'
```

Resultado esperado:
- La respuesta HTTP trae `"band":"contactar_ahora"`.
- En el **Table Editor** de Supabase aparece el lead "Prueba Real" en la
  tabla `leads` con `score_band = contactar_ahora`.
- Te llega un mensaje del bot de Telegram con los datos del lead.

Si alguno de estos tres puntos no pasa, revisamos juntos los logs de la
función (`supabase functions logs intake-landing`) antes de seguir.
