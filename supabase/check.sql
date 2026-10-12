-- Sotto: which setup files have been applied? Read-only: changes nothing.
-- Run in the SQL Editor; every row should say true.
with c as (
  select table_name, column_name from information_schema.columns where table_schema = 'public'
), k as (
  select conname, pg_get_constraintdef(oid) as def from pg_constraint where connamespace = 'public'::regnamespace
)
select 'schema.sql' as file, exists (select 1 from c where table_name = 'report_feed') as applied
union all select 'i18n.sql',      exists (select 1 from c where table_name = 'reports' and column_name = 'i18n')
union all select 'reviews.sql',   exists (select 1 from k where conname = 'reports_kind_check' and def like '%review%')
union all select 'dedupe.sql',    exists (select 1 from c where table_name = 'reports' and column_name = 'dedupe_key')
union all select 'purchase.sql',  exists (select 1 from k where conname = 'reports_purchase_check' and def like '%free_sample%')
union all select 'prices.sql',    exists (select 1 from c where table_name = 'price_feed')
union all select 'region.sql',    exists (select 1 from k where conname = 'price_reports_channel_check' and def like '%xianyu%')
union all select 'ports.sql',     exists (select 1 from c where table_name = 'port_reports')
union all select 'owners.sql',    exists (select 1 from c where table_name = 'owner_reports')
union all select 'bot.sql',       exists (select 1 from c where table_name = 'bot_usage')
union all select 'discuss.sql',   exists (select 1 from c where table_name = 'thread_feed')
union all select 'media.sql',     exists (select 1 from c where table_name = 'thread_feed' and column_name = 'images')
union all select 'brands.sql',    exists (select 1 from c where table_name = 'thread_feed' and column_name = 'author_brand')
union all select 'compiled.sql',  exists (select 1 from c where table_name = 'report_feed' and column_name = 'issue_state')
union all select 'analytics.sql', exists (select 1 from c where table_name = 'events')
union all select 'bookmarks.sql', exists (select 1 from c where table_name = 'bookmarks')
union all select 'moderation.sql', exists (select 1 from c where table_name = 'moderation_queue')
union all select 'seed.sql',      exists (select 1 from public.reports where item_id = 'topping--dx5-ii' and author is null);
