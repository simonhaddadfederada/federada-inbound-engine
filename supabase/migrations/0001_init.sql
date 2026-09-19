-- Esquema inicial: leads, estado de conversación, log de eventos (dedup) y log de notificaciones.

create extension if not exists pgcrypto;

create type lead_channel as enum (
  'landing', 'instagram', 'facebook', 'whatsapp', 'meta_ads', 'google', 'email', 'referido', 'otro'
);

create type lead_status as enum (
  'nuevo', 'en_conversacion', 'calificado', 'contactado', 'en_negociacion', 'ganado', 'perdido', 'descartado'
);

create type score_band as enum ('frio', 'tibio', 'caliente', 'contactar_ahora');

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- origen
  source_channel lead_channel not null,
  campaign text,
  post_ref text,
  external_thread_id text, -- id de conversación en el canal de origen (dm id, wa_id, email, etc.)

  -- datos de calificación (sin información médica)
  name text,
  locality text,
  employment_type text check (employment_type in ('dependencia', 'monotributo', 'particular') or employment_type is null),
  contribution_approx text,
  coverage_for text check (coverage_for in ('individual', 'grupo_familiar') or coverage_for is null),
  intent_timeframe text check (intent_timeframe in ('inmediato', '1_3_meses', 'mas_de_3_meses', 'sin_definir') or intent_timeframe is null),
  phone text,
  explicit_info_request boolean not null default false,
  answers_completed int not null default 0,

  -- consentimiento
  consent boolean not null default false,
  consent_at timestamptz,

  -- scoring y estado comercial
  score int not null default 0,
  score_band score_band not null default 'frio',
  status lead_status not null default 'nuevo',
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  notes text,
  outcome text check (outcome in ('venta', 'no_venta', 'pendiente') or outcome is null),

  unique (source_channel, external_thread_id)
);

create index leads_score_band_idx on leads (score_band);
create index leads_status_idx on leads (status);

create table conversation_state (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  current_step text not null default 'inicio',
  context jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table events_log (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  source lead_channel not null,
  event_key text not null, -- clave de deduplicación: id externo del evento o hash del payload
  payload jsonb,
  processed boolean not null default false,
  error text,
  unique (source, event_key)
);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  sent_at timestamptz not null default now(),
  channel text not null default 'telegram',
  success boolean not null,
  detail text
);

-- Mantiene updated_at al día en cada UPDATE de leads.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_set_updated_at
before update on leads
for each row execute function set_updated_at();
