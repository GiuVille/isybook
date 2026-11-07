-- Copertine corrette a mano dal pannello (campo «Copertina» dell'edizione, src/admin/app.ts bindCoverFields).
-- Le foto caricate stanno nel bucket pubblico `covers`; il pannello le riduce e le converte in WebP prima di caricarle.
-- Lettura pubblica, scrittura solo per la redazione (come il bucket `news` della migrazione 0008).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "cover images public read" on storage.objects for select using (bucket_id = 'covers');
create policy "cover images editors insert" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and is_editor());
create policy "cover images editors update" on storage.objects for update to authenticated using (bucket_id = 'covers' and is_editor());
create policy "cover images editors delete" on storage.objects for delete to authenticated using (bucket_id = 'covers' and is_editor());
