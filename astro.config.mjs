// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// indirizzo pubblico: da PUBLIC_SITE_URL (es. https://isybooks.pages.dev prima del dominio), altrimenti il dominio definitivo
const site = process.env.PUBLIC_SITE_URL || 'https://isybooks.it';

export default defineConfig({
  site,
  // grafiche delle promozioni: scaricate e ottimizzate in build da qualsiasi sito https
  image: { remotePatterns: [{ protocol: 'https' }] },
  integrations: [
    // solo le pagine pubbliche: niente pannello, file .ics o JSON
    sitemap({ filter: (page) => !/\/admin\/|\/promemoria\/|\.ics$|\.json$/.test(page) }),
  ],
});
