-- Motor de contenido V1: cola de ideas/guiones/CTAs generados en batch
-- (no un agente corriendo 24/7 — se genera una tanda por vez y se guarda
-- acá para revisión y aprobación humana antes de publicar).

create type content_format as enum ('reel', 'carousel', 'story', 'post');
create type content_status as enum ('borrador', 'aprobado', 'publicado', 'descartado');

create table content_pieces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- identificador corto y legible para usar como utm_content en los links
  -- de bio/stories, y así poder cruzarlo despues con leads.post_ref
  slug text not null unique,
  format content_format not null,
  hook text not null,          -- primeros 2-3 segundos / primera linea
  script text not null,        -- desarrollo o guion
  cta text not null,           -- llamado a la accion tal cual se diria
  keyword text,                -- palabra clave de captura (ej "APORTES")
  audience text,               -- a quien apunta
  hypothesis text,             -- por que podria generar leads
  suggested_date date,
  status content_status not null default 'borrador',
  -- metricas posteriores (carga manual al principio, luego vía API de Meta Insights)
  impressions int,
  reach int,
  views int,
  likes int,
  saves int,
  shares int,
  comments int,
  dms int,
  leads_generated int,
  qualified_leads int,
  sales int
);

create index content_pieces_status_idx on content_pieces (status);
create index content_pieces_format_idx on content_pieces (format);
