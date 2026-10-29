-- Notizie della bacheca (/notizie): post-it scritti dalla redazione dal pannello, con foto facoltativa.
-- Le foto stanno nel bucket pubblico `news` dello Storage; il pannello le riduce e le converte in WebP prima di caricarle.

create table news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text,
  image_url text, -- URL pubblico della foto nello Storage: in build viene scaricata e ottimizzata
  image_alt text,
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'blue', 'green', 'orange')),
  pinned boolean not null default false, -- fissata in cima alla bacheca
  status content_status not null default 'draft',
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index news_published_idx on news (published_at desc) where status = 'published';
create trigger news_updated_at before update on news for each row execute function set_updated_at();
-- una notizia pubblicata o modificata fa ripartire la build (vedi 0007)
create trigger news_site_changed after insert or update or delete or truncate on news for each statement execute function mark_site_changed();

alter table news enable row level security;
create policy "public read published" on news for select using (status = 'published' or is_editor());
create policy "editors write" on news for all to authenticated using (is_editor()) with check (is_editor());

-- foto delle notizie: lettura pubblica, scrittura solo per la redazione
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "news images public read" on storage.objects for select using (bucket_id = 'news');
create policy "news images editors insert" on storage.objects for insert to authenticated with check (bucket_id = 'news' and is_editor());
create policy "news images editors update" on storage.objects for update to authenticated using (bucket_id = 'news' and is_editor());
create policy "news images editors delete" on storage.objects for delete to authenticated using (bucket_id = 'news' and is_editor());
