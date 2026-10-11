# Sotto: status, open work, and data/legal concerns

Brief for another assistant (Gemini) to propose solutions, especially for collecting data from sources our current tooling can't reach. Written 2026-10-11.

## What Sotto is

An open-source website (code MIT, data CC BY-SA 4.0) that answers "will this audio chain plug in, is it loud enough, do I need an amp", plus a catalog and community data that spec sheets miss: problems owners hit, QC, real prices paid, ports, owner experience.

- Live: https://cxzp.github.io/sotto/ · repo: github.com/CXZP/sotto
- Stack: static vanilla-JS site on GitHub Pages; Supabase (Postgres + RLS, magic-link auth, Storage, Edge Functions); GitHub Actions for a weekly crawl and deploy.
- Started as a university startup-pitch project (GEN354, KMUTT, Thailand). The owner treats it as a real site with a global audience; Thai is one of the UI languages.
- Design stance: show data with its source, never a score or a "buy this". We dislike AI-wrapper recommenders. AI may help collect and structure data, but every fact must link to a source a reader can open, with a verbatim quote.

## Done so far

**Data pipeline**
- Weekly bot (GitHub Actions) pulls public Shopify `/products.json` feeds from 8 stores: audio46, hifigo, bloomaudio, shenzhenaudio, linsoul, headphones.com, apos.audio, hangout.audio. It waits between requests.
- Builds `data/catalog.json`: 3,532 models (IEM 1,503 · desktop 815 · over-ear 711 · dongle 273 · DAP 136 · CD 43 · speakers 31 · power supplies 20).
- Specs are extracted by regex. Every value keeps the verbatim store line it came from, and is dropped unless that line re-parses to the same number.
- Classification:
  - DAC only / amp only / DAC+amp
  - Active vs passive speakers
  - Ports: USB, coax, optical, AES, BT, RCA, XLR, line
  - Switches and streaming: UAC1, NOS, ASIO, Roon Ready, AirPlay, Spotify/Tidal Connect, UPnP, Chromecast
  - DC input/output for power-supply matching
  - Materials, from store sentences only
- De-duplication across stores; brand-spelling merge.
- Hand-added models (`data/extra-items.json`) from makers' own pages, e.g. FiiO JadeAudio Gigas 1.
- Brand logos from Simple Icons (CC0), exact name matches only (11 brands); initials otherwise.

**Site**
- Home page (`#`): the three questions, a live builder result for three real setups (phone → Apple USB-C dongle → Blessing 3 / HD 600 / Cosmo), counts from the data, popular models, newest review summaries, and what Sotto doesn't do. The builder moved to `#build`. With that dongle, no headphone in the catalog with a known sensitivity unit comes out "not loud enough" at 80 dB.
- Chain builder:
  - Source: phone, computer, DAP, CD player or streamer
  - Then optional DAC → amp or DAC/amp → headphones
  - Checks every connection (digital or analog ports) and loudness using voltage/current maths
  - Zoomable voltage-vs-impedance chart
- Release calendar (`#calendar`): pre-orders as bars running to the date the store wrote (quote kept, e.g. "PRE-ORDER TILL OCT. 10TH."), and models by the first day any store published them (Shopify `published_at`). Parsing in `scripts/lib/dates.js`. Fills from the next crawl; until then the page says no dates yet.
- Extra store photos (ports, box, accessories): up to 12 links per model in `data/photos.json`, loaded only on item pages; still hotlinked from store CDNs, never copied.
- Spec sheet from labelled store lines ("Frequency Response: 12Hz-44kHz"): drivers, frequency response, THD, SNR, dynamic range, crosstalk, DAC/amp chip, PCM, DSD, Bluetooth, codecs, battery, connector, plug, cable, weight (`extractSheet` in `scripts/lib/specs.js`; first store per field wins). Display only; the drive maths still uses impedance/sensitivity/power.
- Catalog with filters; per-model pages; static SEO pages with OG images; compare page; glossary/learn pages (incl. UAC, NOS, WASAPI/ASIO, streaming protocols); brand A–Z.
- Regions (14): store search links, currency, local forum searches. Languages: th, en; ja/zh selectable but not translated yet.
- "Real price": code-stacking calculator for Shopee/Lazada vouchers; community "price I paid" reports with a redacted screenshot as evidence; China-market search links (Taobao etc.).

