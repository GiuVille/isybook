// Pannello admin: SPA lato client su Supabase (Auth + RLS).
// La sicurezza è nel database: solo gli utenti presenti in `editors` possono scrivere.
import type { Session } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '../lib/supabase';
import { RESOURCES, STATUS_OPTIONS, getResource, slugify, type Field, type Resource } from './resources';
import { approveReviewItem } from './review';

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
        <a href="#/" class="brand">IsyBook <small>admin</small></a>
        ${link('#/review', 'Da approvare')}
        ${link('#/segnala', 'Segnala promozione')}
        ${groups
          .map(
            (g) => `<p class="group">${g}</p>${RESOURCES.filter((r) => r.group === g)
              .map((r) => link(`#/r/${r.key}`, r.label))
              .join('')}`,
          )
          .join('')}
        <p class="group">Account</p>
        <span class="muted small">${esc(session?.user.email)}</span>
        <button type="button" class="link" id="logout">Esci</button>
      </aside>
      <section class="content">${content}</section>
    </div>`;
}

function bindShell() {
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
      <h1>IsyBook</h1>
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
    if (error) renderLogin(error.message);
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard() {
  const sb = getSupabase();
  const counts = await Promise.all(
    ['review_queue', 'articles', 'works', 'editions', 'events'].map(async (table) => {
      let q = sb.from(table).select('id', { count: 'exact', head: true });
      if (table === 'review_queue') q = q.eq('status', 'pending');
      const { count } = await q;
      return count ?? 0;
    }),
  );
  const [pending, articles, works, editions, events] = counts;
  render(
    shell(`
      <h1>Panoramica</h1>
      <div class="stats">
        <a class="card stat" href="#/review"><strong>${pending}</strong> da approvare</a>
        <a class="card stat" href="#/r/articles"><strong>${articles}</strong> articoli</a>
        <a class="card stat" href="#/r/works"><strong>${works}</strong> opere</a>
        <a class="card stat" href="#/r/editions"><strong>${editions}</strong> edizioni</a>
        <a class="card stat" href="#/r/events"><strong>${events}</strong> eventi</a>
      </div>
      <p class="actions">
        <a class="button" href="#/r/articles/new">Nuovo articolo</a>
        <a class="button secondary" href="#/r/works/new">Nuova opera</a>
        <a class="button secondary" href="#/r/events/new">Nuovo evento</a>
        <a class="button secondary" href="#/segnala">Segnala promozione</a>
      </p>
      <p class="muted small">Il sito pubblico è statico: le modifiche compaiono online al build successivo.</p>`),
  );
  bindShell();
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
  return esc(value);
}

async function renderList(resource: Resource) {
  const { data, error } = await getSupabase()
    .from(resource.table)
    .select('*')
    .order(resource.orderBy.column, { ascending: resource.orderBy.ascending, nullsFirst: false })
    .limit(500);
  if (error) fail(error);
  const rows = data ?? [];
  const labels = await relationLabels(resource);
  const fieldsByName = Object.fromEntries(resource.fields.map((f) => [f.name, f]));
  const hasStatus = resource.fields.some((f) => f.name === 'status');

  render(
    shell(`
      <div class="toolbar">
        <h1>${esc(resource.label)}</h1>
        <a class="button" href="#/r/${resource.key}/new">Nuovo ${esc(resource.singular)}</a>
      </div>
      <div class="filters">
        <input type="search" id="search" placeholder="Cerca…">
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
                    data-status="${esc(row.status ?? '')}">
                  ${resource.listColumns
                    .map((c, i) => {
                      const cell = displayValue(fieldsByName[c], row[c], labels);
                      return `<td>${i === 0 ? `<a href="#/r/${resource.key}/${row.id}">${cell}</a>` : cell}</td>`;
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
  const applyFilters = () => {
    const q = search.value.trim().toLowerCase();
    const s = statusFilter?.value ?? '';
    root.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
      tr.hidden = (q !== '' && !tr.dataset.search!.includes(q)) || (s !== '' && tr.dataset.status !== s);
    });
  };
  search.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
function fieldInput(field: Field, value: unknown, options: Record<string, Array<[string, string]>>): string {
  const required = field.required ? 'required' : '';
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
    case 'select':
    case 'relation': {
      const opts = field.type === 'select' ? field.options! : options[field.name] ?? [];
      const empty = field.required ? '' : '<option value="">—</option>';
      return `<select ${name} ${required}>${empty}${opts
        .map(([v, l]) => `<option value="${esc(v)}" ${String(value ?? '') === v ? 'selected' : ''}>${esc(l)}</option>`)
        .join('')}</select>`;
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
  render(
    shell(`
      <p class="crumbs"><a href="#/r/${resource.key}">${esc(resource.label)}</a></p>
      <h1>${esc(title)}</h1>
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
            <fieldset class="field wide m2m" data-join="${rel.joinTable}">
              <legend>${esc(rel.label)}</legend>
              ${all.length === 0 ? '<span class="muted small">Nessuna voce disponibile.</span>' : ''}
              ${all
                .map(
                  ([v, l]) =>
                    `<label class="check"><input type="checkbox" value="${esc(v)}" ${selected.includes(v) ? 'checked' : ''}> ${esc(l)}</label>`,
                )
                .join('')}
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let values: Row;
    try {
      values = Object.fromEntries(resource.fields.map((f) => [f.name, readField(f, form)]));
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

    flash('Salvato');
    go(`#/r/${resource.key}/${savedId}`);
  });

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare definitivamente questo ${resource.singular}?`)) return;
    const { error } = await sb.from(resource.table).delete().eq('id', id!);
    if (error) fail(error);
    flash('Eliminato');
    go(`#/r/${resource.key}`);
  });
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
const CONTENT_TYPE_LABELS: Record<string, string> = { book: 'Libro', event: 'Evento', article: 'Articolo', promotion: 'Promozione' };

const PROMOTION_KINDS = getResource('promotions')!.fields.find((f) => f.name === 'kind')!.options!;

/** Campi di una promozione proposta, modificabili prima di approvare. */
function promotionSummary(p: Row): string {
  const input = (name: string, label: string, value: unknown, type = 'text') =>
    `<label for="pr-${name}">${label}</label><input id="pr-${name}" data-field="${name}" type="${type}" value="${esc(value ?? '')}">`;
  return `
    <dl class="summary">
      <dt>Editore</dt><dd>${esc(p.publisher?.name ?? '—')}</dd>
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

function reviewTitle(item: Row): string {
  const p = item.payload ?? {};
  return p.work?.title ?? p.title ?? p.name ?? item.id;
}

async function renderReviewList() {
  const { data, error } = await getSupabase()
    .from('review_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at');
  if (error) fail(error);
  const rows = data ?? [];
  render(
    shell(`
      <h1>Da approvare</h1>
      ${rows.length === 0 ? '<p class="muted">Niente in coda.</p>' : ''}
      <div class="queue">
        ${rows
          .map(
            (item: Row) => `
            <a class="card queue-item" href="#/review/${item.id}">
              <span class="pill">${esc(CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type)}</span>
              <strong>${esc(reviewTitle(item))}</strong>
              <span class="muted small">${esc(new Date(item.created_at).toLocaleString('it-IT'))}</span>
            </a>`,
          )
          .join('')}
      </div>`),
  );
  bindShell();
}

async function renderReviewItem(id: string) {
  const sb = getSupabase();
  const { data: item, error } = await sb.from('review_queue').select('*').eq('id', id).single();
  if (error) fail(error);
  const p = item.payload ?? {};
  const summary =
    item.content_type === 'book'
      ? `
        <dl class="summary">
          <dt>Titolo</dt><dd>${esc(p.work?.title)}</dd>
          <dt>Autori</dt><dd>${esc((p.authors ?? []).map((a: Row) => a.name).join(', '))}</dd>
          <dt>Editore</dt><dd>${esc(p.publisher?.name)}</dd>
          <dt>ISBN</dt><dd>${esc(p.edition?.isbn)}</dd>
          <dt>Formato</dt><dd>${esc(p.edition?.format)}</dd>
          <dt>Uscita</dt><dd>${esc(p.edition?.release_date)}</dd>
          <dt>Tropes proposti</dt><dd>${esc((p.tropes ?? []).join(', '))}</dd>
        </dl>
        <label for="plot">Trama (modificabile prima di approvare)</label>
        <textarea id="plot" rows="6">${esc(p.work?.plot)}</textarea>
        ${p.original_description ? `<details><summary>Descrizione originale (solo riferimento, non pubblicare)</summary><p class="muted">${esc(p.original_description)}</p></details>` : ''}`
      : item.content_type === 'promotion'
        ? promotionSummary(p)
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
              ${['book', 'promotion'].includes(item.content_type) ? '<button id="approve">Approva e pubblica</button>' : ''}
              <button class="danger" id="reject">Scarta</button>
            </div>`
          : `<p class="muted">Stato: ${esc(item.status)}</p>`}
      </div>`),
  );
  bindShell();

  document.getElementById('approve')?.addEventListener('click', async () => {
    let payload: Row;
    if (item.content_type === 'book') {
      const plot = (document.getElementById('plot') as HTMLTextAreaElement | null)?.value.trim();
      payload = { ...p, work: { ...p.work, plot: plot || null } };
    } else {
      // promozione: valgono i campi corretti a mano
      payload = { ...p, needs_extraction: false };
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
// Router
// ---------------------------------------------------------------------------
async function route() {
  if (!session) return renderLogin();
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  try {
    if (parts[0] === 'segnala') return renderReport();
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

async function checkEditor(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_editor');
  return !error && data === true;
}

async function start() {
  if (!supabaseConfigured) {
    render(`<div class="card login"><h1>Admin non configurato</h1>
      <p>Imposta <code>PUBLIC_SUPABASE_URL</code> e <code>PUBLIC_SUPABASE_ANON_KEY</code> nel file <code>.env</code> e riavvia.</p></div>`);
    return;
  }
  const sb = getSupabase();
  const apply = async (s: Session | null) => {
    session = s;
    if (s && !(await checkEditor())) {
      await sb.auth.signOut();
      return renderLogin('Questo account non fa parte della redazione.');
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
