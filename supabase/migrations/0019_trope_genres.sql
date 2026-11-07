-- Un trope può stare sotto più generi (es. «Enemies to lovers» in Romance e in Romantasy): tabella di collegamento
-- al posto della sola colonna tropes.genre_id della migrazione 0015. Nel menu «Tropes» della pagina Libri il trope
-- compare sotto ognuno dei suoi generi; senza generi finisce in «Altri». Si sceglie dal pannello, scheda del trope.
create table trope_genres (
  trope_id uuid not null references tropes (id) on delete cascade,
  genre_id uuid not null references genres (id) on delete cascade,
  primary key (trope_id, genre_id)
);

alter table trope_genres enable row level security;
create policy "public read" on trope_genres for select using (true);
create policy "editors write" on trope_genres for all to authenticated using (is_editor()) with check (is_editor());

-- il genere scelto finora diventa il primo collegamento; la vecchia colonna resta ma non si usa più
insert into trope_genres (trope_id, genre_id)
select id, genre_id from tropes where genre_id is not null
on conflict do nothing;
comment on column tropes.genre_id is 'Non più usata: i generi del trope sono in trope_genres (migrazione 0019).';

-- il sito si riaggiorna anche quando cambiano i generi di un trope (come le altre tabelle pubbliche, migrazione 0007)
create trigger trope_genres_site_changed after insert or update or delete or truncate on trope_genres
  for each statement execute function mark_site_changed();
