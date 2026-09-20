-- Bloque 18: Creative Director / Design Quality V1.
-- creative_direction: decisión estructurada (concepto, emoción, estilo,
-- jerarquía, etc.) tomada ANTES de renderizar — auditable, no solo usada
-- al vuelo. quality_scores/quality_score: resultado del quality gate
-- (heurística real medible: longitud de texto, uso de CTA, contraste,
-- variedad de elementos — no es un juicio de una IA de visión, eso
-- necesitaría un servicio nuevo no autorizado; documentado como
-- alternativa futura, no implementado).
alter table content_pieces add column creative_direction jsonb;
alter table content_pieces add column quality_scores jsonb;
alter table content_pieces add column quality_score numeric;
