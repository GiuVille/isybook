// Immagini dei post social, disegnate su canvas con i font e i colori del sito.
// Post 1080×1350 (4:5), storia 1080×1920 (9:16), carosello di slide 1080×1350.
// Stile: scacchiera a quattro riquadri come le anteprime dei libri, etichetta scritta a mano, timbri, copertine.
import {
  SECTION_LABELS,
  dateLine,
  type Palette,
  type SocialFormat,
  type SocialItem,
  type SocialSection,
} from '../lib/social';

const SERIF = '"Young Serif", Georgia, serif';
const TEXT = '"Literata Variable", Georgia, serif';
const HAND = '"Gochi Hand", cursive';

type Ctx = CanvasRenderingContext2D;
interface Box { x: number; y: number; w: number; h: number }

/** Aspetta i font del sito: senza, il canvas disegnerebbe con quelli di sistema. */
export async function ensureFonts() {
  await Promise.all([`64px ${SERIF}`, `40px ${HAND}`, `32px ${TEXT}`, `600 32px ${TEXT}`].map((f) => document.fonts.load(f)));
}

// ---------------------------------------------------------------------------
// Strumenti di disegno
// ---------------------------------------------------------------------------
function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

let grain: CanvasPattern | null = null;
function grainPattern(ctx: Ctx): CanvasPattern {
  if (grain) return grain;
  const [c, g] = canvas(160, 160);
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14;
  }
  g.putImageData(img, 0, 0);
  grain = ctx.createPattern(c, 'repeat')!;
  return grain;
}

/** Scacchiera a quattro riquadri, come le anteprime dei libri, con la grana della carta. */
function background(ctx: Ctx, w: number, h: number, p: Palette) {
  ctx.fillStyle = p.light;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.dark;
  ctx.fillRect(w / 2, 0, w / 2, h / 2);
  ctx.fillRect(0, h / 2, w / 2, h / 2);
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
}

function wrap(ctx: Ctx, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

/** Scrive un testo andando a capo; restituisce la y sotto l'ultima riga. */
function text(ctx: Ctx, value: string, x: number, y: number, o: { font: string; size: number; color: string; maxWidth: number; maxLines?: number; lineHeight?: number; align?: CanvasTextAlign }) {
  ctx.font = `${o.size}px ${o.font}`;
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  const lh = o.size * (o.lineHeight ?? 1.18);
  const lines = wrap(ctx, value, o.maxWidth, o.maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + o.size + i * lh));
  return y + o.size + (lines.length - 1) * lh + o.size * 0.35;
}

function roundRect(ctx: Ctx, b: Box, r: number) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, r);
}

/** Etichetta di carta scritta a mano, come quelle delle cartelline del sito. */
function label(ctx: Ctx, value: string, x: number, y: number, size: number, rotate = -2) {
  ctx.save();
  ctx.font = `${size}px ${HAND}`;
  const w = ctx.measureText(value).width + size * 0.9;
  const h = size * 1.45;
  ctx.translate(x, y);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.18)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = '#2a2230';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(value, size * 0.45, h / 2 + 2);
  ctx.restore();
}

/** Timbro a inchiostro con doppio bordo, leggermente storto. Va a capo su "·" se richiesto, e resta dentro l'immagine. */
function stamp(ctx: Ctx, value: string, cx: number, cy: number, size: number, color: string, rotate = 7, multiline = false) {
  ctx.save();
  ctx.font = `${size}px ${SERIF}`;
  const lines = multiline ? value.split(' · ') : [value];
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.1;
  const h = size * (1.7 + (lines.length - 1) * 1.15);
  cx = Math.min(Math.max(cx, w / 2 + 30), ctx.canvas.width - w / 2 - 30);
  ctx.translate(cx, cy);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.12;
  roundRect(ctx, { x: -w / 2, y: -h / 2, w, h }, size * 0.25);
  ctx.stroke();
  ctx.lineWidth = size * 0.05;
  roundRect(ctx, { x: -w / 2 + size * 0.18, y: -h / 2 + size * 0.18, w: w - size * 0.36, h: h - size * 0.36 }, size * 0.15);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 0, 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  ctx.restore();
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!images.has(src)) {
    images.set(
      src,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      }),
    );
  }
  return images.get(src)!;
}

