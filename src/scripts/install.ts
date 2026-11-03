// "Installa l'app": il sito si aggiunge alla schermata Home come un'app (manifest in public/manifest.webmanifest).
// - Android, Chrome, Edge: il browser annuncia l'installazione con "beforeinstallprompt"; la teniamo da parte e la
//   apriamo quando si tocca il pulsante.
// - iPhone e iPad: Safari non ha un'installazione da avviare, quindi il pulsante apre una guida in tre passi.
//   Nelle app (Instagram, TikTok, Chrome su iOS) l'aggiunta alla Home non c'è: si invita ad aprire il link in Safari.
// - Già installata (si apre "standalone"): nessun pulsante.
// Avviso una tantum su telefono dalla seconda visita, chiudibile per sempre (preferenza in localStorage).

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'isybook:install';
let deferred: InstallPrompt | null = null;

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = () => /instagram|fban|fbav|tiktok|crios|fxios|line\//i.test(navigator.userAgent);
const phone = () => window.matchMedia('(max-width: 760px)').matches;

function readPrefs(): { visits: number; dismissed: boolean } {
  try {
    return { visits: 0, dismissed: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { visits: 0, dismissed: false };
  }
}
function savePrefs(p: { visits: number; dismissed: boolean }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // senza storage l'avviso torna alla prossima visita: pazienza
  }
}

/** I pulsanti si vedono solo dove l'installazione è possibile (prompt pronto) o spiegabile (iOS). */
function showButtons() {
  const can = !standalone() && (deferred !== null || ios());
  document.querySelectorAll<HTMLElement>('[data-install-wrap]').forEach((el) => (el.hidden = !can));
  return can;
}

// ---------------------------------------------------------------------------
// Guida per iPhone e iPad
// ---------------------------------------------------------------------------
const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4Z M12 8v8M8 12h8"/></svg>';

function guide() {
  let d = document.querySelector<HTMLDialogElement>('.install-guide');
  if (!d) {
    d = document.createElement('dialog');
    d.className = 'install-guide';
    d.setAttribute('aria-labelledby', 'install-title');
    d.innerHTML = inApp()
      ? `<h2 id="install-title">Aprilo in Safari</h2>
         <p>Da questa app non si può aggiungere il sito alla schermata Home. Tocca <strong>⋯</strong> o il menu in alto e scegli <strong>«Apri in Safari»</strong> (o «Apri nel browser»), poi tocca di nuovo «Installa l'app».</p>
         <button type="button" class="button-strong" data-close>Ho capito</button>`
      : `<h2 id="install-title">Installa IsyBooks</h2>
         <ol class="install-steps">
           <li><span class="install-step-icon">${SHARE}</span><span>Tocca <strong>Condividi</strong> nella barra di Safari</span></li>
           <li><span class="install-step-icon">${PLUS}</span><span>Scorri e tocca <strong>Aggiungi alla schermata Home</strong></span></li>
           <li><span class="install-step-icon"><img src="/favicon.svg" alt="" width="26" height="26"></span><span>Tocca <strong>Aggiungi</strong>: IsyBooks compare tra le tue app</span></li>
         </ol>
         <p class="install-arrow" aria-hidden="true">↓</p>
         <button type="button" class="button-strong" data-close>Ho capito</button>`;
    d.addEventListener('click', (e) => {
      if (e.target === d || (e.target as HTMLElement).closest('[data-close]')) d!.close();
    });
    document.body.append(d);
  }
  d.showModal();
}

async function install() {
  if (deferred) {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') deferred = null;
    showButtons();
    return;
  }
  if (ios()) guide();
}

// ---------------------------------------------------------------------------
// Avviso una tantum su telefono (dalla seconda visita)
// ---------------------------------------------------------------------------
function maybeNudge() {
  const prefs = readPrefs();
  prefs.visits++;
  savePrefs(prefs);
  if (prefs.dismissed || prefs.visits < 2 || !phone() || !showButtons()) return;
  const bar = document.createElement('div');
  bar.className = 'install-nudge';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Installa l\'app');
  bar.innerHTML = `<img src="/favicon.svg" alt="" width="34" height="34">
    <span><strong>IsyBooks come app</strong><br>Aggiungilo alla schermata Home</span>
    <button type="button" class="button-strong" data-install>Installa</button>
    <button type="button" class="install-nudge-close" aria-label="Non mostrare più">✕</button>`;
  document.body.append(bar);
  bar.querySelector('[data-install]')!.addEventListener('click', () => {
    install();
    bar.remove();
  });
  bar.querySelector('.install-nudge-close')!.addEventListener('click', () => {
    savePrefs({ ...readPrefs(), dismissed: true });
    bar.remove();
  });
}

export function initInstall() {
  if (standalone()) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // niente barra automatica del browser: la offriamo noi, al momento giusto
    deferred = e as InstallPrompt;
    showButtons();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    savePrefs({ ...readPrefs(), dismissed: true });
    showButtons();
    document.querySelector('.install-nudge')?.remove();
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-install]:not(.install-nudge [data-install])')) install();
  });
  showButtons();
  // l'evento del browser arriva poco dopo il caricamento: l'avviso aspetta un attimo
  setTimeout(maybeNudge, 4000);
}
