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

## Qué necesita el App Review

1. **Verificación del negocio** en el Business Manager (hoy figura como
   "Empresa no verificada"). Meta puede pedir documentación de la empresa/
   monotributo.
2. **URL de Política de Privacidad** — Meta exige una, incluso para una app
   chica como esta. Se puede armar una página simple y publicarla en la
   misma landing page (GitHub Pages).
3. **Ícono de la app** y nombre para mostrar.
4. **Para cada permiso solicitado**: una justificación por escrito y,
   generalmente, una grabación de pantalla mostrando el flujo real
   (alguien comenta o escribe → el sistema lo procesa) — lo cual ya podemos
   grabar, porque el flujo ya funciona en modo prueba con tu propia cuenta.

## Mientras se espera la aprobación

El sistema queda completamente listo y probado. En cuanto Meta apruebe el
acceso, no hace falta cambiar nada de código — simplemente empezarán a
llegar los webhooks reales de cualquier persona que comente o escriba.
