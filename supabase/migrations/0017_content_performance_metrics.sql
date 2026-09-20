-- Bloque 7, Objetivo 5: content_performance también expone las métricas
-- reales de Meta (no solo leads), para poder calcular tasas (leads/reach)
-- cuando el denominador exista.
drop view content_performance;

create view content_performance as
select
  cp.id as content_piece_id,
  cp.slug,
  cp.format,
  cp.theme,
  cp.status,
  cp.reach,
  cp.likes,
  cp.comments,
  cp.saves,
  cp.shares,
  count(l.id) as leads_total,
  count(l.id) filter (where l.score_band = 'contactar_ahora') as leads_calificados
from content_pieces cp
left join leads l on l.content_piece_id = cp.id
group by cp.id, cp.slug, cp.format, cp.theme, cp.status, cp.reach, cp.likes, cp.comments, cp.saves, cp.shares;
