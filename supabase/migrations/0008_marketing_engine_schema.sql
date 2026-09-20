-- Bloque 4: Motor de marketing V1 — esquema.

-- Metadatos para el motor: tema (para evitar repetición), tipo de gancho
-- (para el análisis posterior), familia de contenido (variantes de una
-- pieza original), agenda y datos de asset generado.
alter table content_pieces add column theme text;
alter table content_pieces add column hook_type text;
alter table content_pieces add column parent_content_piece_id uuid references content_pieces(id) on delete set null;
alter table content_pieces add column scheduled_at timestamptz;
alter table content_pieces add column asset_ref text;
alter table content_pieces add column asset_type text;
alter table content_pieces add column retention_pct numeric;
alter table content_pieces add column clicks int;

-- Configuración de cadencia y guardrails — una sola fila, editable desde
-- el Table Editor de Supabase sin tocar código.
create table content_config (
  id int primary key default 1,
  reels_per_day int not null default 1,
  stories_per_day int not null default 2,
  carousels_per_week int not null default 2,
  posts_per_week int not null default 2,
  min_days_buffer int not null default 7,
  timezone text not null default 'America/Argentina/Mendoza',
  slot_times jsonb not null default '{"reel":["12:30"],"story":["09:30","19:00"],"carousel":["17:00"],"post":["16:00"]}'::jsonb,
  auto_publish boolean not null default false,
  ai_daily_budget_usd numeric not null default 2.00,
  constraint content_config_singleton check (id = 1)
);
insert into content_config (id) values (1);

-- Registro de gasto de IA: hace cumplir ai_daily_budget_usd antes de
-- habilitar cualquier ejecución autónoma de generación/análisis.
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  purpose text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric not null default 0
);

-- Conclusiones del analizador: se calculan primero con SQL/código
-- (metrics jsonb) y solo si corresponde se resumen con un modelo de
-- lenguaje (conclusion).
create table content_insights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scope text not null, -- 'content_piece' | 'theme' | 'global'
  ref text,
  conclusion text not null,
  sample_size int not null default 0,
  metrics jsonb
);

-- Leads por contenido calculado en vivo desde la atribución real
-- (leads.content_piece_id), no a mano — ver Bloque 3.
create view content_performance as
select
  cp.id as content_piece_id,
  cp.slug,
  cp.format,
  cp.theme,
  cp.status,
  count(l.id) as leads_total,
  count(l.id) filter (where l.score_band = 'contactar_ahora') as leads_calificados
from content_pieces cp
left join leads l on l.content_piece_id = cp.id
group by cp.id, cp.slug, cp.format, cp.theme, cp.status;

alter table content_config enable row level security;
alter table ai_usage_log enable row level security;
alter table content_insights enable row level security;
