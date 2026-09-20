# Cómo revisar y aprobar el contenido

No hay una aplicación nueva para esto — se usa el panel de Supabase que
ya tenés, en la tabla `content_pieces`.

## Pasos

1. Entrá a [supabase.com/dashboard/project/toqaghiiihlsnohbwddl/editor](https://supabase.com/dashboard/project/toqaghiiihlsnohbwddl/editor)
   e iniciá sesión con tu cuenta.
2. En la lista de tablas de la izquierda, elegí **content_pieces**.
3. Vas a ver una fila por cada pieza, con columnas: `hook`, `script`
   (el guion/desarrollo), `cta`, `keyword`, `audience`, `hypothesis`,
   `capture_mechanism` (cómo se captura el lead), `landing_url` (el link
   ya armado, listo para pegar en la historia o mandar por DM) y `status`.
4. Para **aprobar** una pieza: hacé clic en su celda `status` y cambiala
   de `borrador` a `aprobado`.
5. Cuando la publiques de verdad en Instagram: cambiá `status` a
   `publicado` y pegá el link o la referencia de esa publicación en la
   columna `published_ref` (por ejemplo, el link al reel o al post).
6. Si decidís que una pieza no sirve: cambiá `status` a `descartado`.

## Cómo usar el `landing_url` de cada pieza

Cada fila ya tiene su propio link armado en `landing_url`, con el formato:

```
https://simonhaddadfederada.github.io/federada-inbound-engine/?source=instagram&content=<slug-de-la-pieza>
```

- **Si publicás vos la story a mano desde la app de Instagram**: pegale
  el sticker de "Link" con este `landing_url` — ahí sí funciona, cero
  fricción para la persona. Esto es una función nativa de la app, no de
  la API.
- **Si la publica el sistema automáticamente** (cuando `auto_publish`
  esté en `true`): **el link sticker NO se puede agregar por API** —
  confirmado contra la documentación oficial de Meta, no es algo que
  podamos programar. Por eso el `cta` de las stories pide una palabra
  clave por respuesta ("Respondé esta historia con APORTES"), igual que
  reels/carruseles/posts — cuando te escriban, mandales vos el
  `landing_url` por privado.
- **Para reels, carruseles y posts** (siempre, sea manual o automático):
  Instagram no permite poner un link clickeable en el texto. La persona
  te escribe la palabra clave (`keyword`) por DM o comentario — mandale
  vos ese `landing_url` por privado. El lead que complete el formulario
  igual queda asociado a la pieza correcta.

## Cómo se ve la atribución cuando llega el lead

La alerta de Telegram va a mostrar de dónde vino el lead, por ejemplo:

```
🚨 Lead CONTACTAR AHORA (score 80)
WhatsApp: 261...
Edad: 26 a 35
Cobertura actual: Sí
Origen: Instagram
Contenido: Reel — "¿Sabías que una parte de tu sueldo..."
CTA: APORTES
Canal: landing
```

Y en la tabla `leads`, cada lead atribuido tiene guardado
`content_piece_id` (para cruzarlo con `content_pieces` cuando quieras
armar un conteo de "leads por contenido") y `origin_channel`.
