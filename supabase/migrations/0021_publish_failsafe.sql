-- Failsafe (Bloque 16, modo autónomo): si auto_publish=true y la
-- publicación falla 3 veces seguidas, el propio sistema apaga
-- auto_publish y avisa por Telegram — no sigue intentando solo para
-- siempre. Se persiste en content_config (no en memoria) porque cada
-- corrida del cron es una invocación nueva de la función.
alter table content_config add column consecutive_publish_failures int not null default 0;
