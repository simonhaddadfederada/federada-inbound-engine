-- render_started_at: permite "reclamar" una pieza de forma atómica antes
-- de renderizarla (UPDATE ... WHERE status='render_pendiente' AND
-- (render_started_at is null OR vencido) — un solo UPDATE, sin ventana de
-- carrera) para que dos corridas de GitHub Actions superpuestas nunca
-- rendericen la misma pieza dos veces.
alter table content_pieces add column render_started_at timestamptz;
