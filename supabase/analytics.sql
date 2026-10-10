-- Sotto: cookieless, anonymous usage statistics. Run once. Safe to re-run.
--
-- What is stored per event: kind (view / outbound click / error), page,
-- product id, referring site's domain, language, device class, store, and a
-- visitor hash. No IP, no user agent, no account id, no cookies.
--
-- The visitor hash is md5(daily random salt + IP + user agent), computed here
-- in the database. The salt is deleted the next day, so a hash can't be
-- reversed or linked across days: it only lets us count unique visitors per day.
--
-- Raw events are not readable through the API. Only daily aggregates are
-- public (the #stats page).

create table if not exists public.analytics_salt (
  day date primary key,
  salt text not null
);
alter table public.analytics_salt enable row level security; -- no policies: unreachable from the API

create table if not exists public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  day date not null default current_date,
  kind text not null check (kind in ('view', 'outbound', 'error')),
  path text check (char_length(path) <= 120),
  item_id text check (char_length(item_id) <= 200),
  ref_host text check (char_length(ref_host) <= 100),
  lang text check (char_length(lang) <= 5),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  store text check (char_length(store) <= 40),
  message text check (char_length(message) <= 300),
  visitor text not null
);
create index if not exists events_day_idx on public.events (day, kind);
alter table public.events enable row level security; -- no policies: raw rows are unreachable from the API

create or replace function public.track(
  p_kind text, p_path text default null, p_item text default null, p_ref text default null,
  p_lang text default null, p_device text default null, p_store text default null, p_message text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  s text;
  headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip text := split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'cf-connecting-ip', ''), ',', 1);
  ua text := coalesce(headers ->> 'user-agent', '');
  v text;
begin
  if p_kind not in ('view', 'outbound', 'error') then return; end if;
  -- crude bot filter: obvious crawlers aren't people
  if ua ~* '(bot|crawl|spider|slurp|headless|preview|facebookexternalhit|curl|wget)' then return; end if;
  select salt into s from analytics_salt where day = current_date;
  if s is null then
    delete from analytics_salt where day < current_date;
    insert into analytics_salt (day, salt) values (current_date, gen_random_uuid()::text) on conflict (day) do nothing;
    select salt into s from analytics_salt where day = current_date;
  end if;
  v := md5(s || ip || ua);
  -- at most 120 events per visitor per hour
  if (select count(*) from events where visitor = v and at > now() - interval '1 hour') >= 120 then return; end if;
  insert into events (kind, path, item_id, ref_host, lang, device, store, message, visitor)
  values (p_kind, left(p_path, 120), left(p_item, 200), left(p_ref, 100), left(p_lang, 5),
          case when p_device in ('mobile', 'tablet', 'desktop') then p_device end, left(p_store, 40), left(p_message, 300), v);
end $$;
revoke all on function public.track(text, text, text, text, text, text, text, text) from public;
grant execute on function public.track(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- public aggregates
-- These views run as their owner (no security_invoker), so they can count
-- rows the API can't read, and expose only totals.

create or replace view public.stats_daily as
select day,
       count(*) filter (where kind = 'view')::int as views,
       count(distinct visitor) filter (where kind = 'view')::int as visitors,
       count(*) filter (where kind = 'outbound')::int as store_clicks
from public.events where day > current_date - 90 group by day order by day;

create or replace view public.stats_items as
select item_id, count(*)::int as views, count(distinct visitor)::int as visitors
from public.events where kind = 'view' and item_id is not null and day > current_date - 30
group by item_id order by views desc limit 30;

create or replace view public.stats_pages as
select path, count(*)::int as views
from public.events where kind = 'view' and day > current_date - 30
group by path order by views desc limit 20;

create or replace view public.stats_refs as
select ref_host, count(distinct visitor)::int as visitors
from public.events where kind = 'view' and ref_host is not null and day > current_date - 30
group by ref_host order by visitors desc limit 20;

create or replace view public.stats_stores as
select store, count(*)::int as clicks
from public.events where kind = 'outbound' and day > current_date - 30
group by store order by clicks desc;

create or replace view public.stats_devices as
select coalesce(device, 'unknown') as device, coalesce(lang, '?') as lang, count(distinct visitor)::int as visitors
from public.events where kind = 'view' and day > current_date - 30
group by 1, 2 order by visitors desc;

grant select on public.stats_daily, public.stats_items, public.stats_pages, public.stats_refs, public.stats_stores, public.stats_devices to anon, authenticated;

-- Errors stay private: read them in the dashboard with
--   select at, path, message from events where kind = 'error' order by at desc limit 100;
