-- Sotto: one review summary per reviewer per page per model. The site sends
-- dedupe_key = "<site><path>|<reviewer>" (see reviewKey in src/blocks.js);
-- a second post with the same key is refused. Run once. Safe to re-run.

alter table public.reports add column if not exists dedupe_key text;
alter table public.reports drop constraint if exists reports_dedupe_key_check;
alter table public.reports add constraint reports_dedupe_key_check check (dedupe_key is null or char_length(dedupe_key) <= 600);
create unique index if not exists reports_dedupe_idx on public.reports (item_id, dedupe_key) where dedupe_key is not null;
