// Trailer da YouTube: dal link incollato nel pannello si ricava l'ID del video (11 caratteri).
// Formati accettati: youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID; altrimenti null.

const ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeId(link: string | null | undefined): string | null {
  if (!link) return null;
  const raw = link.trim();
  if (ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}

/** Miniatura del video (servita da YouTube, nessun cookie). */
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
/** Lettore in modalità "privacy avanzata": niente cookie finché non si preme play. */
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
export const youtubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
