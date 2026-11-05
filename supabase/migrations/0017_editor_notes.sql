-- Note personali della redazione, nella colonna di sinistra del pannello (src/admin/notes.ts).
-- Una riga per persona: ognuna legge e scrive solo le proprie, e solo se fa parte della redazione.
create table editor_notes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);

alter table editor_notes enable row level security;

create policy "own notes read" on editor_notes for select to authenticated using (user_id = auth.uid() and is_editor());
create policy "own notes insert" on editor_notes for insert to authenticated with check (user_id = auth.uid() and is_editor());
create policy "own notes update" on editor_notes for update to authenticated
  using (user_id = auth.uid() and is_editor()) with check (user_id = auth.uid() and is_editor());
