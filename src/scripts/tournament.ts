// Torneo dell'anno: tabellone dei libri del mese, sfide dirette in una finestra a tutto schermo,
// vincitore con corona e coriandoli, immagine da condividere. Dati in src/lib/journal.ts.
import { esc } from '../lib/book-card';
import {
  MONTHS,
  getJournal,
  journalYears,
  matchCount,
  monthlyOf,
  nextMatch,
  onJournalChange,
  pickWinner,
  resetTournament,
  startTournament,
  tournamentOpen,
  tournamentOpensOn,
  tournamentRounds,
  tournamentWinner,
  type JournalEntry,
  type Tournament,
} from '../lib/journal';
import { heartBurst } from './celebrate';
import { drawTournamentPost, openImageDialog } from './journal-share';
import { reducedMotion } from './reveal';

const roundName = (slots: number) => (slots === 2 ? 'Finale' : slots === 4 ? 'Semifinali' : slots === 8 ? 'Quarti' : 'Ottavi');

export function initTournament(section: HTMLElement) {
  const body = section.querySelector<HTMLElement>('.tourney-body')!;
  const yearBox = section.querySelector<HTMLElement>('.tourney-year')!;
  const dialog = section.querySelector<HTMLDialogElement>('.tourney-match')!;
  const shareDialog = section.querySelector<HTMLDialogElement>('.tourney-share')!;
  let year = new Date().getFullYear();
  let celebratedFor: string | null = null;

  const entryOf = (id: string | null | undefined) => (id ? getJournal().entries.find((e) => e.id === id) ?? null : null);
  const monthLabel = (id: string) => {
    const m = monthlyOf(getJournal(), year).find((x) => x.id === id)?.month;
    return m ? `libro di ${MONTHS[Number(m.slice(5)) - 1]}` : '';
  };
  const cover = (e: JournalEntry | null, cls = 'tcover') =>
    !e
      ? `<span class="${cls} empty"></span>`
      : e.cover
        ? `<img class="${cls}" src="${esc(e.cover)}" alt="" loading="lazy">`
        : `<span class="${cls} ph" style="--c:${esc(e.color)}"><span>${esc(e.title)}</span></span>`;

  // ---------------------------------------------------------------- tabellone
  function bracketHtml(t: Tournament, preview: boolean): string {
    const rounds = tournamentRounds(t);
    const winner = tournamentWinner(t);
    return `<div class="tbracket ${preview ? 'is-preview' : ''}" style="--rounds:${rounds.length}">${rounds
      .map((slots, r) => {
        const last = r === rounds.length - 1;
        const label = last ? 'Libro dell\'anno' : roundName(slots.length);
        const cells = last
          ? `<div class="tslot champion ${winner ? 'is-set' : ''}">${winner ? `${cover(entryOf(winner))}<span class="tname">${esc(entryOf(winner)!.title)}</span>` : '<span class="tq">?</span>'}</div>`
          : [...Array(slots.length / 2)]
              .map((_, m) => {
                const pair = [slots[m * 2], slots[m * 2 + 1]];
                const picked = rounds[r + 1][m];
                return `<div class="tmatchbox" style="--m:${m}">${pair
                  .map((id) => {
                    if (id === null) return '<div class="tslot bye"><span class="tname">passa il turno</span></div>';
                    if (id === undefined) return '<div class="tslot"><span class="tq">?</span></div>';
                    const e = entryOf(id);
                    const state = picked === undefined || pair.includes(null) ? '' : picked === id ? 'won' : 'lost';
                    return `<div class="tslot ${state}">${cover(e)}<span class="tname">${esc(e?.title ?? '')}</span></div>`;
                  })
                  .join('')}</div>`;
              })
              .join('');
        return `<div class="tround" style="--r:${r}"><h3>${label}</h3><div class="tcells">${cells}</div></div>`;
      })
      .join('')}</div>`;
  }

  // ---------------------------------------------------------------- stati della sezione
  function render() {
    const j = getJournal();
    const years = journalYears(j).filter((y) => y <= new Date().getFullYear());
    if (!years.includes(year)) year = years[0];
    yearBox.innerHTML = `<label class="jsr" for="tourney-year-select">Anno</label><select id="tourney-year-select">${years
      .map((y) => `<option ${y === year ? 'selected' : ''}>${y}</option>`)
      .join('')}</select>`;

    const candidates = monthlyOf(j, year).map((x) => x.id);
    const t = j.tournaments[year];
    const open = tournamentOpen(year);

    if (!t && candidates.length < 2) {
      body.innerHTML = `<div class="tempty"><p>Nel ${year} hai scelto <strong>${candidates.length}</strong> ${
        candidates.length === 1 ? 'libro del mese' : 'libri del mese'
      }: per il torneo ne servono almeno due.</p><p class="muted">Sceglili nel book journal, nella linguetta «Del mese». È facoltativo: puoi saltare i mesi che vuoi.</p></div>`;
      return;
    }

    const preview: Tournament = t ?? { seeds: buildPreview(candidates), picks: {}, finishedAt: null };
    if (!open && !t) {
      const days = Math.ceil((tournamentOpensOn(year).getTime() - Date.now()) / 86400000);
      body.innerHTML = `<p class="tcountdown"><span class="tcount-n">${days}</span> ${days === 1 ? 'giorno' : 'giorni'} al torneo: si apre il 1° dicembre. Intanto ecco chi c'è in gara.</p>${bracketHtml(preview, true)}`;
      return;
    }
    if (!t) {
      body.innerHTML = `<div class="tactions"><button type="button" class="button-strong" data-start>Inizia il torneo</button>
        <span class="muted">${candidates.length} libri, ${candidates.length - 1} sfide</span></div>${bracketHtml(preview, true)}`;
      return;
    }

    const winner = entryOf(tournamentWinner(t));
    const played = Object.keys(t.picks).length;
    const changed = candidates.length !== t.seeds.filter(Boolean).length || candidates.some((id) => !t.seeds.includes(id));
    body.innerHTML = `${
      winner
        ? `<div class="tpodium">
            <span class="tcrown" aria-hidden="true">👑</span>
            ${cover(winner, 'tcover big')}
            <p class="twinner-label">Il tuo libro del ${year}</p>
            <p class="twinner-title">${esc(winner.title)}</p>
            ${winner.author ? `<p class="muted">${esc(winner.author)}</p>` : ''}
            <div class="tactions">
              <button type="button" class="button-strong" data-post>Crea un post</button>
              <button type="button" class="button-soft" data-reset>Rifai il torneo</button>
            </div>
          </div>`
        : `<div class="tactions"><button type="button" class="button-strong" data-next>${played ? 'Prossima sfida' : 'Prima sfida'}</button>
            <span class="muted">${played} di ${matchCount(t)} sfide</span>
            <button type="button" class="button-soft" data-reset>Ricomincia</button></div>`
    }
    ${changed ? '<p class="muted tchanged">I libri del mese sono cambiati da quando hai iniziato: «Rifai il torneo» per includerli.</p>' : ''}
    ${bracketHtml(t, false)}`;

    if (winner && celebratedFor !== `${year}-${t.finishedAt}`) {
      celebratedFor = `${year}-${t.finishedAt}`;
      celebrate();
    }
  }

  /** Lo stesso ordine del torneo vero (passaggi del turno ai primi mesi), solo per l'anteprima. */
  function buildPreview(ids: string[]) {
    let size = 2;
    while (size < ids.length) size *= 2;
    const byes = size - ids.length;
    return ids.flatMap((id, i) => (i < byes ? [id, null] : [id]));
  }

  function celebrate() {
    if (reducedMotion()) return;
    const podium = body.querySelector<HTMLElement>('.tpodium');
    if (!podium) return;
    const layer = document.createElement('div');
    layer.className = 'tconfetti';
    layer.setAttribute('aria-hidden', 'true');
    const colors = ['#e9cf74', '#d99aae', '#7a3570', '#a9c8a2', '#a6c4df', '#c99a2e'];
    for (let i = 0; i < 60; i++) {
      const bit = document.createElement('i');
      bit.style.cssText = `--x:${Math.random() * 100}%;--dx:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 720 - 360}deg;--d:${Math.random() * 0.6}s;--c:${colors[i % colors.length]}`;
      layer.append(bit);
    }
    podium.append(layer);
    setTimeout(() => layer.remove(), 3200);
    const crown = podium.querySelector<HTMLElement>('.tcrown');
    if (crown) setTimeout(() => heartBurst(crown, '★', '#e2a92b'), 700);
  }

  // ---------------------------------------------------------------- sfida diretta
  const bookA = dialog.querySelector<HTMLButtonElement>('.tmatch-book.a')!;
  const bookB = dialog.querySelector<HTMLButtonElement>('.tmatch-book.b')!;
  let busy = false;

  function showMatch() {
    const t = getJournal().tournaments[year];
    const match = t && nextMatch(t);
    if (!t || !match) {
      if (dialog.open) dialog.close();
      return render();
    }
    const rounds = tournamentRounds(t);
    const isFinal = match.round === rounds.length - 2;
    const played = Object.keys(t.picks).length;
    dialog.classList.toggle('is-final', isFinal);
    dialog.querySelector('.tmatch-round')!.textContent = isFinal ? 'La finale' : `${roundName(rounds[match.round].length)} · sfida ${played + 1} di ${matchCount(t)}`;
    dialog.querySelector<HTMLElement>('.tmatch-bar span')!.style.setProperty('--p', String(played / matchCount(t)));
    for (const [button, id] of [[bookA, match.a], [bookB, match.b]] as const) {
      const e = entryOf(id)!;
      button.dataset.id = id;
      button.className = `tmatch-book ${button === bookA ? 'a' : 'b'} is-in`;
      button.innerHTML = `${cover(e, 'tcover big')}<span class="tmatch-title">${esc(e.title)}</span><span class="tmatch-meta">${esc(monthLabel(id))}${
        e.ratings.overall ? ` · ★ ${String(e.ratings.overall).replace('.', ',')}` : ''
      }</span>`;
      button.setAttribute('aria-label', `Scegli «${e.title}»`);
    }
    if (!dialog.open) dialog.showModal();
    bookA.focus();
    busy = false;
  }

  async function choose(button: HTMLButtonElement) {
    if (busy) return;
    busy = true;
    const t = getJournal().tournaments[year];
    const match = t && nextMatch(t);
    if (!match) return;
    const loser = button === bookA ? bookB : bookA;
    button.classList.add('is-win');
    loser.classList.add('is-lose');
    await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : dialog.classList.contains('is-final') ? 1400 : 950));
    pickWinner(year, match.round, match.match, button.dataset.id!);
    showMatch();
  }

  // ---------------------------------------------------------------- eventi
  bookA.addEventListener('click', () => choose(bookA));
  bookB.addEventListener('click', () => choose(bookB));
  dialog.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') bookA.focus();
    if (ev.key === 'ArrowRight') bookB.focus();
  });
  dialog.querySelector('.tmatch-close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', render);

  yearBox.addEventListener('change', (ev) => {
    year = Number((ev.target as HTMLSelectElement).value);
    render();
  });

  body.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.dataset.start !== undefined) {
      startTournament(year, monthlyOf(getJournal(), year).map((x) => x.id));
      return showMatch();
    }
    if (t.dataset.next !== undefined) return showMatch();
    if (t.dataset.reset !== undefined && confirm('Rifare il torneo da capo? Le scelte fatte si perdono.')) {
      resetTournament(year);
      return render();
    }
    if (t.dataset.post !== undefined) {
      const tour = getJournal().tournaments[year];
      const rounds = tournamentRounds(tour);
      const winnerId = tournamentWinner(tour);
      const finalist = entryOf(rounds[rounds.length - 2].find((id) => id && id !== winnerId));
      const semis = (rounds[rounds.length - 3] ?? []).filter((id) => id && !rounds[rounds.length - 2].includes(id)).map(entryOf);
      openImageDialog(shareDialog, `libro-dell-anno-${year}`, `Anteprima del libro dell'anno ${year}`, (format) =>
        drawTournamentPost(year, entryOf(winnerId)!, finalist, semis.filter((e): e is JournalEntry => Boolean(e)), getJournal().settings, format),
      );
    }
  });

  onJournalChange(() => {
    if (!dialog.open) render();
  });
  render();
}