function shadow(ctx: Ctx, blur = 24) {
  ctx.shadowColor = 'rgba(0,0,0,.32)';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = blur / 3;
}

/** Copertina (foto se c'è, altrimenti segnaposto nel colore del genere), locandina della promozione o foglio di calendario. */
async function art(ctx: Ctx, item: SocialItem, b: Box, rotate = 0) {
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  const box = { x: -b.w / 2, y: -b.h / 2, w: b.w, h: b.h };
  const img = item.image ? await loadImage(item.image.src) : null;

  if (item.kind === 'event') {
    // foglio di calendario: mese in alto, giorno grande
    const [, m, d] = item.date.split('-').map(Number);
    const month = new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' });
    shadow(ctx);
    ctx.fillStyle = '#fffdf8';
    roundRect(ctx, box, 14);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = item.palette.accent;
    ctx.fillRect(box.x, box.y, box.w, box.h * 0.26);
    text(ctx, month, 0, box.y + box.h * 0.02, { font: HAND, size: box.h * 0.15, color: '#fff', maxWidth: box.w, align: 'center' });
    text(ctx, String(d), 0, box.y + box.h * 0.3, { font: SERIF, size: box.h * 0.46, color: '#2a2230', maxWidth: box.w, align: 'center' });
  } else if (item.kind === 'promo' && !img) {
    // buono: matrice colorata e premio scritto grande
    shadow(ctx);
    ctx.fillStyle = item.palette.panel;
    roundRect(ctx, box, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = item.palette.accent;
    ctx.fillRect(box.x, box.y, box.w * 0.2, box.h);
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = 'rgba(42,34,48,.45)';
    ctx.lineWidth = 3;
    roundRect(ctx, { x: box.x - 12, y: box.y - 12, w: box.w + 24, h: box.h + 24 }, 16);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, item.highlight ?? item.title, box.x + box.w * 0.6, box.y + box.h * 0.2, {
      font: SERIF, size: box.w * 0.12, color: item.palette.accent, maxWidth: box.w * 0.7, maxLines: 4, align: 'center',
    });
  } else if (img) {
    // foto: copertina riempita; grafica della promozione intera, in una polaroid
    shadow(ctx);
    if (item.kind === 'promo') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.shadowColor = 'transparent';
      const pad = b.w * 0.05;
      const scale = Math.min((box.w - pad * 2) / img.width, (box.h - pad * 2.6) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, -w / 2, box.y + pad, w, h);
    } else {
      const scale = Math.max(box.w / img.width, box.h / img.height);
      const sw = box.w / scale;
      const sh = box.h / scale;
      roundRect(ctx, box, 6);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, box.x, box.y, box.w, box.h);
      ctx.restore();
    }
  } else {
    // copertina segnaposto, come sul sito
    shadow(ctx);
    ctx.fillStyle = item.palette.accent;
    roundRect(ctx, box, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(box.x, box.y, box.w * 0.05, box.h);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = Math.max(2, b.w * 0.008);
    ctx.strokeRect(box.x + box.w * 0.1, box.y + box.h * 0.06, box.w * 0.82, box.h * 0.88);
    text(ctx, item.title, 0, box.y + box.h * 0.2, { font: SERIF, size: box.w * 0.13, color: '#fff', maxWidth: box.w * 0.7, maxLines: 4, align: 'center' });
    text(ctx, item.subtitle.toUpperCase(), 0, box.y + box.h * 0.82, { font: TEXT, size: box.w * 0.055, color: 'rgba(255,255,255,.85)', maxWidth: box.w * 0.75, maxLines: 1, align: 'center' });
  }
  ctx.restore();
}

