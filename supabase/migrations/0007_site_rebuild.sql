-- Aggiornamento del sito statico dopo le modifiche ai contenuti.
-- Ogni modifica alle tabelle pubbliche segna l'ora in site_state; scripts/rebuild-site.ts (GitHub Actions, ogni 15 minuti)
-- fa ripartire la build su Cloudflare Pages quando le modifiche si sono fermate da qualche minuto, così approvando
-- dieci libri di fila parte una build sola e non dieci.

create table site_state (
  id smallint primary key default 1 check (id = 1), -- una sola riga
  content_changed_at timestamptz, -- ultima modifica a un contenuto pubblico
  rebuild_requested_at timestamptz, -- "Aggiorna il sito adesso" dal pannello
  last_rebuild_at timestamptz -- ultima build richiesta a Cloudflare Pages
);

insert into site_state (id) values (1);

-- security definer: deve poter scrivere anche quando la modifica arriva da un utente senza permessi su site_state
create or replace function mark_site_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update site_state set content_changed_at = now() where id = 1;
  return null;
end $$;

-- un trigger per istruzione (non per riga): approvare un libro con dieci tropes costa un solo aggiornamento
do $$
declare t text;
begin
  foreach t in array array[
    'works', 'editions', 'events', 'adaptations', 'merch', 'articles', 'promotions',
    'authors', 'publishers', 'genres', 'tropes', 'settings', 'sections',
    'work_authors', 'work_genres', 'work_tropes', 'work_settings',
    'event_authors', 'event_works', 'merch_works', 'merch_authors', 'article_works',
    'adaptation_genres', 'adaptation_tropes', 'promotion_works'
  ]
  loop
    execute format(
      'create trigger %I_site_changed after insert or update or delete or truncate on %I for each statement execute function mark_site_changed()',
      t, t
    );
  end loop;
end $$;

-- la redazione vede lo stato e può chiedere una build; le altre colonne le scrive lo script (service role)
alter table site_state enable row level security;
create policy "editors read" on site_state for select to authenticated using (is_editor());
create policy "editors request rebuild" on site_state for update to authenticated using (is_editor()) with check (is_editor());
revoke update on site_state from authenticated;
grant update (rebuild_requested_at) on site_state to authenticated;
