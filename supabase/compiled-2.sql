-- Sotto: second batch of maker-acknowledged problems, from FiiO's and Topping's
-- own firmware release notes. Run after compiled.sql. Safe to re-run.
-- Each quote was checked on 2026-10-12 against the linked page.

insert into public.reports (item_id, kind, title, body, evidence_url, purchase, author, issue_state, fixed_in, quote, checked_on)
select * from (values
  (
    'fiio--k11', 'issue',
    'Optical dropouts with TVs; no output after switching to coaxial',
    'FiiO''s notes for K11 firmware V129 (2025-11-05) list fixes for audio dropouts when decoding optical audio from a TV (with AES3 set to 1 in System Settings), and for no output after switching to coaxial mode. FiiO notes that updating to V129 erases all device settings.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202311101753541075396',
    'unknown', null::uuid, 'fixed', 'V129',
    'Fixed the issue where audio dropouts may occur in optical decoding for televisions.',
    date '2026-10-12'
  ),
  (
    'fiio--btr13', 'issue',
    'Sudden volume change and pops on the low-gain balanced output',
    'FiiO''s notes for BTR13 firmware V12.8 (2024-11-08) list a fix for a "volume mutation" at volume 0 on the low-gain balanced output, and for occasional popping on that output. FiiO''s wording doesn''t say more; we read "mutation" as an abrupt change in volume. Units on older firmware may still do this.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202412181710544627982',
    'unknown', null::uuid, 'fixed', 'V12.8',
    '3. Fixed low gain balanced output 0 volume volume mutation issue 4. Fixed the low gain balanced output curve probability popping problem',
    date '2026-10-12'
  ),
  (
    'fiio--btr13', 'issue',
    'Start of playback cut off; pop on incoming calls after changing balance',
    'FiiO''s notes for BTR13 firmware V13.2 (2026-05-22) list fixes for missing audio when playback starts, and for a popping sound when a call comes in after the channel balance was adjusted. Owners on the same FiiO thread had reported on V12.8 a loud pop on one side after a balance change and a reboot, and that keeping the balance at 0 avoided it.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202412181710544627982',
    'unknown', null::uuid, 'fixed', 'V13.2',
    '2. Fixed an issue of missing audio during initial playback.',
    date '2026-10-12'
  ),
  (
    'fiio--btr15', 'issue',
    'Gain switching from low back to high after a reboot',
    'FiiO''s notes for BTR15 Bluetooth firmware V3.8 (2024-06-17) list a fix for the gain changing from low to high after a reboot, and for USB 1.0 mode reverting to USB 2.0. With sensitive IEMs, high gain can be much louder than expected; on older firmware, check the gain after restarting.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202312201447233677679',
    'unknown', null::uuid, 'fixed', 'Bluetooth V3.8',
    '1. Fixed the issue where the gain level changes from low to high after rebooting.',
    date '2026-10-12'
  ),
  (
    'fiio--ka13', 'issue',
    'Left channel louder on iPhones',
    'FiiO''s notes for KA13 firmware v0.21 (2025-07-23) list a fix for the left channel possibly sounding louder when playing from Apple phones. Owners on the same FiiO thread had reported that, on firmware v0.17 and v0.18, the left ear became suddenly very loud each time the KA13 was connected to an iPhone, until a volume button was pressed.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202309281720242213748',
    'unknown', null::uuid, 'fixed', 'v0.21',
    '1. Fixed the issue where the left channel may sound louder when playing songs on Apple phones.',
    date '2026-10-12'
  ),
  (
    'fiio--k15', 'issue',
    'Noise with EQ on while streaming MQA through Roon',
    'FiiO''s notes for K15 main firmware V155 with MCU V95 (2026-09-16) list a fix for noise when EQ was on while streaming MQA tracks through Roon. FiiO says to update the MCU to V95 after the main firmware.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202511212008303270485',
    'unknown', null::uuid, 'fixed', 'V155 / MCU V95',
    '8. Fixed an issue where noise occurred when EQ was enabled while streaming MQA tracks via Roon.',
    date '2026-10-12'
  ),
  (
    'fiio--k15', 'issue',
    'Stuttering with app EQ on in coaxial and Bluetooth modes',
    'FiiO''s notes for K15 main firmware V142 with MCU V93 (2025-11-21) list a fix for audio stuttering when EQ was turned on from the app in coaxial and Bluetooth decoding modes.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202511212008303270485',
    'unknown', null::uuid, 'fixed', 'V142 / MCU V93',
    '5. Fixed the issue where enabling EQ via the app in coaxial and Bluetooth decoding modes could cause audio stuttering.',
    date '2026-10-12'
  ),
  (
    'fiio--m23-high-resolution', 'issue',
    'Battery kept charging in Desktop mode',
    'FiiO''s notes for M23 firmware FW1.0.1 (2024-04-29) list a fix for charging that could continue after Desktop mode was turned on.',
    'https://forum.fiio.com/note/showNoteContent.do?id=202404291801126137242',
    'unknown', null::uuid, 'fixed', 'FW1.0.1',
    '4. Fixed the issue where charging may continue after enabling the Desktop mode;',
    date '2026-10-12'
  ),
  (
    'fiio--ka15', 'issue',
    'Power-saving mode could not be turned off',
    'FiiO''s notes for KA15 firmware V1.1.6 (2026-03-04) list a fix for power-saving mode that could not be turned off. FiiOs instruction: "Turn off power saving mode: Long press the Volume- button and power the KA15".',
    'https://forum.fiio.com/note/showNoteContent.do?id=202412181648159317941',
    'unknown', null::uuid, 'fixed', 'V1.1.6',
    '1. Fixed the issue where power saving mode could not be turned off.',
    date '2026-10-12'
  ),
  (
    'topping--e50-ii', 'issue',
    'No sound with high gain and a high-Q PEQ setting',
    'Topping''s release notes for E50 II firmware V1.69 (2026-10-09) list a fix for no sound at high gain with high Q settings, and for the PEQ left and right channels jumping when switched.',
    'https://www.toppingaudio.com/download/e50-ii-version-v1-69-firmware-update',
    'unknown', null::uuid, 'fixed', 'V1.69',
    'Fixed: No sound at high gain and high Q settings.',
    date '2026-10-12'
  ),
  (
    'topping--a900', 'issue',
    'Pop during factory reset with a signal playing',
    'Topping''s release notes for A900 firmware V1.20 (2025-08-27) list a fix for a brief audible pop during a factory reset while an input signal is present.',
    'https://www.toppingaudio.com/download/a900-version-v1-20-firmware-update',
    'unknown', null::uuid, 'fixed', 'V1.20',
    'Fixed: Brief audible pop noise during factory reset when an input signal is present.',
    date '2026-10-12'
  ),
  (
    'topping--d900', 'issue',
    'No output in NetEase Cloud Music exclusive mode',
    'Topping''s release notes for D900 firmware V1.48 (2026-07-07) list a fix for no output when NetEase Cloud Music plays in exclusive mode.',
    'https://www.toppingaudio.com/download/d900-version-v1-48-firmware-update',
    'unknown', null::uuid, 'fixed', 'V1.48',
    '*Fixed: No output in NetEase Cloud Music exclusive mode.',
    date '2026-10-12'
  )
) as v(item_id, kind, title, body, evidence_url, purchase, author, issue_state, fixed_in, quote, checked_on)
where not exists (select 1 from public.reports r where r.item_id = v.item_id and r.title = v.title);
