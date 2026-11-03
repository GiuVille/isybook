// security.txt (RFC 9116): a chi scrivere se si trova un problema di sicurezza nel sito.
// La scadenza si calcola a ogni build (un anno dopo): il sito si ricostruisce ogni giorno, quindi resta sempre valida.
import type { APIRoute } from 'astro';

const CONTACT = 'villella.giuseppe03@gmail.com';

export const GET: APIRoute = ({ site }) => {
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return new Response(
    [
      `Contact: mailto:${CONTACT}`,
      `Expires: ${expires.toISOString().replace(/\.\d+Z$/, 'Z')}`,
      'Preferred-Languages: it, en',
      `Canonical: ${new URL('/.well-known/security.txt', site)}`,
      `Policy: ${new URL('/privacy', site)}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
