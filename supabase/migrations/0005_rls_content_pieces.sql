-- content_pieces se creó sin RLS (el mismo error que ya se corrigió en las
-- otras 4 tablas en 0002_enable_rls.sql). Se verificó con la clave pública
-- real que podía escribir filas sin restricción — se cierra acá.
alter table content_pieces enable row level security;
