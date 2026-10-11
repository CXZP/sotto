-- Sotto: notice and takedown. A post flagged by 3 different people is hidden
-- automatically until a maintainer reviews it (Thai Computer Crime Act
-- notice-and-takedown practice: act promptly on a complaint, then decide).
-- Maintainers see the queue with `select * from public.moderation_queue;`
-- and restore a post with `update public.<table> set status = 'visible' where id = …;`
-- Run once after schema.sql, prices.sql and discuss.sql. Safe to re-run.

create or replace function public.hide_after_flags() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tg_table_name = 'flags' then
    select count(*) into n from public.flags where report_id = new.report_id;
    if n >= 3 then update public.reports set status = 'hidden' where id = new.report_id; end if;
  elsif tg_table_name = 'price_flags' then
    select count(*) into n from public.price_flags where price_id = new.price_id;
    if n >= 3 then update public.price_reports set status = 'hidden' where id = new.price_id; end if;
  elsif tg_table_name = 'discuss_flags' then
    select count(*) into n from public.discuss_flags where kind = new.kind and target_id = new.target_id;
    if n >= 3 then
      if new.kind = 'thread' then update public.threads set status = 'hidden' where id = new.target_id;
      else update public.comments set status = 'hidden' where id = new.target_id; end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists hide_after_flags on public.flags;
create trigger hide_after_flags after insert on public.flags for each row execute function public.hide_after_flags();
drop trigger if exists hide_after_flags on public.price_flags;
create trigger hide_after_flags after insert on public.price_flags for each row execute function public.hide_after_flags();
drop trigger if exists hide_after_flags on public.discuss_flags;
create trigger hide_after_flags after insert on public.discuss_flags for each row execute function public.hide_after_flags();

-- One place to read every flag, newest first (maintainers only: no grants).
create or replace view public.moderation_queue as
select 'report' as kind, f.report_id as target_id, r.status, r.title as what, f.reason, f.created_at from public.flags f join public.reports r on r.id = f.report_id
union all
select 'price', f.price_id, p.status, p.amount || ' ' || p.currency, f.reason, f.created_at from public.price_flags f join public.price_reports p on p.id = f.price_id
union all
select f.kind, f.target_id, coalesce(t.status, c.status), coalesce(t.title, left(c.body, 80)), f.reason, f.created_at
from public.discuss_flags f
left join public.threads t on f.kind = 'thread' and t.id = f.target_id
left join public.comments c on f.kind = 'comment' and c.id = f.target_id
order by created_at desc;
revoke all on public.moderation_queue from anon, authenticated;
