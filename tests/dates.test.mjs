import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, preorder, listedAt } from "../scripts/lib/dates.js";

const seen = "2026-10-11T00:00:00Z";

test("store pre-order wording", () => {
  assert.equal(parseDate("MM3A (PRE-ORDER TILL OCT. 10TH.)", "2026-09-20T00:00:00Z"), "2026-10-10");
  assert.equal(parseDate("ENGLISH (PRE ORDER STATUS UNTIL MARCH 10TH. 2027)", seen), "2027-03-10");
  assert.equal(parseDate("Pre-order, ships 2026-11-05", seen), "2026-11-05");
  assert.equal(parseDate("Presale ends 15 November", seen), "2026-11-15");
});

test("a date without a year rolls to next year only when long past", () => {
  assert.equal(parseDate("pre-order till Oct 1", seen), "2026-10-01");
  assert.equal(parseDate("pre-order till Jan 20", seen), "2027-01-20");
});

test("preorder keeps the quote and ignores normal variants", () => {
  const p = { title: "Moondrop MM3A", variants: [{ title: "Black" }, { title: "White (Pre-order till Oct. 10th.)" }] };
  assert.deepEqual(preorder(p, "2026-09-20T00:00:00Z"), { until: "2026-10-10", quote: "White (Pre-order till Oct. 10th.)" });
  assert.equal(preorder({ title: "Blessing 3", variants: [{ title: "Default Title" }] }, seen), null);
  assert.deepEqual(preorder({ title: "X [Pre-sale]", variants: [{ title: "Default Title" }] }, seen), { until: null, quote: "X [Pre-sale]" });
  // "preorder" inside an unrelated word or price note is not enough.
  assert.equal(preorder({ title: "Order now", variants: [{ title: "Default Title" }] }, seen), null);
});

test("listedAt prefers published over created", () => {
  assert.equal(listedAt({ publishedAt: "2026-09-01T10:00:00-04:00", createdAt: "2026-08-01T00:00:00Z" }), "2026-09-01");
  assert.equal(listedAt({ createdAt: "2026-08-01T00:00:00Z" }), "2026-08-01");
  assert.equal(listedAt({}), null);
});
