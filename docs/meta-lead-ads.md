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

## Qué falta para que traiga leads reales

`META_PAGE_ACCESS_TOKEN` (permiso `leads_retrieval` sobre la Página). Sin
esto, el webhook **igual guarda el lead con la atribución del anuncio**
(para no perderla) pero sin teléfono, y la alerta de Telegram dice
explícitamente que hay que revisarlo a mano en Ads Manager — no se
inventa un dato que no tenemos.

## Estado de las pruebas (nomenclatura pedida)

- 🟡 **Firma HMAC + parseo del webhook**: probado con un payload simulado,
  firmado de forma independiente (Python), con la forma exacta que
  documenta Meta para el campo `leadgen`. Confirmado: firma inválida
  rechaza (401), payload válido guarda el lead con la atribución
  correcta, reintento duplicado se ignora, alerta de Telegram con la
  línea "Anuncio: ..." confirmada por Simón. **No es un lead real.**
- ❌ **Recuperar las respuestas reales del formulario (Graph API)**:
  bloqueado — no existe `META_PAGE_ACCESS_TOKEN` todavía.
- ❌ **Lead Ads Testing Tool oficial de Meta**: no se usó en este bloque
  (requiere sesión logueada de Simón en developers.facebook.com). Pasos
  para cuando quieras probarlo vos: Meta for Developers → tu app → tu
  Página → "Lead Ads Testing Tool" → elegís la Página y el formulario (o
  el tool te deja crear uno de prueba) → "Generate Test Lead" → eso
  dispara el webhook real con datos falsos, sin gastar un peso.
