// Immagine da condividere di una scheda del book journal: post 4:5 o storia 9:16 disegnati su canvas
// con i colori dell'agendina (copertina, voti, una frase, l'inizio della recensione, piè di pagina IsyBooks).
// Le copertine remote non si possono disegnare senza "sporcare" il canvas: al loro posto un segnaposto col titolo.
import { COVER_COLORS, INKS, MONTHS, RATING_LABELS, type JournalEntry, type JournalSettings, type RatingKey, type Saga, type YearStats } from '../lib/journal';

type Ctx = CanvasRenderingContext2D;
const SERIF = "'Young Serif', Georgia, serif";
const HAND = "'Gochi Hand', cursive";
const TEXT = "'Literata Variable', Georgia, serif";

async function ensureFonts() {
  await Promise.all([`64px ${SERIF}`, `40px ${HAND}`, `32px ${TEXT}`].map((f) => document.fonts.load(f))).catch(() => {});
}

function wrap(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  const total = text.trim().split(/\s+/).length;
  const used = lines.join(' ').split(/\s+/).length;
  if (used < total && lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '…');
  return lines;
}

function star(ctx: Ctx, x: number, y: number, r: number, fill: number, color: string) {
  const path = new Path2D();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    path[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  path.closePath();
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke(path);
  if (fill > 0) {
    ctx.clip(path);
    ctx.fillStyle = color;
    ctx.fillRect(x - r, y - r, r * 2 * fill, r * 2);
  }
  ctx.restore();
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function drawShare(entry: JournalEntry, settings: JournalSettings, format: 'post' | 'story', saga: Saga | null = null): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const W = 1080;
  const H = format === 'post' ? 1350 : 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const cover = COVER_COLORS.find((c) => c.id === settings.cover)!.value;
  const ink = INKS.find((c) => c.id === settings.ink)!.value;

  // copertina dell'agendina come cornice, pagina a righe dentro
  ctx.fillStyle = cover;
  ctx.fillRect(0, 0, W, H);
  const m = 56;
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.roundRect(m, m, W - m * 2, H - m * 2, 18);
  ctx.fill();
  ctx.strokeStyle = '#d6e2ee';
  ctx.lineWidth = 2;
  for (let y = m + 120; y < H - m - 20; y += 44) {
    ctx.beginPath();
    ctx.moveTo(m + 30, y);
    ctx.lineTo(W - m - 30, y);
    ctx.stroke();
  }
  // segnalibro
  ctx.fillStyle = settings.ribbon;
  ctx.beginPath();
  ctx.moveTo(W - m - 110, m);
  ctx.lineTo(W - m - 70, m);
  ctx.lineTo(W - m - 70, m + 150);
  ctx.lineTo(W - m - 90, m + 128);
  ctx.lineTo(W - m - 110, m + 150);
  ctx.fill();

  // copertina del libro
  const x0 = m + 60;
  let y = m + 80;
  const cw = 260;
  const ch = 390;
  ctx.save();
  ctx.translate(x0 + cw / 2, y + ch / 2);
  ctx.rotate(-0.035);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  const img = entry.cover?.startsWith('/') ? await loadImage(entry.cover) : null;
  if (img) ctx.drawImage(img, -cw / 2, -ch / 2, cw, ch);
  else {
    ctx.fillStyle = entry.color;
    ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff';
    ctx.font = `34px ${SERIF}`;
    ctx.textAlign = 'center';
    wrap(ctx, entry.title, cw - 40, 5).forEach((l, i, all) => ctx.fillText(l, 0, -((all.length - 1) * 42) / 2 + i * 42));
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // titolo, autore, voti
  const tx = x0 + cw + 50;
  const tw = W - m - 60 - tx;
  ctx.fillStyle = '#2b2a35';
  ctx.font = `54px ${SERIF}`;
  const titleLines = wrap(ctx, entry.title, tw, 3);
  titleLines.forEach((l, i) => ctx.fillText(l, tx, y + 50 + i * 62));
  let ty = y + 50 + titleLines.length * 62;
  ctx.font = `30px ${TEXT}`;
  ctx.fillStyle = '#5c5a68';
  if (entry.author) ctx.fillText(entry.author, tx, ty), (ty += 50);
  if (saga) {
    ctx.font = `30px ${HAND}`;
    ctx.fillStyle = cover;
    ctx.fillText(`Saga «${saga.name}»${saga.position ? ` · ${saga.position}/${saga.total}` : ''}`, tx, ty);
    ty += 56;
  } else ty += 6;
  for (const key of Object.keys(RATING_LABELS) as RatingKey[]) {
    const value = entry.ratings[key];
    if (!value) continue;
    ctx.font = `32px ${HAND}`;
    ctx.fillStyle = '#2b2a35';
    ctx.fillText(RATING_LABELS[key], tx, ty);
    for (let i = 0; i < 5; i++) star(ctx, tx + 200 + i * 40, ty - 10, 17, Math.max(0, Math.min(1, value - i)), '#e2a92b');
    ty += 48;
  }
  y = Math.max(y + ch + 60, ty + 20);

  // frase preferita
  const quote = entry.quotes.split(/\n+/).find((q) => q.trim());
  if (quote) {
    ctx.font = `40px ${HAND}`;
    ctx.fillStyle = cover;
    const lines = wrap(ctx, `“${quote.trim()}”`, W - m * 2 - 120, 3);
    lines.forEach((l, i) => ctx.fillText(l, m + 60, y + i * 50));
    y += lines.length * 50 + 40;
  }

  // recensione
  if (entry.review.trim()) {
    ctx.font = `44px ${HAND}`;
    ctx.fillStyle = '#2b2a35';
    ctx.fillText('Recensione', m + 60, y);
    y += 56;
    ctx.font = `${settings.hand ? `36px ${HAND}` : `30px ${TEXT}`}`;
    ctx.fillStyle = ink;
    const maxLines = Math.max(2, Math.floor((H - m - 140 - y) / 44));
    wrap(ctx, entry.review.trim(), W - m * 2 - 120, maxLines).forEach((l, i) => ctx.fillText(l, m + 60, y + i * 44));
  }

  // piè di pagina
  ctx.fillStyle = cover;
  ctx.font = `30px ${HAND}`;
  ctx.textAlign = 'center';
  ctx.fillText('dal mio book journal su IsyBooks', W / 2, H - m - 36);
  return canvas;
}

// ---------------------------------------------------------------------------
// Post dell'anno: statistiche e torneo
// ---------------------------------------------------------------------------
type Format = 'post' | 'story';

function page(settings: JournalSettings, format: Format): [HTMLCanvasElement, Ctx, number, number, string] {
  const W = 1080;
  const H = format === 'post' ? 1350 : 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const cover = COVER_COLORS.find((c) => c.id === settings.cover)!.value;
  ctx.fillStyle = cover;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.roundRect(56, 56, W - 112, H - 112, 18);
  ctx.fill();
  // carta puntinata
  ctx.fillStyle = '#d3dbe5';
  for (let y = 100; y < H - 90; y += 36) for (let x = 100; x < W - 90; x += 36) ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = cover;
  ctx.font = `30px ${HAND}`;
  ctx.textAlign = 'center';
  ctx.fillText('dal mio book journal su IsyBooks', W / 2, H - 92);
  ctx.textAlign = 'left';
  return [canvas, ctx, W, H, cover];
}

/** Copertina di un libro (solo se dal nostro sito: le altre "sporcherebbero" il canvas) o segnaposto col titolo. */
async function bookCover(ctx: Ctx, e: JournalEntry, x: number, y: number, w: number, h: number, tilt = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(tilt);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  const img = e.cover?.startsWith('/') ? await loadImage(e.cover) : null;
  if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  else {
    ctx.fillStyle = e.color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const size = Math.max(18, Math.round(w / 7.5));
    ctx.font = `${size}px ${SERIF}`;
    const lines = wrap(ctx, e.title, w - 24, 5);
    lines.forEach((l, i) => ctx.fillText(l, 0, -((lines.length - 1) * size * 1.2) / 2 + i * size * 1.2));
  }
  ctx.restore();
}

function crown(ctx: Ctx, cx: number, y: number, w: number, color: string) {
  const h = w * 0.6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#8a6a1c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y + h);
  ctx.lineTo(cx - w / 2, y + h * 0.25);
  ctx.lineTo(cx - w / 4, y + h * 0.6);
  ctx.lineTo(cx, y);
  ctx.lineTo(cx + w / 4, y + h * 0.6);
  ctx.lineTo(cx + w / 2, y + h * 0.25);
  ctx.lineTo(cx + w / 2, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export async function drawStatsPost(stats: YearStats, settings: JournalSettings, format: Format): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const [canvas, ctx, W, H, cover] = page(settings, format);
  const ink = INKS.find((c) => c.id === settings.ink)!.value;
  let y = 190;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b2a35';
  ctx.font = `68px ${HAND}`;
  ctx.fillText(stats.month != null ? `Il mio ${MONTHS[stats.month]} ${stats.year} in libri` : `Il mio ${stats.year} in libri`, W / 2, y);
  y += 150;
  const big = [
    [String(stats.read), stats.read === 1 ? 'libro letto' : 'libri letti'],
    [stats.pages.toLocaleString('it-IT'), 'pagine'],
    [stats.avgRating != null ? `${String(stats.avgRating).replace('.', ',')}★` : '—', 'voto medio'],
  ];
  big.forEach(([n, label], i) => {
    const cx = W / 2 + (i - 1) * 300;
    ctx.fillStyle = cover;
    ctx.font = `96px ${SERIF}`;
    ctx.fillText(n, cx, y);
    ctx.fillStyle = '#5c5a68';
    ctx.font = `32px ${HAND}`;
    ctx.fillText(label, cx, y + 50);
  });
  if (stats.month != null) {
    // un mese: le copertine dei libri finiti, in fila
    y += 120;
    const books = stats.books.slice(0, format === 'post' ? 4 : 6);
    const cw = 170;
    const perRow = Math.min(books.length, format === 'post' ? 4 : 3);
    for (const [i, e] of books.entries()) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowW = perRow * cw + (perRow - 1) * 40;
      await bookCover(ctx, e, W / 2 - rowW / 2 + col * (cw + 40), y + row * (cw * 1.5 + 40), cw, cw * 1.5, (col - 1) * 0.04);
    }
    y += Math.ceil(books.length / Math.max(1, perRow)) * (cw * 1.5 + 40) + 70;
    ctx.textAlign = 'left';
    const line = (label: string, value: string) => {
      if (y > H - 170) return;
      ctx.fillStyle = '#5c5a68';
      ctx.font = `34px ${HAND}`;
      ctx.fillText(label, 120, y);
      ctx.fillStyle = ink;
      ctx.font = `36px ${settings.hand ? HAND : TEXT}`;
      ctx.fillText(wrap(ctx, value, W - 520, 1)[0] ?? '', 440, y);
      y += 62;
    };
    if (stats.genres[0]) line('Genere del mese', stats.genres[0][0]);
    if (stats.tropes[0]) line('Trope del mese', stats.tropes[0][0]);
    return canvas;
  }
  // barre dei mesi
  y += 140;
  const chartH = format === 'post' ? 300 : 420;
  const max = Math.max(1, ...stats.perMonth);
  const bw = 52;
  const gap = (W - 200 - bw * 12) / 11;
  stats.perMonth.forEach((v, i) => {
    const x = 100 + i * (bw + gap);
    const h = (v / max) * chartH;
    ctx.fillStyle = i === stats.bestMonth ? cover : settings.ribbon;
    ctx.beginPath();
    ctx.roundRect(x, y + chartH - h, bw, Math.max(h, 4), 8);
    ctx.fill();
    ctx.fillStyle = '#5c5a68';
    ctx.font = `26px ${HAND}`;
    ctx.fillText(MONTHS[i].slice(0, 3), x + bw / 2, y + chartH + 36);
    if (v) {
      ctx.fillStyle = '#2b2a35';
      ctx.fillText(String(v), x + bw / 2, y + chartH - h - 12);
    }
  });
  y += chartH + 110;
  ctx.textAlign = 'left';
  const line = (label: string, value: string) => {
    if (y > H - 170) return;
    ctx.fillStyle = '#5c5a68';
    ctx.font = `34px ${HAND}`;
    ctx.fillText(label, 120, y);
    ctx.fillStyle = ink;
    ctx.font = `36px ${settings.hand ? HAND : TEXT}`;
    ctx.fillText(wrap(ctx, value, W - 520, 1)[0] ?? '', 440, y);
    y += 62;
  };
  if (stats.bestMonth != null) line('Mese d\'oro', MONTHS[stats.bestMonth]);
  if (stats.genres[0]) line('Genere del cuore', stats.genres[0][0]);
  if (stats.tropes[0]) line('Trope del cuore', stats.tropes[0][0]);
  if (stats.longest) line('Il più lungo', `${stats.longest.title} (${stats.longest.totalPages} pag.)`);
  if (stats.avgDays != null) line('In media', `${stats.avgDays} giorni a libro`);
  return canvas;
}

export async function drawTournamentPost(
  year: number,
  winner: JournalEntry,
  finalist: JournalEntry | null,
  others: JournalEntry[],
  settings: JournalSettings,
  format: Format,
): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const [canvas, ctx, W, H, cover] = page(settings, format);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b2a35';
  ctx.font = `64px ${HAND}`;
  ctx.fillText(`Il mio libro del ${year}`, W / 2, 190);
  const cw = format === 'post' ? 340 : 420;
  const ch = cw * 1.5;
  const top = format === 'post' ? 330 : 420;
  // raggi dietro il vincitore
  ctx.save();
  ctx.translate(W / 2, top + ch / 2);
  ctx.fillStyle = 'rgba(233, 207, 116, 0.35)';
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -ch);
    ctx.lineTo(40, -ch);
    ctx.fill();
  }
  ctx.restore();
  await bookCover(ctx, winner, W / 2 - cw / 2, top, cw, ch, -0.03);
  crown(ctx, W / 2, top - 110, 150, '#e9cf74');
  let y = top + ch + 80;
  ctx.fillStyle = '#2b2a35';
  ctx.font = `54px ${SERIF}`;
  wrap(ctx, winner.title, W - 240, 2).forEach((l) => (ctx.fillText(l, W / 2, y), (y += 62)));
  ctx.fillStyle = '#5c5a68';
  ctx.font = `32px ${TEXT}`;
  if (winner.author) ctx.fillText(winner.author, W / 2, y), (y += 70);
  const podium = [finalist, ...others].filter((e): e is JournalEntry => Boolean(e)).slice(0, format === 'post' ? 3 : 5);
  if (podium.length && y < H - 330) {
    ctx.fillStyle = cover;
    ctx.font = `36px ${HAND}`;
    ctx.fillText(finalist ? 'In finale e semifinale' : 'In gara', W / 2, y);
    y += 30;
    const sw = 120;
    const total = podium.length * sw + (podium.length - 1) * 40;
    for (const [i, e] of podium.entries()) await bookCover(ctx, e, W / 2 - total / 2 + i * (sw + 40), y, sw, sw * 1.5, (i - 1) * 0.04);
  }
  return canvas;
}

