-- Bloque 5, Objetivo 4: atribución de leads de Meta Lead Ads.
-- Guarda la referencia exacta del anuncio que generó el lead, para poder
-- comparar más adelante "ANUNCIO X -> N leads -> M ventas".
alter table leads add column ad_campaign_id text;
alter table leads add column ad_set_id text;
alter table leads add column ad_id text;
alter table leads add column ad_form_id text;
