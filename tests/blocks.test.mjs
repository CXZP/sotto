import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks, reviewPost, reviewPostI18n, problemPosts } from "../src/blocks.js";

const sample = `Here you go:
\`\`\`json
{"sotto": 1, "product": "Moondrop Blessing 3", "source": "https://www.head-fi.org/showcase/moondrop-blessing-3.26409/reviews",
 "reviewer": "monkonomics", "date": "2026-03-11", "rating": "2.5/5", "summary": "เบสฟุ้งเมื่อเพลงแน่น เสียงกลางบาง",
 "pros": [{"point": "บิลด์แน่น", "quote": "Overall build feels solid and well put together"}, {"point": "no quote"}],
 "cons": [{"point": "เสียงกลางบาง", "quote": "Midrange often comes across thin and underfed"}],
 "problems": [], "ports_in": ["usb", "hdmi"], "features": ["nos"]}
\`\`\`
{"sotto": 1, "product": "X", "source": "http://insecure", "pros": [], "cons": []}`;

test("parses fenced and bare blocks, drops unquoted points and unknown ports", () => {
  const b = parseBlocks(sample);
  assert.equal(b.length, 2);
  assert.equal(b[0].pros.length, 1);
  assert.deepEqual(b[0].ports_in, ["usb"]);
  assert.equal(b[1].source, "");
});

test("review post keeps the rating and the quotes", () => {
  const { title, body } = reviewPost(parseBlocks(sample)[0]);
  assert.match(title, /เบสฟุ้ง/);
  assert.match(body, /2\.5\/5/);
  assert.match(body, /“Midrange often comes across thin and underfed”/);
  assert.equal(problemPosts(parseBlocks(sample)[0]).length, 0);
});

test("review post in every translated language, quotes kept as written", () => {
  const b = {
    ...parseBlocks(sample)[0],
    summary_i18n: { th: "เบสฟุ้ง", en: "Boomy bass", ja: "低音がこもる", zh: "低音浑浊" },
    pros: [{ point: "บิลด์แน่น", point_i18n: { en: "Solid build", ja: "作りが良い", zh: "做工扎实" }, quote: "Overall build feels solid and well put together" }],
  };
  const all = reviewPostI18n(b);
  assert.deepEqual(Object.keys(all), ["th", "en", "ja", "zh"]);
  assert.match(all.zh.title, /^低音浑浊/);
  assert.match(all.zh.body, /优点\n- 做工扎实 — “Overall build feels solid/);
  assert.match(all.th.body, /- บิลด์แน่น —/);
  assert.equal(reviewPostI18n(parseBlocks(sample)[0]), null);
});

test("verdict line under the credit, and the review's own language kept for 'view original'", () => {
  const b = {
    ...parseBlocks(sample)[0],
    source_lang: "en",
    summary_i18n: { th: "เบสฟุ้ง", en: "Boomy bass" },
    verdict: { point: "เกรด B-", point_i18n: { en: "Grade B-, not at retail" }, quote: "Will I buy it at retail? Absolutely not." },
  };
  const all = reviewPostI18n(b);
  assert.equal(all._src, "en");
  assert.match(all.en.body, /^★ 2\.5\/5 · Review by monkonomics.*\nVerdict: Grade B-, not at retail — “Will I buy it at retail\? Absolutely not\.”/);
  assert.match(all.th.body, /\nสรุปของผู้รีวิว: เกรด B- — /);
});

test("one-word points show their quote once; a verdict can carry several quotes", () => {
  const b = {
    ...parseBlocks(sample)[0],
    pros: [{ point: "Detailed", quote: "Detailed" }],
    verdict: { point: "B-, not at retail", quote: "I grade the Blessing 3 a B-.", quotes: ["I grade the Blessing 3 a B-.", "Will I buy it at retail? Absolutely not."] },
  };
  const { body } = reviewPost(b, { pros: "Pros", cons: "Cons", by: "Review by", verdict: "Verdict" });
  assert.match(body, /\n- “Detailed”\n/);
  assert.match(body, /Verdict: B-, not at retail — “I grade the Blessing 3 a B-\.” “Will I buy it at retail\? Absolutely not\.”/);
});
