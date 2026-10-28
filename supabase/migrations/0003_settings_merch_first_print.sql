-- Ambientazioni (college, scuola, lavoro…), gadget inclusi in un'edizione, prima edizione.

create table settings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text
);

create table work_settings (
  work_id uuid not null references works (id) on delete cascade,
  setting_id uuid not null references settings (id) on delete cascade,
  primary key (work_id, setting_id)
);

alter table settings enable row level security;
create policy "public read" on settings for select using (true);
create policy "editors write" on settings for all to authenticated using (is_editor()) with check (is_editor());

alter table work_settings enable row level security;
create policy "public read" on work_settings for select using (true);
create policy "editors write" on work_settings for all to authenticated using (is_editor()) with check (is_editor());

-- prima edizione / prima tiratura
alter table editions add column first_print boolean not null default false;

-- gadget venduto insieme a una specifica edizione (segnalibro della prima tiratura, poster della limitata…)
alter table merch add column edition_id uuid references editions (id) on delete set null;
create index merch_edition_idx on merch (edition_id);
