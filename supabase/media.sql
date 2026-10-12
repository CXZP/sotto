-- Sotto: photos in threads and comments. Run once after discuss.sql. Safe to re-run.
--
--   * Images live in the public "media" bucket, one folder per user.
--   * Posts may only reference images from that bucket: no hotlinked
--     images, which could be used as tracking pixels on readers.
--   * The page re-encodes every image (drops EXIF/GPS) and offers the
--     black-box redactor before upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "media own upload" on storage.objects;
create policy "media own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media own delete" on storage.objects;
create policy "media own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Every URL must point into this project's media bucket.
create or replace function public.only_media_urls(urls text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(u ~ '^https://wozliersimrahwsuzoyn\.supabase\.co/storage/v1/object/public/media/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'), true)
  from unnest(urls) as u
$$;

alter table public.threads add column if not exists images text[] not null default '{}';
alter table public.comments add column if not exists images text[] not null default '{}';
alter table public.threads drop constraint if exists threads_images_ok;
alter table public.threads add constraint threads_images_ok check (cardinality(images) <= 8 and public.only_media_urls(images));
alter table public.comments drop constraint if exists comments_images_ok;
alter table public.comments add constraint comments_images_ok check (cardinality(images) <= 4 and public.only_media_urls(images));

-- A comment may be just a photo.
alter table public.comments drop constraint if exists comments_body_check;
alter table public.comments add constraint comments_body_check check (char_length(body) <= 5000 and (char_length(body) >= 1 or cardinality(images) >= 1));

-- Feeds gain the images column (appended, so the views can be replaced in place).
-- brands.sql adds columns to this view, and Postgres can't take columns away
-- from a view: when they are there already, re-running this file leaves it alone.
do $guard$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'thread_feed' and column_name = 'author_brand') then
    execute $v$
create or replace view public.thread_feed with (security_invoker = true) as
select t.id, t.author, p.display_name as author_name, t.category, t.title, t.body, t.item_ids, t.created_at, t.edited_at,
       coalesce((select sum(v.value) from public.thread_votes v where v.thread_id = t.id), 0)::int as score,
       (select count(*) from public.comments c where c.thread_id = t.id and c.status = 'visible')::int as comment_count,
       greatest(t.created_at, coalesce((select max(c.created_at) from public.comments c where c.thread_id = t.id), t.created_at)) as last_activity,
       t.images
from public.threads t
left join public.profiles p on p.id = t.author
where t.status = 'visible'
    $v$;
  end if;
end $guard$;

-- brands.sql adds columns to this view, and Postgres can't take columns away
-- from a view: when they are there already, re-running this file leaves it alone.
do $guard$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comment_feed' and column_name = 'author_brand') then
    execute $v$
create or replace view public.comment_feed with (security_invoker = true) as
select c.id, c.thread_id, c.parent_id, c.author, p.display_name as author_name, c.body, c.created_at, c.edited_at,
       coalesce((select sum(v.value) from public.comment_votes v where v.comment_id = c.id), 0)::int as score,
       c.images
from public.comments c
left join public.profiles p on p.id = c.author
where c.status = 'visible'
    $v$;
  end if;
end $guard$;

grant select on public.thread_feed, public.comment_feed to anon, authenticated;
