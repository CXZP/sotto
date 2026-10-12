-- Sotto: discussions (threads, nested comments, votes) and account deletion.
-- Run once in Supabase → SQL Editor after schema.sql. Safe to re-run.
--
--   * Anyone can read; posting, voting and flagging need a signed-in user.
--   * People edit and delete only their own rows.
--   * Bodies are plain text; the page escapes everything and only turns
--     https:// URLs into links.

-- ---------------------------------------------------------------- threads

create table if not exists public.threads (
  id bigint generated always as identity primary key,
  author uuid references auth.users (id) on delete set null default auth.uid(),
  category text not null default 'general' check (category in ('question', 'setup', 'deal', 'issue', 'news', 'general')),
  title text not null check (char_length(title) between 5 and 160),
  body text not null default '' check (char_length(body) <= 10000),
  item_ids text[] not null default '{}' check (cardinality(item_ids) <= 5),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists threads_created_idx on public.threads (created_at desc) where status = 'visible';
create index if not exists threads_items_idx on public.threads using gin (item_ids);
alter table public.threads enable row level security;

drop policy if exists "threads readable" on public.threads;
create policy "threads readable" on public.threads for select using (status = 'visible' or author = auth.uid());
drop policy if exists "own thread insert" on public.threads;
create policy "own thread insert" on public.threads for insert to authenticated with check (author = auth.uid() and status = 'visible');
drop policy if exists "own thread update" on public.threads;
create policy "own thread update" on public.threads for update to authenticated using (author = auth.uid()) with check (author = auth.uid() and status = 'visible');
drop policy if exists "own thread delete" on public.threads;
create policy "own thread delete" on public.threads for delete to authenticated using (author = auth.uid());

-- ---------------------------------------------------------------- comments

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads (id) on delete cascade,
  parent_id bigint references public.comments (id) on delete cascade,
  author uuid references auth.users (id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists comments_thread_idx on public.comments (thread_id, created_at);
alter table public.comments enable row level security;

drop policy if exists "comments readable" on public.comments;
create policy "comments readable" on public.comments for select using (status = 'visible' or author = auth.uid());
drop policy if exists "own comment insert" on public.comments;
create policy "own comment insert" on public.comments for insert to authenticated with check (author = auth.uid() and status = 'visible');
drop policy if exists "own comment update" on public.comments;
create policy "own comment update" on public.comments for update to authenticated using (author = auth.uid()) with check (author = auth.uid() and status = 'visible');
drop policy if exists "own comment delete" on public.comments;
create policy "own comment delete" on public.comments for delete to authenticated using (author = auth.uid());

-- ---------------------------------------------------------------- votes (+1 / -1, one per person)

create table if not exists public.thread_votes (
  thread_id bigint not null references public.threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  value smallint not null check (value in (-1, 1)),
  primary key (thread_id, user_id)
);
create table if not exists public.comment_votes (
  comment_id bigint not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  value smallint not null check (value in (-1, 1)),
  primary key (comment_id, user_id)
);
alter table public.thread_votes enable row level security;
alter table public.comment_votes enable row level security;
do $$
declare t text;
begin
  foreach t in array array['thread_votes', 'comment_votes'] loop
    execute format('drop policy if exists "votes readable" on public.%I', t);
    execute format('create policy "votes readable" on public.%I for select using (true)', t);
    execute format('drop policy if exists "own vote insert" on public.%I', t);
    execute format('create policy "own vote insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "own vote update" on public.%I', t);
    execute format('create policy "own vote update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "own vote delete" on public.%I', t);
    execute format('create policy "own vote delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- flags (moderation queue, write-only)

create table if not exists public.discuss_flags (
  kind text not null check (kind in ('thread', 'comment')),
  target_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  primary key (kind, target_id, user_id)
);
alter table public.discuss_flags enable row level security;
drop policy if exists "own discuss flag insert" on public.discuss_flags;
create policy "own discuss flag insert" on public.discuss_flags for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- rate limits

create or replace function public.discuss_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; cap int;
begin
  if new.author is null then return new; end if;
  if tg_table_name = 'threads' then
    select count(*) into n from public.threads where author = new.author and created_at > now() - interval '1 day';
    cap := 10;
  else
    select count(*) into n from public.comments where author = new.author and created_at > now() - interval '1 day';
    cap := 100;
  end if;
  if n >= cap then raise exception 'rate_limit: max % per day', cap; end if;
  return new;
end $$;
drop trigger if exists threads_rate_limit on public.threads;
create trigger threads_rate_limit before insert on public.threads for each row execute function public.discuss_rate_limit();
drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit before insert on public.comments for each row execute function public.discuss_rate_limit();

-- ---------------------------------------------------------------- read models

-- media.sql adds columns to this view, and Postgres can't take columns away
-- from a view: when they are there already, re-running this file leaves it alone.
do $guard$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'thread_feed' and column_name = 'images') then
    execute $v$
create or replace view public.thread_feed with (security_invoker = true) as
select t.id, t.author, p.display_name as author_name, t.category, t.title, t.body, t.item_ids, t.created_at, t.edited_at,
       coalesce((select sum(v.value) from public.thread_votes v where v.thread_id = t.id), 0)::int as score,
       (select count(*) from public.comments c where c.thread_id = t.id and c.status = 'visible')::int as comment_count,
       greatest(t.created_at, coalesce((select max(c.created_at) from public.comments c where c.thread_id = t.id), t.created_at)) as last_activity
from public.threads t
left join public.profiles p on p.id = t.author
where t.status = 'visible'
    $v$;
  end if;
end $guard$;

-- media.sql adds columns to this view, and Postgres can't take columns away
-- from a view: when they are there already, re-running this file leaves it alone.
do $guard$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comment_feed' and column_name = 'images') then
    execute $v$
create or replace view public.comment_feed with (security_invoker = true) as
select c.id, c.thread_id, c.parent_id, c.author, p.display_name as author_name, c.body, c.created_at, c.edited_at,
       coalesce((select sum(v.value) from public.comment_votes v where v.comment_id = c.id), 0)::int as score
from public.comments c
left join public.profiles p on p.id = c.author
where c.status = 'visible'
    $v$;
  end if;
end $guard$;

-- ---------------------------------------------------------------- account deletion (PDPA)

-- Deletes the caller's auth user. Issue reports and price reports are deleted
-- (a null author there means "Sotto team", so they can't just be orphaned).
-- Threads and comments stay, shown as "deleted account", so replies keep
-- their context. Profile, votes, confirms and flags cascade.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.reports where author = me;
  delete from public.price_reports where author = me;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- grants

grant select on public.threads, public.comments, public.thread_votes, public.comment_votes, public.thread_feed, public.comment_feed to anon, authenticated;
grant insert, update, delete on public.threads, public.comments, public.thread_votes, public.comment_votes to authenticated;
grant insert on public.discuss_flags to authenticated;
