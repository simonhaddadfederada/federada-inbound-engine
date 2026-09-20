-- Fecha/hora real de publicación, distinta de scheduled_at (que es la
-- hora sugerida/planeada, no necesariamente cuándo se publicó de verdad).
alter table content_pieces add column published_at timestamptz;
