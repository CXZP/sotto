-- Sotto: prices people actually paid. Run once in Supabase → SQL Editor after schema.sql.
-- Safe to re-run.
--
-- Why this exists: a marketplace list price is not the price paid (shop codes,
-- platform codes, campaigns, coins). Bots can't see what a person paid, and
-- scraping Shopee/Lazada breaks their terms. So people report it, with proof.
--
--   * Every report needs evidence: a screenshot (uploaded to the "evidence"
--     bucket after the page re-encodes it and the person blacks out personal
--     details) or an https link.
--   * Reports are shown as ranges per channel, never as one "lowest" number.

-- ---------------------------------------------------------------- price_reports

create table if not exists public.price_reports (
  id bigint generated always as identity primary key,
  item_id text not null check (char_length(item_id) between 3 and 200),
  channel text not null check (channel in (
    'shopee', 'lazada', 'tiktok', 'store_th', 'secondhand_th',
    'taobao', 'tmall', 'jd', 'xianyu', 'store_intl', 'aliexpress', 'other')),
  amount numeric(12, 2) not null check (amount > 0 and amount < 10000000),
  currency text not null check (currency in ('THB', 'CNY', 'USD', 'EUR', 'JPY', 'SGD', 'MYR')),
  includes_shipping boolean not null default false,
  condition text not null default 'new' check (condition in ('new', 'open_box', 'used')),
  paid_on date not null,
  campaign text not null default '' check (char_length(campaign) <= 60),
  note text not null default '' check (char_length(note) <= 300),
  evidence_url text not null check (evidence_url ~ '^https://[^ ]+$'),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  author uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists price_reports_item_idx on public.price_reports (item_id) where status = 'visible';
alter table public.price_reports enable row level security;

drop policy if exists "visible prices readable" on public.price_reports;
create policy "visible prices readable" on public.price_reports for select using (status = 'visible' or author = auth.uid());
drop policy if exists "own price insert" on public.price_reports;
create policy "own price insert" on public.price_reports for insert to authenticated with check (author = auth.uid() and status = 'visible');
drop policy if exists "own price delete" on public.price_reports;
create policy "own price delete" on public.price_reports for delete to authenticated using (author = auth.uid());

-- 10 price reports per person per day, and no dates in the future or before 2015.
create or replace function public.price_reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.paid_on > current_date + 1 or new.paid_on < date '2015-01-01' then
    raise exception 'bad_date: paid_on out of range';
  end if;
  if new.author is not null and (
    select count(*) from public.price_reports where author = new.author and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'rate_limit: max 10 price reports per day';
  end if;
  return new;
end $$;
drop trigger if exists price_reports_guard on public.price_reports;
create trigger price_reports_guard before insert on public.price_reports for each row execute function public.price_reports_guard();

-- ---------------------------------------------------------------- price_flags

create table if not exists public.price_flags (
  price_id bigint not null references public.price_reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  primary key (price_id, user_id)
);
alter table public.price_flags enable row level security;
drop policy if exists "own price flag insert" on public.price_flags;
create policy "own price flag insert" on public.price_flags for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- read model

create or replace view public.price_feed with (security_invoker = true) as
select r.id, r.item_id, r.channel, r.amount, r.currency, r.includes_shipping, r.condition, r.paid_on,
       r.campaign, r.note, r.evidence_url, r.created_at, r.author, p.display_name as author_name
from public.price_reports r
left join public.profiles p on p.id = r.author
where r.status = 'visible';

-- ---------------------------------------------------------------- evidence screenshots

-- Public bucket: screenshots are proof meant to be seen. Images only, 2 MB max.
-- The page re-encodes every image (drops EXIF/GPS) and asks the person to
-- black out names, addresses and phone numbers before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Each person writes only inside a folder named after their user id.
drop policy if exists "evidence own upload" on storage.objects;
create policy "evidence own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "evidence own delete" on storage.objects;
create policy "evidence own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- grants

grant select on public.price_reports, public.price_feed to anon, authenticated;
grant insert, delete on public.price_reports to authenticated;
grant insert on public.price_flags to authenticated;
