-- Date di uscita incomplete: Google Books per molte edizioni italiane dice solo l'anno ("2026") o anno e mese.
-- La data resta una data vera (primo giorno del periodo, così ordinamenti e confronti funzionano) e la precisione
-- dice come mostrarla: "29 settembre 2026", "settembre 2026" o "2026". Un periodo già iniziato non risulta "in uscita".
alter table editions
  add column release_precision text not null default 'day' check (release_precision in ('day', 'month', 'year'));

-- Genere new adult (molte delle autrici di riferimento della semina: Mona Kasten, Erin Watt, Karim B., Rokia…)
insert into genres (slug, name, theme) values ('new-adult', 'New adult', 'romance') on conflict (slug) do nothing;
