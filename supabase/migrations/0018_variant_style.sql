-- Bloque 8: permite renderizar una misma idea en distintos estilos
-- (pregunta / dinero_perdido / mito / dato_curioso) y comparar cuál
-- convierte mejor. parent_content_piece_id (ya existente) sigue
-- marcando de qué pieza original deriva la variante.
alter table content_pieces add column variant_style text;
