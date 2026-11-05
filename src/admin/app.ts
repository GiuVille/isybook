// Pannello admin: SPA lato client su Supabase (Auth + RLS).
// La sicurezza è nel database: solo gli utenti presenti in `editors` possono scrivere.
import type { Session } from '@supabase/supabase-js';
import { EDITION_TYPE_LABELS, FORMAT_LABELS } from '../lib/format';
import { getSupabase, supabaseConfigured } from '../lib/supabase';
import type { EditionFormat, EditionType } from '../lib/types';
import { RESOURCES, STATUS_OPTIONS, getResource, slugify, type Field, type Resource } from './resources';
import { approveReviewItem } from './review';
import { bindSocial, socialHtml } from './social';
import { enhancePickers } from './picker';
import { bindPriceSuggestion, bindWorkSuggestions } from './suggest';
import { clearDraft, formState, pruneDrafts, restoreDraft, watchDraft } from './draft';
import { bindNotes, flushNotes, notesHtml } from './notes';

const root = document.getElementById('admin')!;
let session: Session | null = null;

type Row = Record<string, any>;

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function render(html: string) {
  flushNotes(); // le note in sospeso si salvano prima di ridisegnare la pagina
  root.innerHTML = html;
}

function flash(message: string, kind: 'ok' | 'error' = 'ok') {
  const el = document.createElement('div');
  el.className = `flash ${kind}`;
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 2500);
}

function fail(error: unknown): never {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  flash(message, 'error');
  throw error;
}

function go(hash: string) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

