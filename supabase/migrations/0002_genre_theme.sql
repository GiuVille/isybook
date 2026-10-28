-- Palette dell'anteprima libro per genere (vedi src/lib/book-themes.ts).
-- Se null, il tema viene dedotto dallo slug del genere.
alter table genres
  add column theme text check (theme in ('romance', 'giallo', 'horror', 'fantasy', 'ya', 'default'));
