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
- Chain builder:
  - Source: phone, computer, DAP, CD player or streamer
  - Then optional DAC → amp or DAC/amp → headphones
  - Checks every connection (digital or analog ports) and loudness using voltage/current maths
  - Zoomable voltage-vs-impedance chart
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
- Gemini app skill "sotto-review-extractor" (docs/gemini-skill.md):
  - Turns one review page into JSON "Sotto blocks": one per reviewer, pros/cons/problems/ports, each with a verbatim quote.
  - Pasting a block into the site fills the form ("review summary" post type) without any API call.
  - `scripts/blocks-to-sql.mjs` bulk-imports many blocks as "Sotto team (compiled from open sources)" posts, skipping any product that doesn't match exactly one catalog model.

## What's left

1. **Data is thin.** Few problem reports, owner reports, prices or port reports so far. This is the biggest issue.
2. **Specs missing for many models.** Many have no output power at a stated load, so they can't be calculated (e.g. FiiO K17, Gigas 1, whose maker states power with no load).
3. Japanese and Chinese UI translation (~600 strings each; long pages like glossary and legal too).
4. Some remaining duplicate listings and misclassifications.
5. Speakers have no matching maths yet (we link to BuildHifi).
6. No email notifications (needs an Edge Function plus an email provider).
7. Moderation tooling beyond "report post" and RLS.

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
- **Terms of service:** we don't scrape sites that forbid it or put up bot checks. Using another company's crawler (e.g. having Gemini fetch Head-Fi for us) to get around a bot check may still break the site's terms. We'd like a clear answer on what Gemini's URL-reading/grounding features permit for a third-party product.
- **Defamation:** defamation is a criminal offence in Thailand. Problem reports must come from real experience with evidence and must not overstate. AI summaries that soften or sharpen a reviewer's verdict are a real risk, so the quote requirement stays.
- **Personal data (Thai PDPA):** user screenshots are redacted in the browser before upload. Pasted text goes to an AI provider, and the privacy page says so (including that Gemini's free tier may use it for improvement).
- **Trademarks:** logos are used only for identification, with a note; no implied endorsement.
- **Store images:** product photos are loaded from the stores with a link back, not copied into our repo.

**Data quality**
- AI summaries without quotes are unreliable. Example: asked about Head-Fi's Blessing 3 reviews, the Gemini app gave a positive "community consensus". Meanwhile the review visible on the page was 2.5★ with harsh cons. It also contained claims we couldn't trace to that page.
- One reviewer ≠ consensus: keep posts per source, show counts with n, never compute a score.
- Free samples vs bought units should be marked (we have a field).

## What we'd like from Gemini

1. A way to turn Head-Fi/forum/maker pages into Sotto blocks at scale. It must keep verbatim quotes and per-reviewer separation, and stay within those sites' terms and Google's API terms. Is Gemini API "URL context" or Search grounding allowed for this? Can the returned quotes be checked against the page text?
2. Sources for missing specs (output power at a stated load, sensitivity with unit, output impedance) that allow reuse. Who should we ask for permission (e.g. squig.link owners, ASR) and what licence wording to request?
3. A plan to seed real owner data in Thailand and abroad without scraping: partnerships, embeds, contributor programmes, brand cooperation.
4. Anything in our legal approach above that is wrong or missing.
