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
  social_links?: Array<{ label: string; url: string }> | null;
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

export type WatchKind = 'subscription' | 'rent' | 'buy' | 'free';

/** Dove vedere un adattamento (disponibilità in Italia). */
export interface WatchProvider {
  platform: string;
  url?: string | null;
  kind: WatchKind;
}

export interface Adaptation {
  id: string;
  slug: string;
  title: string;
  kind: 'series' | 'film';
  platform?: string | null;
  release_date?: string | null;
  production_status?: string | null;
  tmdb_id?: number | null;
  plot?: string | null;
  poster_url?: string | null;
  seasons?: number | null;
  episodes?: number | null;
  runtime_minutes?: number | null;
  watch_providers: WatchProvider[];
  genres: Tag[];
  tropes: Tag[];
  /** true se generi/tropes non sono indicati sull'adattamento e vengono dal libro. */
  inherited: { genres: boolean; tropes: boolean };
  source: { slug: string; title: string; authors: Author[] };
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

export type PromotionKind = 'gift_with_purchase' | 'bundle' | 'discount' | 'contest' | 'preorder';
export type PromotionChannel = 'online' | 'bookstores' | 'chain' | 'everywhere';

/** Promozione di un editore o di una libreria: omaggio, 3x2, sconto, concorso, bonus preordine. */
export type NewsColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';

/** Notizia della bacheca: un post-it scritto dalla redazione. */
export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  image_url: string | null;
  image_alt: string | null;
  color: NewsColor;
  pinned: boolean;
  published_at: string | null;
}

export interface Promotion {
  id: string;
  slug: string;
  title: string;
  kind: PromotionKind;
  publisher: Publisher | null;
  description?: string | null;
  conditions?: string | null;
  reward?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  channel: PromotionChannel;
  where_note?: string | null;
  url?: string | null;
  image_url?: string | null;
  image_credit?: string | null;
  image_alt?: string | null;
  source_url?: string | null;
  works: Array<{ slug: string; title: string }>;
}
