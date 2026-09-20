# Identidad visual obligatoria (regla del sistema, 20/09/2026)

Toda pieza visual que se genere para Federada — post, story, carrusel,
portada de reel — tiene que respetar esto. No es una preferencia estética,
es una regla fija que cualquier script/función de render debe seguir.

## Tipografías

- **Red Hat Display** — titulares/hooks (usar variantes `Black` o
  `ExtraBold` para el elemento dominante).
- **Red Hat Text** — cuerpo, subtextos, firma (`Regular`/`Medium`).
- Archivos guardados en `assets/fonts/` (`RedHatDisplay[wght].ttf`,
  `RedHatText[wght].ttf` — fuentes variables, licencia OFL, gratis). Cargar
  el peso con `font.set_variation_by_name("Black"|"Bold"|"ExtraBold"|
  "SemiBold"|"Medium"|"Regular"|"Light")`.

## Colores

- Azul institucional `#001489` — color base/fondo principal.
- Magenta institucional `#F04E98` — acento estratégico (CTA, palabra
  clave del hook). Nunca como color de fondo ni en grandes superficies.
- Blanco — texto principal sobre el azul.
- **No usar verde ni ningún color fuera de esta paleta** salvo que haya
  una razón muy clara y se lo consulte antes.

## Reglas de composición

- Mobile-first: todo se diseña pensando en verse bien en un celular.
- Jerarquía muy clara: un solo elemento dominante (el hook), todo lo
  demás secundario.
- El hook tiene que poder leerse y entenderse en menos de 2 segundos.
- Menos texto dentro del asset es mejor — el desarrollo largo va en el
  caption, no en la imagen.
- El CTA tiene que verse como un botón real (forma, color de acento,
  contraste), nunca como un adorno o un link de texto suelto.
- Evitar que la pieza se sienta "institucional/folleto" — el objetivo es
  verse comercial y moderna sin dejar de ser reconociblemente Federada.
- Formato post feed: 1080×1350 (4:5, el más alto que acepta Instagram sin
  recortar). Formato story: 1080×1920.

## Cómo se aplicó en la primera pieza real

Ver `assets/generated/post-error-frecuente-cartilla.png` como referencia
del resultado esperado: fondo azul con degradé sutil, hook en Red Hat
Display Black con la palabra clave en magenta, texto de apoyo en Red Hat
Text, botón de CTA magenta con flecha dibujada (no un glifo de fuente,
para evitar caracteres faltantes), firma discreta abajo.
