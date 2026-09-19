# Fase 2 — Instagram (estado y próximos pasos)

## Lo que ya está hecho y verificado

- **Business Manager**: existente, con tu Página de Facebook ("Simon Haddad -
  Federada Salud", ID `1246428528563183`) y tu cuenta de Instagram
  (@simoonhaddad) vinculadas.
- **App de Meta for Developers**: creada — `Federada Inbound Engine`
  (App ID `1113996954538798`), con el caso de uso "Administrar mensajes y
  contenido en Instagram".
- **Permisos agregados** (estado "Listo para prueba"): `instagram_business_basic`,
  `instagram_business_manage_comments`, `instagram_business_manage_messages`.
- **Cuenta de Instagram agregada como tester**: @simoonhaddad
  (ID de Instagram Business: `17841439114787646`), invitación aceptada desde
  instagram.com → Configuración → Aplicaciones y sitios web → Invitaciones
  para evaluadores (en el celular esta sección no aparece, es un bug conocido
  de Meta — hay que hacerlo desde la versión web).
- **Edge Function `instagram-webhook`** desplegada en Supabase, con:
  - Verificación de firma HMAC (`X-Hub-Signature-256`) — **9 tests
    automáticos**, incluyendo un vector de prueba calculado de forma
    independiente con Python.
  - Detección de palabras clave en comentarios y DMs (reglas fijas, sin IA)
    — **6 tests automáticos**.
  - Guardado del lead + alerta de Telegram — **probado con curl simulando
    un webhook real de Meta, firma incluida**: el lead se guardó
    correctamente y el mensaje de Telegram llegó de verdad.
  - Protección contra duplicados (Meta reintenta el envío si no respondés
    rápido) — probado.
  - Rechazo de firmas inválidas (401) — probado.
- **Webhook configurado y verificado en Meta**: URL de callback + token de
  verificación guardados, handshake de verificación confirmado por Meta
  (✓ verde), campos `comments` y `messages` suscritos.

## Lo que falta (y por qué no depende de nosotros)

La app está en modo **"Sin publicar"**. Meta solo entrega webhooks reales
cuando la app está **publicada**, y como pedimos permisos avanzados de
Instagram (`manage_comments`, `manage_messages`), publicarla requiere pasar
por el proceso de **App Review** de Meta. Esto se confirmó con una prueba
real: un comentario con "APORTES" hecho desde otra cuenta de Instagram
(@si.moncho) en una publicación de @simoonhaddad no generó ningún evento en
el webhook — exactamente lo esperado según la propia advertencia de Meta.

**App Review típicamente tarda 2 a 4 semanas.** Conviene enviarlo cuanto
antes porque es lo que más demora del proceso.

## Solicitud de App Review — estado actual (armada el 19/09/2026)

Ya se creó la solicitud (`submission_id 1114055364532957`) en
developers.facebook.com → Revisión → Revisión de la aplicación. Para
convertirte en Tech Provider (paso obligatorio para pedir estos permisos)
tuviste que aceptar una decisión irreversible — ya la confirmaste.

**Completado:**
- ✅ **Configuración de la aplicación**: política de privacidad, URL de
  eliminación de datos, ícono, categoría — todo cargado y guardado.
- ✅ **Uso permitido — texto de justificación** de los 4 permisos
  (`instagram_business_basic`, `instagram_business_manage_messages`,
  `instagram_business_manage_comments`, `public_profile`) — ya redactado y
  guardado, explicando que la app es una herramienta interna de un solo
  negocio (no multi-tenant) y cómo probar el flujo real.
- ✅ **Gestión de datos**: declaramos a Supabase, Inc. (Brasil/EE.UU.) y
  Telegram FZ-LLC (Emiratos Árabes Unidos) como encargados del tratamiento;
  responsable de los datos: Simón Haddad, en Argentina; sin solicitudes de
  seguridad nacional en los últimos 12 meses; sin procesos formales
  todavía para pedidos de autoridades (marcado honestamente como tal).

**Pendiente — dos bloqueos genuinos, ambos tuyos:**

1. **Verificación de empresa** (sección "Verificación" de la solicitud).
   Necesita tus datos legales reales: nombre/razón social, dirección,
   teléfono, email, sitio web, y posiblemente subir documentación (CUIT,
   constancia de AFIP u otro comprobante) si Meta no puede confirmar la
   empresa automáticamente. Yo no puedo completar esto — es tu identidad
   legal. Se hace desde Meta Business Suite → Configuración → Centro de
   seguridad → Verificación de la empresa → "Iniciar verificación".

2. **Grabación de pantalla por permiso** (sección "Uso permitido", un
   video por cada uno de los 3 permisos de Instagram). Meta pide ver la
   experiencia real: alguien comentando o escribiéndole a @simoonhaddad, y
   el sistema reaccionando. Instrucciones exactas para grabar cada video:

   - **instagram_business_basic**: mostrar un comentario o DM llegando a
     @simoonhaddad y, en algún lugar visible (la tabla `leads` en el Table
     Editor de Supabase, por ejemplo), el nombre de usuario de esa persona
     apareciendo guardado.
   - **instagram_business_manage_comments**: comentar con la palabra
     "APORTES" en cualquier publicación pública de
     instagram.com/simoonhaddad, y mostrar la alerta de Telegram
     llegándote a vos.
   - **instagram_business_manage_messages**: mandarle un DM a
     @simoonhaddad desde otra cuenta, y mostrar la alerta de Telegram
     llegándote a vos.

   Se puede grabar con la grabadora de pantalla nativa del celular (para
   el lado de Instagram) y, si querés mostrar también el lado del sistema
   en la misma toma, compartiendo pantalla del feed de Telegram o del
   Table Editor de Supabase. No hace falta edición, alcanza con que se vea
   claro. Una vez que tengas los 3 videos, los subimos juntos a cada
   sección de "Uso permitido" y marcamos las casillas de confirmación.

3. **Instrucciones para el revisor**: quedó pendiente porque pide agregar
   antes una "plataforma" (ej. sitio web) en la configuración de la app —
   se puede resolver en el mismo momento en que carguemos los videos.

## Mientras se espera la aprobación

El sistema queda completamente listo y probado. En cuanto Meta apruebe el
acceso, no hace falta cambiar nada de código — simplemente empezarán a
llegar los webhooks reales de cualquier persona que comente o escriba.
