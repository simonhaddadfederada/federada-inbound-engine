-- Bloque 19: Creative Director V2 — biblioteca visual reutilizable.
-- Guarda tanto assets propios (íconos dibujados con Pillow) como, a
-- futuro, fotos reales de stock con licencia comercial (Pexels) — misma
-- tabla, un campo "source" que distingue el origen.
create table visual_assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null,          -- ej. 'persona_celular', 'familia', 'documento'
  source text not null,            -- 'propio' | 'pexels' | ...
  license text not null,           -- texto libre: qué licencia ampara su uso
  orientation text,                -- 'portrait' | 'landscape' | 'square'
  subjects text[],                 -- ej. {'persona','celular'}
  emotion text,
  recommended_uses text,
  storage_url text not null,
  external_ref text,               -- ej. id/URL de Pexels, para trazabilidad
  times_used int not null default 0,
  last_used_at timestamptz
);

alter table visual_assets enable row level security;
create policy "visual_assets solo service role" on visual_assets for all using (false);
-- Sin política para anon/authenticated: solo el service role (Edge
-- Functions / worker cloud) accede, igual que content_pieces.
