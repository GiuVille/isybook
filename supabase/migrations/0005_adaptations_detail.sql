-- Serie TV e film come schede complete: trama, locandina, stagioni/episodi o durata,
-- dove vederli, generi e tropes propri (se mancano si usano quelli del libro).

alter table adaptations
  add column slug text unique,
  add column plot text,
  add column poster_url text,
  add column seasons smallint check (seasons > 0),
  add column episodes smallint check (episodes > 0),
  add column runtime_minutes smallint check (runtime_minutes > 0),
  -- [{ platform, url, kind: 'subscription' | 'rent' | 'buy' | 'free' }], disponibilità in Italia
  add column watch_providers jsonb not null default '[]';

create table adaptation_genres (
  adaptation_id uuid not null references adaptations (id) on delete cascade,
  genre_id uuid not null references genres (id) on delete cascade,
  primary key (adaptation_id, genre_id)
);

create table adaptation_tropes (
  adaptation_id uuid not null references adaptations (id) on delete cascade,
  trope_id uuid not null references tropes (id) on delete cascade,
  primary key (adaptation_id, trope_id)
);

alter table adaptation_genres enable row level security;
create policy "public read" on adaptation_genres for select using (true);
create policy "editors write" on adaptation_genres for all to authenticated using (is_editor()) with check (is_editor());

alter table adaptation_tropes enable row level security;
create policy "public read" on adaptation_tropes for select using (true);
create policy "editors write" on adaptation_tropes for all to authenticated using (is_editor()) with check (is_editor());
