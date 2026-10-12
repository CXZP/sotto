-- Sotto: human checks. "Right" means a person compared our entry with the real
-- thing (rear-panel photo, the maker's manual) and said so. Makers' pages, store
-- text, rules and AI only suggest; a check is what makes an entry "checked".
--
-- Only people listed in public.checkers can record a check. Add yourself once,
-- in the SQL editor, after signing in on the site at least once:
--   insert into public.checkers (user_id) select id from auth.users where email = 'you@example.com';
--
-- Run once. Safe to re-run.

create table if not exists public.checkers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.checkers enable row level security;
drop policy if exists "checkers readable" on public.checkers;
create policy "checkers readable" on public.checkers for select using (true);
-- No insert/update/delete policy: only the SQL editor (service role) adds checkers.

create table if not exists public.checks (
  id bigint generated always as identity primary key,
  item_id text not null check (char_length(item_id) <= 200),
  -- What was checked: the sockets and jacks a box has (more fields later).
  field text not null default 'sockets' check (field in ('sockets')),
  -- 'ok': what we show is right. 'fixed': it was wrong; "data" is the right one.
  verdict text not null check (verdict in ('ok', 'fixed')),
  -- What the page showed when the person looked (to notice later changes).
  shown jsonb not null check (octet_length(shown::text) <= 8000),
  -- For 'fixed': {in:{port:n}, out:{port:n}, jacks:[...]}.
  data jsonb check (data is null or octet_length(data::text) <= 8000),
  -- What the person looked at: a photo or manual link.
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  note text check (note is null or char_length(note) <= 500),
  author uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists checks_item_idx on public.checks (item_id, created_at desc);
alter table public.checks enable row level security;
drop policy if exists "checks readable" on public.checks;
create policy "checks readable" on public.checks for select using (true);
drop policy if exists "checker insert" on public.checks;
create policy "checker insert" on public.checks for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.checkers c where c.user_id = auth.uid()));
drop policy if exists "own check delete" on public.checks;
create policy "own check delete" on public.checks for delete to authenticated using (author = auth.uid());

grant select on public.checkers, public.checks to anon, authenticated;
grant insert, delete on public.checks to authenticated;
