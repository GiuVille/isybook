-- IsyBooks: schema iniziale (MVP)
-- Opera (works) ≠ edizione (editions): un'opera ha molte edizioni.
-- Ogni contenuto pubblicabile ha uno status: il pubblico vede solo 'published'.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type content_status as enum ('draft', 'published', 'archived');
create type edition_format as enum ('paperback', 'hardcover', 'kindle', 'audio');
create type edition_type as enum ('standard', 'special', 'limited');
create type work_origin as enum ('publisher', 'self', 'wattpad');
create type publisher_kind as enum ('publisher', 'self', 'box');
create type event_kind as enum ('fair', 'signing', 'presentation', 'other');
create type adaptation_kind as enum ('series', 'film');
create type merch_kind as enum ('gadget', 'jewelry', 'box', 'other');
create type source_kind as enum ('api', 'rss', 'page');
create type review_status as enum ('pending', 'approved', 'rejected');

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Redazione: chi può usare il pannello admin
-- ---------------------------------------------------------------------------
create table editors (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from editors where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Anagrafiche
-- ---------------------------------------------------------------------------
create table authors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  bio text,
  social_links jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table publishers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind publisher_kind not null default 'publisher',
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text
);

create table tropes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text
);

-- ---------------------------------------------------------------------------
-- Opere ed edizioni
-- ---------------------------------------------------------------------------
create table works (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  plot text,
  series text,
  series_number numeric(5, 1),
  origin work_origin not null default 'publisher',
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work_authors (
  work_id uuid not null references works (id) on delete cascade,
  author_id uuid not null references authors (id) on delete cascade,
  primary key (work_id, author_id)
);

create table work_genres (
  work_id uuid not null references works (id) on delete cascade,
  genre_id uuid not null references genres (id) on delete cascade,
  primary key (work_id, genre_id)
);

create table work_tropes (
  work_id uuid not null references works (id) on delete cascade,
  trope_id uuid not null references tropes (id) on delete cascade,
  primary key (work_id, trope_id)
);

create table editions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works (id) on delete cascade,
  isbn text unique,
  format edition_format not null,
  publisher_id uuid references publishers (id) on delete set null,
  release_date date,
  price numeric(8, 2),
  language text not null default 'it',
  edition_type edition_type not null default 'standard',
  print_run integer,
  details text,
  cover_url text,
  purchase_links jsonb not null default '[]', -- [{label, url, affiliate}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index editions_work_idx on editions (work_id);
create index editions_release_idx on editions (release_date);
create index editions_type_idx on editions (edition_type) where edition_type <> 'standard';

-- ---------------------------------------------------------------------------
-- Eventi, adattamenti, merch
-- ---------------------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind event_kind not null default 'other',
  starts_on date not null,
  ends_on date,
  venue text,
  city text,
  url text,
  description text,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_starts_idx on events (starts_on);

create table event_authors (
  event_id uuid not null references events (id) on delete cascade,
  author_id uuid not null references authors (id) on delete cascade,
  primary key (event_id, author_id)
);

create table event_works (
  event_id uuid not null references events (id) on delete cascade,
  work_id uuid not null references works (id) on delete cascade,
  primary key (event_id, work_id)
);

create table adaptations (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works (id) on delete cascade,
  title text not null,
  kind adaptation_kind not null,
  platform text,
  release_date date,
  production_status text,
  tmdb_id integer,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merch (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind merch_kind not null default 'gadget',
  shop text,
  price numeric(8, 2),
  url text,
  affiliate boolean not null default false,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merch_works (
  merch_id uuid not null references merch (id) on delete cascade,
  work_id uuid not null references works (id) on delete cascade,
  primary key (merch_id, work_id)
);

create table merch_authors (
  merch_id uuid not null references merch (id) on delete cascade,
  author_id uuid not null references authors (id) on delete cascade,
  primary key (merch_id, author_id)
);

-- ---------------------------------------------------------------------------
-- Rubriche e articoli
-- ---------------------------------------------------------------------------
create table sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null default '',
  section_id uuid references sections (id) on delete set null,
  status content_status not null default 'draft',
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_published_idx on articles (published_at desc) where status = 'published';

create table article_works (
  article_id uuid not null references articles (id) on delete cascade,
  work_id uuid not null references works (id) on delete cascade,
  primary key (article_id, work_id)
);

-- ---------------------------------------------------------------------------
-- Fonti e coda di revisione
-- ---------------------------------------------------------------------------
create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind source_kind not null,
  url text not null,
  last_read_at timestamptz,
  created_at timestamptz not null default now()
);

create table review_queue (
  id uuid primary key default gen_random_uuid(),
  content_type text not null, -- 'work', 'edition', 'event', 'article', ...
  payload jsonb not null,
  status review_status not null default 'pending',
  source_id uuid references sources (id) on delete set null,
  note text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index review_queue_pending_idx on review_queue (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['authors', 'publishers', 'works', 'editions', 'events', 'adaptations', 'merch', 'sections', 'articles']
  loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--   anon/authenticated: lettura dei soli contenuti pubblicati
--   editors: lettura e scrittura completa (pannello admin)
--   service role: bypassa la RLS (script di import)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  -- tabelle sempre leggibili dal pubblico
  foreach t in array array['authors', 'publishers', 'genres', 'tropes', 'sections',
                           'work_authors', 'work_genres', 'work_tropes',
                           'event_authors', 'event_works', 'merch_works', 'merch_authors', 'article_works']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('create policy "editors write" on %I for all to authenticated using (is_editor()) with check (is_editor())', t);
  end loop;

  -- tabelle con status: il pubblico vede solo 'published', la redazione tutto
  foreach t in array array['works', 'events', 'adaptations', 'merch', 'articles']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read published" on %I for select using (status = ''published'' or is_editor())', t);
    execute format('create policy "editors write" on %I for all to authenticated using (is_editor()) with check (is_editor())', t);
  end loop;

  -- tabelle interne: solo redazione
  foreach t in array array['sources', 'review_queue']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "editors all" on %I for all to authenticated using (is_editor()) with check (is_editor())', t);
  end loop;
end $$;

-- le edizioni sono visibili se l'opera è pubblicata
alter table editions enable row level security;
create policy "public read published" on editions for select
  using (is_editor() or exists (select 1 from works w where w.id = work_id and w.status = 'published'));
create policy "editors write" on editions for all to authenticated using (is_editor()) with check (is_editor());

alter table editors enable row level security;
create policy "editors read" on editors for select to authenticated using (is_editor());
