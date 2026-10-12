-- Sotto community schema.
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent where possible).
--
-- Principles:
--   * Anyone can read visible posts. Writing needs a signed-in user.
--   * People edit and delete only their own rows.
--   * An "issue" must carry an https evidence link (Thai defamation law is
--     criminal; claims need evidence, and the brand can answer).
--   * Nothing here is reachable unless explicitly granted below
--     ("Automatically expose new tables" was turned off).

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------- reports

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  item_id text not null check (char_length(item_id) between 3 and 200),
  kind text not null check (kind in ('issue', 'owner', 'correction')),
  title text not null check (char_length(title) between 5 and 140),
  body text not null default '' check (char_length(body) <= 2000),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://[^ ]+$'),
  purchase text not null default 'unknown' check (purchase in ('bought', 'free_sample', 'unknown')),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  -- null author = seeded by the maintainers through the SQL editor
  author uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint issue_needs_evidence check (kind <> 'issue' or evidence_url is not null)
);
create index if not exists reports_item_idx on public.reports (item_id) where status = 'visible';
alter table public.reports enable row level security;

drop policy if exists "visible reports readable" on public.reports;
create policy "visible reports readable" on public.reports for select using (status = 'visible' or author = auth.uid());
drop policy if exists "own report insert" on public.reports;
create policy "own report insert" on public.reports for insert to authenticated with check (author = auth.uid() and status = 'visible');
drop policy if exists "own report update" on public.reports;
create policy "own report update" on public.reports for update to authenticated using (author = auth.uid()) with check (author = auth.uid() and status = 'visible');
drop policy if exists "own report delete" on public.reports;
create policy "own report delete" on public.reports for delete to authenticated using (author = auth.uid());

-- At most 10 posts per person per day: slows spam without needing a moderator online.
create or replace function public.reports_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.author is not null and (
    select count(*) from public.reports where author = new.author and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'rate_limit: max 10 posts per day';
  end if;
  return new;
end $$;
drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports for each row execute function public.reports_rate_limit();

-- ---------------------------------------------------------------- confirms ("me too")

create table if not exists public.confirms (
  report_id bigint not null references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
alter table public.confirms enable row level security;

drop policy if exists "confirms readable" on public.confirms;
create policy "confirms readable" on public.confirms for select using (true);
drop policy if exists "own confirm insert" on public.confirms;
create policy "own confirm insert" on public.confirms for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own confirm delete" on public.confirms;
create policy "own confirm delete" on public.confirms for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- flags (moderation queue)

create table if not exists public.flags (
  report_id bigint not null references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
alter table public.flags enable row level security;
-- Flags are write-only for users; maintainers read them in the dashboard.
drop policy if exists "own flag insert" on public.flags;
create policy "own flag insert" on public.flags for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- read model

-- Posts with their "me too" count and the author's display name, in one query.
-- i18n.sql adds columns to this view, and Postgres can't take columns away
-- from a view: when they are there already, re-running this file leaves it alone.
do $guard$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'report_feed' and column_name = 'i18n') then
    execute $v$
create or replace view public.report_feed with (security_invoker = true) as
select r.id, r.item_id, r.kind, r.title, r.body, r.evidence_url, r.purchase, r.created_at, r.author,
       p.display_name as author_name,
       (select count(*) from public.confirms c where c.report_id = r.id)::int as confirms
from public.reports r
left join public.profiles p on p.id = r.author
where r.status = 'visible'
    $v$;
  end if;
end $guard$;

-- ---------------------------------------------------------------- grants

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.reports, public.confirms, public.report_feed to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.reports to authenticated;
grant insert, delete on public.confirms to authenticated;
grant insert on public.flags to authenticated;
