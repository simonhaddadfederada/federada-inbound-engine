# Qué puede hacer hoy la API de Instagram (verificado contra docs oficiales, 20/09/2026)

Consultado en `developers.facebook.com/docs/instagram-platform` (Content
Publishing). Resumen corto, no se generó documentación extensa a propósito.

| Capacidad | Estado | Detalle |
|---|---|---|
| Publicar imagen/post | 🟡 REQUIERE PERMISO | Necesita `instagram_business_content_publish` (Instagram Login) — no lo tenemos agregado en la app todavía |
| Publicar carrusel | 🟡 REQUIERE PERMISO | Mismo permiso que arriba. Cuenta como 1 sola publicación para el límite de rate |
| Publicar reel | 🟡 REQUIERE PERMISO | Mismo permiso que arriba |
| Publicar story | 🟡 REQUIERE PERMISO | Mismo permiso que arriba |
| Programar publicación en el lado de Meta | 🔴 NO DISPONIBLE | Meta no tiene scheduling nativo — hay que guardar `scheduled_at` nosotros y publicar en el momento exacto (por eso el módulo de cola/scheduling propio) |
| Leer comentarios (webhook) | 🟢 FUNCIONA (solo testers) | Ya construido y probado con un evento real. Bloqueado para el público general hasta que la app esté "Live" (App Review) |
| Responder comentarios | 🟡 REQUIERE PERMISO + App Review | Tenemos `manage_comments` agregado, pero el mismo bloqueo de App Review/Live aplica |
| Enviar/responder DMs | 🟡 REQUIERE PERMISO + App Review | Tenemos `manage_messages` agregado, mismo bloqueo |
| Leer métricas (Insights) | 🟡 REQUIERE PERMISO | Necesita `instagram_business_manage_insights`, no agregado todavía |
| Límite de publicaciones | — | 100 publicaciones por API por cuenta cada 24hs (carrusel cuenta como 1) — no es un problema a nuestra cadencia actual |

**Conclusión para este bloque**: nada de publicación automática es posible
hoy sin agregar `instagram_business_content_publish` (y `..._manage_insights`)
al App Review que ya está en trámite, y sin que Meta apruebe la app como
"Live". Por eso los adapters de publicación (`_shared/publishers/instagram.ts`)
quedan construidos pero en estado `blocked`, con el motivo exacto de qué los
desbloquea — no se inventa que publican.
