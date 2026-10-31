-- Messaggi di chi legge, dal modulo in fondo alla home: idee, errori trovati, libri che mancano.
-- Chiunque può solo inserirne uno; li legge e li gestisce solo la redazione dal pannello (sezione Messaggi).
-- Non sono contenuti pubblici: niente trigger di rebuild.

create table feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'other' check (kind in ('idea', 'bug', 'book', 'other')),
  message text not null check (char_length(message) between 5 and 2000),
  name text check (name is null or char_length(name) <= 80),
  email text check (email is null or (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  page text check (page is null or char_length(page) <= 200),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index feedback_unread_idx on feedback (created_at desc) where not read;

alter table feedback enable row level security;
-- chi visita il sito può solo inviare (mai leggere, nemmeno i propri)
create policy "anyone sends" on feedback for insert to anon, authenticated with check (read = false);
create policy "editors read" on feedback for select to authenticated using (is_editor());
create policy "editors update" on feedback for update to authenticated using (is_editor()) with check (is_editor());
create policy "editors delete" on feedback for delete to authenticated using (is_editor());
