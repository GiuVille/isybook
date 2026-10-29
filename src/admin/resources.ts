// Configurazione delle risorse gestite dal pannello admin.
// Ogni risorsa è una tabella Supabase; i campi guidano lista e form.
import { THEME_OPTIONS } from '../lib/book-themes';

export type FieldType =
  | 'text'
  | 'slug'
  | 'textarea'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'relation'
  | 'json';

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
  help?: string;
}

/** Relazione molti-a-molti gestita con una lista di checkbox. */
export interface ManyToMany {
  label: string;
  joinTable: string;
  ownKey: string; // colonna della join che punta a questa risorsa
  otherKey: string; // colonna della join che punta all'altra tabella
  table: string;
  labelColumn: string;
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
      { name: 'title', label: 'Titolo', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      {
        name: 'kind', label: 'Tipo', type: 'select', required: true,
        options: [['fair', 'Fiera'], ['signing', 'Firmacopie'], ['presentation', 'Presentazione'], ['other', 'Altro']],
      },
      { name: 'starts_on', label: 'Inizio', type: 'date', required: true },
      { name: 'ends_on', label: 'Fine', type: 'date' },
      { name: 'venue', label: 'Luogo', type: 'text' },
      { name: 'city', label: 'Città', type: 'text' },
      { name: 'url', label: 'Link', type: 'text' },
      { name: 'description', label: 'Descrizione', type: 'textarea' },
      status,
    ],
    manyToMany: [
      { label: 'Autori', joinTable: 'event_authors', ownKey: 'event_id', otherKey: 'author_id', table: 'authors', labelColumn: 'name' },
      { label: 'Libri', joinTable: 'event_works', ownKey: 'event_id', otherKey: 'work_id', table: 'works', labelColumn: 'title' },
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
      { name: 'title', label: 'Titolo', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      { name: 'publisher_id', label: 'Editore', type: 'relation', table: 'publishers', labelColumn: 'name' },
      {
        name: 'kind', label: 'Tipo', type: 'select', required: true,
        options: [
          ['gift_with_purchase', 'Omaggio con l\'acquisto'],
          ['bundle', 'Offerta multipla (3x2…)'],
          ['discount', 'Sconto'],
          ['contest', 'Concorso'],
          ['preorder', 'Bonus preordine'],
        ],
      },
      { name: 'reward', label: 'Cosa si ottiene', type: 'text', help: 'Scritto grande sul buono: «Un plaid in omaggio», «Il terzo libro è gratis».' },
      { name: 'conditions', label: 'Condizioni', type: 'text', help: '«Acquistando 3 libri della collana X».' },
      { name: 'description', label: 'Descrizione', type: 'textarea', help: 'Scritta da noi, non copiata dal comunicato.' },
      { name: 'starts_on', label: 'Inizio', type: 'date' },
      { name: 'ends_on', label: 'Fine', type: 'date' },
      {
        name: 'channel', label: 'Dove', type: 'select', required: true,
        options: [['everywhere', 'Online e in libreria'], ['online', 'Online'], ['bookstores', 'In libreria'], ['chain', 'In una catena']],
      },
      { name: 'where_note', label: 'Dove, in dettaglio', type: 'text', help: '«Nelle librerie aderenti», «Sul sito dell\'editore».' },
      { name: 'url', label: 'Link alla promozione', type: 'text' },
      { name: 'image_url', label: 'Immagine', type: 'text' },
      { name: 'source_url', label: 'Fonte', type: 'text', help: 'Pagina da cui è stata ricavata, per controllarla.' },
      status,
    ],
    manyToMany: [
      { label: 'Libri coinvolti', joinTable: 'promotion_works', ownKey: 'promotion_id', otherKey: 'work_id', table: 'works', labelColumn: 'title' },
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
      { name: 'title', label: 'Titolo', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'title', required: true },
      { name: 'plot', label: 'Trama', type: 'textarea', help: 'Solo trame scritte da noi: mai copiare la quarta di copertina.' },
      { name: 'series', label: 'Serie', type: 'text' },
      { name: 'series_number', label: 'Numero nella serie', type: 'number' },
      {
        name: 'origin', label: 'Origine', type: 'select', required: true,
        options: [['publisher', 'Editore'], ['self', 'Self-publishing'], ['wattpad', 'Wattpad']],
      },
      {
        name: 'spice_level', label: 'Livello spicy', type: 'select',
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
      { label: 'Autori', joinTable: 'work_authors', ownKey: 'work_id', otherKey: 'author_id', table: 'authors', labelColumn: 'name' },
      { label: 'Generi', joinTable: 'work_genres', ownKey: 'work_id', otherKey: 'genre_id', table: 'genres', labelColumn: 'name' },
      { label: 'Tropes', joinTable: 'work_tropes', ownKey: 'work_id', otherKey: 'trope_id', table: 'tropes', labelColumn: 'name' },
      { label: 'Ambientazione', joinTable: 'work_settings', ownKey: 'work_id', otherKey: 'setting_id', table: 'settings', labelColumn: 'name' },
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
      { name: 'work_id', label: 'Opera', type: 'relation', table: 'works', labelColumn: 'title', required: true },
      {
        name: 'format', label: 'Formato', type: 'select', required: true,
        options: [['paperback', 'Brossura'], ['hardcover', 'Copertina rigida'], ['kindle', 'Kindle'], ['audio', 'Audiolibro']],
      },
      {
        name: 'edition_type', label: 'Tipo', type: 'select', required: true,
        options: [['standard', 'Standard'], ['special', 'Speciale'], ['limited', 'Limitata']],
      },
      { name: 'publisher_id', label: 'Editore', type: 'relation', table: 'publishers', labelColumn: 'name' },
      { name: 'first_print', label: 'Prima edizione / prima tiratura', type: 'checkbox' },
      { name: 'pages', label: 'Pagine', type: 'number' },
      { name: 'isbn', label: 'ISBN', type: 'text' },
      { name: 'release_date', label: 'Data uscita', type: 'date' },
      { name: 'price', label: 'Prezzo (€)', type: 'number' },
      { name: 'language', label: 'Lingua', type: 'text', required: true },
      { name: 'print_run', label: 'Tiratura', type: 'number' },
      { name: 'details', label: 'Dettagli', type: 'textarea', help: 'Bordi decorati, copertina alternativa, firma…' },
      { name: 'cover_url', label: 'URL copertina', type: 'text' },
      {
        name: 'purchase_links', label: 'Link d\'acquisto', type: 'json',
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
      {
        name: 'watch_providers', label: 'Dove vederlo (Italia)', type: 'json',
        help: 'Lista JSON: [{"platform": "Netflix", "url": "https://…", "kind": "subscription"}] — kind: subscription, rent, buy, free',
      },
      { name: 'tmdb_id', label: 'ID TMDB', type: 'number' },
      status,
    ],
    manyToMany: [
      { label: 'Generi (se vuoto: quelli del libro)', joinTable: 'adaptation_genres', ownKey: 'adaptation_id', otherKey: 'genre_id', table: 'genres', labelColumn: 'name' },
      { label: 'Tropes (se vuoto: quelli del libro)', joinTable: 'adaptation_tropes', ownKey: 'adaptation_id', otherKey: 'trope_id', table: 'tropes', labelColumn: 'name' },
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
      { label: 'Autori', joinTable: 'merch_authors', ownKey: 'merch_id', otherKey: 'author_id', table: 'authors', labelColumn: 'name' },
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
    listColumns: ['name', 'slug'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'description', label: 'Descrizione', type: 'textarea' },
    ],
  },
  {
    key: 'settings',
    table: 'settings',
    label: 'Ambientazioni',
    singular: 'ambientazione',
    group: 'Anagrafiche',
    listColumns: ['name', 'slug'],
    orderBy: { column: 'name', ascending: true },
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, help: 'College, scuola, lavoro, corte reale…' },
      { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
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