**Community (Supabase, RLS on everything)**
- Problem reports with a required evidence link, plus "me too" counts.
- Owner notes and corrections.
- Verified brand accounts can answer reports.
- Discussions (threads, comments, votes, photos, markdown), gallery of setups / dream setups, bookmarks, inbox.
- "I own this": structured owner form (months owned, QC on arrival, failure and when, ease 1–5, annoyances, would buy again). Shown as counts with n.
- Port reports from back-panel photos or links.
- Anonymous cookieless analytics (daily-salted hash, aggregate views only).
- Legal pages: terms, privacy (Thai PDPA), contact via GitHub issue forms (data corrections, takedowns, privacy, brand accounts, add-a-model).

**AI-assisted data entry**
- Supabase Edge Function `summarize`, using Gemini or Claude:
  - Drafts a problem report, ports list or model entry from text the user pastes.
  - Never fetches URLs.
  - Keeps only facts whose quote is found in the pasted text.
  - 20 drafts per user per day.
  - Review summaries come in th/en/ja/zh at once; quotes stay in the original language. Posts keep them in `reports.i18n` (run `supabase/i18n.sql`), and each viewer sees their own language. Posts the writer edited before posting stay in one language.
  - One review summary per reviewer per page per model: `reports.dedupe_key` with a unique index (run `supabase/dedupe.sql`). Repeats are skipped and counted, not errors.
- Review summaries also carry the reviewer's own verdict (1-3 quotes), how they got the unit, and every pro/con the reviewer listed (up to 8 each). "View original" shows the version in the review's own language.
- Posts list: chips by kind and source site, order (most confirmed / newest), 10 at a time; review summaries show the rating, verdict and unit lines and open pros/cons on click.
- SQL to run once, in order, after schema.sql: reviews.sql, i18n.sql, dedupe.sql, purchase.sql.
- Gemini app skill "sotto-review-extractor" (docs/gemini-skill.md):
  - Turns one review page into JSON "Sotto blocks": one per reviewer, pros/cons/problems/ports, each with a verbatim quote.
  - Pasting a block into the site fills the form ("review summary" post type) without any API call.
  - `scripts/blocks-to-sql.mjs` bulk-imports many blocks as "Sotto team (compiled from open sources)" posts, skipping any product that doesn't match exactly one catalog model.

## What's left

1. **Data is thin.** Few problem reports, owner reports, prices or port reports so far. This is the biggest issue.
2. **Specs missing for many models.** Many have no output power at a stated load, so they can't be calculated (e.g. FiiO K17, Gigas 1, whose maker states power with no load).
3. **Specs drawn as images.** Many Chinese brands put the spec table in a description image (made for Taobao etc.). Tested OCR (tesseract.js, free, no key) on a Moondrop Starfield III page: it reads the table only after inverting dark images and upscaling, and it misreads units: "7.7Ω±15%" came out as "7.701 15%", "Vrms" as "Nrms". Plan: OCR in CI only for models still missing specs, each image URL read once and cached, numbers plus image link stored (never the image). OCR values are labelled "read from image, unconfirmed" and never enter the drive maths until a second source agrees or a person confirms against the cropped image. Gemini vision is the more accurate later option (key in GitHub Secrets only).
4. Japanese and Chinese UI translation (~600 strings each; long pages like glossary and legal too).
5. Some remaining duplicate listings and misclassifications.
6. Speakers have no matching maths yet (we link to BuildHifi).
7. No email notifications (needs an Edge Function plus an email provider).
8. Moderation tooling beyond "report post" and RLS.

## What our tooling can't reach (where Gemini might help)

| Source | What's there | Problem for us |
|---|---|---|
| Head-Fi (showcase pages, manufacturer threads, reviews) | Specs from makers, long-term owner reports, failures, firmware notes | Bot check blocks our fetcher; Gemini's app can read it |
| Reddit (r/headphones, r/inearfidelity, r/budgetaudiophile) | Owner experience, QC, problems | API terms and paid access; we chose not to scrape |
| Audio Science Review | Measurements (SINAD, power at load), DC-protection tests | Forum; terms unclear for reuse; can link |
| Squig.link / CrinGraph databases, AutoEq | Frequency-response data | Licence of measurement data unclear (AutoEq code is MIT; data ownership not stated); many squig repos have no licence |
| Makers' sites (FiiO, Topping, Moondrop…) | Official specs, firmware changelogs (= acknowledged bugs) | Fine to read; no common format; some block bots |
| Shopee / Lazada / Taobao / JD | Real local prices, buyer reviews with photos | Terms forbid scraping; Taobao needs login; we use links and user-reported prices instead |
| Pantip, Facebook groups (Thai) | Local owner experience | Login walls, terms |

