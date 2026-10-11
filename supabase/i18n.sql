-- Sotto: review-summary posts in every site language (th, en, ja, zh).
-- The summariser writes each post in all four; the site shows the viewer's one
-- and falls back to title/body. Run once after schema.sql. Safe to re-run.

alter table public.reports add column if not exists i18n jsonb;
alter table public.reports drop constraint if exists reports_i18n_check;
alter table public.reports add constraint reports_i18n_check
  check (i18n is null or (jsonb_typeof(i18n) = 'object' and octet_length(i18n::text) <= 20000));

create or replace view public.report_feed with (security_invoker = true) as
select r.id, r.item_id, r.kind, r.title, r.body, r.evidence_url, r.purchase, r.created_at, r.author,
       p.display_name as author_name,
       (select count(*) from public.confirms c where c.report_id = r.id)::int as confirms,
       r.i18n
from public.reports r
left join public.profiles p on p.id = r.author
where r.status = 'visible';
