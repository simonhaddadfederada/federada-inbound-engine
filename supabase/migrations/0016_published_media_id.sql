-- published_ref guarda el permalink (para que Simón lo abra); esto guarda
-- el media id real que pide la API de insights — son cosas distintas.
alter table content_pieces add column published_media_id text;
