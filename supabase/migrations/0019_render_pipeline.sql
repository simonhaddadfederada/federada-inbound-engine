-- Bloque 16: renderer en la nube (GitHub Actions), separado del
-- publicador (Supabase) — ver docs/render-pipeline-cloud.md.
--
-- render_pendiente: la pieza tiene guion/CTA aprobados y un render_spec
-- (beats/voz/música) listo, esperando a que el worker de GitHub Actions
-- la renderice. render_failed: se agotaron los reintentos — nunca se
-- publica una pieza en este estado (publish-content solo mira
-- 'programado', así que esto ya la excluye de forma natural).
alter type content_status add value if not exists 'render_pendiente';
alter type content_status add value if not exists 'render_failed';

-- render_spec: beats/voz/música que el worker cloud necesita para
-- renderizar (mismo formato que ya usa scripts/render_reel_asset.py) —
-- hoy se carga a mano por pieza; automatizar "guion -> beats" queda
-- pendiente como su propio paso, no se inventa acá.
alter table content_pieces add column render_spec jsonb;
alter table content_pieces add column render_attempts int not null default 0;
alter table content_pieces add column last_render_error text;

-- Bucket público para los assets generados (reemplaza a GitHub Pages
-- para lo que se genera de acá en más: sin commits de binarios, fácil
-- de limpiar, trazable por content_piece_id en el path del archivo).
-- Público porque la Content Publishing API de Meta necesita poder bajar
-- el video_url sin ninguna credencial — igual que ya era público en
-- GitHub Pages, no es una regresión de privacidad.
insert into storage.buckets (id, name, public)
values ('content-assets', 'content-assets', true)
on conflict (id) do nothing;

create policy "content-assets lectura publica"
  on storage.objects for select
  using (bucket_id = 'content-assets');

create policy "content-assets solo service role escribe"
  on storage.objects for insert
  with check (bucket_id = 'content-assets' and auth.role() = 'service_role');

create policy "content-assets solo service role actualiza"
  on storage.objects for update
  using (bucket_id = 'content-assets' and auth.role() = 'service_role');

create policy "content-assets solo service role borra"
  on storage.objects for delete
  using (bucket_id = 'content-assets' and auth.role() = 'service_role');
