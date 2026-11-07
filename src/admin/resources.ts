// Configurazione delle risorse gestite dal pannello admin.
// Ogni risorsa è una tabella Supabase; i campi guidano lista e form.
import { THEME_OPTIONS } from '../lib/book-themes';
import { DOODLE_OPTIONS } from '../lib/doodles';

export type FieldType =
  | 'text'
  | 'slug'
  | 'textarea'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'relation'
  | 'json'
  | 'image'
  | 'cover'; // copertina: foto caricata, copertina di Open Library per ISBN o link (bindCoverFields in app.ts)

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<[value: string, label: string]>; // select
  table?: string; // relation: tabella referenziata
  labelColumn?: string; // relation: colonna da mostrare
  slugFrom?: string; // slug: campo da cui generarlo
  optionSelect?: string; // relation: select personalizzata per le opzioni
  optionLabel?: (row: Record<string, any>) => string; // relation: etichetta costruita dalla riga
  bucket?: string; // image: bucket dello Storage in cui caricare la foto
  readonly?: boolean; // mostrato ma non modificabile, e mai salvato
  creatable?: boolean; // relation: "Aggiungi" accanto alla tendina per creare una nuova voce (nome + slug)
  help?: string;
  /** Gruppo del modulo ("Cosa", "Quando", "Dove"…): i campi con lo stesso gruppo stanno insieme sotto un titolo. */
  section?: string;
  /** Campo che serve di rado: va in "Altre opzioni", chiuso di partenza (lo slug ci va sempre). */
  advanced?: boolean;
}

/** Relazione molti-a-molti gestita con una lista di checkbox. */
export interface ManyToMany {
  label: string;
  section?: string; // gruppo del modulo, come per i campi
  joinTable: string;
  ownKey: string; // colonna della join che punta a questa risorsa
  otherKey: string; // colonna della join che punta all'altra tabella
  table: string;
  labelColumn: string;
  /** Mostra "Aggiungi" per creare una nuova voce (nome + slug) senza uscire dal form. */
  creatable?: boolean;
}

export interface Resource {
  key: string;
  table: string;
  label: string;
  singular: string;
  group: 'Contenuti' | 'Catalogo' | 'Anagrafiche';
  listColumns: string[];
  orderBy: { column: string; ascending: boolean };
  fields: Field[];
  manyToMany?: ManyToMany[];
  /** Niente pulsante "Nuovo": le righe arrivano da fuori (es. i messaggi dal modulo della home). */
  noCreate?: boolean;
  /** Risorse figlie mostrate dentro il form (es. edizioni e adattamenti di un'opera). */
  children?: Array<{ resource: string; foreignKey: string; label: string }>;
}

export const STATUS_OPTIONS: Field['options'] = [
  ['draft', 'Bozza'],
  ['published', 'Pubblicato'],
  ['archived', 'Archiviato'],
];

const status: Field = { name: 'status', label: 'Stato', type: 'select', options: STATUS_OPTIONS, required: true };

