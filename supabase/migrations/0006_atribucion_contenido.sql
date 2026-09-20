-- Atribución de leads a la pieza de contenido que los originó.

-- En leads: qué contenido y qué canal de origen produjo la visita a la
-- landing (distinto de source_channel, que es el mecanismo de captura —
-- para leads de landing siempre es 'landing').
alter table leads add column content_piece_id uuid references content_pieces(id) on delete set null;
alter table leads add column origin_channel text;

-- En content_pieces: dónde se va a publicar, cómo se captura el lead desde
-- ahí, el link ya armado y listo para usar, y la referencia a la
-- publicación real una vez que salió.
alter table content_pieces add column channel text not null default 'instagram';
alter table content_pieces add column capture_mechanism text;
alter table content_pieces add column landing_url text;
alter table content_pieces add column published_ref text;
