# Cómo funciona el puntaje de leads (scoring)

Es una suma simple de puntos, sin IA. El código fuente de la verdad está en
[`supabase/functions/_shared/scoring.ts`](../supabase/functions/_shared/scoring.ts)
— este documento explica esos mismos números en palabras.

**Rediseñado el 20/09/2026**: el score ahora mide **intención demostrada**,
no cantidad de campos de formulario completados. Antes, un lead sumaba
puntos "por cada pregunta contestada" — eso penalizaba injustamente a los
leads de la landing de fricción mínima, que a propósito solo hace 2 taps +
teléfono en vez de un formulario largo.

## Puntos que suma cada lead

| Señal | Puntos |
|---|---|
| Dio el primer paso voluntariamente (comentó, escribió, completó el mini-flujo) | +20 |
| Pidió explícitamente contacto/información (completar el flujo y enviarlo ya cuenta como esto) | +20 |
| Dejó un WhatsApp/teléfono de contacto | +40 |
| *(bonus, solo si el canal llega a saberlo)* Tiene aportes (dependencia/monotributo) | +10 |
| *(bonus)* Quiere cambiar de cobertura de forma inmediata | +10 |
| *(bonus)* Quiere cambiar en 1 a 3 meses | +5 |

**Máximo posible: 100 puntos.**

## Por qué la landing de fricción mínima siempre da "CONTACTAR AHORA"

El flujo de 3 pasos de la landing (edad → cobertura actual → WhatsApp)
exige el teléfono para poder enviarse. Eso significa que **todo envío
válido** de ese formulario suma 20 (dio el primer paso) + 20 (pidió
contacto) + 40 (dejó el teléfono) = **80 puntos**, siempre — cae en la
banda más alta por diseño.

Esto es intencional: en un formulario de 3 taps, la fricción baja es lo que
filtra la intención (solo alguien con ganas real completa hasta el final y
escribe su WhatsApp), no la cantidad de datos pedidos. La edad y si tiene
cobertura hoy se guardan como dato de contexto para Simón, pero **no suman
puntos todavía** — no hay evidencia comercial clara de que uno u otro valor
sea más o menos "caliente", así que no se inventó un peso sin fundamento.
Se puede ajustar el día que haya datos reales de conversión que lo justifiquen.

## Bandas (sin cambios)

| Banda | Rango de puntos | Qué significa |
|---|---|---|
| 🧊 FRÍO | 0 – 20 | Dio el primer paso, pero sin pedir nada concreto ni dejar contacto. |
| 🌤️ TIBIO | 21 – 45 | Pidió información/contacto explícitamente, pero sin dejar teléfono todavía (típico de un comentario de Instagram sin DM). |
| 🔥 CALIENTE | 46 – 70 | Dejó el teléfono. |
| 🚨 CONTACTAR AHORA | 71+ | Dio el primer paso + pidió contacto + dejó teléfono — el caso típico de la landing. Te llega alerta por Telegram. |

## Instagram usa la misma fórmula

Un comentario o DM con palabra clave sin teléfono (Instagram no lo entrega)
da 20 (dio el primer paso) + 20 (palabra clave = pedido explícito) = 40 →
**TIBIO**. Un comentario sin palabra clave da solo 20 → **FRÍO**. La alerta
de Telegram para Instagram se manda siempre, independientemente de la
banda (ver `docs/architecture.md`), así que este número hoy es sobre todo
para poder priorizar/filtrar más adelante, no para decidir si se notifica.

## Cómo ajustar

Todos los números viven en `SCORE_WEIGHTS` y `SCORE_BANDS` en `scoring.ts`,
en un solo lugar.
