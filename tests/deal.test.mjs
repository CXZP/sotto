import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCode, capPoint, combos, parseCode, encodeCode, decodeCode, landed, summarize } from "../src/deal.js";

test("percentage code respects min spend and cap", () => {
  const code = { kind: "platform", pct: 30, min: 954, cap: 4000 };
  assert.deepEqual(applyCode(1590, code), { eligible: true, discount: 477, capped: false });
  assert.equal(applyCode(900, code).eligible, false);
  assert.equal(applyCode(900, code).shortfall, 54);
  assert.equal(applyCode(20000, code).discount, 4000);
  assert.equal(applyCode(20000, code).capped, true);
  assert.equal(capPoint(code), 13333.33);
});

test("shop code applies before the platform code's min spend", () => {
  const codes = [
    { kind: "shop", off: 100, min: 500 },
    { kind: "platform", pct: 15, min: 1000, cap: 300 },
  ];
  // 1050 - 100 = 950 < 1000, so stacking both is invalid; the best valid choice is the platform code alone.
  const best = combos(1050, codes)[0];
  assert.equal(best.valid, true);
  assert.equal(best.shop, null);
  assert.equal(best.final, 892.5);
});

test("a capped big code can lose to a smaller uncapped one", () => {
  const codes = [
    { kind: "platform", pct: 30, min: 0, cap: 300 },
    { kind: "platform", pct: 20, min: 0, cap: 2000 },
  ];
  const best = combos(5000, codes)[0];
  assert.equal(best.platform.pct, 20);
  assert.equal(best.final, 4000);
});

test("parses codes as Thai and English apps print them", () => {
  assert.deepEqual(parseCode("ลด 30% ขั้นต่ำ ฿954 ลดสูงสุด ฿4,000"), { kind: "platform", pct: 30, min: 954, cap: 4000 });
  assert.deepEqual(parseCode("15% off min spend 500 capped at 300", "shop"), { kind: "shop", pct: 15, min: 500, cap: 300 });
  assert.deepEqual(parseCode("ลด ฿200 ขั้นต่ำ ฿1k"), { kind: "platform", off: 200, min: 1000 });
  assert.equal(parseCode("free shipping"), null);
});

test("codes round-trip through the URL form", () => {
  for (const c of [
    { kind: "platform", pct: 30, min: 954, cap: 4000 },
    { kind: "shop", off: 200, min: 1000 },
    { kind: "shop", pct: 5 },
  ])
    assert.deepEqual(decodeCode(encodeCode(c)), c);
});

test("landed price uses only the rate given", () => {
  assert.equal(landed({ price: 100, rate: 0 }), null);
  assert.deepEqual(landed({ price: 100, shipping: 20, rate: 5, extraPct: 10 }), { base: 600, extra: 60, total: 660 });
});

test("summaries keep ranges per channel and currency", () => {
  const s = summarize([
    { channel: "shopee", currency: "THB", amount: 1100, paid_on: "2026-10-10" },
    { channel: "shopee", currency: "THB", amount: 1300, paid_on: "2026-09-09" },
    { channel: "shopee", currency: "THB", amount: 1200, paid_on: "2026-08-08" },
    { channel: "taobao", currency: "CNY", amount: 699.9, paid_on: "2026-10-01" },
  ]);
  assert.equal(s[0].channel, "shopee");
  assert.deepEqual([s[0].min, s[0].median, s[0].max, s[0].n], [1100, 1200, 1300, 3]);
  assert.equal(s[0].first, "2026-08-08");
  assert.equal(s[1].currency, "CNY");
});