/** Mappa id → etichetta per i campi relazione. */
async function loadOptions(
  table: string,
  labelColumn: string,
  custom?: Pick<Field, 'optionSelect' | 'optionLabel'>,
): Promise<Array<[string, string]>> {
  const select = custom?.optionSelect ?? `id, ${labelColumn}`;
  const { data, error } = await getSupabase().from(table).select(select).order(labelColumn);
  if (error) fail(error);
  return (data ?? []).map((r: Row) => [r.id, custom?.optionLabel ? custom.optionLabel(r) : r[labelColumn]]);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function shell(content: string): string {
  const groups = ['Contenuti', 'Catalogo', 'Anagrafiche'] as const;
  const current = location.hash;
  const link = (hash: string, label: string) =>
    `<a href="${hash}" class="${current.startsWith(hash) ? 'active' : ''}">${esc(label)}</a>`;
  return `
    <div class="layout">
      <aside>
        <a href="#/" class="brand">IsyBooks <small>admin</small></a>
        ${link('#/review', 'Da approvare')}
        ${link('#/segnala', 'Segnala promozione')}
        ${link('#/social', 'Post social')}
        ${groups
          .map(
            (g) => `<p class="group">${g}</p>${RESOURCES.filter((r) => r.group === g)
              .map((r) => link(`#/r/${r.key}`, r.label))
              .join('')}`,
          )
          .join('')}
        ${notesHtml()}
        <p class="group">Account</p>
        <span class="muted small">${esc(session?.user.email)}</span>
        <button type="button" class="link" id="logout">Esci</button>
      </aside>
      <section class="content">${content}</section>
    </div>`;
}

function bindShell() {
  bindNotes(session?.user.id);
  document.getElementById('logout')?.addEventListener('click', async () => {
    await getSupabase().auth.signOut();
  });
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function renderLogin(message = '') {
  render(`
    <form class="login card" id="login">
      <h1>IsyBooks</h1>
      <p class="muted">Accesso redazione</p>
      ${message ? `<p class="error">${esc(message)}</p>` : ''}
      <label>Email <input type="email" name="email" required autocomplete="username"></label>
      <label>Password <input type="password" name="password" required autocomplete="current-password"></label>
      <button type="submit">Entra</button>
    </form>`);
  document.getElementById('login')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (error) renderLogin(error.message === 'Invalid login credentials' ? 'Email o password sbagliate.' : error.message);
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard() {
  const sb = getSupabase();
  const counts = await Promise.all(
    ['review_queue', 'articles', 'works', 'editions', 'events', 'feedback'].map(async (table) => {
      let q = sb.from(table).select('id', { count: 'exact', head: true });
      if (table === 'review_queue') q = q.eq('status', 'pending');
      if (table === 'feedback') q = q.eq('read', false);
      const { count } = await q;
      return count ?? 0;
    }),
  );
  const [pending, articles, works, editions, events, unread] = counts;
  // stato del sito pubblico (migrazione 0007): se la tabella non c'è ancora, il riquadro non compare
  const { data: site } = await sb.from('site_state').select('content_changed_at, rebuild_requested_at, last_rebuild_at').eq('id', 1).maybeSingle();
  render(
    shell(`
      <h1>Panoramica</h1>
      <div class="stats">
        <a class="card stat" href="#/review"><strong>${pending}</strong> da approvare</a>
        <a class="card stat" href="#/r/articles"><strong>${articles}</strong> articoli</a>
        <a class="card stat" href="#/r/works"><strong>${works}</strong> opere</a>
        <a class="card stat" href="#/r/editions"><strong>${editions}</strong> edizioni</a>
        <a class="card stat" href="#/r/events"><strong>${events}</strong> eventi</a>
        <a class="card stat" href="#/r/feedback"><strong>${unread}</strong> ${unread === 1 ? 'messaggio' : 'messaggi'} da leggere</a>
      </div>
      <p class="actions">
        <a class="button" href="#/r/articles/new">Nuovo articolo</a>
        <a class="button secondary" href="#/r/works/new">Nuova opera</a>
        <a class="button secondary" href="#/r/events/new">Nuovo evento</a>
        <a class="button secondary" href="#/segnala">Segnala promozione</a>
        <a class="button secondary" href="#/social">Post social</a>
      </p>
      ${site ? siteCard(site) : '<p class="muted small">Il sito pubblico è statico: le modifiche compaiono online al build successivo.</p>'}`),
  );
  bindShell();

  document.getElementById('rebuild')?.addEventListener('click', async () => {
    const { error } = await sb.from('site_state').update({ rebuild_requested_at: new Date().toISOString() }).eq('id', 1);
    if (error) fail(error);
    flash('Richiesta inviata: il sito si aggiorna entro 15 minuti');
    await renderDashboard();
  });
}

/** Riquadro "Sito pubblico": ultimo aggiornamento, modifiche in attesa e pulsante per aggiornarlo subito. */
function siteCard(site: Row): string {
  const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'mai';
  const last = time(site.last_rebuild_at);
  const requested = time(site.rebuild_requested_at) > last;
  const pending = time(site.content_changed_at) > last;
  return `
    <section class="card site-card">
      <h2>Sito pubblico</h2>
      <p>Ultimo aggiornamento: <strong>${esc(when(site.last_rebuild_at))}</strong></p>
      <p>${
        requested
          ? 'Aggiornamento richiesto: va online entro 15 minuti.'
          : pending
            ? 'Ci sono modifiche non ancora online: partono da sole dopo 10 minuti senza altre modifiche.'
            : 'Tutto online.'
      }</p>
      ${requested ? '' : '<button type="button" id="rebuild">Aggiorna il sito adesso</button>'}
    </section>`;
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------
async function relationLabels(resource: Resource): Promise<Record<string, Record<string, string>>> {
  const maps: Record<string, Record<string, string>> = {};
  for (const f of resource.fields.filter((f) => f.type === 'relation' && resource.listColumns.includes(f.name))) {
    maps[f.name] = Object.fromEntries(await loadOptions(f.table!, f.labelColumn!, f));
  }
  return maps;
}

function displayValue(field: Field | undefined, value: unknown, labels: Record<string, Record<string, string>>): string {
  if (value == null || value === '') return '<span class="muted">—</span>';
  if (!field) return esc(value);
  if (field.type === 'relation') return esc(labels[field.name]?.[String(value)] ?? value);
  if (field.type === 'select') {
    const label = field.options?.find(([v]) => v === value)?.[1] ?? value;
    return field.name === 'status' ? `<span class="pill ${esc(value)}">${esc(label)}</span>` : esc(label);
  }
  if (field.type === 'date') return esc(new Date(String(value)).toLocaleDateString('it-IT'));
  if (field.type === 'checkbox') return value ? 'Sì' : '<strong>No</strong>';
  // testi lunghi (es. i messaggi): in elenco solo l'inizio
  if (field.type === 'textarea') return esc(String(value).length > 90 ? `${String(value).slice(0, 90)}…` : value);
  return esc(value);
}

/** Copertina di una riga in elenco: per le opere la prima edizione che ne ha una, per le edizioni la sua. */
function rowCover(resource: Resource, row: Row): string | null {
  if (resource.key === 'works') return (row.editions ?? []).find((e: Row) => e.cover_url)?.cover_url ?? null;
  if (resource.key === 'editions') return row.cover_url ?? null;
  return null;
}

/**
 * Pallino di stato di un'opera nel pannello:
 * rosso = mancano informazioni di base (autrice, genere, edizione o copertina);
 * arancione = la trama è da scrivere o da approvare (anche se in coda);
 * verde = tutto a posto, trama approvata.
 */
function workDot(row: Row, pendingPlots: Set<string>): { color: 'red' | 'orange' | 'green'; label: string } {
  const missing = [
    !(row.work_authors ?? []).length && 'autrice',
    !(row.work_genres ?? []).length && 'genere',
    !(row.editions ?? []).length && 'edizione',
    (row.editions ?? []).length && !(row.editions ?? []).some((e: Row) => e.cover_url) && 'copertina',
  ].filter(Boolean);
  if (missing.length) return { color: 'red', label: `Da sistemare: manca ${missing.join(', ')}` };
  if (!row.plot?.trim() || pendingPlots.has(row.id)) return { color: 'orange', label: 'Trama da scrivere o da approvare' };
  return { color: 'green', label: 'Tutto a posto' };
}

async function renderList(resource: Resource) {
  const listSelect =
    resource.key === 'works' ? '*, editions(cover_url), work_authors(author_id), work_genres(genre_id)' : '*';
  const { data, error } = await getSupabase()
    .from(resource.table)
    .select(listSelect)
    .order(resource.orderBy.column, { ascending: resource.orderBy.ascending, nullsFirst: false })
    .limit(500);
  if (error) fail(error);
  const rows = data ?? [];
  const labels = await relationLabels(resource);
  // opere con una trama ancora in "Da approvare": pallino arancione
  let pendingPlots = new Set<string>();
  if (resource.key === 'works') {
    const queued = await getSupabase().from('review_queue').select('payload->>work_id').eq('content_type', 'plot').eq('status', 'pending');
    if (queued.error) fail(queued.error);
    pendingPlots = new Set((queued.data ?? []).map((r: Row) => r.work_id).filter(Boolean));
  }
  const withThumbs = resource.key === 'works' || resource.key === 'editions';
  const fieldsByName = Object.fromEntries(resource.fields.map((f) => [f.name, f]));
  const hasStatus = resource.fields.some((f) => f.name === 'status');

  render(
    shell(`
      <div class="toolbar">
        <h1>${esc(resource.label)}</h1>
        ${resource.noCreate ? '' : `<a class="button" href="#/r/${resource.key}/new">Nuovo ${esc(resource.singular)}</a>`}
      </div>
      ${
        resource.key === 'works'
          ? `<p class="dot-legend"><span><span class="dot green"></span> tutto a posto</span><span><span class="dot orange"></span> trama da scrivere o da approvare</span><span><span class="dot red"></span> mancano informazioni (autrice, genere, edizione o copertina)</span></p>`
          : ''
      }
      <div class="filters">
        <input type="search" id="search" placeholder="Cerca…">
        ${
          resource.key === 'works'
            ? `<select id="dot-filter"><option value="">Tutti i colori</option><option value="red">Solo rosse</option><option value="orange">Solo arancioni</option><option value="green">Solo verdi</option></select>`
            : ''
        }
        ${
          hasStatus
            ? `<select id="status-filter"><option value="">Tutti gli stati</option>${STATUS_OPTIONS!.map(
                ([v, l]) => `<option value="${v}">${l}</option>`,
              ).join('')}</select>`
            : ''
        }
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${resource.listColumns.map((c) => `<th>${esc(fieldsByName[c]?.label ?? c)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows
              .map(
                (row: Row) => `
                <tr data-search="${esc(resource.listColumns.map((c) => labels[c]?.[row[c]] ?? row[c] ?? '').join(' ').toLowerCase())}"
                    data-status="${esc(row.status ?? '')}" data-dot="${resource.key === 'works' ? workDot(row, pendingPlots).color : ''}">
                  ${resource.listColumns
                    .map((c, i) => {
                      const cell = displayValue(fieldsByName[c], row[c], labels);
                      if (i !== 0) return `<td>${cell}</td>`;
                      const cover = withThumbs ? rowCover(resource, row) : null;
                      const thumb = withThumbs ? (cover ? `<img class="queue-thumb" src="${esc(cover)}" alt="" loading="lazy">` : '<span class="queue-thumb"></span>') : '';
                      const dot = resource.key === 'works' ? workDot(row, pendingPlots) : null;
                      return `<td><a class="${withThumbs ? 'list-title' : ''}" href="#/r/${resource.key}/${row.id}">${
                        dot ? `<span class="dot ${dot.color}" title="${esc(dot.label)}" aria-label="${esc(dot.label)}"></span>` : ''
                      }${thumb}<span>${cell}</span></a></td>`;
                    })
                    .join('')}
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        ${rows.length === 0 ? '<p class="muted">Nessun elemento.</p>' : ''}
      </div>`),
  );
  bindShell();

  const search = document.getElementById('search') as HTMLInputElement;
  const statusFilter = document.getElementById('status-filter') as HTMLSelectElement | null;
  const dotFilter = document.getElementById('dot-filter') as HTMLSelectElement | null;
  const applyFilters = () => {
    const q = search.value.trim().toLowerCase();
    const s = statusFilter?.value ?? '';
    const c = dotFilter?.value ?? '';
    root.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
      tr.hidden = (q !== '' && !tr.dataset.search!.includes(q)) || (s !== '' && tr.dataset.status !== s) || (c !== '' && tr.dataset.dot !== c);
    });
  };
  search.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  dotFilter?.addEventListener('change', applyFilters);
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
function fieldInput(field: Field, value: unknown, options: Record<string, Array<[string, string]>>): string {
  const required = field.readonly ? 'disabled' : field.required ? 'required' : '';
  const name = `name="${field.name}" id="f-${field.name}"`;
  switch (field.type) {
    case 'textarea':
      return `<textarea ${name} ${required} rows="${field.name === 'body' ? 16 : 4}">${esc(value)}</textarea>`;
    case 'json':
      return `<textarea ${name} rows="4" class="mono">${esc(value == null ? '[]' : JSON.stringify(value, null, 2))}</textarea>`;
    case 'number':
      return `<input type="number" step="any" ${name} ${required} value="${esc(value)}">`;
    case 'date':
      return `<input type="date" ${name} ${required} value="${esc(value ? String(value).slice(0, 10) : '')}">`;
    case 'checkbox':
      return `<input type="checkbox" ${name} ${value ? 'checked' : ''}>`;
    case 'image':
      // il valore è l'URL pubblico nello Storage; il file scelto viene caricato subito (vedi bindImageFields)
      return `<div class="image-field" data-bucket="${esc(field.bucket ?? '')}">
          <input type="hidden" ${name} value="${esc(value)}">
          <img class="image-preview" alt="" ${value ? `src="${esc(value)}"` : 'hidden'}>
          <input type="file" accept="image/*" aria-label="${esc(field.label)}">
          <button type="button" class="link danger image-remove" ${value ? '' : 'hidden'}>Rimuovi foto</button>
        </div>`;
    case 'select':
    case 'relation': {
      const opts = field.type === 'select' ? field.options! : options[field.name] ?? [];
      const empty = field.required ? '' : '<option value="">—</option>';
      const extra = field.type === 'relation' ? ` data-relation${field.creatable && !field.readonly ? ` data-create="${esc(field.table!)}"` : ''}` : '';
      const select = `<select ${name} ${required}${extra}>${empty}${opts
        .map(([v, l]) => `<option value="${esc(v)}" ${String(value ?? '') === v ? 'selected' : ''}>${esc(l)}</option>`)
        .join('')}</select>`;
      return select;
    }
    default:
      return `<input type="text" ${name} ${required} value="${esc(value)}">`;
  }
}

function readField(field: Field, form: HTMLFormElement): unknown {
  const el = form.elements.namedItem(field.name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const raw = el.value.trim();
  switch (field.type) {
    case 'checkbox':
      return (el as HTMLInputElement).checked;
    case 'number':
      return raw === '' ? null : Number(raw);
    case 'json':
      try {
        return raw === '' ? [] : JSON.parse(raw);
      } catch {
        throw new Error(`"${field.label}" non è un JSON valido`);
      }
    case 'slug':
      return slugify(raw);
    default:
      return raw === '' ? null : raw;
  }
}

async function renderForm(resource: Resource, id: string | null, prefill: Row = {}) {
  const sb = getSupabase();
  let row: Row = { ...defaults(resource), ...prefill };
  if (id) {
    const { data, error } = await sb.from(resource.table).select('*').eq('id', id).single();
    if (error) fail(error);
    row = data;
  }

  const options: Record<string, Array<[string, string]>> = {};
  for (const f of resource.fields.filter((f) => f.type === 'relation')) {
    options[f.name] = await loadOptions(f.table!, f.labelColumn!, f);
  }

  const m2m = await Promise.all(
    (resource.manyToMany ?? []).map(async (rel) => {
      const all = await loadOptions(rel.table, rel.labelColumn);
      let selected: string[] = [];
      if (id) {
        const { data, error } = await sb.from(rel.joinTable).select(rel.otherKey).eq(rel.ownKey, id);
        if (error) fail(error);
        selected = (data ?? []).map((r: Row) => r[rel.otherKey]);
      }
      return { rel, all, selected };
    }),
  );

  let childrenHtml = '';
  for (const rel of id ? resource.children ?? [] : []) {
    const child = getResource(rel.resource)!;
    const { data } = await sb
      .from(child.table)
      .select('*')
      .eq(rel.foreignKey, id!)
      .order(child.orderBy.column, { ascending: child.orderBy.ascending, nullsFirst: false });
    const childLabels = await relationLabels(child);
    const fieldsByName = Object.fromEntries(child.fields.map((f) => [f.name, f]));
    const cols = child.listColumns.filter((c) => c !== rel.foreignKey);
    childrenHtml += `
      <section class="children">
        <div class="toolbar">
          <h2>${esc(rel.label)}</h2>
          <a class="button secondary" href="#/r/${child.key}/new?${rel.foreignKey}=${id}">Aggiungi</a>
        </div>
        <div class="table-wrap"><table>
          <thead><tr>${cols.map((c) => `<th>${esc(fieldsByName[c]?.label ?? c)}</th>`).join('')}</tr></thead>
          <tbody>${(data ?? [])
            .map(
              (r: Row) =>
                `<tr>${cols
                  .map((c, i) => {
                    const cell = displayValue(fieldsByName[c], r[c], childLabels);
                    return `<td>${i === 0 ? `<a href="#/r/${child.key}/${r.id}">${cell}</a>` : cell}</td>`;
                  })
                  .join('')}</tr>`,
            )
            .join('')}</tbody>
        </table></div>
        ${(data ?? []).length === 0 ? '<p class="muted small">Nessun elemento.</p>' : ''}
      </section>`;
  }

  const title = id ? row[resource.fields[0].name] ?? `Modifica ${resource.singular}` : `Nuovo ${resource.singular}`;
  // copertina in piccolo accanto al titolo, per riconoscere subito il libro (opere: la prima edizione che ne ha una)
  let headCover: string | null = resource.key === 'editions' ? row.cover_url ?? null : null;
  if (resource.key === 'works' && id) {
    const ed = await sb.from('editions').select('cover_url').eq('work_id', id).not('cover_url', 'is', null).limit(1);
    headCover = ed.data?.[0]?.cover_url ?? null;
  }
  render(
    shell(`
      <p class="crumbs"><a href="#/r/${resource.key}">${esc(resource.label)}</a></p>
      <div class="form-head">${headCover ? `<img class="form-cover" src="${esc(headCover)}" alt="">` : ''}<h1>${esc(title)}</h1></div>
      <form id="edit" class="form card">
        ${resource.fields
          .map(
            (f) => `
            <div class="field ${f.type === 'textarea' || f.type === 'json' ? 'wide' : ''}">
              <label for="f-${f.name}">${esc(f.label)}${f.required ? ' *' : ''}</label>
              ${fieldInput(f, row[f.name], options)}
              ${f.help ? `<small class="muted">${esc(f.help)}</small>` : ''}
            </div>`,
          )
          .join('')}
        ${m2m
          .map(
            ({ rel, all, selected }) => `
            <fieldset class="field wide m2m" data-join="${rel.joinTable}" ${rel.creatable ? `data-create="${esc(rel.table)}"` : ''}>
              <legend>${esc(rel.label)}</legend>
              <div class="m2m-list">
                ${all
                  .map(
                    ([v, l]) =>
                      `<label class="check"><input type="checkbox" value="${esc(v)}" ${selected.includes(v) ? 'checked' : ''}> ${esc(l)}</label>`,
                  )
                  .join('')}
              </div>
            </fieldset>`,
          )
          .join('')}
        <div class="actions wide">
          <button type="submit">Salva</button>
          ${id ? '<button type="button" class="danger" id="delete">Elimina</button>' : ''}
        </div>
      </form>
      ${childrenHtml}`),
  );
  bindShell();

  const form = document.getElementById('edit') as HTMLFormElement;

  // Slug generato automaticamente finché non viene modificato a mano.
  for (const f of resource.fields.filter((f) => f.type === 'slug' && f.slugFrom)) {
    const slugEl = form.elements.namedItem(f.name) as HTMLInputElement;
    const sourceEl = form.elements.namedItem(f.slugFrom!) as HTMLInputElement;
    let touched = Boolean(slugEl.value);
    slugEl.addEventListener('input', () => (touched = true));
    sourceEl.addEventListener('input', () => {
      if (!touched) slugEl.value = slugify(sourceEl.value);
    });
  }

  // bozza automatica: quello che si scrive resta nel browser anche cambiando pagina, finché non si salva.
  // Si rimette nei campi prima dei menu e dei suggerimenti, che leggono i valori.
  const draftKey = `${resource.key}:${id ?? `new${Object.keys(prefill).length ? `?${new URLSearchParams(prefill as Record<string, string>)}` : ''}`}`;
  const savedState = formState(form);
  restoreDraft(form, draftKey, () => renderForm(resource, id, prefill));

  bindImageFields(form);
  // tendine e elenchi diventano menu con ricerca; le voci nuove si creano senza doppioni (stesso slug = stessa voce)
  enhancePickers(form, async (table, name) => {
    const { row, existed } = await findOrCreate(table, name);
    flash(existed ? `«${row.name}» c'era già: l'ho scelto` : `«${row.name}» aggiunto`);
    return { id: row.id, name: row.name };
  });
  // suggerimenti dalla stessa autrice (opere) e prezzo più usato dall'editore (edizioni)
  if (resource.key === 'works') bindWorkSuggestions(form, id);
  if (resource.key === 'editions') bindPriceSuggestion(form);
  watchDraft(form, draftKey, savedState);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.querySelector('.image-field.is-uploading')) return flash('Attendi la fine del caricamento della foto', 'error');
    let values: Row;
    try {
      values = Object.fromEntries(resource.fields.filter((f) => !f.readonly).map((f) => [f.name, readField(f, form)]));
    } catch (err) {
      return fail(err);
    }
    if (values.status === 'published' && 'published_at' in values && !values.published_at) {
      values.published_at = new Date().toISOString().slice(0, 10);
    }

    const query = id
      ? sb.from(resource.table).update(values).eq('id', id).select('id').single()
      : sb.from(resource.table).insert(values).select('id').single();
    const { data, error } = await query;
    if (error) fail(error);
    const savedId: string = data.id;

    for (const { rel } of m2m) {
      const checked = [...form.querySelectorAll<HTMLInputElement>(`fieldset[data-join="${rel.joinTable}"] input:checked`)].map(
        (i) => i.value,
      );
      const del = await sb.from(rel.joinTable).delete().eq(rel.ownKey, savedId);
      if (del.error) fail(del.error);
      if (checked.length) {
        const ins = await sb.from(rel.joinTable).insert(checked.map((v) => ({ [rel.ownKey]: savedId, [rel.otherKey]: v })));
        if (ins.error) fail(ins.error);
      }
    }

    clearDraft(draftKey);
    flash('Salvato');
    // si torna all'elenco: da lì si apre subito la prossima voce da aggiungere
    go(`#/r/${resource.key}`);
  });

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare definitivamente questo ${resource.singular}?`)) return;
    const { error } = await sb.from(resource.table).delete().eq('id', id!);
    if (error) fail(error);
    clearDraft(draftKey);
    flash('Eliminato');
    go(`#/r/${resource.key}`);
  });
}

// Voce nuova da un menu (tropes, generi, autori, editore…): se lo slug esiste già usa quella, senza doppioni.
async function findOrCreate(table: string, name: string): Promise<{ row: Row; existed: boolean }> {
  const sb = getSupabase();
  const slug = slugify(name);
  const found = await sb.from(table).select('id, name').eq('slug', slug).maybeSingle();
  if (found.error) fail(found.error);
  if (found.data) return { row: found.data, existed: true };
  const inserted = await sb.from(table).insert({ name, slug }).select('id, name').single();
  if (inserted.error) fail(inserted.error);
  return { row: inserted.data, existed: false };
}

// Foto: ridotta a 1600px e convertita in WebP nel browser (meno spazio nello Storage, niente dati EXIF
// come la posizione), poi caricata nel bucket; nel campo resta l'URL pubblico.
const MAX_IMAGE_SIDE = 1600;

async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Conversione della foto non riuscita'))), 'image/webp', 0.85),
  );
}

