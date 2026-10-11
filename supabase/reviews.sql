-- Sotto: "review summary" posts — one reviewer's pros and cons, each with a
-- quote from the linked review. Run once after schema.sql. Safe to re-run.

alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('issue', 'owner', 'correction', 'review'));
