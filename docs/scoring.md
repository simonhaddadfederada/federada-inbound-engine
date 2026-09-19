# Cómo funciona el puntaje de leads (scoring)

Es una suma simple de puntos, sin IA. El código fuente de la verdad está en
[`supabase/functions/_shared/scoring.ts`](../supabase/functions/_shared/scoring.ts)
— este documento explica esos mismos números en palabras.

## Puntos que suma cada lead

| Señal | Puntos |
|---|---|
| Inició la conversación voluntariamente (escribió, comentó, llenó el formulario) | +10 |
| Por cada pregunta de calificación que contestó (hasta 6) | +5 c/u (máx. +30) |
| Está en relación de dependencia o es monotributista (tiene aportes) | +20 |
| Quiere cambiar de cobertura de forma inmediata | +25 |
| Quiere cambiar en 1 a 3 meses | +15 |
| Dejó un teléfono de contacto de forma voluntaria | +15 |
| Pidió explícitamente información/cotización/plan | +10 |

**Máximo posible: 110 puntos.**

## Bandas

| Banda | Rango de puntos | Qué significa |
|---|---|---|
| 🧊 FRÍO | 0 – 20 | Mostró algo de interés, pero muy poca información o intención. |
| 🌤️ TIBIO | 21 – 45 | Contestó varias preguntas, pero sin urgencia ni aportes claros. |
| 🔥 CALIENTE | 46 – 70 | Buen perfil, con aportes y/o intención de mediano plazo. |
| 🚨 CONTACTAR AHORA | 71+ | Alta intención, aportes, plazo inmediato y/o dejó teléfono. Te llega alerta por Telegram. |

## Por qué estos números (y cómo ajustarlos)

Son un punto de partida razonable, no un dogma. Están pensados para que:

- Nadie llegue a "CONTACTAR AHORA" solo por escribir un mensaje — tiene que
  haber datos de calificación reales.
- Tener aportes (dependencia/monotributo) y una intención de plazo inmediato
  sea, por sí solo, casi suficiente para disparar la alerta — porque es la
  combinación que históricamente más convierte en venta.
- Dejar el teléfono sume fuerte, porque es la señal más difícil de fingir.

Si después de un tiempo de uso real ves que el umbral queda muy alto o muy
bajo (demasiadas alertas, o ninguna), los números se ajustan en un solo
lugar (`SCORE_WEIGHTS` y `SCORE_BANDS` en `scoring.ts`) sin tocar el resto
del sistema.
