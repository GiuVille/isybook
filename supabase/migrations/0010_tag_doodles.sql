-- Decorazione (scarabocchio sugli sfondi delle anteprime) scelta dal pannello per tropes e ambientazioni.
-- Contiene il nome di un'icona di src/lib/doodles.ts; vuoto = scelta automatica dallo slug.
-- Niente vincolo sui valori: le icone le aggiunge lo sviluppo nel codice, i nomi sconosciuti vengono ignorati.

alter table tropes add column doodle text;
alter table settings add column doodle text;
