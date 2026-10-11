-- Sotto summariser: usage log for the daily limit (written only by the
-- Edge Function with the service role; nobody can read it from the page).
-- Run once. Safe to re-run.

create table if not exists public.bot_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  created_at timestamptz not null default now()
);
create index if not exists bot_usage_user_idx on public.bot_usage (user_id, created_at);
alter table public.bot_usage enable row level security;
-- no policies: only the service role (the Edge Function) touches this table

-- Old rows are useless after a day.
delete from public.bot_usage where created_at < now() - interval '2 days';
