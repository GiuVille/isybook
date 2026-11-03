-- Vocabolario di partenza per la semina del catalogo (npm run seed):
-- 1. generi, assegnati in automatico dalle categorie di Google Books (genresFromCategories in scripts/lib/book-payload.ts);
-- 2. tropes comuni, tra cui l'AI sceglie quelli da suggerire nella coda "Trama".
-- Si possono rinominare o togliere dal pannello; rieseguire la migrazione non tocca quelli già presenti.

insert into genres (slug, name, theme) values
  ('romantasy', 'Romantasy', 'romance'),
  ('fantasy', 'Fantasy', 'fantasy'),
  ('fantasy-ya', 'Fantasy YA', 'ya'),
  ('young-adult', 'Young adult', 'ya'),
  ('romance', 'Romance', 'romance'),
  ('romance-contemporaneo', 'Romance contemporaneo', 'romance'),
  ('dark-romance', 'Dark romance', 'romance'),
  ('romance-storico', 'Romance storico', 'romance'),
  ('sports-romance', 'Sports romance', 'romance'),
  ('giallo', 'Giallo', 'giallo'),
  ('thriller', 'Thriller', 'giallo'),
  ('horror', 'Horror', 'horror'),
  ('fantascienza', 'Fantascienza', 'default')
on conflict (slug) do nothing;

insert into tropes (slug, name) values
  ('enemies-to-lovers', 'Enemies to lovers'),
  ('friends-to-lovers', 'Friends to lovers'),
  ('rivals-to-lovers', 'Rivals to lovers'),
  ('slow-burn', 'Slow burn'),
  ('fake-relationship', 'Fake relationship'),
  ('forced-proximity', 'Forced proximity'),
  ('only-one-bed', 'Only one bed'),
  ('second-chance', 'Second chance'),
  ('grumpy-sunshine', 'Grumpy x sunshine'),
  ('forbidden-love', 'Amore proibito'),
  ('love-triangle', 'Triangolo amoroso'),
  ('marriage-of-convenience', 'Matrimonio di convenienza'),
  ('he-falls-first', 'He falls first'),
  ('morally-grey', 'Morally grey'),
  ('found-family', 'Found family'),
  ('chosen-one', 'Prescelta'),
  ('fae', 'Fae'),
  ('draghi', 'Draghi'),
  ('vampiri', 'Vampiri'),
  ('academy', 'Accademia di magia'),
  ('royalty', 'Corti e regni'),
  ('mates', 'Fated mates'),
  ('doppio-pov', 'Doppio pov'),
  ('small-town', 'Small town'),
  ('age-gap', 'Age gap'),
  ('workplace', 'Workplace romance'),
  ('bodyguard', 'Bodyguard'),
  ('revenge', 'Vendetta'),
  ('heist', 'Colpo da maestro')
on conflict (slug) do nothing;