/** Proporzioni del disegno: copertine 2:3, buoni e calendari più larghi. */
const artRatio = (item: SocialItem) => (item.kind === 'book' ? 1.5 : item.kind === 'event' ? 1 : item.image ? item.image.height / item.image.width + 0.12 : 0.8);

function footer(ctx: Ctx, w: number, y: number, p: Palette, site: string) {
  const host = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  ctx.fillStyle = p.ink;
  ctx.font = `46px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(host, w / 2, y);
  ctx.font = `34px ${HAND}`;
  ctx.fillText('il radar delle uscite', w / 2, y + 44);
}

const stampColor = (item: SocialItem) => (item.kind === 'promo' && /ultim/i.test(item.badge ?? '') ? '#c62828' : item.kind === 'book' ? '#c62828' : '#2f5d8a');

// ---------------------------------------------------------------------------
// Slide
// ---------------------------------------------------------------------------
interface Frame { w: number; h: number; top: number; bottom: number }
const POST: Frame = { w: 1080, h: 1350, top: 70, bottom: 70 };
// le storie hanno in alto e in basso le barre di Instagram: lì niente testo
const STORY: Frame = { w: 1080, h: 1920, top: 240, bottom: 300 };

/** Intestazione: etichetta della sezione, titolone, periodo scritto a mano. Restituisce la y libera. */
function header(ctx: Ctx, f: Frame, p: Palette, section: SocialSection, title: string, period: string, scale = 1) {
  label(ctx, SECTION_LABELS[section], 70, f.top, 40 * scale);
  let y = text(ctx, title, 70, f.top + 80 * scale, { font: SERIF, size: 92 * scale, color: p.ink, maxWidth: f.w - 140, maxLines: 2, lineHeight: 1.05 });
  if (period) y = text(ctx, period, 72, y - 6, { font: HAND, size: 54 * scale, color: p.ink, maxWidth: f.w - 140 });
  return y + 20;
}

/** Elenco: una riga per elemento, disegno a sinistra e testi a destra. */
async function listSlide(f: Frame, section: SocialSection, title: string, items: SocialItem[], period: string, site: string) {
  const [c, ctx] = canvas(f.w, f.h);
  const p = items[0].palette;
  background(ctx, f.w, f.h, p);
  const top = header(ctx, f, p, section, title, period, f === STORY ? 1.1 : 1);
  const bottom = f.h - f.bottom - 110;
  const rowH = (bottom - top) / items.length;
  for (const [i, item] of items.entries()) {
    const y = top + i * rowH;
    const artH = Math.min(rowH - 34, 330);
    const artW = Math.min(artH / artRatio(item), 300);
    // pannello chiaro dietro ogni riga, per leggere bene sopra la scacchiera
    ctx.fillStyle = p.panel;
    ctx.globalAlpha = 0.88;
    roundRect(ctx, { x: 50, y: y + 6, w: f.w - 100, h: rowH - 18 }, 18);
    ctx.fill();
    ctx.globalAlpha = 1;
    await art(ctx, item, { x: 80, y: y + (rowH - artH) / 2 - 6, w: artW, h: artH }, i % 2 ? 2 : -2);
    const tx = 80 + artW + 44;
    const hasStamp = Boolean(item.badge && item.kind !== 'event');
    // il timbro sta in alto a destra: il titolo si ferma prima
    const tw = f.w - tx - 80;
    const titleWidth = hasStamp ? tw - 250 : tw;
    const big = Math.min(60, rowH * 0.19);
    const titleText = item.kind === 'promo' && item.highlight ? item.highlight : item.title;
    // altezza del blocco di testo: se il titolo va su due righe e non c'è posto, la riga dei dettagli salta
    ctx.font = `${big}px ${SERIF}`;
    const titleLines = Math.min(wrap(ctx, titleText, titleWidth, 2).length, 2);
    const base = big * 1.35 + (titleLines - 1) * big * 1.18 + big * 0.6 * 1.35 + 4 + big * 0.78 * 1.35;
    const detail = item.details[0] && base + big * 0.5 * 1.35 <= rowH - 40 ? item.details[0] : null;
    const block = base + (detail ? big * 0.5 * 1.35 : 0);
    let ty = y + 6 + (rowH - 18 - block) / 2;
    ty = text(ctx, titleText, tx, ty, { font: SERIF, size: big, color: p.ink, maxWidth: titleWidth, maxLines: 2 });
    ty = text(ctx, item.kind === 'promo' ? item.title : item.subtitle, tx, ty, { font: TEXT, size: big * 0.6, color: p.ink, maxWidth: tw, maxLines: 1 });
    ty = text(ctx, dateLine(item), tx, ty + 4, { font: HAND, size: big * 0.78, color: p.ink, maxWidth: tw, maxLines: 1 });
    if (detail) text(ctx, detail, tx, ty, { font: TEXT, size: big * 0.5, color: p.ink, maxWidth: tw, maxLines: 1 });
    if (hasStamp) stamp(ctx, item.badge!.replace('Edizione ', ''), f.w - 200, y + 56, 28, stampColor(item));
  }
  footer(ctx, f.w, f.h - f.bottom - 40, p, site);
  return c;
}

/** Scheda di un solo elemento: disegno grande, poi titolo, data e dettagli. */
async function heroSlide(f: Frame, section: SocialSection, item: SocialItem, site: string, index?: string) {
  const [c, ctx] = canvas(f.w, f.h);
  const p = item.palette;
  background(ctx, f.w, f.h, p);
  label(ctx, index ? `${SECTION_LABELS[section]} · ${index}` : SECTION_LABELS[section], 70, f.top, 40);
  const top = f.top + 110;
  const bottom = f.h - f.bottom - 120; // sopra il piè di pagina
  const maxArtH = Math.min((bottom - top) * 0.5, item.kind === 'book' ? 600 : 520);
  // larghezza al limite (banner): l'altezza segue le proporzioni, niente cornice vuota
  const artW = Math.min(maxArtH / artRatio(item), f.w - 260);
  const artH = Math.min(maxArtH, artW * artRatio(item));

  // testi: prima li misuro su un foglio di prova, così il riquadro è alto quanto serve
  const mid = f.w / 2;
  const tw = f.w - 200;
  const writeText = (g: Ctx, y0: number) => {
    let y = text(g, item.kind === 'promo' && item.highlight ? item.highlight : item.title, mid, y0, { font: SERIF, size: 66, color: p.ink, maxWidth: tw, maxLines: 2, align: 'center' });
    y = text(g, item.kind === 'promo' ? item.title : item.subtitle, mid, y, { font: TEXT, size: 38, color: p.ink, maxWidth: tw, maxLines: 2, align: 'center' });
    y = text(g, dateLine(item), mid, y + 6, { font: HAND, size: 56, color: p.ink, maxWidth: tw, maxLines: 1, align: 'center' });
    for (const d of item.details.slice(0, 2)) y = text(g, d, mid, y, { font: TEXT, size: 32, color: p.ink, maxWidth: tw, maxLines: 2, align: 'center' });
    if (item.kind === 'book' && item.tags.length) y = text(g, item.tags.join(' · '), mid, y + 8, { font: HAND, size: 40, color: p.ink, maxWidth: tw, maxLines: 1, align: 'center' });
    return y;
  };
  const [, scratch] = canvas(f.w, f.h);
  const panelH = writeText(scratch, 20) + 10;

  // disegno e riquadro centrati nello spazio libero
  const artTop = top + Math.max(0, (bottom - top - (artH + 50 + panelH)) / 2);
  await art(ctx, item, { x: (f.w - artW) / 2, y: artTop, w: artW, h: artH }, -2);
  // accanto alla copertina, in basso: il titolo stampato sopra resta leggibile
  if (item.badge) stamp(ctx, item.badge, f.w / 2 + artW / 2 + 150, artTop + artH * 0.78, 38, stampColor(item), 8, true);

  const panelTop = artTop + artH + 50;
  ctx.fillStyle = p.panel;
  ctx.globalAlpha = 0.9;
  roundRect(ctx, { x: 60, y: panelTop, w: f.w - 120, h: panelH }, 22);
  ctx.fill();
  ctx.globalAlpha = 1;
  writeText(ctx, panelTop + 20);
  footer(ctx, f.w, f.h - f.bottom - 40, p, site);
  return c;
}

/** Prima slide del carosello: titolone, periodo, ventaglio di copertine, invito a scorrere. */
async function coverSlide(section: SocialSection, title: string, items: SocialItem[], period: string, site: string) {
  const f = POST;
  const [c, ctx] = canvas(f.w, f.h);
  const p = items[0].palette;
  background(ctx, f.w, f.h, p);
  label(ctx, SECTION_LABELS[section], 70, f.top, 44);
  let y = text(ctx, title, f.w / 2, 190, { font: SERIF, size: 112, color: p.ink, maxWidth: f.w - 160, maxLines: 2, lineHeight: 1.02, align: 'center' });
  if (period) y = text(ctx, period, f.w / 2, y, { font: HAND, size: 64, color: p.ink, maxWidth: f.w - 160, align: 'center' });
  const fan = items.slice(0, 3);
  const h = 470;
  for (const [i, item] of fan.entries()) {
    const w = Math.min(h / artRatio(item), 380);
    const offset = (i - (fan.length - 1) / 2) * 250;
    await art(ctx, item, { x: f.w / 2 + offset - w / 2, y: y + 40 + Math.abs(offset) * 0.15, w, h }, (i - (fan.length - 1) / 2) * 9);
  }
  text(ctx, 'scorri →', f.w - 80, f.h - 200, { font: HAND, size: 58, color: p.ink, maxWidth: 400, align: 'right' });
  footer(ctx, f.w, f.h - f.bottom - 40, p, site);
  return c;
}

/** Ultima slide del carosello: dove trovare tutto. */
function endSlide(items: SocialItem[], site: string) {
  const f = POST;
  const [c, ctx] = canvas(f.w, f.h);
  const p = items[0].palette;
  background(ctx, f.w, f.h, p);
  ctx.fillStyle = p.panel;
  roundRect(ctx, { x: 110, y: 380, w: f.w - 220, h: 560 }, 28);
  ctx.fill();
  const host = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  let y = text(ctx, 'Trovi tutte le date su', f.w / 2, 440, { font: TEXT, size: 48, color: p.ink, maxWidth: f.w - 300, align: 'center' });
  y = text(ctx, host, f.w / 2, y + 10, { font: SERIF, size: 104, color: p.ink, maxWidth: f.w - 300, align: 'center' });
  text(ctx, 'salva il post per non perderle', f.w / 2, y + 40, { font: HAND, size: 56, color: p.ink, maxWidth: f.w - 300, align: 'center' });
  label(ctx, 'il radar delle uscite', f.w / 2 - 210, 300, 44, 3);
  return c;
}

/** Tutte le immagini di una bozza: una per post e storia, più slide per il carosello. Telegram è solo testo. */
export async function renderSlides(format: SocialFormat, section: SocialSection, title: string, items: SocialItem[], period: string, site: string): Promise<HTMLCanvasElement[]> {
  if (format === 'telegram' || items.length === 0) return [];
  await ensureFonts();
  if (format === 'carousel') {
    const slides = [await coverSlide(section, title, items, period, site)];
    for (const [i, item] of items.entries()) slides.push(await heroSlide(POST, section, item, site, `${i + 1}/${items.length}`));
    slides.push(endSlide(items, site));
    return slides;
  }
  const frame = format === 'story' ? STORY : POST;
  return [items.length === 1 ? await heroSlide(frame, section, items[0], site) : await listSlide(frame, section, title, items, period, site)];
}