function bindImageFields(form: HTMLFormElement) {
  for (const box of form.querySelectorAll<HTMLElement>('.image-field')) {
    const value = box.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    const file = box.querySelector<HTMLInputElement>('input[type="file"]')!;
    const preview = box.querySelector<HTMLImageElement>('.image-preview')!;
    const remove = box.querySelector<HTMLButtonElement>('.image-remove')!;
    const show = (url: string) => {
      value.value = url;
      preview.hidden = !url;
      remove.hidden = !url;
      if (url) preview.src = url;
      else preview.removeAttribute('src');
    };
    remove.addEventListener('click', () => show(''));
    file.addEventListener('change', async () => {
      const chosen = file.files?.[0];
      if (!chosen) return;
      box.classList.add('is-uploading');
      try {
        const blob = await toWebp(chosen);
        const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.webp`;
        const storage = getSupabase().storage.from(box.dataset.bucket!);
        const { error } = await storage.upload(path, blob, { contentType: 'image/webp' });
        if (error) fail(error);
        show(storage.getPublicUrl(path).data.publicUrl);
        flash('Foto caricata');
      } finally {
        box.classList.remove('is-uploading');
        file.value = '';
      }
    });
  }
}

function defaults(resource: Resource): Row {
  const row: Row = {};
  for (const f of resource.fields) {
    if (f.name === 'status') row.status = 'draft';
    if (f.name === 'language') row.language = 'it';
    if (f.type === 'select' && f.required && !(f.name in row)) row[f.name] = f.options![0][0];
  }
  return row;
}

// ---------------------------------------------------------------------------
// Coda di revisione
// ---------------------------------------------------------------------------
const CONTENT_TYPE_LABELS: Record<string, string> = {
  book: 'Libro',
  event: 'Evento',
  article: 'Articolo',
  promotion: 'Promozione',
  plot: 'Trama',
  adaptation: 'Serie o film',
};
const PROMOTION_KINDS = getResource('promotions')!.fields.find((f) => f.name === 'kind')!.options!;

// Voci proposte per un libro o una promozione: ognuna va approvata, nulla viene scartato o creato in silenzio.
// Quelle già in catalogo partono spuntate; le nuove hanno il nome correggibile e partono spuntate solo
// se arrivano dai dati (autori, editore), non se sono un'interpretazione dell'estrazione (generi, tropes, ambientazioni).
type TagTable = 'genres' | 'tropes' | 'settings' | 'authors' | 'publishers';
const TAG_KINDS: Record<TagTable, { what: string; newChecked: boolean }> = {
  genres: { what: 'genere', newChecked: false },
  tropes: { what: 'trope', newChecked: false },
  settings: { what: 'ambientazione', newChecked: false },
  authors: { what: 'autore', newChecked: true },
  publishers: { what: 'editore', newChecked: true },
};
const humanize = (slug: string) => {
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
/** Proposti come slug (generi, tropes, ambientazioni) o come nomi (autori, editore). */
const fromSlugs = (slugs: string[] = []) => slugs.map((slug) => ({ slug, name: humanize(slug) }));
const fromNames = (items: Array<{ name: string; slug?: string } | null | undefined> = []) =>
  items.flatMap((x) => (x?.name ? [{ slug: x.slug || slugify(x.name), name: x.name }] : []));

async function proposedTags(
  sb: ReturnType<typeof getSupabase>,
  table: TagTable,
  label: string,
  items: Array<{ slug: string; name: string }>,
): Promise<string> {
  if (items.length === 0) return '';
  const { data, error } = await sb.from(table).select('slug, name').in('slug', items.map((x) => x.slug));
  if (error) fail(error);
  const known = new Map((data ?? []).map((r: Row) => [r.slug, r.name]));
  const { what, newChecked } = TAG_KINDS[table];
  return `<dt>${label}</dt><dd class="proposed" data-tags="${table}">${items
    .map((x) =>
      known.has(x.slug)
        ? `<label class="check"><input type="checkbox" data-slug="${esc(x.slug)}" data-name="${esc(known.get(x.slug))}" checked> ${esc(known.get(x.slug))}</label>`
        : `<label class="check"><input type="checkbox" data-slug="${esc(x.slug)}" data-new ${newChecked ? 'checked' : ''}> <input type="text" class="new-name" value="${esc(x.name)}" aria-label="Nome del nuovo ${what}"> <small>nuovo ${what}</small></label>`,
    )
    .join('')}</dd>`;
}

/** Voci spuntate, con il nome eventualmente corretto; isNew = da creare. */
function approvedTags(table: TagTable): Array<{ slug: string; name: string; isNew: boolean }> | null {
  const box = document.querySelector(`[data-tags="${table}"]`);
  if (!box) return null;
  return [...box.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map((c) => {
    if (!c.hasAttribute('data-new')) return { slug: c.dataset.slug!, name: c.dataset.name!, isNew: false };
    const name = c.parentElement!.querySelector<HTMLInputElement>('.new-name')!.value.trim() || humanize(c.dataset.slug!);
    return { slug: slugify(name), name, isNew: true };
  });
}

/** Generi, tropes e ambientazioni approvati nel formato del payload: slug da collegare + voci nuove da creare. */
function approvedSlugs(table: 'genres' | 'tropes' | 'settings'): Row {
  const items = approvedTags(table);
  if (!items) return {};
  return { [table]: items.map((x) => x.slug), [`new_${table}`]: items.filter((x) => x.isNew).map(({ slug, name }) => ({ slug, name })) };
}

/** Editore approvato (il primo spuntato) o null; undefined se non ce n'era uno proposto. */
function approvedPublisher(): Row | null | undefined {
  const items = approvedTags('publishers');
  if (!items) return undefined;
  return items[0] ? { name: items[0].name, slug: items[0].slug } : null;
}

/** Campi di una promozione proposta, modificabili prima di approvare. */
function promotionSummary(p: Row, publisherHtml: string): string {
  const input = (name: string, label: string, value: unknown, type = 'text') =>
    `<label for="pr-${name}">${label}</label><input id="pr-${name}" data-field="${name}" type="${type}" value="${esc(value ?? '')}">`;
  return `
    <dl class="summary">
      ${publisherHtml || '<dt>Editore</dt><dd>—</dd>'}
      <dt>Libri citati</dt><dd>${esc((p.works ?? []).join(', ') || '—')}</dd>
      <dt>Fonte</dt><dd>${p.source_url ? `<a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_url)}</a>` : '—'}</dd>
      ${p.note ? `<dt>Nota</dt><dd>${esc(p.note)}</dd>` : ''}
    </dl>
    ${p.needs_extraction ? '<p class="muted">Segnalazione in attesa della lettura notturna: puoi aspettare oppure compilare i campi qui sotto.</p>' : ''}
    ${p.extraction_note ? `<p class="muted">${esc(p.extraction_note)}</p>` : ''}
    ${p.raw_text ? `<details><summary>Testo incollato</summary><p class="muted">${esc(p.raw_text)}</p></details>` : ''}
    ${input('title', 'Titolo', p.title)}
    <label for="pr-kind">Tipo</label>
    <select id="pr-kind" data-field="kind">${PROMOTION_KINDS.map(([v, l]) => `<option value="${v}" ${v === p.kind ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    ${input('reward', 'Cosa si ottiene', p.reward)}
    ${input('conditions', 'Condizioni', p.conditions)}
    ${input('starts_on', 'Inizio', p.starts_on, 'date')}
    ${input('ends_on', 'Fine', p.ends_on, 'date')}
    ${input('where_note', 'Dove, in dettaglio', p.where_note)}
    <label for="pr-description">Descrizione (scritta da noi)</label>
    <textarea id="pr-description" data-field="description" rows="4">${esc(p.description)}</textarea>
    <fieldset class="promo-image">
      <legend>Grafica ufficiale</legend>
      ${p.image_url
        ? `<img src="${esc(p.image_url)}" alt="" style="max-width: 260px; max-height: 260px; display: block; margin-bottom: 8px;">
           <label><input type="checkbox" id="pr-use-image" checked> Usa questa immagine (solo se pubblicata dall'editore per la promozione)</label>`
        : '<p class="muted small">Nessuna grafica trovata: puoi incollare il link qui sotto.</p>'}
      ${input('image_url', 'Link dell\'immagine', p.image_url, 'url')}
      ${input('image_credit', 'Credito', p.image_credit ?? p.publisher?.name)}
      ${input('image_alt', 'Testo alternativo (cosa mostra e cosa c\'è scritto)', p.image_alt)}
    </fieldset>`;
}

const EVENT_KINDS = getResource('events')!.fields.find((f) => f.name === 'kind')!.options!;

/** Evento proposto dalle fonti: campi correggibili prima di approvare. */
function eventSummary(p: Row): string {
  const input = (name: string, label: string, value: unknown, type = 'text') =>
    `<label for="ev-${name}">${label}</label><input id="ev-${name}" data-field="${name}" type="${type}" value="${esc(value ?? '')}">`;
  return `
    <dl class="summary">
      <dt>Autrici e autori citati</dt><dd>${esc((p.authors ?? []).join(', ') || '—')} <small class="muted">(si collegano quelli già in catalogo)</small></dd>
      <dt>Libri citati</dt><dd>${esc((p.works ?? []).join(', ') || '—')}</dd>
      <dt>Fonte</dt><dd>${p.source_url ? `<a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_url)}</a>` : '—'}</dd>
    </dl>
    ${input('title', 'Titolo', p.title)}
    <label for="ev-kind">Tipo</label>
    <select id="ev-kind" data-field="kind">${EVENT_KINDS.map(([v, l]) => `<option value="${v}" ${v === p.kind ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    ${input('starts_on', 'Inizio', p.starts_on, 'date')}
    ${input('ends_on', 'Fine (se dura più giorni)', p.ends_on, 'date')}
    ${input('venue', 'Luogo', p.venue)}
    ${input('city', 'Città', p.city)}
    ${input('url', 'Link', p.url, 'url')}
    <label for="ev-description">Descrizione (scritta da noi)</label>
    <textarea id="ev-description" data-field="description" rows="3">${esc(p.description)}</textarea>`;
}

function reviewTitle(item: Row): string {
  const p = item.payload ?? {};
  if (item.content_type === 'adaptation') return `${p.adaptation?.title ?? ''} (da «${p.work_title ?? ''}»)`;
  return p.work?.title ?? p.title ?? p.name ?? item.id;
}

/** Una trama o un adattamento si possono approvare in blocco solo se non c'è nulla da decidere a mano. */
/** Si può approvare anche in blocco dall'elenco (il resto va aperto uno per uno)? */
function bulkReady(item: Row): boolean {
  const p = item.payload ?? {};
  if (item.content_type === 'plot') return Boolean(p.plot?.trim()) && !(p.new_tropes ?? []).length && !(p.new_genres ?? []).length;
  if (item.content_type === 'adaptation') return true;
  return false;
}

/** Testo in cui cercare: titolo, autrici, editore, fonte (minuscolo, senza accenti). */
function queueSearchText(item: Row): string {
  const p = item.payload ?? {};
  const names = (list: unknown) => (Array.isArray(list) ? list.map((x) => (typeof x === 'string' ? x : x?.name ?? '')) : []);
  return [
    reviewTitle(item),
    p.work_title,
    ...names(p.authors),
    p.publisher?.name ?? p.publisher,
    p.source_url,
    CONTENT_TYPE_LABELS[item.content_type],
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Da completare a mano: trama da scrivere, oppure tropes o generi nuovi da decidere. */
const queueIncomplete = (item: Row) => {
  const p = item.payload ?? {};
  return (item.content_type === 'plot' && !p.plot?.trim()) || Boolean((p.new_tropes ?? []).length || (p.new_genres ?? []).length);
};

// Sezioni di "Da approvare": libri, serie e film, promozioni, eventi; il resto (articoli…) in "Altro".
const QUEUE_SECTIONS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'libri', label: '📚 Libri', types: ['plot', 'book'] },
  { key: 'serie', label: '🎬 Serie e film', types: ['adaptation'] },
  { key: 'promozioni', label: '🎁 Promozioni', types: ['promotion'] },
  { key: 'eventi', label: '📅 Eventi', types: ['event'] },
];
const sectionOf = (type: string) => QUEUE_SECTIONS.find((s) => s.types.includes(type))?.key ?? 'altro';

/** Promozione o evento già finiti mentre aspettavano in coda: si segnalano, così non si approvano per sbaglio. */
function queueExpired(item: Row): boolean {
  const p = item.payload ?? {};
  const today = new Date().toISOString().slice(0, 10);
  if (item.content_type === 'promotion') return Boolean(p.ends_on && p.ends_on < today);
  if (item.content_type === 'event') return Boolean((p.ends_on || p.starts_on) && (p.ends_on || p.starts_on) < today);
  return false;
}

async function renderReviewList() {
  const { data, error } = await getSupabase()
    .from('review_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at');
  if (error) fail(error);
  const rows = data ?? [];
  const count = (key: string) => rows.filter((r: Row) => sectionOf(r.content_type) === key).length;
  const sections = [...QUEUE_SECTIONS, { key: 'altro', label: 'Altro', types: [] as string[] }].filter((s) => s.key !== 'altro' || count('altro') > 0);
  // si apre sulla sezione scelta (resta nell'indirizzo) o sulla prima che ha qualcosa
  const asked = new URLSearchParams(location.hash.split('?')[1] ?? '').get('sezione') ?? '';
  const filter = sections.some((s) => s.key === asked) ? asked : (sections.find((s) => count(s.key) > 0)?.key ?? 'libri');
  const shown = rows.filter((r: Row) => sectionOf(r.content_type) === filter);
  const bulkable = shown.filter(bulkReady);
  const genreSlugs = [...new Set(shown.flatMap((r: Row) => (Array.isArray(r.payload?.genres) ? r.payload.genres : [])))].sort() as string[];
  render(
    shell(`
      <h1>Da approvare</h1>
      ${rows.length === 0 ? '<p class="muted">Niente in coda.</p>' : ''}
      ${
        rows.length
          ? `<div class="queue-tools">
              <nav class="queue-tabs" aria-label="Sezioni di Da approvare">${sections
                .map((s) => `<a class="queue-tab ${s.key === filter ? 'is-on' : ''}" href="#/review?sezione=${s.key}" ${s.key === filter ? 'aria-current="page"' : ''}>${esc(s.label)} <span class="queue-tab-n">${count(s.key)}</span></a>`)
                .join('')}</nav>
              ${shown.length === 0 ? '<p class="muted">Niente in coda in questa sezione.</p>' : ''}
              <div class="queue-search">
                <input type="search" id="q-search" placeholder="Cerca per titolo, autrice, editore…" aria-label="Cerca in Da approvare">
                <label>Stato
                  <select id="q-state">
                    <option value="">Tutte</option>
                    <option value="ready">Pronte da approvare in blocco</option>
                    <option value="todo">Da completare (trama o voci nuove)</option>
                  </select>
                </label>
                ${
                  genreSlugs.length && filter === 'libri'
                    ? `<label>Genere
                        <select id="q-genre"><option value="">Tutti</option>${genreSlugs.map((g) => `<option value="${esc(g)}">${esc(humanize(g))}</option>`).join('')}</select>
                      </label>`
                    : ''
                }
                <label>Ordine
                  <select id="q-order"><option value="old">Prima le più vecchie</option><option value="new">Prima le più recenti</option></select>
                </label>
                <span class="muted small" id="q-count" aria-live="polite"></span>
              </div>
              ${
                bulkable.length
                  ? `<div class="queue-bulk">
                      <label class="check"><input type="checkbox" id="bulk-all"> Seleziona tutte le pronte (${bulkable.length})</label>
                      <button id="bulk-approve" disabled>Approva selezionati</button>
                      <span class="muted small" id="bulk-progress"></span>
                    </div>
                    <p class="muted small">Si possono approvare in blocco trame già scritte (senza tropes nuovi da decidere) e serie o film. Il resto si apre uno per uno.</p>`
                  : ''
              }
            </div>`
          : ''
      }
      <div class="queue">
        ${shown
          .map(
            (item: Row) => `
            <div class="card queue-item" data-search="${esc(queueSearchText(item))}" data-ready="${bulkReady(item)}" data-todo="${queueIncomplete(item)}"
              data-genres="${esc((Array.isArray(item.payload?.genres) ? item.payload.genres : []).join(' '))}" data-time="${esc(item.created_at)}">
              ${bulkReady(item) ? `<input type="checkbox" class="bulk-pick" value="${item.id}" aria-label="Seleziona «${esc(reviewTitle(item))}»">` : '<span class="bulk-space"></span>'}
              ${queueThumb(item)}
              <span class="pill">${esc(CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type)}</span>
              <a href="#/review/${item.id}"><strong>${esc(reviewTitle(item))}</strong></a>
              ${item.content_type === 'plot' && !item.payload?.plot ? '<span class="pill draft">trama da scrivere</span>' : ''}
              ${queueExpired(item) ? '<span class="pill expired">scaduto</span>' : ''}
              <span class="muted small">${esc(new Date(item.created_at).toLocaleString('it-IT'))}</span>
            </div>`,
          )
          .join('')}
      </div>`),
  );
  bindShell();

  const picks = () => [...document.querySelectorAll<HTMLInputElement>('.bulk-pick:checked')].map((i) => i.value);
  const approveBtn = document.getElementById('bulk-approve') as HTMLButtonElement | null;
  const refresh = () => {
    if (approveBtn) approveBtn.disabled = picks().length === 0;
  };
  document.querySelectorAll('.bulk-pick').forEach((i) => i.addEventListener('change', refresh));
  // ricerca e filtri: tutto nella pagina, senza ricaricare la coda
  const queue = document.querySelector<HTMLElement>('.queue');
  const cards = [...document.querySelectorAll<HTMLElement>('.queue-item')];
  const qSearch = document.getElementById('q-search') as HTMLInputElement | null;
  const qState = document.getElementById('q-state') as HTMLSelectElement | null;
  const qGenre = document.getElementById('q-genre') as HTMLSelectElement | null;
  const qOrder = document.getElementById('q-order') as HTMLSelectElement | null;
  const qCount = document.getElementById('q-count');
  const applyFilters = () => {
    const words = (qSearch?.value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const ok =
        words.every((w) => card.dataset.search!.includes(w)) &&
        (!qState?.value || (qState.value === 'ready' ? card.dataset.ready === 'true' : card.dataset.todo === 'true')) &&
        (!qGenre?.value || card.dataset.genres!.split(' ').includes(qGenre.value));
      card.hidden = !ok;
      // una nascosta non resta selezionata per l'approvazione in blocco
      if (!ok) {
        const pick = card.querySelector<HTMLInputElement>('.bulk-pick');
        if (pick) pick.checked = false;
      }
      if (ok) visible++;
    }
    if (queue && qOrder) {
      const sorted = [...cards].sort((a, b) => a.dataset.time!.localeCompare(b.dataset.time!) * (qOrder.value === 'new' ? -1 : 1));
      queue.append(...sorted);
    }
    if (qCount) qCount.textContent = visible === cards.length ? `${cards.length} elementi` : `${visible} di ${cards.length}`;
    refresh();
  };
  [qSearch, qState, qGenre, qOrder].forEach((el) => el?.addEventListener(el === qSearch ? 'input' : 'change', applyFilters));
  applyFilters();

  document.getElementById('bulk-all')?.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    // solo quelle visibili con i filtri attivi
    document.querySelectorAll<HTMLInputElement>('.queue-item:not([hidden]) .bulk-pick').forEach((i) => (i.checked = on));
    refresh();
  });
  approveBtn?.addEventListener('click', async () => {
    const ids = picks();
    if (!confirm(`Approvare e pubblicare ${ids.length} elementi così come sono?`)) return;
    approveBtn.disabled = true;
    const progress = document.getElementById('bulk-progress')!;
    const sb = getSupabase();
    let done = 0;
    let failed = 0;
    for (const id of ids) {
      const item = rows.find((r: Row) => r.id === id);
      try {
        await approveReviewItem(sb, item, session!.user.id);
        done++;
      } catch {
        failed++;
      }
      progress.textContent = `${done + failed} di ${ids.length}…`;
    }
    flash(failed ? `Approvati ${done}, non riusciti ${failed}: aprili uno per uno` : `Approvati ${done}`, failed ? 'error' : 'ok');
    await renderReviewList();
  });
}

/** Copertina o locandina piccola nell'elenco, per riconoscere a colpo d'occhio. */
function queueThumb(item: Row): string {
  const p = item.payload ?? {};
  const src = item.content_type === 'adaptation' ? p.adaptation?.poster_url : (p.cover_url ?? p.edition?.cover_url);
  return src ? `<img class="queue-thumb" src="${esc(src)}" alt="" loading="lazy">` : '<span class="queue-thumb"></span>';
}

/** Riepilogo di una trama da approvare: testo modificabile, tropes suggeriti, quarta originale solo come riferimento. */
async function plotSummary(sb: ReturnType<typeof getSupabase>, p: Row): Promise<string> {
  const tag = (slug: string) => ({ slug, name: humanize(slug) });
  const tropes = [...(p.tropes ?? []).map(tag), ...(p.new_tropes ?? [])];
  const genres = [...(p.genres ?? []).map(tag), ...(p.new_genres ?? [])];
  return `
    <dl class="summary">
      <dt>Libro</dt><dd><a href="/libri/${esc(p.work_slug)}" target="_blank" rel="noopener">${esc(p.title)}</a> ${p.authors?.length ? `di ${esc(p.authors.join(', '))}` : ''}</dd>
      ${await proposedTags(sb, 'genres', 'Generi proposti', genres)}
      ${await proposedTags(sb, 'tropes', 'Tropes proposti', tropes)}
    </dl>
    <p class="muted small">Il libro è già online senza trama: la scheda mostra «La trama arriva presto» finché non approvi.</p>
    <label for="plot">Trama (scritta da noi: correggila liberamente prima di approvare)</label>
    <textarea id="plot" rows="7" placeholder="Scrivi la trama con parole vostre, senza spoiler oltre la premessa.">${esc(p.plot)}</textarea>
    ${p.original_description ? `<details><summary>Quarta di copertina dell'editore (solo riferimento, non copiarla)</summary><p class="muted">${esc(p.original_description)}</p></details>` : ''}`;
}

/** Riepilogo di una serie o un film proposto da TMDB. */
function adaptationSummary(p: Row): string {
  const a = p.adaptation ?? {};
  const kinds: Record<string, string> = { subscription: 'abbonamento', rent: 'noleggio', buy: 'acquisto', free: 'gratis' };
  return `
    <div class="adapt-head">
      ${a.poster_url ? `<img src="${esc(a.poster_url)}" alt="" class="adapt-poster">` : ''}
      <dl class="summary">
        <dt>Tratto da</dt><dd>${esc(p.work_title)}</dd>
        <dt>Tipo</dt><dd>${a.kind === 'film' ? 'Film' : 'Serie TV'}${a.platform ? ` · ${esc(a.platform)}` : ''}</dd>
        <dt>Uscita</dt><dd>${esc(a.release_date ?? '—')}${a.production_status ? ` · ${esc(a.production_status)}` : ''}</dd>
        ${a.kind === 'film' ? `<dt>Durata</dt><dd>${esc(a.runtime_minutes ?? '—')} minuti</dd>` : `<dt>Stagioni</dt><dd>${esc(a.seasons ?? '—')} (${esc(a.episodes ?? '—')} episodi)</dd>`}
        <dt>Dove vederlo</dt><dd>${(a.watch_providers ?? []).map((w: Row) => `${esc(w.platform)} (${kinds[w.kind] ?? w.kind})`).join(', ') || '—'}</dd>
        <dt>Trailer</dt><dd>${a.trailer_url ? `<a href="${esc(a.trailer_url)}" target="_blank" rel="noopener">guarda</a>` : '—'}</dd>
        <dt>TMDB</dt><dd><a href="https://www.themoviedb.org/${a.kind === 'film' ? 'movie' : 'tv'}/${esc(a.tmdb_id)}" target="_blank" rel="noopener">scheda</a></dd>
      </dl>
    </div>
    <label for="plot">Trama (scritta da noi: correggila liberamente prima di approvare)</label>
    <textarea id="plot" rows="6">${esc(a.plot)}</textarea>
    ${p.original_overview ? `<details><summary>Trama di TMDB (solo riferimento)</summary><p class="muted">${esc(p.original_overview)}</p></details>` : ''}`;
}

async function renderReviewItem(id: string) {
  const sb = getSupabase();
  const { data: item, error } = await sb.from('review_queue').select('*').eq('id', id).single();
  if (error) fail(error);
  const p = item.payload ?? {};
  const proposed =
    item.content_type === 'book'
      ? (
          await Promise.all([
            proposedTags(sb, 'authors', 'Autori', fromNames(p.authors)),
            proposedTags(sb, 'publishers', 'Editore', fromNames([p.publisher])),
            proposedTags(sb, 'genres', 'Generi proposti', fromSlugs(p.genres)),
            proposedTags(sb, 'tropes', 'Tropes proposti', fromSlugs(p.tropes)),
            proposedTags(sb, 'settings', 'Ambientazioni proposte', fromSlugs(p.settings)),
          ])
        ).join('')
      : item.content_type === 'promotion'
        ? await proposedTags(sb, 'publishers', 'Editore', fromNames([p.publisher]))
        : '';
  const summary =
    item.content_type === 'book'
      ? `
        <dl class="summary">
          <dt>Titolo</dt><dd>${esc(p.work?.title)}</dd>
          <dt>ISBN</dt><dd>${esc(p.edition?.isbn)}</dd>
          <dt>Formato</dt><dd>${esc(FORMAT_LABELS[p.edition?.format as EditionFormat] ?? p.edition?.format)}</dd>
          <dt>Edizione</dt><dd>${esc(EDITION_TYPE_LABELS[p.edition?.edition_type as EditionType] ?? p.edition?.edition_type)}${
            p.edition?.print_run ? ` · ${esc(p.edition.print_run)} copie` : ''
          }</dd>
          ${p.edition?.details ? `<dt>Dettagli</dt><dd>${esc(p.edition.details)}</dd>` : ''}
          <dt>Uscita</dt><dd>${esc(p.edition?.release_date)}</dd>
          ${proposed}
          ${p.source_url ? `<dt>Fonte</dt><dd><a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_url)}</a></dd>` : ''}
          ${p.note ? `<dt>Nota</dt><dd>${esc(p.note)}</dd>` : ''}
        </dl>
        <label for="plot">Trama (modificabile prima di approvare)</label>
        <textarea id="plot" rows="6">${esc(p.work?.plot)}</textarea>
        ${p.original_description ? `<details><summary>Descrizione originale (solo riferimento, non pubblicare)</summary><p class="muted">${esc(p.original_description)}</p></details>` : ''}`
      : item.content_type === 'promotion'
        ? promotionSummary(p, proposed)
        : item.content_type === 'plot'
          ? await plotSummary(sb, p)
          : item.content_type === 'adaptation'
            ? adaptationSummary(p)
            : item.content_type === 'event'
              ? eventSummary(p)
              : '';

  render(
    shell(`
      <p class="crumbs"><a href="#/review">Da approvare</a></p>
      <h1>${esc(reviewTitle(item))}</h1>
      <div class="card">
        ${summary}
        <details ${summary ? '' : 'open'}><summary>Dati completi</summary><pre>${esc(JSON.stringify(p, null, 2))}</pre></details>
        ${item.status === 'pending'
          ? `<div class="actions">
              ${['book', 'promotion', 'plot', 'adaptation', 'event'].includes(item.content_type) ? `<button id="approve">${item.content_type === 'plot' ? 'Approva la trama' : 'Approva e pubblica'}</button>` : ''}
              <button class="danger" id="reject">Scarta</button>
            </div>`
          : `<p class="muted">Stato: ${esc(item.status)}</p>`}
      </div>`),
  );
  bindShell();

  document.getElementById('approve')?.addEventListener('click', async () => {
    let payload: Row;
    const text = (document.getElementById('plot') as HTMLTextAreaElement | null)?.value.trim() ?? '';
    if (item.content_type === 'plot') {
      if (!text) return flash('Scrivi la trama prima di approvare', 'error');
      // proposed_genres: i generi suggeriti (già sul sito dalla semina), per scollegare quelli tolti in revisione
      payload = { ...p, plot: text, proposed_genres: p.genres ?? [], ...approvedSlugs('tropes'), ...approvedSlugs('genres') };
    } else if (item.content_type === 'adaptation') {
      payload = { ...p, adaptation: { ...p.adaptation, plot: text || null } };
    } else if (item.content_type === 'book') {
      const plot = (document.getElementById('plot') as HTMLTextAreaElement | null)?.value.trim();
      const authors = (approvedTags('authors') ?? []).map(({ slug, name }) => ({ slug, name }));
      if (authors.length === 0) return flash('Un libro ha bisogno di almeno un autore: spuntane o aggiungine uno', 'error');
      const publisher = approvedPublisher();
      payload = {
        ...p,
        work: { ...p.work, plot: plot || null },
        authors,
        ...(publisher !== undefined ? { publisher } : {}),
        ...approvedSlugs('genres'),
        ...approvedSlugs('tropes'),
        ...approvedSlugs('settings'),
      };
    } else if (item.content_type === 'event') {
      // evento: valgono i campi corretti a mano
      payload = { ...p };
      document.querySelectorAll<HTMLInputElement>('[data-field]').forEach((el) => (payload[el.dataset.field!] = el.value.trim() || null));
    } else {
      // promozione: valgono i campi corretti a mano
      payload = { ...p, needs_extraction: false };
      const publisher = approvedPublisher();
      if (publisher !== undefined) payload.publisher = publisher;
      document.querySelectorAll<HTMLInputElement>('[data-field]').forEach((el) => (payload[el.dataset.field!] = el.value.trim() || null));
      // grafica scartata: non si salva nulla, neanche credito e testo alternativo
      if ((document.getElementById('pr-use-image') as HTMLInputElement | null)?.checked === false) {
        Object.assign(payload, { image_url: null, image_credit: null, image_alt: null });
      }
    }
    try {
      const approved = await approveReviewItem(sb, { ...item, payload }, session!.user.id);
      flash('Approvato');
      go(`#/r/${approved.resource}/${approved.id}`);
    } catch (err) {
      fail(err);
    }
  });

  document.getElementById('reject')?.addEventListener('click', async () => {
    const note = prompt('Motivo (facoltativo)') ?? null;
    const { error } = await sb
      .from('review_queue')
      .update({ status: 'rejected', note, reviewed_by: session!.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) fail(error);
    flash('Scartato');
    go('#/review');
  });
}

// ---------------------------------------------------------------------------
// Segnala promozione: link o testo incollato (post Instagram, newsletter…).
// La segnalazione entra in coda; la lettura notturna ne estrae i dati, oppure si compila a mano.
// ---------------------------------------------------------------------------
function renderReport() {
  render(
    shell(`
      <h1>Segnala promozione</h1>
      <p class="muted">Incolla il link della pagina o il testo del post o della newsletter. Finisce in «Da approvare»: i campi si compilano
        da soli con la lettura notturna, oppure puoi completarli subito a mano.</p>
      <form class="card" id="report">
        <label for="rep-url">Link</label>
        <input id="rep-url" name="url" type="url" placeholder="https://…">
        <label for="rep-text">Testo</label>
        <textarea id="rep-text" name="text" rows="8" placeholder="Testo del post, della storia o della newsletter"></textarea>
        <label for="rep-image">Link della grafica (facoltativo)</label>
        <input id="rep-image" name="image" type="url" placeholder="https://…">
        <label for="rep-note">Nota per chi approva (facoltativa)</label>
        <input id="rep-note" name="note" type="text">
        <div class="actions"><button type="submit">Metti in coda</button></div>
      </form>`),
  );
  bindShell();
  document.getElementById('report')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const url = String(form.get('url') ?? '').trim();
    const text = String(form.get('text') ?? '').trim();
    if (!url && !text) return flash('Serve almeno il link o il testo', 'error');
    // titolo provvisorio: le prime parole del testo, altrimenti il sito
    const title = text ? text.split(/\s+/).slice(0, 8).join(' ') : new URL(url).hostname.replace(/^www\./, '');
    const { data, error } = await getSupabase()
      .from('review_queue')
      .insert({
        content_type: 'promotion',
        payload: {
          title: `Segnalazione: ${title}`,
          kind: 'gift_with_purchase',
          channel: 'everywhere',
          source_url: url || null,
          url: url || null,
          raw_text: text || null,
          image_url: String(form.get('image') ?? '').trim() || null,
          note: String(form.get('note') ?? '').trim() || null,
          needs_extraction: true,
        },
      })
      .select('id')
      .single();
    if (error) fail(error);
    flash('In coda');
    go(`#/review/${data.id}`);
  });
}

// ---------------------------------------------------------------------------
// Post social: bozze per Instagram e Telegram dai contenuti pubblicati
// ---------------------------------------------------------------------------
async function renderSocial() {
  render(shell(socialHtml()));
  bindShell();
  await bindSocial(flash);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
// messaggio da mostrare sul modulo di accesso dopo un'uscita forzata (l'evento SIGNED_OUT ridisegna il modulo)
let loginMessage = '';

async function route() {
  if (!session) {
    renderLogin(loginMessage);
    loginMessage = '';
    return;
  }
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  try {
    if (parts[0] === 'segnala') return renderReport();
    if (parts[0] === 'social') return await renderSocial();
    if (parts[0] === 'review') {
      return parts[1] ? await renderReviewItem(parts[1]) : await renderReviewList();
    }
    if (parts[0] === 'r') {
      const resource = getResource(parts[1]);
      if (!resource) return go('#/');
      if (!parts[2]) return await renderList(resource);
      if (parts[2] === 'new') return await renderForm(resource, null, Object.fromEntries(new URLSearchParams(query)));
      return await renderForm(resource, parts[2]);
    }
    await renderDashboard();
  } catch (err) {
    console.error(err);
  }
}

/** null = fa parte della redazione; altrimenti il motivo da mostrare sul modulo di accesso. */
async function checkEditor(): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('is_editor');
  if (error) {
    console.error('is_editor', error);
    return `Accesso riuscito, ma il controllo della redazione non ha risposto: ${error.message}`;
  }
  return data === true ? null : 'Questo account non fa parte della redazione.';
}

async function start() {
  pruneDrafts(); // via le bozze dimenticate da più di 30 giorni
  if (!supabaseConfigured) {
    // in locale, senza Supabase, i post social si possono provare coi dati d'esempio
    if (import.meta.env.DEV && location.hash.startsWith('#/social')) {
      render(`<section class="content standalone">${socialHtml()}</section>`);
      await bindSocial(flash);
      return;
    }
    render(`<div class="card login"><h1>Admin non configurato</h1>
      <p>Imposta <code>PUBLIC_SUPABASE_URL</code> e <code>PUBLIC_SUPABASE_ANON_KEY</code> nel file <code>.env</code> e riavvia.</p></div>`);
    return;
  }
  const sb = getSupabase();
  const apply = async (s: Session | null) => {
    session = s;
    const problem = s ? await checkEditor() : null;
    if (problem) {
      loginMessage = problem;
      await sb.auth.signOut();
      return;
    }
    route();
  };
  sb.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') apply(s);
  });
  const { data } = await sb.auth.getSession();
  await apply(data.session);
  window.addEventListener('hashchange', route);
}

start();
