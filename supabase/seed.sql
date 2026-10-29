-- Dati di esempio (stessi di src/data/sample.json)

insert into sections (id, slug, name, description, sort_order) values
  ('00000000-0000-0000-0000-0000000000a1', 'da-wattpad-alla-libreria', 'Da Wattpad alla libreria', 'Storie nate su Wattpad e arrivate in libreria.', 1),
  ('00000000-0000-0000-0000-0000000000a2', 'novita', 'Novità', 'Le uscite della settimana.', 2);

insert into publishers (id, slug, name, kind) values
  ('00000000-0000-0000-0000-0000000000b1', 'editrice-esempio', 'Editrice Esempio', 'publisher'),
  ('00000000-0000-0000-0000-0000000000b2', 'box-esempio', 'Box Esempio', 'box');

insert into authors (id, slug, name, bio) values
  ('00000000-0000-0000-0000-0000000000c1', 'autrice-esempio', 'Autrice Esempio', 'Autrice di romantasy (dato di esempio).');

insert into genres (id, slug, name, theme) values
  ('00000000-0000-0000-0000-0000000000d1', 'romantasy', 'Romantasy', 'romance'),
  ('00000000-0000-0000-0000-0000000000d2', 'fantasy-ya', 'Fantasy YA', 'ya'),
  ('00000000-0000-0000-0000-0000000000d3', 'giallo', 'Giallo', 'giallo'),
  ('00000000-0000-0000-0000-0000000000d4', 'horror', 'Horror', 'horror');

insert into tropes (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'enemies-to-lovers', 'Enemies to lovers'),
  ('00000000-0000-0000-0000-0000000000e2', 'slow-burn', 'Slow burn'),
  ('00000000-0000-0000-0000-0000000000e3', 'found-family', 'Found family');

insert into works (id, slug, title, plot, series, series_number, origin, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'la-corona-di-cenere', 'La corona di cenere',
   'Una ladra cresciuta nei bassifondi viene costretta a servire il principe che ha distrutto la sua famiglia. Tra intrighi di corte e una magia che si credeva estinta, dovrà scegliere tra vendetta e libertà. (Titolo e trama di esempio.)',
   'Cronache di cenere', 1, 'publisher', 'published'),
  ('00000000-0000-0000-0000-0000000000f2', 'il-patto-delle-stelle', 'Il patto delle stelle',
   'Cinque ragazzi senza casa trovano rifugio in una nave volante e scoprono di essere legati da un''antica profezia. (Titolo e trama di esempio.)',
   null, null, 'wattpad', 'published');

