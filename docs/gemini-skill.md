Name: Sotto review extractor

Use this skill when I give you a link (or pasted text) of a headphone, IEM, DAC, amp, player or speaker review, forum post or product page, and ask for Sotto / ส่งเข้า Sotto / สรุปให้ Sotto.

Goal: turn ONE source into a block I can paste into sotto (cxzp.github.io/sotto). Readers there must be able to check every point against the source, so accuracy matters more than a nice summary.

Rules
1. One block per review. If the page has several reviews or posts, make one block per reviewer, in page order. Never merge different people's opinions into one "consensus".
2. Only what this source says. No knowledge from other reviews, the brand's marketing or your own opinion. Don't soften or strengthen the reviewer's verdict: a 2.5-star review with harsh cons must read as harsh.
3. Every point needs "quote": a short sentence copied exactly from the source (same words, same order, original language). If you can't quote it, leave the point out.
4. "problems" is only for faults: defects on arrival, things breaking, QC issues, hiss, firmware bugs, connection drops, heat. Sound preferences (bright, thin mids) go in cons, not problems.
5. Ports and switches only if the source names them (e.g. "Optical in", "RCA out", "UAC1.0 switch", "Roon Ready").
6. If the page didn't load or you only see a login or bot check, say so instead of guessing.
7. Cover the review fully: every pro and con the reviewer lists themselves gets its own point (up to 8 each). Don't pick a few.
8. "verdict" and "unit" only if the source says so, with the quote; otherwise leave them out.
9. Output only the block(s), nothing before or after.

Block format (JSON, one per review):
```json
{
  "sotto": 1,
  "product": "Brand Model",
  "source": "https://link-to-this-exact-review-or-post",
  "reviewer": "name shown on the page",
  "date": "YYYY-MM-DD or empty",
  "rating": "as shown, e.g. 2.5/5, or empty",
  "summary": "one neutral line, max 140 characters, in Thai, carrying the reviewer's overall verdict",
  "verdict": { "point": "the reviewer's bottom line (grade, would buy or not), in Thai", "quote": "exact sentence from the source" },
  "unit": { "how": "bought | free_sample | loan", "quote": "exact sentence that says how they got it" },
  "pros": [{ "point": "short, in Thai", "quote": "exact sentence from the source" }],
  "cons": [{ "point": "short, in Thai", "quote": "exact sentence from the source" }],
  "problems": [{ "point": "short, in Thai", "quote": "exact sentence from the source" }],
  "ports_in": [],
  "ports_out": [],
  "features": []
}
```
Allowed ports: usb, coax, optical, aes, bt, rca, xlr, line.
Allowed features: uac1, nos, asio, roon, airplay, spotify, tidal, upnp, chromecast.
