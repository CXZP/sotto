-- Sotto: "loaned for review" as its own kind of unit, apart from free samples
-- (the summariser reads it from the review, with the sentence that says so).
-- Run once. Safe to re-run.

alter table public.reports drop constraint if exists reports_purchase_check;
alter table public.reports add constraint reports_purchase_check check (purchase in ('bought', 'free_sample', 'loan', 'unknown'));
