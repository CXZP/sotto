-- Sotto: private bookmarks (saved threads and products / wishlist).
-- Run once after discuss.sql. Safe to re-run. Only the owner can see them.

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('thread', 'item')),
  target text not null check (char_length(target) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, target)
);
alter table public.bookmarks enable row level security;

drop policy if exists "own bookmarks read" on public.bookmarks;
create policy "own bookmarks read" on public.bookmarks for select to authenticated using (user_id = auth.uid());
drop policy if exists "own bookmarks insert" on public.bookmarks;
create policy "own bookmarks insert" on public.bookmarks for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own bookmarks delete" on public.bookmarks;
create policy "own bookmarks delete" on public.bookmarks for delete to authenticated using (user_id = auth.uid());

-- At most 1,000 bookmarks per person.
create or replace function public.bookmarks_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.bookmarks where user_id = new.user_id) >= 1000 then
    raise exception 'rate_limit: max 1000 bookmarks';
  end if;
  return new;
end $$;
drop trigger if exists bookmarks_cap on public.bookmarks;
create trigger bookmarks_cap before insert on public.bookmarks for each row execute function public.bookmarks_cap();

grant select, insert, delete on public.bookmarks to authenticated;
