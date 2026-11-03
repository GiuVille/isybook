// robots.txt generato in build, così l'indirizzo della sitemap segue sempre il dominio configurato.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /promemoria/',
      'Disallow: /catalogo.json',
      '',
      `Sitemap: ${new URL('/sitemap-index.xml', site)}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
