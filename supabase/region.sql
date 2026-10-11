-- Sotto: price reports from outside Thailand (Amazon/eBay, more currencies).
-- Run once after prices.sql. Safe to re-run.
-- store_th / secondhand_th keep their names but now mean "local store" and
-- "used, local"; the currency says which country.

alter table public.price_reports drop constraint if exists price_reports_channel_check;
alter table public.price_reports add constraint price_reports_channel_check check (channel in (
  'shopee', 'lazada', 'tiktok', 'amazon', 'ebay', 'store_th', 'secondhand_th',
  'taobao', 'tmall', 'jd', 'xianyu', 'store_intl', 'aliexpress', 'other'));

alter table public.price_reports drop constraint if exists price_reports_currency_check;
alter table public.price_reports add constraint price_reports_currency_check check (currency in (
  'THB', 'CNY', 'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD', 'MYR', 'PHP', 'IDR', 'VND', 'AUD', 'CAD', 'TWD', 'HKD'));
