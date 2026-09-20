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

- **Para historias**: pegá ese link directo en el sticker de "Link" de la
  historia. La persona lo toca, completa los 3 pasos, y el lead va a
  quedar asociado automáticamente a esa historia.
- **Para reels, carruseles y posts**: Instagram no permite poner un link
  clickeable en el texto de esas publicaciones. Ahí la persona te va a
  escribir la palabra clave (`keyword`) por DM o comentario — cuando te
  escriba, mandale vos ese mismo `landing_url` por privado. Así, aunque
  el primer contacto sea manual, el lead que complete el formulario
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
