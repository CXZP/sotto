import { test } from "node:test";
import assert from "node:assert/strict";
import { appendHistory } from "../scripts/lib/history.js";

const item = (price, available = true, extra = []) => ({
  id: "moondrop--blessing-3",
  offers: [{ store: "hifigo", price, available, condition: "new" }, ...extra],
});

test("records only changes", () => {
  let h = appendHistory({}, [item(319)], "2026-10-12");
  h = appendHistory(h, [item(319)], "2026-10-19");
  h = appendHistory(h, [item(289)], "2026-10-26");
  h = appendHistory(h, [item(289, false)], "2026-11-02");
  assert.deepEqual(h["moondrop--blessing-3"].hifigo, [
    ["2026-10-12", 319, 1],
    ["2026-10-26", 289, 1],
    ["2026-11-02", 289, 0],
  ]);
});

test("same day overwrites, used and suspect listings are ignored", () => {
  let h = appendHistory({}, [item(319)], "2026-10-12");
  h = appendHistory(h, [item(299, true, [{ store: "hifigo", price: 99, available: true, condition: "used" }, { store: "linsoul", price: 5, available: true, condition: "new", suspect: true }])], "2026-10-12");
  assert.deepEqual(h["moondrop--blessing-3"], { hifigo: [["2026-10-12", 299, 1]] });
});

test("does not mutate the previous history", () => {
  const prev = appendHistory({}, [item(319)], "2026-10-12");
  appendHistory(prev, [item(1)], "2026-10-19");
  assert.equal(prev["moondrop--blessing-3"].hifigo.length, 1);
});
