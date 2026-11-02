// Immagine da condividere di una scheda del book journal: post 4:5 o storia 9:16 disegnati su canvas
// con i colori dell'agendina (copertina, voti, una frase, l'inizio della recensione, piè di pagina IsyBooks).
// Le copertine remote non si possono disegnare senza "sporcare" il canvas: al loro posto un segnaposto col titolo.
import { COVER_COLORS, INKS, RATING_LABELS, type JournalEntry, type JournalSettings, type RatingKey, type Saga } from '../lib/journal';

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

/** Finestra con anteprima, scelta del formato, download e condivisione nativa dove c'è. */
export function openShare(section: HTMLElement, entry: JournalEntry, settings: JournalSettings, saga: Saga | null) {
  const dialog = section.querySelector<HTMLDialogElement>('.journal-share-dialog')!;
  const preview = dialog.querySelector<HTMLElement>('.jshare-preview')!;
  const download = dialog.querySelector<HTMLButtonElement>('.jshare-download')!;
  const native = dialog.querySelector<HTMLButtonElement>('.jshare-native')!;
  let canvas: HTMLCanvasElement | null = null;
  const format = () => (dialog.querySelector<HTMLInputElement>('[name="jshare-format"]:checked')?.value === 'story' ? 'story' : 'post');
  const fileName = () => `isybooks-journal-${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${format()}.png`;
  const blob = () => new Promise<Blob | null>((resolve) => canvas?.toBlob(resolve, 'image/png') ?? resolve(null));

  async function draw() {
    preview.textContent = 'Preparo l\'immagine…';
    canvas = await drawShare(entry, settings, format(), saga);
    preview.replaceChildren(canvas);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Anteprima dell'immagine di «${entry.title}»`);
  }

  dialog.onchange = draw;
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
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: entry.title }).catch(() => {});
  };
  dialog.onclick = (ev) => {
    if (ev.target === dialog) dialog.close();
  };
  dialog.showModal();
  draw();
}
