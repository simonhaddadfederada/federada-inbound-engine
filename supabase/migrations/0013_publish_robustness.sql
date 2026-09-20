-- Bloque 7, Objetivo 1: idempotencia real del publicador.
-- pending_container_id: si ya creamos el contenedor en Meta pero el
-- paso de publish_container falló, la próxima corrida reutiliza el
-- mismo contenedor en vez de crear uno nuevo (evita publicaciones
-- duplicadas si la primera parte del proceso sí funcionó).
alter table content_pieces add column pending_container_id text;
alter table content_pieces add column last_publish_error text;
alter table content_pieces add column publish_attempts int not null default 0;
