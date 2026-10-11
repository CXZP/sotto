-- Sotto: "dream setup" threads, verified brand accounts, brand responses.
-- Run once after media.sql. Safe to re-run.

-- ---------------------------------------------------------------- dream setups
-- Setups (owned) and dreams (wishlists) are threads with photos and linked
-- products; the gallery page shows them as a photo grid.
alter table public.threads drop constraint if exists threads_category_check;
alter table public.threads add constraint threads_category_check
  check (category in ('question', 'setup', 'dream', 'deal', 'issue', 'news', 'general'));

-- ---------------------------------------------------------------- verified brand accounts
-- Added by maintainers only (SQL editor), after checking the request came
-- from the brand (e.g. an email from the brand's own domain):
--   insert into public.brand_reps (user_id, brand, title)
--   values ('<auth user id>', 'Moondrop', 'Customer support');
create table if not exists public.brand_reps (
  user_id uuid primary key references auth.users (id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 80),
  title text not null default '' check (char_length(title) <= 80),
  verified_at timestamptz not null default now()
);
alter table public.brand_reps enable row level security;
drop policy if exists "brand reps readable" on public.brand_reps;
create policy "brand reps readable" on public.brand_reps for select using (true);
-- no insert/update/delete policies: only maintainers can change this table

-- ---------------------------------------------------------------- responses to issue reports
create table if not exists public.report_responses (
  id bigint generated always as identity primary key,
  report_id bigint not null references public.reports (id) on delete cascade,
  author uuid references auth.users (id) on delete set null default auth.uid(),
  brand text not null,
  body text not null check (char_length(body) between 5 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists report_responses_report_idx on public.report_responses (report_id);
alter table public.report_responses enable row level security;
drop policy if exists "responses readable" on public.report_responses;
create policy "responses readable" on public.report_responses for select using (true);
drop policy if exists "verified rep insert" on public.report_responses;
create policy "verified rep insert" on public.report_responses for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.brand_reps r where r.user_id = auth.uid() and lower(r.brand) = lower(brand)));
drop policy if exists "own response update" on public.report_responses;
create policy "own response update" on public.report_responses for update to authenticated
  using (author = auth.uid()) with check (author = auth.uid());
drop policy if exists "own response delete" on public.report_responses;
create policy "own response delete" on public.report_responses for delete to authenticated using (author = auth.uid());

create or replace view public.response_feed with (security_invoker = true) as
select x.id, x.report_id, x.author, x.brand, x.body, x.created_at, x.edited_at,
       p.display_name as author_name, r.title as author_title
from public.report_responses x
left join public.profiles p on p.id = x.author
left join public.brand_reps r on r.user_id = x.author;

-- ---------------------------------------------------------------- brand badge on discussions
create or replace view public.thread_feed with (security_invoker = true) as
select t.id, t.author, p.display_name as author_name, t.category, t.title, t.body, t.item_ids, t.created_at, t.edited_at,
       coalesce((select sum(v.value) from public.thread_votes v where v.thread_id = t.id), 0)::int as score,
       (select count(*) from public.comments c where c.thread_id = t.id and c.status = 'visible')::int as comment_count,
       greatest(t.created_at, coalesce((select max(c.created_at) from public.comments c where c.thread_id = t.id), t.created_at)) as last_activity,
       t.images,
       b.brand as author_brand
from public.threads t
left join public.profiles p on p.id = t.author
left join public.brand_reps b on b.user_id = t.author
where t.status = 'visible';

create or replace view public.comment_feed with (security_invoker = true) as
select c.id, c.thread_id, c.parent_id, c.author, p.display_name as author_name, c.body, c.created_at, c.edited_at,
       coalesce((select sum(v.value) from public.comment_votes v where v.comment_id = c.id), 0)::int as score,
       c.images,
       b.brand as author_brand
from public.comments c
left join public.profiles p on p.id = c.author
left join public.brand_reps b on b.user_id = c.author
where c.status = 'visible';

grant select on public.brand_reps, public.report_responses, public.response_feed, public.thread_feed, public.comment_feed to anon, authenticated;
grant insert, update, delete on public.report_responses to authenticated;
