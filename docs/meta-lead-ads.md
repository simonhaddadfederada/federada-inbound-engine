# Meta Lead Ads V1 — infraestructura (sin pautar)

No se creó ninguna campaña, anuncio ni formulario real en Meta Ads
Manager. Esto es solo la infraestructura para cuando decidas pautar.

## Flujo

```
Meta Lead Ad (formulario instantáneo)
  -> webhook "leadgen" de la Página
  -> meta-leadgen-webhook (verifica firma, guarda atribución)
  -> Graph API (trae las respuestas reales, si hay META_PAGE_ACCESS_TOKEN)
  -> scoring
  -> Telegram
```

## Formulario recomendado (fricción mínima, igual que la landing)

Cuando crees el formulario en Ads Manager, usá estas 3 preguntas — nada más:

1. **Pregunta personalizada** `rango_edad`: opción múltiple (18 a 25 / 26 a
   35 / 36 a 45 / 46 o más).
2. **Pregunta personalizada** `tiene_cobertura`: Sí / No.
3. **Campo precargado de Meta**: `phone_number` (Meta lo autocompleta desde
   el perfil de la persona — fricción prácticamente cero, no hace falta
   sacarlo aunque nosotros solo usemos el teléfono).

**No agregues** email, nombre, empresa, sueldo, aporte, ni grupo familiar
— eso se conversa después, personalmente.

## Atribución guardada por lead

`ad_campaign_id`, `ad_set_id`, `ad_id`, `ad_form_id` (migración
`0010_meta_ads_atribucion.sql`) — permite más adelante comparar
"Anuncio X → N leads → M ventas" por anuncio real.

## ⚠️ Corrección importante: el flujo NO está completo sin META_PAGE_ACCESS_TOKEN

El bloque anterior dijo "el webhook guarda cualquier lead aunque falte el
token" — eso es cierto pero **engañoso si se lee como "el flujo
funciona"**. Aclarado en 3 pasos separados, porque son 3 cosas distintas:

| Paso | Qué es | Estado sin `META_PAGE_ACCESS_TOKEN` |
|---|---|---|
| **A. Recibir el evento webhook** | Meta nos avisa "alguien completó un formulario" | ✅ Funciona — probado (🟡 con payload simulado, ver abajo) |
| **B. Obtener el `leadgen_id`** | Viene incluido en el mismo evento del paso A, no requiere ningún llamado extra | ✅ Funciona — es un dato del payload, no de la Graph API |
| **C. Obtener los datos reales del formulario** (teléfono, rango etario, cobertura, y cualquier otro `field_data`) | Requiere un llamado aparte a la Graph API (`GET /{leadgen_id}`) con un **Page Access Token con permiso `leads_retrieval`** | ❌ **Bloqueado.** Sin esto NO tenemos el teléfono ni ningún dato de contacto. |

**Consecuencia concreta**: hoy, si llegara un lead real de Meta Ads, se
guardaría una fila en `leads` con la atribución del anuncio (para no
perderla) pero **sin teléfono ni ningún dato de contacto** — no es un
lead que Simón pueda usar para vender, es solo un aviso de "pasó algo,
andá a revisarlo a mano en Ads Manager". El paso C es el que falta para
que esto sea un lead de verdad.

## Estado de las pruebas (nomenclatura pedida)

- 🟡 **Pasos A + B (recibir evento + leadgen_id) y firma HMAC**: probado
  con un payload simulado, firmado de forma independiente (Python), con
  la forma exacta que documenta Meta para el campo `leadgen` — **no es
  un lead real ni se usó la herramienta oficial de Meta**. Confirmado:
  firma inválida rechaza (401), payload válido guarda la atribución
  correcta, reintento duplicado se ignora, alerta de Telegram con la
  línea "Anuncio: ..." confirmada por Simón.
- ❌ **Paso C (datos reales del formulario vía Graph API)**: bloqueado —
  no existe `META_PAGE_ACCESS_TOKEN` todavía. Este paso nunca se probó,
  ni simulado ni real, porque no hay token con el que probarlo.
- ❌ **Lead Ads Testing Tool oficial de Meta**: no se usó todavía
  (requiere sesión logueada de Simón en developers.facebook.com). Pasos
  para cuando quieras probarlo vos: Meta for Developers → tu app → tu
  Página → "Lead Ads Testing Tool" → elegís la Página y el formulario (o
  el tool te deja crear uno de prueba) → "Generate Test Lead" → eso
  dispara el webhook real con datos falsos, sin gastar un peso.
