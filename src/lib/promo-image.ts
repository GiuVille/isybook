// Grafica ufficiale di una promozione (o copertina per le bozze social), preparata in build.
// Remota: Astro la scarica e la converte in WebP a più larghezze, così il sito non dipende dall'indirizzo dell'editore.
// Locale (in public/, es. i dati d'esempio): servita così com'è, ne leggo solo le dimensioni.
// Il formato decide come entra nel buono: striscia se larga, polaroid se quadrata o verticale.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getImage } from 'astro:assets';
import { imageMetadata } from 'astro/assets/utils';

export type PromoImageShape = 'wide' | 'square' | 'tall';

export interface PromoImage {
  src: string;
  srcset?: string;
  width: number;
  height: number;
  shape: PromoImageShape;
}

const shapeOf = (width: number, height: number): PromoImageShape => {
  const ratio = width / height;
  return ratio > 1.4 ? 'wide' : ratio < 0.85 ? 'tall' : 'square';
};

async function resolve(url: string): Promise<PromoImage | null> {
  try {
    if (url.startsWith('/')) {
      const meta = await imageMetadata(await readFile(join(process.cwd(), 'public', url)));
      return { src: url, width: meta.width, height: meta.height, shape: shapeOf(meta.width, meta.height) };
    }
    const image = await getImage({ src: url, inferSize: true, format: 'webp', widths: [360, 720, 1200] });
    const width = Number(image.attributes.width ?? image.options.width);
    const height = Number(image.attributes.height ?? image.options.height);
    if (!width || !height) return null;
    return { src: image.src, srcset: image.srcSet.attribute || undefined, width, height, shape: shapeOf(width, height) };
  } catch (err) {
    // immagine sparita o non leggibile: la promozione resta senza foto, la build continua
    console.warn(`Immagine non disponibile (${url}): ${(err as Error).message}`);
    return null;
  }
}

// la stessa grafica compare in più pagine (elenco, home, dettaglio): la preparo una volta sola
const cache = new Map<string, Promise<PromoImage | null>>();

export function promoImage(url: string | null | undefined): Promise<PromoImage | null> {
  if (!url) return Promise.resolve(null);
  if (!cache.has(url)) cache.set(url, resolve(url));
  return cache.get(url)!;
}
