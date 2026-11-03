// robots.txt generato in build, così l'indirizzo della sitemap segue sempre il dominio configurato.
// Con PUBLIC_NOINDEX impostata (lancio in prova, catalogo ancora da riempire) chiude tutto ai motori di ricerca.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    (import.meta.env.PUBLIC_NOINDEX
      ? ['User-agent: *', 'Disallow: /', '']
      : [
          'User-agent: *',
          'Allow: /',
          'Disallow: /admin/',
          'Disallow: /promemoria/',
          'Disallow: /catalogo.json',
          '',
          `Sitemap: ${new URL('/sitemap-index.xml', site)}`,
          '',
        ]
    ).join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
