-- Bloque 7, Objetivos 2 y 3: soporte de assets multiples (carrusel) y
-- video (reel) por content_piece.
alter table content_pieces add column carousel_assets jsonb;
alter table content_pieces add column video_ref text;