## Concerns we want any solution to respect

**Legal**
- **Copyright:** facts (a measured voltage, "has optical in") are fine to state with a link. Copying review text, photos or whole graphs is not. Short quotes as evidence, plus our own one-line summary and the link, is what we do now. Is that acceptable as quotation/fair use for a non-commercial open project? EU database rights may apply to bulk copies of a database (e.g. measurement sets).
- **What the sites' terms say (read Oct 2026, not legal advice):**
  - Head-Fi Terms of Service: "Head-Fi makes no claim of authorship or copyright ownership with respect to any post" — copyright stays with each reviewer. No scraping clause on that page. Head-Fi's sponsors include Moondrop, Linsoul, ShenzhenAudio and Headphones.com, so review posts now record how the reviewer got the unit (bought / free sample / loan, with the sentence that says so).
  - Audio Science Review (Terms and rules, Privacy, Cookies): members "retain copyright over the Content" and grant ASR a non-exclusive licence; no scraping clause, but the site is behind reCAPTCHA, so no automated fetching. The site itself is "Copyright © Audio Science Review LLC" — staff measurement reviews and their graphs are ASR's: link and quote numbers (e.g. SINAD) with the sentence, never copy graphs. ASR is XenForo, so the bookmarklet already splits its posts per author.
  - Reddit User Agreement §7: you may not "access, search, or collect data from the Services by any means (automated or otherwise) except as permitted"; crawling only per robots.txt; "scraping … without Reddit's prior written consent is prohibited". Users keep ownership of their posts. Our bookmarklet copies one page a person is reading, on their click; whether that counts as "collecting" is unclear. Never bulk-import Reddit (no blocks-to-sql runs, no automation).
- **Terms of service:** we don't scrape sites that forbid it or put up bot checks. Using another company's crawler (e.g. having Gemini fetch Head-Fi for us) to get around a bot check may still break the site's terms. We'd like a clear answer on what Gemini's URL-reading/grounding features permit for a third-party product.
- **Defamation:** defamation is a criminal offence in Thailand. Problem reports must come from real experience with evidence and must not overstate. AI summaries that soften or sharpen a reviewer's verdict are a real risk, so the quote requirement stays.
- **Personal data (Thai PDPA):** user screenshots are redacted in the browser before upload. Pasted text goes to an AI provider, and the privacy page says so (including that Gemini's free tier may use it for improvement).
- **Trademarks:** logos are used only for identification, with a note; no implied endorsement.
- **Store images:** product photos are loaded from the stores with a link back, not copied into our repo.

**Data quality**
- AI summaries without quotes are unreliable. Example: asked about Head-Fi's Blessing 3 reviews, the Gemini app gave a positive "community consensus". Meanwhile the review visible on the page was 2.5★ with harsh cons. It also contained claims we couldn't trace to that page.
- One reviewer ≠ consensus: keep posts per source, show counts with n, never compute a score.
- Free samples vs bought units are marked: the summariser reads bought / free sample / loan from the review, with the sentence that says so.

## What we'd like from Gemini

1. A way to turn Head-Fi/forum/maker pages into Sotto blocks at scale. It must keep verbatim quotes and per-reviewer separation, and stay within those sites' terms and Google's API terms. Is Gemini API "URL context" or Search grounding allowed for this? Can the returned quotes be checked against the page text?
2. Sources for missing specs (output power at a stated load, sensitivity with unit, output impedance) that allow reuse. Who should we ask for permission (e.g. squig.link owners, ASR) and what licence wording to request?
3. A plan to seed real owner data in Thailand and abroad without scraping: partnerships, embeds, contributor programmes, brand cooperation.
4. Anything in our legal approach above that is wrong or missing.
