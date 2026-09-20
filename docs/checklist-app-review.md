# Checklist operativo — App Review de Meta

Guía paso a paso para cuando te sientes a hacerlo. Sin decisiones que pensar.

## 🟢 Descubrimiento importante antes de arrancar

Para **publicar contenido e insights en TU PROPIA cuenta** (nunca en la de
otra persona — que es exactamente nuestro caso), Meta tiene un modo
llamado **"Standard Access"** que **funciona sin pasar por App Review**,
siempre que tu cuenta ya tenga un rol en la app (la tuya ya lo tiene: es
tester). Esto **no está confirmado en la práctica todavía** (hay que
probarlo), pero si funciona como documenta Meta, te ahorra semanas de
espera para el publicador y el analizador. Es 10 minutos de tu parte:

### Paso rápido a probar (antes del checklist completo de abajo)
1. Andá a [developers.facebook.com](https://developers.facebook.com) → tu
   app **Federada Inbound Engine** → **Casos de uso** → "Administrar
   mensajes y contenido en Instagram" → **Personalizar**.
2. Agregá los permisos `instagram_business_content_publish` y
   `instagram_business_manage_insights` (botón "Agregar", quedan en
   estado "Listo para prueba" — es exactamente el mismo estado en el que
   ya están tus otros 3 permisos hoy).
3. Generá un token de acceso nuevo para tu cuenta @simoonhaddad (mismo
   lugar de siempre) y pasámelo.
4. Yo pruebo con ese token si publicar/leer insights en tu cuenta ya
   funciona sin esperar el App Review. Si funciona, lo activamos ya.

Esto **NO reemplaza** el checklist de abajo — los permisos de comentarios
y DMs (`manage_comments`, `manage_messages`) siguen necesitando el
proceso completo porque involucran datos de OTRAS personas (quien te
comenta o escribe), no solo los tuyos.

---

## Checklist completo de App Review (para comentarios/DMs de desconocidos)

### 1. Qué tenés que abrir
El navegador, sesión logueada con tu cuenta de Meta/Facebook personal
(la misma con la que administrás la Página).

### 2. Dónde tenés que entrar
- Verificación de empresa: **business.facebook.com** → ⚙️ Configuración
  → Centro de seguridad → Verificación de la empresa.
- Videos y envío final: **developers.facebook.com** → tu app → Revisión
  → Revisión de la aplicación → la solicitud ya creada
  (`submission_id 1114055364532957`).

### 3. Qué documentación tenés que subir
Depende de si Meta puede confirmar tu empresa automáticamente. Si no,
te va a pedir uno de estos (tené a mano el que consigas más rápido):
CUIT/constancia de inscripción AFIP, o un comprobante de domicilio
comercial. Datos que vas a tener que escribir a mano: razón social/tu
nombre legal, dirección, teléfono, email, sitio web.

### 4. Qué permisos estamos pidiendo (en esta solicitud)
`instagram_business_basic`, `instagram_business_manage_comments`,
`instagram_business_manage_messages`, `public_profile`.

*(Los de publicar/insights se prueban aparte, ver sección de arriba —
si no funcionan en Standard Access, se agregan a esta misma solicitud
antes de grabar los videos, para no hacer dos rondas.)*

### 5. Qué videos tenés que grabar
Uno por cada permiso — 3 videos cortos, sin edición.

### 6. Qué debe mostrar exactamente cada video
| Permiso | Qué mostrar |
|---|---|
| `instagram_business_basic` | Un comentario o DM llegando a @simoonhaddad, y el nombre de usuario de esa persona apareciendo guardado en la tabla `leads` (Table Editor de Supabase). |
| `instagram_business_manage_comments` | Comentar "APORTES" en una publicación pública de instagram.com/simoonhaddad, y la alerta de Telegram llegándote a vos. |
| `instagram_business_manage_messages` | Mandarle un DM a @simoonhaddad desde otra cuenta, y la alerta de Telegram llegándote a vos. |

Se puede grabar con el grabador de pantalla nativo del celular. Si querés
mostrar el lado del sistema en la misma toma, compartí pantalla del feed
de Telegram o del Table Editor.

### 7. Qué texto poner en la justificación de cada permiso
Ya está escrito y guardado en la solicitud (no hace falta redactarlo de
nuevo) — resume que es una herramienta interna de un solo negocio (no
multi-tenant), que sirve para que un asesor de seguros reciba alertas
cuando alguien le comenta/escribe pidiendo información.

### 8. Qué URLs necesita Meta
- Política de privacidad: ya cargada.
- URL de eliminación de datos: ya cargada.
- Plataforma/sitio web de la app (paso que quedó pendiente): usá
  `https://simonhaddadfederada.github.io/federada-inbound-engine/`

### 9. Qué cosas ya están listas (no tenés que tocar nada)
- App creada, permisos agregados, webhook funcionando y verificado.
- Política de privacidad + eliminación de datos publicadas y cargadas.
- Textos de "Uso permitido" y "Gestión de datos" completos.
- Ícono de la app cargado.

### 10. Qué cosas tenés que hacer vos (nadie más puede hacerlas)
1. Verificación de empresa (tus datos legales reales).
2. Grabar los 3 videos.
3. Cargar la URL de plataforma (paso 8).
4. Subir los videos a cada sección y enviar la solicitud.
5. (Opcional, 10 minutos) Probar el atajo de Standard Access de arriba
   antes de grabar nada — si funciona, te ahorrás esperar el review para
   publicar contenido.

## Mientras se espera

Todo el sistema (generador, cola, scheduling) sigue funcionando y
acumulando contenido listo. En cuanto Meta apruebe, no hay que tocar
código — el publicador ya está preparado, solo hay que cambiar
`content_config.auto_publish` a `true` cuando decidas confiar en él.
