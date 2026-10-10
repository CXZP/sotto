-- Maintainer seed posts. Run after schema.sql, in the SQL Editor (it bypasses RLS,
-- so author stays null and the site shows these as maintainer posts).
-- Every seed must carry evidence a reader can open and judge.

insert into public.reports (item_id, kind, title, body, evidence_url, purchase, author)
select * from (values
  (
    'topping--dx5-ii', 'issue',
    'DC protection reportedly not working',
    'An issue log compiled from the Audio Science Review thread reports that DC fed to the input is not cut at the headphone output, unlike earlier Topping amps (A30 Pro, L30, L50). The same log says even low gain may be loud for very sensitive IEMs. Topping has shipped firmware updates; check your version.',
    'https://manuals.plus/m/fa39901f22f19f74815277142db48d32caf6d24f313ee5202d111e82f5dd0a18',
    'unknown', null::uuid
  ),
  (
    'topping--dx5-ii', 'issue',
    'Crackling / distortion reports',
    'Owners on Head-Fi report crackling and distortion. One traced it to a USB port and fixed it by switching ports; another unit was repaired by the factory with a firmware/MCU reflash.',
    'https://www.head-fi.org/threads/topping-dx5-ii-distortion-issue.978524/page-2',
    'unknown', null::uuid
  )
) as v(item_id, kind, title, body, evidence_url, purchase, author)
where not exists (select 1 from public.reports r where r.item_id = v.item_id and r.title = v.title);