/** Finestra con anteprima, scelta del formato, download e condivisione nativa dove c'è (riusata da journal e torneo). */
export function openImageDialog(dialog: HTMLDialogElement, fileBase: string, label: string, draw: (format: Format) => Promise<HTMLCanvasElement>) {
  const preview = dialog.querySelector<HTMLElement>('.jshare-preview')!;
  const download = dialog.querySelector<HTMLButtonElement>('.jshare-download')!;
  const native = dialog.querySelector<HTMLButtonElement>('.jshare-native')!;
  let canvas: HTMLCanvasElement | null = null;
  const format = (): Format => (dialog.querySelector<HTMLInputElement>('input[value="story"]:checked') ? 'story' : 'post');
  const fileName = () => `isybooks-${fileBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${format()}.png`;
  const blob = () => new Promise<Blob | null>((resolve) => canvas?.toBlob(resolve, 'image/png') ?? resolve(null));

  async function render() {
    preview.textContent = 'Preparo l\'immagine…';
    canvas = await draw(format());
    preview.replaceChildren(canvas);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
  }
  dialog.onchange = render;
  download.onclick = async () => {
    const b = await blob();
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = fileName();
    a.click();
    URL.revokeObjectURL(a.href);
  };
  native.hidden = !('share' in navigator && 'canShare' in navigator);
  native.onclick = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName(), { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
  };
  dialog.onclick = (ev) => {
    if (ev.target === dialog) dialog.close();
  };
  dialog.showModal();
  render();
}

/** Immagine di una scheda del journal. */
export function openShare(section: HTMLElement, entry: JournalEntry, settings: JournalSettings, saga: Saga | null) {
  openImageDialog(
    section.querySelector<HTMLDialogElement>('.journal-share-dialog')!,
    `journal-${entry.title}`,
    `Anteprima dell'immagine di «${entry.title}»`,
    (format) => drawShare(entry, settings, format, saga),
  );
}

