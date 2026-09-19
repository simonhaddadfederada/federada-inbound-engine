-- Activa Row Level Security en las 4 tablas y no define ninguna política
-- para los roles "anon" ni "authenticated". Esto bloquea por completo el
-- acceso directo desde la clave pública (anon/publishable key) — la misma
-- que está embebida en el código público de la landing page.
--
-- No afecta a las Edge Functions: siguen usando la service_role key, que
-- por diseño de Postgres/Supabase siempre atraviesa RLS sin importar las
-- políticas definidas.
--
-- Motivo: se verificó que, sin esto, cualquiera con la anon key podía leer
-- nombres y teléfonos de todos los leads guardados.

alter table leads enable row level security;
alter table conversation_state enable row level security;
alter table events_log enable row level security;
alter table notifications_log enable row level security;
