# Qué puede hacer hoy la API de Instagram

## ✅ Actualización confirmada con una prueba REAL (20/09/2026)

Publicar imágenes/stories y leer insights **NO requieren Advanced
Access/App Review** cuando es tu propia cuenta la que publica — alcanza
con **Standard Access** (automático para cualquier cuenta que ya sea
tester/admin de la app, que es nuestro caso). Esto se comprobó con
llamadas reales, no simuladas:

- Se creó un contenedor de imagen real (`POST /{ig-user-id}/media`) con
  el asset de marca ya generado — quedó en estado `FINISHED` (listo para
  publicar, **no publicado**, no visible en el perfil).
- Se leyó `insights` real de la cuenta (`reach`: 588 y 120 en los últimos
  2 días) — dato real, no inventado.

Por esto, `publishInstagramPost` y `publishInstagramStory`
(`_shared/publishers/instagram.ts`) ya no son un stub bloqueado: intentan
publicar de verdad cuando se los invoca. Siguen sin poder ejecutarse
solos porque `content_config.auto_publish = false`.

### ⚠️ Nuevo blocker encontrado (no es de permisos)

El token de Instagram (Standard Access) es de **corta duración** (dura
pocas horas) y el intercambio por uno de **larga duración** (60 días,
`grant_type=ig_exchange_token`) falla con `"Session key invalid"` —
mismo error reproducible que ya había fallado antes. Hasta resolver esto,
publicar de forma automática y sostenida (sin que Simón pase un token
nuevo cada tanto) no es viable. Es la próxima pieza a investigar.

## Matriz completa

| Capacidad | Estado | Detalle |
|---|---|---|
| Publicar imagen/post (propia cuenta) | ✅ **Confirmado con prueba real** | Standard Access alcanza. Bloqueado hoy solo por el token de corta duración. |
| Publicar story (propia cuenta) | ✅ **Confirmado con prueba real** | Ídem. |
| Publicar carrusel | 🟡 Permiso ya no es el problema | Necesita varias imágenes; `content_pieces` solo guarda un `asset_ref` por pieza — falta diseño, no permiso. |
| Publicar reel | 🟡 Permiso ya no es el problema | Necesita un video; no generamos assets de video todavía — falta producción, no permiso. |
| Publicar en cuentas que NO son la nuestra | 🟡 REQUIERE Advanced Access/App Review | Nunca es nuestro caso (single-tenant), no aplica en este proyecto. |
| Programar publicación en el lado de Meta | 🔴 NO DISPONIBLE | Meta no tiene scheduling nativo — lo resolvemos con `scheduled_at` propio. |
| Leer comentarios (webhook) | 🟢 Funciona (solo testers) | Bloqueado para el público general hasta que la app esté "Live" (App Review). |
| Responder comentarios/DMs | 🟡 REQUIERE App Review | Sigue necesitando Advanced Access porque involucra datos de OTRAS personas (quien comenta/escribe), no de la propia cuenta. |
| Límite de publicaciones | — | 100 por cuenta cada 24hs (carrusel cuenta como 1) — no es un problema a nuestra cadencia. |

**Conclusión**: el App Review completo (`docs/checklist-app-review.md`)
sigue haciendo falta para comentarios/DMs de desconocidos — eso sí
involucra datos de terceros. Para publicar contenido propio, el blocker
real pasó a ser el token de larga duración, no el permiso.
