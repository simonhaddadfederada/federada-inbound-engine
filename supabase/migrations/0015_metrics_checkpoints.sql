-- Bloque 7, Objetivo 5: checkpoints de métricas reales (primeras horas,
-- 24h, 72h) sin hacer polling constante.
alter table content_pieces add column metrics_last_checked_at timestamptz;
