-- Sotto: ports and switches confirmed by users from a photo of the back panel.
-- Stores often don't list ports in text; the photo is the evidence.
-- Run once after prices.sql (uses the evidence bucket). Safe to re-run.

create table if not exists public.port_reports (
  id bigint generated always as identity primary key,
  item_id text not null check (char_length(item_id) between 3 and 200),
  ports_in text[] not null default '{}' check (ports_in <@ array['usb', 'coax', 'optical', 'aes', 'bt', 'rca', 'xlr', 'line']),
  ports_out text[] not null default '{}' check (ports_out <@ array['usb', 'coax', 'optical', 'aes', 'bt', 'rca', 'xlr', 'line']),
  features text[] not null default '{}' check (features <@ array['uac1', 'nos', 'roon', 'airplay', 'spotify', 'tidal', 'upnp', 'chromecast', 'asio']),
  evidence_url text not null check (evidence_url ~ '^https://[^ ]+$'),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  author uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (cardinality(ports_in) + cardinality(ports_out) + cardinality(features) > 0)
);
create index if not exists port_reports_item_idx on public.port_reports (item_id) where status = 'visible';
alter table public.port_reports enable row level security;

drop policy if exists "visible ports readable" on public.port_reports;
create policy "visible ports readable" on public.port_reports for select using (status = 'visible' or author = auth.uid());
drop policy if exists "own port insert" on public.port_reports;
create policy "own port insert" on public.port_reports for insert to authenticated with check (author = auth.uid() and status = 'visible');
drop policy if exists "own port delete" on public.port_reports;
create policy "own port delete" on public.port_reports for delete to authenticated using (author = auth.uid());

-- At most 30 port reports a day per person.
create or replace function public.port_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.port_reports where author = new.author and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate limit';
  end if;
  return new;
end $$;
drop trigger if exists port_rate_limit on public.port_reports;
create trigger port_rate_limit before insert on public.port_reports for each row execute function public.port_rate_limit();

create or replace view public.port_feed with (security_invoker = true) as
select r.id, r.item_id, r.ports_in, r.ports_out, r.features, r.evidence_url, r.note, r.created_at, r.author,
       p.display_name as author_name
from public.port_reports r
left join public.profiles p on p.id = r.author
where r.status = 'visible';

grant select on public.port_reports, public.port_feed to anon, authenticated;
grant insert, delete on public.port_reports to authenticated;

-- Account deletion also removes port reports.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.reports where author = me;
  delete from public.price_reports where author = me;
  delete from public.port_reports where author = me;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
