-- Tropes divisi per genere: nel menu a tendina della pagina Libri i tropes compaiono sotto il titoletto del loro genere
-- (Romance, Fantasy…). Si sceglie dal pannello, scheda del trope → "Genere"; senza genere finiscono in "Altri".
alter table tropes add column genre_id uuid references genres (id) on delete set null;
