import type { APIRoute } from 'astro';
import { buildCatalog } from '../lib/catalog';
import { getWorks } from '../lib/data';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(buildCatalog(await getWorks())), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
