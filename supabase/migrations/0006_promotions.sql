-- Promozioni delle case editrici e delle librerie: omaggi con l'acquisto, 3x2, sconti, concorsi, bonus preordine.
-- Arrivano dalla lettura notturna delle fonti (scripts/check-promotions.ts) o dalle segnalazioni,
-- passano dalla coda di revisione e diventano visibili solo con status = 'published'.

create type promotion_kind as enum ('gift_with_purchase', 'bundle', 'discount', 'contest', 'preorder');
create type promotion_channel as enum ('online', 'bookstores', 'chain', 'everywhere');

create table promotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  publisher_id uuid references publishers (id) on delete set null,
  kind promotion_kind not null,
  description text,
  conditions text, -- es. "Acquistando 3 libri della collana X"
  reward text, -- es. "Plaid in omaggio", "Il terzo libro è gratis"
  starts_on date,
  ends_on date,
  channel promotion_channel not null default 'everywhere',
  where_note text, -- es. "Solo nelle librerie aderenti", "Sul sito dell'editore"
  url text,
  image_url text, -- grafica ufficiale: in build viene scaricata e ottimizzata, mai linkata dal sito d'origine
  image_credit text, -- es. "Editrice Esempio": la grafica si usa solo con il credito
  image_alt text,
  source_url text, -- pagina da cui è stata ricavata, per la revisione
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index promotions_published_idx on promotions (ends_on) where status = 'published';
create trigger promotions_updated_at before update on promotions for each row execute function set_updated_at();

-- libri coinvolti nella promozione
create table promotion_works (
  promotion_id uuid not null references promotions (id) on delete cascade,
  work_id uuid not null references works (id) on delete cascade,
  primary key (promotion_id, work_id)
);

alter table promotions enable row level security;
create policy "public read published" on promotions for select using (status = 'published' or is_editor());
create policy "editors write" on promotions for all to authenticated using (is_editor()) with check (is_editor());

alter table promotion_works enable row level security;
create policy "public read" on promotion_works for select using (true);
create policy "editors write" on promotion_works for all to authenticated using (is_editor()) with check (is_editor());

-- Fonti: a cosa servono e impronta dell'ultimo contenuto letto, per non rielaborare pagine invariate.
create type source_purpose as enum ('promotions', 'releases', 'events');

alter table sources
  add column purpose source_purpose not null default 'releases',
  add column content_hash text,
  add column last_changed_at timestamptz,
  add column active boolean not null default true;
