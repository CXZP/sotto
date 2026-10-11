-- Sotto: "I own this" — short, comparable owner reports (QC, failures, ease
-- of use, would buy again). One per person per model, editable. Shown only
-- as counts with the number of owners, never as a score.
-- Run once after discuss.sql. Safe to re-run.

create table if not exists public.owner_reports (
  id bigint generated always as identity primary key,
  item_id text not null check (char_length(item_id) between 3 and 200),
  author uuid not null references auth.users (id) on delete cascade default auth.uid(),
  months_owned smallint not null check (months_owned between 0 and 240),
  qc text not null check (qc in ('ok', 'cosmetic', 'faulty')),
  failed boolean not null default false,
  failed_after smallint check (failed_after is null or failed_after between 0 and 240),
  failure text not null default '' check (char_length(failure) <= 200),
  ease smallint not null check (ease between 1 and 5),
  annoyances text[] not null default '{}' check (annoyances <@ array['heat', 'app', 'buttons', 'gain', 'cable', 'driver', 'connection', 'battery', 'noise', 'size']),
  buy_again text not null check (buy_again in ('yes', 'maybe', 'no')),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (item_id, author)
);
create index if not exists owner_reports_item_idx on public.owner_reports (item_id) where status = 'visible';
alter table public.owner_reports enable row level security;

drop policy if exists "visible owners readable" on public.owner_reports;
create policy "visible owners readable" on public.owner_reports for select using (status = 'visible' or author = auth.uid());
drop policy if exists "own owner insert" on public.owner_reports;
create policy "own owner insert" on public.owner_reports for insert to authenticated with check (author = auth.uid() and status = 'visible');
drop policy if exists "own owner update" on public.owner_reports;
create policy "own owner update" on public.owner_reports for update to authenticated using (author = auth.uid()) with check (author = auth.uid() and status = 'visible');
drop policy if exists "own owner delete" on public.owner_reports;
create policy "own owner delete" on public.owner_reports for delete to authenticated using (author = auth.uid());

-- Public list (names, notes) and per-model totals.
create or replace view public.owner_feed with (security_invoker = true) as
select o.id, o.item_id, o.author, p.display_name as author_name, o.months_owned, o.qc, o.failed, o.failed_after,
       o.failure, o.ease, o.annoyances, o.buy_again, o.note, o.created_at, o.updated_at
from public.owner_reports o
left join public.profiles p on p.id = o.author
where o.status = 'visible';

create or replace view public.owner_summary with (security_invoker = true) as
select item_id,
       count(*)::int as n,
       count(*) filter (where qc = 'ok')::int as qc_ok,
       count(*) filter (where qc = 'cosmetic')::int as qc_cosmetic,
       count(*) filter (where qc = 'faulty')::int as qc_faulty,
       count(*) filter (where failed)::int as failed,
       round(avg(months_owned))::int as months_avg,
       round(avg(ease)::numeric, 1) as ease_avg,
       count(*) filter (where buy_again = 'yes')::int as again_yes,
       count(*) filter (where buy_again = 'maybe')::int as again_maybe,
       count(*) filter (where buy_again = 'no')::int as again_no
from public.owner_reports
where status = 'visible'
group by item_id;

grant select on public.owner_reports, public.owner_feed, public.owner_summary to anon, authenticated;
grant insert, update, delete on public.owner_reports to authenticated;

-- Account deletion also removes owner reports (cascade covers it; listed for clarity).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.reports where author = me;
  delete from public.price_reports where author = me;
  delete from public.port_reports where author = me;
  delete from public.owner_reports where author = me;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
