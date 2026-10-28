export type ContentStatus = 'draft' | 'published' | 'archived';
export type EditionFormat = 'paperback' | 'hardcover' | 'kindle' | 'audio';
export type EditionType = 'standard' | 'special' | 'limited';
export type WorkOrigin = 'publisher' | 'self' | 'wattpad';
export type PublisherKind = 'publisher' | 'self' | 'box';

export interface Author {
  id: string;
  slug: string;
  name: string;
  bio?: string | null;
}

export interface Publisher {
  id: string;
  slug: string;
  name: string;
  kind: PublisherKind;
  website?: string | null;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
  theme?: string | null; // solo generi: palette dell'anteprima
}

export interface PurchaseLink {
  label: string;
  url: string;
  affiliate?: boolean;
}

export interface Edition {
  id: string;
  isbn?: string | null;
  format: EditionFormat;
  publisher?: Publisher | null;
  release_date?: string | null;
  price?: number | null;
  language: string;
  edition_type: EditionType;
  first_print: boolean; // prima edizione / prima tiratura
  pages?: number | null;
  print_run?: number | null;
  details?: string | null;
  cover_url?: string | null;
  purchase_links: PurchaseLink[];
}

export interface Adaptation {
  id: string;
  title: string;
  kind: 'series' | 'film';
  platform?: string | null;
  release_date?: string | null;
  production_status?: string | null;
  tmdb_id?: number | null;
}

export type MerchKind = 'gadget' | 'jewelry' | 'box' | 'other';

export interface Merch {
  id: string;
  name: string;
  kind: MerchKind;
  shop?: string | null;
  price?: number | null;
  url?: string | null;
  affiliate: boolean;
  /** Se valorizzato, il gadget era incluso in questa edizione (es. prima tiratura, edizione limitata). */
  edition_id?: string | null;
}

export interface Work {
  id: string;
  slug: string;
  title: string;
  plot?: string | null;
  series?: string | null;
  series_number?: number | null;
  origin: WorkOrigin;
  spice_level?: number | null; // 0–5, solo romance e derivati
  authors: Author[];
  genres: Tag[];
  tropes: Tag[];
  settings: Tag[]; // ambientazioni: college, scuola, lavoro…
  editions: Edition[];
  adaptations: Adaptation[];
  merch: Merch[];
}

export type EventKind = 'fair' | 'signing' | 'presentation' | 'other';

export interface BookEvent {
  id: string;
  slug: string;
  title: string;
  kind: EventKind;
  starts_on: string;
  ends_on?: string | null;
  venue?: string | null;
  city?: string | null;
  url?: string | null;
  description?: string | null;
  authors: Author[];
  works: Array<{ slug: string; title: string }>;
}

export interface Section {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  section?: Section | null;
  published_at?: string | null;
}
