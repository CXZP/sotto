-- Sotto: posts compiled by Sotto from public sources (author null), with
--   issue_state  open | fixed | unclear   (issues only)
--   fixed_in     the firmware that fixed it, as the maker names it
--   quote        the source's own words the post rests on, verbatim
--   checked_on   the day a person last checked the source
-- See the "How we compile" page (#compiled). Run after schema.sql and i18n.sql,
-- in the SQL Editor. Safe to re-run.

alter table public.reports add column if not exists issue_state text;
alter table public.reports drop constraint if exists reports_issue_state_check;
alter table public.reports add constraint reports_issue_state_check check (issue_state is null or issue_state in ('open', 'fixed', 'unclear'));
alter table public.reports add column if not exists fixed_in text;
alter table public.reports drop constraint if exists reports_fixed_in_check;
alter table public.reports add constraint reports_fixed_in_check check (fixed_in is null or char_length(fixed_in) <= 80);
alter table public.reports add column if not exists quote text;
alter table public.reports drop constraint if exists reports_quote_check;
alter table public.reports add constraint reports_quote_check check (quote is null or char_length(quote) <= 600);
alter table public.reports add column if not exists checked_on date;
alter table public.reports add column if not exists i18n jsonb;

create or replace view public.report_feed with (security_invoker = true) as
select r.id, r.item_id, r.kind, r.title, r.body, r.evidence_url, r.purchase, r.created_at, r.author,
       p.display_name as author_name,
       (select count(*) from public.confirms c where c.report_id = r.id)::int as confirms,
       r.i18n, r.issue_state, r.fixed_in, r.quote, r.checked_on
from public.reports r
left join public.profiles p on p.id = r.author
where r.status = 'visible';

-- The DX5 II DC-protection post rests on a second-hand log. Topping's own
-- support page for the DX5 II now has an "HP DC abnormal" entry with a
-- "DC Detection Sensitivity" menu setting, so the claim may be out of date.
-- Unclear until a person reads the Audio Science Review thread itself.
update public.reports
set issue_state = 'unclear',
    checked_on = date '2026-10-12',
    quote = '· Go to the menu and set DC Detection Sensitivity to Low. [Menu - Advanced - DC Detection Sensitivity]',
    body = 'An issue log compiled from the Audio Science Review thread reports that DC fed to the input is not cut at the headphone output, unlike earlier Topping amps (A30 Pro, L30, L50). Unclear now: Topping''s own DX5 II support page has an "HP DC abnormal" entry and a DC Detection Sensitivity setting, so later firmware may have added DC detection. We have not confirmed either way.'
where item_id = 'topping--dx5-ii' and author is null and title = 'DC protection reportedly not working';

-- Maker-acknowledged problems, from the makers' own firmware release notes.
-- Each was checked on 2026-10-12 against the linked page.
insert into public.reports (item_id, kind, title, body, evidence_url, purchase, author, issue_state, fixed_in, quote, checked_on)
select * from (values
  (
    'topping--dx5-ii', 'issue',
    'Brief volume jump from Cloud PEQ when refreshing Web Home',
    'Topping''s release notes for firmware V2.58 (2026-10-09) list a fix for a sudden volume increase: with local PEQ off, refreshing the Web Home page could briefly turn Cloud PEQ on. The same release fixes a pop when USB PCM audio resumes after a sample-rate change. If you use Topping''s web or app EQ, check your firmware version.',
    'https://www.toppingaudio.com/download/dx5-ii-version-v2-58-firmware-update',
    'unknown', null::uuid, 'fixed', 'V2.58',
    '*Fixed: When local PEQ was disabled, refreshing Web Home could briefly enable Cloud PEQ and cause a sudden volume increase.',
    date '2026-10-12'
  ),
  (
    'topping--dx1-ii', 'issue',
    'Pop when waking from the optical input; mute not working with fixed 0 dB output',
    'Topping''s release notes for firmware V16.07.23.07 (2026-09-03) list two fixes: a popping noise when the unit woke by itself on the optical (OPT) input, and mute not working when the line/optical output was set to a fixed 0 dB.',
    'https://www.toppingaudio.com/download/dx1-ii-v16-07-23-07-firmware-update',
    'unknown', null::uuid, 'fixed', 'V16.07.23.07',
    'Fixed: A popping noise when the device automatically woke from OPT input. Fixed: Mute did not work when LO/OPT fixed 0 dB output was enabled and only OPT or LO was selected.',
    date '2026-10-12'
  ),
  (
    'fiio--btr17', 'issue',
    'Battery stopping at 60% with charging protection on',
    'FiiO''s firmware notes for Bluetooth V1.25 (2025-08-26) list a fix for charging that could stop at 60% after charging protection was turned on. The same update (XMOS V1.32) fixes a PS5 not always recognising the BTR17 in UAC 1.0 mode.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202412181625193628457',
    'unknown', null::uuid, 'fixed', 'Bluetooth V1.25 / XMOS V1.32',
    'Fixed the issue where charging could sometimes only reach 60% after enabling charging protection.',
    date '2026-10-12'
  ),
  (
    'fiio--btr17', 'issue',
    'PEQ changes not applied in USB (UAC) mode',
    'FiiO''s firmware notes for Bluetooth V1.28 / XMOS V1.36 (2026-03-19) list a fix for PEQ filter changes made in FiiO Control not taking effect in UAC (USB) mode, and for global gain set in the web PEQ not being saved.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202412181625193628457',
    'unknown', null::uuid, 'fixed', 'Bluetooth V1.28 / XMOS V1.36',
    'Fixed an issue where adjusting PEQ filters via FiiO Control in UAC mode did not take effect.',
    date '2026-10-12'
  ),
  (
    'fiio--k19', 'issue',
    'Volume level mismatch after switching output modes',
    'FiiO''s notes for K19 MCU firmware V165 (2026-09-16) list fixes for the volume not matching after switching output modes, and for EQ settings not taking effect the first time EQ was turned on.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202407191546276968969',
    'unknown', null::uuid, 'fixed', 'MCU V165',
    'Fixed volume output mismatch after switching output modes.',
    date '2026-10-12'
  ),
  (
    'fiio--ka17', 'issue',
    'No sound after some EQ filter settings; quiet on phones with EQ off',
    'FiiO''s notes for KA17 firmware V2.21 (2025-04-29) list a fix for no output after some EQ filter settings, and an improvement for low volume on a phone in non-exclusive mode with EQ off.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202403121546197194373',
    'unknown', null::uuid, 'fixed', 'V2.21',
    'Fixed the issue of no output when playing after repairing some EQ filter settings. 2. Optimized the problem of low output volume when connecting a mobile phone in non-exclusive mode with EQ off.',
    date '2026-10-12'
  ),
  (
    'fiio--ka17', 'issue',
    'Volume dropped when EQ was turned on; no output for 32-bit with EQ',
    'FiiO''s notes for KA17 firmware V2.00 (2024-04-26) list fixes for the volume dropping when EQ was turned on, and for no output when playing 32-bit audio in the exclusive USB mode with EQ on. Units on older firmware may still behave this way.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202403121546197194373',
    'unknown', null::uuid, 'fixed', 'V2.00',
    'Fixed the issue where volume would decrease when enabling EQ.',
    date '2026-10-12'
  ),
  (
    'fiio--qx13', 'issue',
    'PEQ Q values not matching what was set',
    'FiiO''s notes for QX13 XMOS firmware V1.33 (2026-03-03) list a fix for PEQ curve Q values being inconsistent.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202510241833175605750',
    'unknown', null::uuid, 'fixed', 'XMOS V1.33',
    'Fixed the issue where PEQ curve Q values were inconsistent.',
    date '2026-10-12'
  )
) as v(item_id, kind, title, body, evidence_url, purchase, author, issue_state, fixed_in, quote, checked_on)
where not exists (select 1 from public.reports r where r.item_id = v.item_id and r.title = v.title);
