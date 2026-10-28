// Card libro generate nel browser (feed "Per te", La mia libreria). Stili in global.css (.mini-book).
import type { CatalogBook } from './catalog';

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

/** Copertina: foto se c'è, altrimenti segnaposto nel colore del genere con il titolo. */
export function miniCover(book: CatalogBook): string {
  return book.cover
    ? `<img class="mini-book-cover" src="${esc(book.cover)}" alt="" loading="lazy">`
    : `<span class="mini-book-cover placeholder" style="--c:${esc(book.color)}" aria-hidden="true">${esc(book.title)}</span>`;
}

export function bookCard(book: CatalogBook, options: { note?: string; action?: string } = {}): string {
  return `
    <article class="mini-book">
      <a href="/libri/${esc(book.slug)}" class="mini-book-link">
        ${miniCover(book)}
        <span class="mini-book-text">
          <strong>${esc(book.title)}</strong>
          <span class="mini-book-meta">${esc(book.authors.join(', '))}</span>
          ${book.released ? `<span class="mini-book-meta">${esc(formatDate(book.released))}</span>` : ''}
          ${options.note ? `<span class="mini-book-note">${esc(options.note)}</span>` : ''}
        </span>
      </a>
      ${options.action ?? ''}
    </article>`;
}