export const RESOURCES: Resource[] = [
  {
    key: 'articles',
    table: 'articles',
    label: 'Articoli',
    singular: 'articolo',
    group: 'Contenuti',
    listColumns: ['title', 'section_id', 'status', 'published_at'],
    orderBy: { column: 'updated_at', ascending: false },
    fields: [
      { name: 'title', label: 'Titolo', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      { name: 'section_id', label: 'Rubrica', type: 'relation', table: 'sections', labelColumn: 'name' },
      { name: 'excerpt', label: 'Sommario', type: 'textarea' },
      { name: 'body', label: 'Testo', type: 'textarea', help: 'Paragrafi separati da una riga vuota.' },
      status,
      { name: 'published_at', label: 'Data pubblicazione', type: 'date' },
    ],
    manyToMany: [
      { label: 'Libri citati', joinTable: 'article_works', ownKey: 'article_id', otherKey: 'work_id', table: 'works', labelColumn: 'title' },
    ],
  },
  {
    key: 'sections',
    table: 'sections',
    label: 'Rubriche',
    singular: 'rubrica',
    group: 'Contenuti',
    listColumns: ['name', 'slug', 'sort_order'],
    orderBy: { column: 'sort_order', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'description', label: 'Descrizione', type: 'textarea' },
      { name: 'sort_order', label: 'Ordine', type: 'number' },
    ],
  },
  {
    key: 'events',
    table: 'events',
    label: 'Eventi',
    singular: 'evento',
    group: 'Contenuti',
    listColumns: ['title', 'kind', 'starts_on', 'city', 'status'],
    orderBy: { column: 'starts_on', ascending: false },
    fields: [
      { name: 'title', label: 'Titolo', type: 'text', required: true, section: 'Cosa', help: '«Firmacopie di Erin Doom», «Salone del Libro 2027».' },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      {
        name: 'kind', label: 'Tipo', type: 'select', required: true, section: 'Cosa',
        options: [['fair', 'Fiera'], ['signing', 'Firmacopie'], ['presentation', 'Presentazione'], ['other', 'Altro']],
      },
      { name: 'description', label: 'Descrizione', type: 'textarea', section: 'Cosa', help: 'Due righe scritte da noi.' },
      { name: 'starts_on', label: 'Giorno (o primo giorno)', type: 'date', required: true, section: 'Quando' },
      { name: 'ends_on', label: 'Ultimo giorno', type: 'date', section: 'Quando', help: 'Solo se dura più di un giorno.' },
      { name: 'venue', label: 'Luogo', type: 'text', section: 'Dove', help: '«Libreria Feltrinelli, piazza Duomo», «Padiglione 2».' },
      { name: 'city', label: 'Città', type: 'text', section: 'Dove' },
      { name: 'url', label: 'Link per informazioni o biglietti', type: 'text', section: 'Dove' },
      status,
    ],
    manyToMany: [
      { label: 'Autori', joinTable: 'event_authors', ownKey: 'event_id', otherKey: 'author_id', table: 'authors', labelColumn: 'name', creatable: true, section: 'Chi e quali libri' },
      { label: 'Libri', joinTable: 'event_works', ownKey: 'event_id', otherKey: 'work_id', table: 'works', labelColumn: 'title', section: 'Chi e quali libri' },
    ],
  },
  {
    key: 'feedback',
    table: 'feedback',
    label: 'Messaggi',
    singular: 'messaggio',
    group: 'Contenuti',
    noCreate: true,
    listColumns: ['created_at', 'kind', 'message', 'email', 'read'],
    orderBy: { column: 'created_at', ascending: false },
    fields: [
      { name: 'created_at', label: 'Ricevuto', type: 'date', readonly: true },
      {
        name: 'kind', label: 'Tipo', type: 'select', readonly: true,
        options: [['idea', 'Idea'], ['bug', 'Errore'], ['book', 'Libro che manca'], ['other', 'Altro']],
      },
      { name: 'message', label: 'Messaggio', type: 'textarea', readonly: true },
      { name: 'name', label: 'Nome', type: 'text', readonly: true },
      { name: 'email', label: 'Email', type: 'text', readonly: true, help: 'Solo per rispondere: dopo la risposta elimina il messaggio.' },
      { name: 'page', label: 'Inviato da', type: 'text', readonly: true },
      { name: 'read', label: 'Letto', type: 'checkbox' },
    ],
  },
  {
    key: 'news',
    table: 'news',
    label: 'Notizie',
    singular: 'notizia',
    group: 'Contenuti',
    listColumns: ['title', 'color', 'pinned', 'published_at', 'status'],
    orderBy: { column: 'published_at', ascending: false },
    fields: [
      { name: 'title', label: 'Titolo', type: 'text', required: true, help: 'Breve: è scritto grande sul post-it.' },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      { name: 'body', label: 'Testo', type: 'textarea', help: 'Poche righe. Paragrafi separati da una riga vuota; sulla bacheca si legge l\'inizio, il resto aprendo il post-it.' },
      {
        name: 'color', label: 'Colore del post-it', type: 'select', required: true,
        options: [['yellow', 'Giallo'], ['pink', 'Rosa'], ['blue', 'Azzurro'], ['green', 'Verde'], ['orange', 'Arancione']],
      },
      { name: 'pinned', label: 'Fissata in cima', type: 'checkbox' },
      { name: 'image_url', label: 'Foto', type: 'image', bucket: 'news', help: 'Facoltativa. Viene ridotta e convertita prima del caricamento; usa solo foto tue o che puoi pubblicare.' },
      { name: 'image_alt', label: 'Testo alternativo della foto', type: 'text', help: 'Cosa mostra la foto, per chi usa un lettore di schermo.' },
      { name: 'published_at', label: 'Data', type: 'date' },
      status,
    ],
  },
  {
    key: 'promotions',
    table: 'promotions',
    label: 'Promozioni',
    singular: 'promozione',
    group: 'Contenuti',
    listColumns: ['title', 'kind', 'ends_on', 'status'],
    orderBy: { column: 'ends_on', ascending: false },
    fields: [
      { name: 'title', label: 'Titolo', type: 'text', required: true, section: 'Cosa' },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      { name: 'publisher_id', label: 'Editore', type: 'relation', table: 'publishers', labelColumn: 'name', creatable: true, section: 'Cosa' },
      {
        name: 'kind', label: 'Tipo', type: 'select', required: true, section: 'Cosa',
        options: [
          ['gift_with_purchase', 'Omaggio con l\'acquisto'],
          ['bundle', 'Offerta multipla (3x2…)'],
          ['discount', 'Sconto'],
          ['contest', 'Concorso'],
          ['preorder', 'Bonus preordine'],
        ],
      },
      { name: 'reward', label: 'Cosa si ottiene', type: 'text', section: 'Cosa', help: 'Scritto grande sul buono: «Un plaid in omaggio», «Il terzo libro è gratis».' },
      { name: 'conditions', label: 'Condizioni', type: 'text', section: 'Cosa', help: '«Acquistando 3 libri della collana X».' },
      { name: 'description', label: 'Descrizione', type: 'textarea', section: 'Cosa', help: 'Scritta da noi, non copiata dal comunicato.' },
      { name: 'starts_on', label: 'Dal', type: 'date', section: 'Quando', help: 'Vuoto se è già in corso.' },
      { name: 'ends_on', label: 'Fino al', type: 'date', section: 'Quando', help: 'Vuoto se non c\'è una scadenza (fino a esaurimento).' },
      {
        name: 'channel', label: 'Dove', type: 'select', required: true, section: 'Dove',
        options: [['everywhere', 'Online e in libreria'], ['online', 'Online'], ['bookstores', 'In libreria'], ['chain', 'In una catena']],
      },
      { name: 'where_note', label: 'Dove, in dettaglio', type: 'text', section: 'Dove', help: '«Nelle librerie aderenti», «Sul sito dell\'editore».' },
      { name: 'url', label: 'Link alla promozione', type: 'text', section: 'Dove' },
      { name: 'image_url', label: 'Grafica ufficiale (link)', type: 'text', section: 'Grafica', help: 'Solo grafiche pubblicate dall\'editore per la promozione. In build viene scaricata e ottimizzata.' },
      { name: 'image_credit', label: 'Credito della grafica', type: 'text', section: 'Grafica', help: '«Editrice Esempio»: compare sotto la grafica.' },
      { name: 'image_alt', label: 'Testo alternativo', type: 'text', advanced: true, help: 'Cosa mostra la grafica e cosa c\'è scritto, per chi usa un lettore di schermo.' },
      { name: 'source_url', label: 'Fonte', type: 'text', advanced: true, help: 'Pagina da cui è stata ricavata, per controllarla.' },
      status,
    ],
    manyToMany: [
      { label: 'Libri coinvolti', joinTable: 'promotion_works', ownKey: 'promotion_id', otherKey: 'work_id', table: 'works', labelColumn: 'title', section: 'Libri coinvolti' },
    ],
  },
  {
    key: 'works',
    table: 'works',
    label: 'Opere',
    singular: 'opera',
    group: 'Catalogo',
    listColumns: ['title', 'series', 'origin', 'status'],
    orderBy: { column: 'title', ascending: true },
    fields: [
      { name: 'title', label: 'Titolo', type: 'text', required: true, section: 'Libro' },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      { name: 'plot', label: 'Trama', type: 'textarea', section: 'Libro', help: 'Solo trame scritte da noi: mai copiare la quarta di copertina.' },
      { name: 'series', label: 'Serie', type: 'text', section: 'Serie' },
      { name: 'series_number', label: 'Numero nella serie', type: 'number', section: 'Serie' },
      {
        name: 'origin', label: 'Origine', type: 'select', required: true, section: 'Classificazione',
        options: [['publisher', 'Editore'], ['self', 'Self-publishing'], ['wattpad', 'Wattpad']],
      },
      {
        name: 'spice_level', label: 'Livello spicy', type: 'select', section: 'Classificazione',
        options: [
          ['0', '0 · nessuna scena spicy'],
          ['1', '1 · baci e tensione'],
          ['2', '2 · scene sensuali, a porte chiuse'],
          ['3', '3 · scene esplicite'],
          ['4', '4 · molto esplicito'],
          ['5', '5 · estremamente esplicito'],
        ],
        help: 'Solo per romance e derivati: negli altri generi non viene mostrato.',
      },
      status,
    ],
    manyToMany: [
      { label: 'Autori', joinTable: 'work_authors', ownKey: 'work_id', otherKey: 'author_id', table: 'authors', labelColumn: 'name', creatable: true, section: 'Libro' },
      { label: 'Generi', joinTable: 'work_genres', ownKey: 'work_id', otherKey: 'genre_id', table: 'genres', labelColumn: 'name', creatable: true, section: 'Classificazione' },
      { label: 'Tropes', joinTable: 'work_tropes', ownKey: 'work_id', otherKey: 'trope_id', table: 'tropes', labelColumn: 'name', creatable: true, section: 'Classificazione' },
      { label: 'Ambientazione', joinTable: 'work_settings', ownKey: 'work_id', otherKey: 'setting_id', table: 'settings', labelColumn: 'name', creatable: true, section: 'Classificazione' },
    ],
    children: [
      { resource: 'editions', foreignKey: 'work_id', label: 'Edizioni' },
      { resource: 'adaptations', foreignKey: 'work_id', label: 'Serie TV e film' },
    ],
  },
  {
    key: 'editions',
    table: 'editions',
    label: 'Edizioni',
    singular: 'edizione',
    group: 'Catalogo',
    listColumns: ['work_id', 'format', 'edition_type', 'release_date', 'publisher_id'],
    orderBy: { column: 'release_date', ascending: false },
    fields: [
      { name: 'work_id', label: 'Opera', type: 'relation', table: 'works', labelColumn: 'title', required: true, section: 'Edizione' },
      {
        name: 'format', label: 'Formato', type: 'select', required: true, section: 'Edizione',
        options: [['paperback', 'Brossura'], ['hardcover', 'Copertina rigida'], ['kindle', 'Kindle'], ['audio', 'Audiolibro']],
      },
      {
        name: 'edition_type', label: 'Tipo', type: 'select', required: true,
        options: [['standard', 'Standard'], ['special', 'Speciale'], ['limited', 'Limitata']],
      },
      { name: 'publisher_id', label: 'Editore', type: 'relation', table: 'publishers', labelColumn: 'name', creatable: true },
      { name: 'first_print', label: 'Prima edizione / prima tiratura', type: 'checkbox' },
      { name: 'pages', label: 'Pagine', type: 'number' },
      { name: 'isbn', label: 'ISBN', type: 'text' },
      { name: 'cover_url', label: 'Copertina di questa edizione', type: 'cover', bucket: 'covers', section: 'Copertina' },
      { name: 'release_date', label: 'Data uscita', type: 'date', section: 'Uscita e prezzo' },
      {
        name: 'release_precision', label: 'La data è', type: 'select', section: 'Uscita e prezzo', options: [
          ['day', 'esatta'], ['month', 'solo il mese'], ['year', "solo l'anno"],
        ],
      },
      { name: 'price', label: 'Prezzo (€)', type: 'number', section: 'Uscita e prezzo' },
      { name: 'language', label: 'Lingua', type: 'text', required: true },
      { name: 'print_run', label: 'Tiratura', type: 'number' },
      { name: 'details', label: 'Dettagli', type: 'textarea', help: 'Bordi decorati, copertina alternativa, firma…' },
      {
        name: 'purchase_links', label: 'Link d\'acquisto', type: 'json', section: 'Acquisto',
        help: 'Lista JSON: [{"label": "Amazon", "url": "https://…", "affiliate": true}]',
      },
    ],
  },
  {
    key: 'adaptations',
    table: 'adaptations',
    label: 'Serie TV e film',
    singular: 'adattamento',
    group: 'Catalogo',
    listColumns: ['title', 'work_id', 'kind', 'platform', 'status'],
    orderBy: { column: 'release_date', ascending: false },
    fields: [
      { name: 'work_id', label: 'Tratto da', type: 'relation', table: 'works', labelColumn: 'title', required: true },
      { name: 'title', label: 'Titolo', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      { name: 'kind', label: 'Tipo', type: 'select', required: true, options: [['series', 'Serie TV'], ['film', 'Film']] },
      { name: 'plot', label: 'Trama', type: 'textarea', help: 'Scritta da noi, senza spoiler oltre la premessa.' },
      { name: 'platform', label: 'Piattaforma principale', type: 'text', help: 'Netflix, Prime Video, cinema…' },
      { name: 'release_date', label: 'Data di uscita', type: 'date' },
      { name: 'production_status', label: 'Stato produzione', type: 'text', help: 'Annunciata, in lavorazione, in uscita… (mostrato se manca la data)' },
      { name: 'seasons', label: 'Stagioni (serie)', type: 'number' },
      { name: 'episodes', label: 'Episodi in totale (serie)', type: 'number' },
      { name: 'runtime_minutes', label: 'Durata in minuti (film)', type: 'number' },
      { name: 'poster_url', label: 'URL locandina', type: 'text' },
      { name: 'trailer_url', label: 'Trailer (link YouTube)', type: 'text', help: 'Incolla il link del trailer ufficiale (youtube.com/watch?v=… o youtu.be/…). Sul sito si carica solo quando si preme play.' },
      {
        name: 'watch_providers', label: 'Dove vederlo (Italia)', type: 'json',
        help: 'Lista JSON: [{"platform": "Netflix", "url": "https://…", "kind": "subscription"}] — kind: subscription, rent, buy, free',
      },
      { name: 'tmdb_id', label: 'ID TMDB', type: 'number' },
      status,
    ],
    manyToMany: [
      { label: 'Generi (se vuoto: quelli del libro)', joinTable: 'adaptation_genres', ownKey: 'adaptation_id', otherKey: 'genre_id', table: 'genres', labelColumn: 'name', creatable: true },
      { label: 'Tropes (se vuoto: quelli del libro)', joinTable: 'adaptation_tropes', ownKey: 'adaptation_id', otherKey: 'trope_id', table: 'tropes', labelColumn: 'name', creatable: true },
    ],
  },
  {
    key: 'merch',
    table: 'merch',
    label: 'Gadget',
    singular: 'gadget',
    group: 'Catalogo',
    listColumns: ['name', 'kind', 'edition_id', 'shop', 'status'],
    orderBy: { column: 'updated_at', ascending: false },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      {
        name: 'kind', label: 'Tipo', type: 'select', required: true,
        options: [['gadget', 'Gadget'], ['jewelry', 'Gioiello'], ['box', 'Box'], ['other', 'Altro']],
      },
      {
        name: 'edition_id', label: "Incluso nell'edizione", type: 'relation', table: 'editions', labelColumn: 'release_date',
        optionSelect: 'id, release_date, format, edition_type, first_print, works ( title )',
        optionLabel: (r) =>
          [r.works?.title, r.first_print ? 'prima edizione' : r.edition_type !== 'standard' ? r.edition_type : r.format, r.release_date]
            .filter(Boolean)
            .join(' · '),
        help: 'Se il gadget era venduto insieme a una edizione (prima tiratura, limitata…). Lascia vuoto se si compra a parte.',
      },
      { name: 'shop', label: 'Negozio', type: 'text' },
      { name: 'price', label: 'Prezzo (€)', type: 'number' },
      { name: 'url', label: 'Link', type: 'text' },
      { name: 'affiliate', label: 'Link affiliato', type: 'checkbox' },
      status,
    ],
    manyToMany: [
      { label: 'Libri', joinTable: 'merch_works', ownKey: 'merch_id', otherKey: 'work_id', table: 'works', labelColumn: 'title' },
      { label: 'Autori', joinTable: 'merch_authors', ownKey: 'merch_id', otherKey: 'author_id', table: 'authors', labelColumn: 'name', creatable: true },
    ],
  },
  {
    key: 'authors',
    table: 'authors',
    label: 'Autori',
    singular: 'autore',
    group: 'Anagrafiche',
    listColumns: ['name', 'slug'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'bio', label: 'Bio breve', type: 'textarea' },
      { name: 'social_links', label: 'Link social', type: 'json', help: 'Lista JSON: [{"label": "Instagram", "url": "https://…"}]' },
    ],
  },
  {
    key: 'publishers',
    table: 'publishers',
    label: 'Editori',
    singular: 'editore',
    group: 'Anagrafiche',
    listColumns: ['name', 'kind'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      {
        name: 'kind', label: 'Tipo', type: 'select', required: true,
        options: [['publisher', 'Editore'], ['self', 'Self-publishing'], ['box', 'Box']],
      },
      { name: 'website', label: 'Sito', type: 'text' },
    ],
  },
  {
    key: 'genres',
    table: 'genres',
    label: 'Generi',
    singular: 'genere',
    group: 'Anagrafiche',
    listColumns: ['name', 'slug', 'theme'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      {
        name: 'theme', label: 'Colore anteprima', type: 'select', options: THEME_OPTIONS,
        help: 'Se vuoto viene scelto in base allo slug (romance, giallo, horror, fantasy…).',
      },
      { name: 'description', label: 'Descrizione', type: 'textarea' },
    ],
  },
  {
    key: 'tropes',
    table: 'tropes',
    label: 'Tropes',
    singular: 'trope',
    group: 'Anagrafiche',
    listColumns: ['name', 'doodle'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'doodle', label: 'Decorazione', type: 'select', options: DOODLE_OPTIONS, help: 'Scarabocchio disegnato sugli sfondi dei libri con questo trope. Se vuoto viene scelto in automatico.' },
      { name: 'description', label: 'Descrizione', type: 'textarea' },
    ],
    // nel menu «Tropes» della pagina Libri il trope compare sotto ognuno di questi generi (migrazione 0019); senza, in «Altri»
    manyToMany: [
      { label: 'Generi', joinTable: 'trope_genres', ownKey: 'trope_id', otherKey: 'genre_id', table: 'genres', labelColumn: 'name' },
    ],
  },
  {
    key: 'settings',
    table: 'settings',
    label: 'Ambientazioni',
    singular: 'ambientazione',
    group: 'Anagrafiche',
    listColumns: ['name', 'slug', 'doodle'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, help: 'College, scuola, lavoro, corte reale…' },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'doodle', label: 'Decorazione', type: 'select', options: DOODLE_OPTIONS, help: 'Scarabocchio disegnato sugli sfondi dei libri ambientati qui. Se vuoto viene scelto in automatico.' },
      { name: 'description', label: 'Descrizione', type: 'textarea' },
    ],
  },
  {
    key: 'sources',
    table: 'sources',
    label: 'Fonti',
    singular: 'fonte',
    group: 'Anagrafiche',
    listColumns: ['name', 'purpose', 'last_read_at', 'active'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      { name: 'url', label: 'Indirizzo', type: 'text', required: true, help: 'Pagina delle promozioni o feed RSS dell\'editore.' },
      { name: 'kind', label: 'Tipo', type: 'select', required: true, options: [['page', 'Pagina'], ['rss', 'Feed RSS'], ['api', 'API']] },
      {
        name: 'purpose', label: 'Cosa cercare', type: 'select', required: true,
        options: [['promotions', 'Promozioni'], ['releases', 'Uscite'], ['events', 'Eventi']],
      },
      { name: 'active', label: 'Leggila ogni notte', type: 'checkbox' },
      {
        name: 'frequency', label: 'Frequenza', type: 'select', required: true,
        options: [['daily', 'Ogni notte'], ['hot', 'Calda: anche ogni mezz\'ora di giorno']],
        help: 'Calda per box, edizioni limitate e promozioni a tempo, che vanno a ruba in poche ore. Se la pagina non cambia non si spende nulla.',
      },
    ],
  },
];

export function getResource(key: string): Resource | undefined {
  return RESOURCES.find((r) => r.key === key);
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
