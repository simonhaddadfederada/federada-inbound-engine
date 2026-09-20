-- Bloque 6: token de Instagram durable + refresh automático.
--
-- El token que generamos desde el panel de Meta YA es de larga duración
-- (60 días) — no un token corto para intercambiar. El endpoint correcto
-- para mantenerlo vivo es "refresh" (grant_type=ig_refresh_token), no
-- "exchange" (grant_type=ig_exchange_token, que es para tokens cortos y
-- por eso fallaba con "Session key invalid").
--
-- El valor del token vive acá (no en Supabase Secrets) porque necesita
-- actualizarse solo, con frecuencia, desde una Edge Function — los
-- secrets de Supabase son estáticos y solo los cambia un humano por CLI.
-- RLS igual que el resto: bloqueado para anon/authenticated, service_role
-- lo salta.
create table platform_tokens (
  platform text primary key,
  access_token text not null,
  expires_at timestamptz not null,
  last_refreshed_at timestamptz not null default now(),
  refresh_count int not null default 0,
  last_refresh_error text
);

alter table platform_tokens enable row level security;
