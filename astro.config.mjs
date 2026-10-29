// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://isybooks.it',
  // grafiche delle promozioni: scaricate e ottimizzate in build da qualsiasi sito https
  image: { remotePatterns: [{ protocol: 'https' }] },
});
