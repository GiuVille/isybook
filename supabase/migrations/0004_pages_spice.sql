-- Numero di pagine per edizione e livello spicy per opera (0–5, solo romance e derivati).
alter table editions add column pages integer check (pages > 0);
alter table works add column spice_level smallint check (spice_level between 0 and 5);