insert into work_authors (work_id, author_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1');

insert into work_genres (work_id, genre_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000d2');

insert into work_tropes (work_id, trope_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e3');

insert into editions (work_id, isbn, format, publisher_id, release_date, price, edition_type, print_run, details) values
  ('00000000-0000-0000-0000-0000000000f1', '9780000000001', 'hardcover', '00000000-0000-0000-0000-0000000000b1', '2026-11-12', 19.90, 'standard', null, null),
  ('00000000-0000-0000-0000-0000000000f1', null, 'hardcover', '00000000-0000-0000-0000-0000000000b2', '2026-12-01', 39.00, 'limited', 1500, 'Bordi decorati, copertina alternativa, firma stampata'),
  ('00000000-0000-0000-0000-0000000000f1', null, 'kindle', '00000000-0000-0000-0000-0000000000b1', '2026-11-12', 6.99, 'standard', null, null),
  ('00000000-0000-0000-0000-0000000000f2', '9780000000002', 'paperback', '00000000-0000-0000-0000-0000000000b1', '2026-10-20', 16.00, 'special', null, 'Prima tiratura con sovraccoperta esclusiva');

insert into articles (slug, title, excerpt, body, section_id, status, published_at) values
  ('benvenuti-su-isybook', 'Benvenuti su IsyBook',
   'Uscite, edizioni speciali ed eventi attorno ai libri che ami, in un posto solo.',
   E'IsyBook raccoglie tutto quello che succede attorno ai libri: uscite, edizioni speciali e limitate, eventi e firmacopie.\n\nQuesto è un articolo di esempio.',
   '00000000-0000-0000-0000-0000000000a2', 'published', '2026-10-28');

-- Tropi aggiuntivi e due opere di generi diversi, per provare i colori delle anteprime
insert into tropes (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000e4', 'fake-relationship', 'Fake relationship'),
  ('00000000-0000-0000-0000-0000000000e5', 'doppio-pov', 'Doppio pov'),
  ('00000000-0000-0000-0000-0000000000e6', 'he-falls-first', 'He falls first'),
  ('00000000-0000-0000-0000-0000000000e7', 'forced-proximity', 'Forced proximity'),
  ('00000000-0000-0000-0000-0000000000e8', 'locked-room', 'Delitto della camera chiusa'),
  ('00000000-0000-0000-0000-0000000000e9', 'casa-infestata', 'Casa infestata'),
  ('00000000-0000-0000-0000-0000000000ea', 'small-town', 'Paesino isolato'),
  ('00000000-0000-0000-0000-0000000000eb', 'unreliable-narrator', 'Narratore inaffidabile');

insert into work_tropes (work_id, trope_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e4'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e5'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e6'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e7');

insert into works (id, slug, title, plot, origin, status) values
  ('00000000-0000-0000-0000-0000000000f3', 'lultimo-ospite', 'L’ultimo ospite',
   'Una tempesta isola sei invitati in una villa sul lago. Al mattino il padrone di casa è morto in una stanza chiusa a chiave dall’interno, e tutti hanno qualcosa da nascondere. (Titolo e trama di esempio.)',
   'publisher', 'published'),
  ('00000000-0000-0000-0000-0000000000f4', 'la-casa-sul-fiume', 'La casa sul fiume',
   'Tornata nel paese dove è cresciuta per vendere la casa della nonna, Marta inizia a sentire passi al piano di sopra. Ma i suoi ricordi di quell’estate non coincidono con quelli di nessun altro. (Titolo e trama di esempio.)',
   'self', 'published');

insert into work_authors (work_id, author_id) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000c1');

insert into work_genres (work_id, genre_id) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000d3'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000d4');

insert into work_tropes (work_id, trope_id) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e8'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000e9'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000ea'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000eb');

insert into editions (work_id, format, publisher_id, release_date, price) values
  ('00000000-0000-0000-0000-0000000000f3', 'paperback', '00000000-0000-0000-0000-0000000000b1', '2026-11-26', 18.00),
  ('00000000-0000-0000-0000-0000000000f4', 'kindle', null, '2026-10-31', 3.99);

insert into adaptations (work_id, title, kind, platform, production_status, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'La corona di cenere', 'series', 'Netflix', 'In lavorazione', 'published');

-- Ambientazioni, prima tiratura con gadget, secondo volume della saga
insert into settings (id, slug, name) values
  ('00000000-0000-0000-0000-000000000101', 'corte-reale', 'Corte reale'),
  ('00000000-0000-0000-0000-000000000102', 'accademia', 'Accademia'),
  ('00000000-0000-0000-0000-000000000103', 'college', 'College'),
  ('00000000-0000-0000-0000-000000000104', 'paese-di-provincia', 'Paese di provincia'),
  ('00000000-0000-0000-0000-000000000105', 'villa-isolata', 'Villa isolata');

insert into works (id, slug, title, plot, series, series_number, origin, status) values
  ('00000000-0000-0000-0000-0000000000f5', 'il-trono-di-brace', 'Il trono di brace',
   'Ora che la corona è sua, la ladra scopre che governare è più pericoloso che rubare: la corte trama nell’ombra e il principe nasconde un segreto che può bruciare il regno. (Titolo e trama di esempio.)',
   'Cronache di cenere', 2, 'publisher', 'published');

insert into work_authors (work_id, author_id) values
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000c1');
insert into work_genres (work_id, genre_id) values
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000d1');
insert into work_tropes (work_id, trope_id) values
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000e5');

insert into work_settings (work_id, setting_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000105'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000104');

insert into editions (work_id, format, publisher_id, release_date, price) values
  ('00000000-0000-0000-0000-0000000000f5', 'hardcover', '00000000-0000-0000-0000-0000000000b1', '2027-05-14', 19.90);

update editions set first_print = true, details = 'Prima tiratura con segnalibro in omaggio'
  where isbn = '9780000000001';

insert into merch (name, kind, shop, edition_id, status)
  select 'Segnalibro illustrato', 'gadget', 'Editrice Esempio', id, 'published' from editions where isbn = '9780000000001';
insert into merch (name, kind, shop, edition_id, status)
  select 'Stampa artistica dei protagonisti', 'gadget', 'Box Esempio', id, 'published' from editions
  where work_id = '00000000-0000-0000-0000-0000000000f1' and edition_type = 'limited';

with m as (
  insert into merch (name, kind, shop, price, url, affiliate, status)
  values ('Collana con la corona di cenere', 'jewelry', 'Negozio Esempio', 24.90, 'https://example.com', true, 'published')
  returning id
)
insert into merch_works (merch_id, work_id) select id, '00000000-0000-0000-0000-0000000000f1' from m;

-- Pagine, livello spicy e audiolibro
update works set spice_level = 3 where id = '00000000-0000-0000-0000-0000000000f1';
update works set spice_level = 4 where id = '00000000-0000-0000-0000-0000000000f5';
update editions set pages = 432 where work_id = '00000000-0000-0000-0000-0000000000f1' and format = 'hardcover';
update editions set pages = 352 where work_id = '00000000-0000-0000-0000-0000000000f2';
update editions set pages = 288 where work_id = '00000000-0000-0000-0000-0000000000f3';
update editions set pages = 480 where work_id = '00000000-0000-0000-0000-0000000000f5';
insert into editions (work_id, format, publisher_id, release_date, price, details) values
  ('00000000-0000-0000-0000-0000000000f1', 'audio', '00000000-0000-0000-0000-0000000000b1', '2026-11-12', 14.99,
   'Letto da una narratrice di esempio, 14 h 20 min');

-- Eventi di esempio
insert into events (id, slug, title, kind, starts_on, ends_on, venue, city, url, description, status) values
  ('00000000-0000-0000-0000-000000000201', 'firmacopie-la-corona-di-cenere-milano', 'Firmacopie de «La corona di cenere»', 'signing',
   '2026-11-21', null, 'Libreria Esempio, corso di esempio 1', 'Milano', null,
   'L’autrice firma le copie del primo volume della saga. Prima tiratura con segnalibro fino a esaurimento. (Evento di esempio.)', 'published'),
  ('00000000-0000-0000-0000-000000000202', 'presentazione-il-patto-delle-stelle-roma', 'Presentazione de «Il patto delle stelle»', 'presentation',
   '2026-12-05', null, 'Biblioteca di esempio', 'Roma', null,
   'Incontro con l’autrice e lettura di alcuni capitoli. (Evento di esempio.)', 'published'),
  ('00000000-0000-0000-0000-000000000203', 'fiera-del-libro-di-esempio-torino-2027', 'Fiera del libro di esempio', 'fair',
   '2027-05-14', '2027-05-18', 'Padiglione di esempio', 'Torino', 'https://example.com',
   'Cinque giorni di incontri, firmacopie e stand degli editori, con un’area dedicata al romantasy. (Evento di esempio.)', 'published'),
  ('00000000-0000-0000-0000-000000000204', 'incontro-lettrici-bologna-settembre', 'Incontro tra lettrici e lettori', 'other',
   '2026-09-20', null, 'Caffè letterario di esempio', 'Bologna', null,
   'Scambio di libri e chiacchiere sui tropes preferiti. (Evento di esempio.)', 'published');

insert into event_authors (event_id, author_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-0000000000c1');

insert into event_works (event_id, work_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-0000000000f5');

-- Serie TV e film di esempio
insert into adaptations (id, work_id, slug, title, kind, platform, release_date, production_status, plot, seasons, episodes, runtime_minutes, watch_providers, status) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000f2', 'il-patto-delle-stelle-serie', 'Il patto delle stelle', 'series',
   'Disney+', '2026-03-06', null,
   'Cinque ragazzi, una nave volante e una profezia: l’adattamento in otto episodi resta fedele al libro e aggiunge il punto di vista del capitano. (Serie di esempio.)',
   1, 8, null, '[{"platform": "Disney+", "url": "https://www.disneyplus.com/it-it", "kind": "subscription"}]', 'published'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-0000000000f3', 'lultimo-ospite-film', 'L’ultimo ospite', 'film',
   'Prime Video', '2025-11-14', null,
   'Una notte di tempesta, una villa sul lago e sei sospettati: il film stringe il romanzo in un giallo serrato a porte chiuse. (Film di esempio.)',
   null, null, 112, '[{"platform": "Prime Video", "url": "https://www.primevideo.com", "kind": "subscription"}, {"platform": "Apple TV", "url": "https://tv.apple.com/it", "kind": "rent"}]', 'published');

update adaptations set slug = 'la-corona-di-cenere-serie',
  plot = 'La serie segue la ladra e il principe dal primo incontro a corte, con una prima stagione che copre l’intero primo libro. (Serie di esempio.)'
  where work_id = '00000000-0000-0000-0000-0000000000f1';

insert into adaptation_genres (adaptation_id, genre_id) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000d2');
insert into adaptation_tropes (adaptation_id, trope_id) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000e3');

-- Secondo autore di esempio (gialli e horror) e bio
update authors set
  bio = 'Scrive romantasy e fantasy YA: corti piene di intrighi, magie dimenticate e amori che nascono come rivalità. (Autrice di esempio.)',
  social_links = '[{"label": "Instagram", "url": "https://www.instagram.com/"}]'
  where id = '00000000-0000-0000-0000-0000000000c1';
insert into authors (id, slug, name, bio) values
  ('00000000-0000-0000-0000-0000000000c2', 'autore-esempio', 'Autore Esempio',
   'Gialli a porte chiuse e storie di case che ricordano più di chi le abita. (Autore di esempio.)');
update work_authors set author_id = '00000000-0000-0000-0000-0000000000c2'
  where work_id in ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4');

-- Sports romance di esempio (hockey), per gli scarabocchi a tema sport
insert into genres (id, slug, name, theme) values
  ('00000000-0000-0000-0000-0000000000d5', 'sports-romance', 'Sports romance', 'romance');
insert into tropes (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000ec', 'rivals-to-lovers', 'Rivals to lovers');
insert into settings (id, slug, name) values
  ('00000000-0000-0000-0000-000000000106', 'pista-di-hockey', 'Pista di hockey'),
  ('00000000-0000-0000-0000-000000000107', 'college-sportivo', 'College');
insert into works (id, slug, title, plot, origin, spice_level, status) values
  ('00000000-0000-0000-0000-0000000000f6', 'ghiaccio-e-scintille', 'Ghiaccio e scintille',
   'Lei allena la squadra di pattinaggio, lui è il capitano dei rivali sul ghiaccio: per un''intera stagione dovranno dividere la stessa pista, gli stessi orari e, a quanto pare, le stesse notti insonni. (Titolo e trama di esempio.)',
   'publisher', 2, 'published');
insert into work_authors (work_id, author_id) values ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000c1');
insert into work_genres (work_id, genre_id) values ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000d5');
insert into work_tropes (work_id, trope_id) values
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000ec'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000e7'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000e2');
insert into work_settings (work_id, setting_id) values
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000106'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000107');
insert into editions (work_id, format, publisher_id, release_date, price, pages) values
  ('00000000-0000-0000-0000-0000000000f6', 'paperback', '00000000-0000-0000-0000-0000000000b1', '2026-12-10', 17.90, 384),
  ('00000000-0000-0000-0000-0000000000f6', 'kindle', '00000000-0000-0000-0000-0000000000b1', '2026-12-10', 5.99, null);

-- Promozioni di esempio (una già conclusa)
insert into promotions (id, slug, title, publisher_id, kind, description, conditions, reward, starts_on, ends_on, channel, where_note, status) values
  ('00000000-0000-0000-0000-0000000001a1', 'plaid-d-autunno', 'Il plaid d''autunno', '00000000-0000-0000-0000-0000000000b1', 'gift_with_purchase', 'Per l''arrivo del freddo l''editore regala un plaid a quadri con il logo della collana a chi compra tre romantasy in libreria. (Promozione di esempio.)', 'Acquistando 3 libri della collana Romantasy', 'Un plaid in omaggio', '2026-10-15', '2026-11-30', 'bookstores', 'Nelle librerie aderenti, fino a esaurimento scorte', 'published'),
  ('00000000-0000-0000-0000-0000000001a2', 'tre-per-due-gialli', '3x2 sui gialli', '00000000-0000-0000-0000-0000000000b1', 'bundle', 'Tre gialli al prezzo di due: il meno caro è in regalo. (Promozione di esempio.)', 'Su tutti i gialli e i thriller del catalogo', 'Il terzo libro è gratis', '2026-10-20', '2026-10-31', 'everywhere', 'Online e in libreria', 'published'),
  ('00000000-0000-0000-0000-0000000001a3', 'bonus-preordine-il-trono-di-brace', 'Bonus preordine «Il trono di brace»', '00000000-0000-0000-0000-0000000000b1', 'preorder', 'Chi preordina il seguito della saga riceve un segnalibro olografico e una cartolina con la firma stampata dell’autrice. (Promozione di esempio.)', 'Preordinando il libro entro il 31 marzo', 'Segnalibro olografico e cartolina firmata', '2026-10-01', '2027-03-31', 'online', 'Sul sito dell''editore', 'published'),
  ('00000000-0000-0000-0000-0000000001a4', 'vinci-la-special-edition', 'Vinci la special edition', '00000000-0000-0000-0000-0000000000b2', 'contest', 'Estrazione di cinque copie della special edition con bordi decorati tra chi si iscrive alla newsletter del box. (Promozione di esempio.)', 'Iscrivendosi alla newsletter', '5 special edition in palio', '2026-10-25', '2026-11-15', 'online', 'Sul sito del box', 'published'),
  ('00000000-0000-0000-0000-0000000001a5', 'tote-bag-di-settembre', 'La tote bag di settembre', '00000000-0000-0000-0000-0000000000b1', 'gift_with_purchase', 'Una tote bag illustrata con due libri della collana Young Adult. (Promozione di esempio, già conclusa.)', 'Acquistando 2 libri Young Adult', 'Una tote bag in omaggio', '2026-09-01', '2026-10-10', 'chain', 'Nelle librerie di una catena', 'published');
insert into promotion_works (promotion_id, work_id) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-0000000000f3'),
  ('00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-0000000000f4'),
  ('00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-0000000000f5'),
  ('00000000-0000-0000-0000-0000000001a4', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000001a5', '00000000-0000-0000-0000-0000000000f2');

-- Grafiche di esempio (finte) per due promozioni: un post quadrato e un banner largo
update promotions set image_url = '/samples/promo-plaid.svg', image_credit = 'Editrice Esempio',
  image_alt = 'Plaid a quadri rosso e senape con la scritta: il plaid d''autunno in regalo con 3 romantasy, fino al 30 novembre.'
  where slug = 'plaid-d-autunno';
update promotions set image_url = '/samples/promo-gialli.svg', image_credit = 'Editrice Esempio',
  image_alt = 'Banner scuro con tre libri e la scritta: 3x2 sui gialli e i thriller, il terzo libro è in regalo.'
  where slug = 'tre-per-due-gialli';
