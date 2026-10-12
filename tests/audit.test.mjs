import { test } from "node:test";
import assert from "node:assert/strict";
import { audit, regressions } from "../scripts/lib/audit.js";

const item = (id, extra = {}) => ({ id, brand: "iFi", model: id.split("--")[1], category: "desktop", offers: [{ title: id, image: "x" }], specs: {}, ...extra });

test("the ZEN DAC 3 case: USB-only power against the maker's DC inlet", () => {
  const cat = { stores: {}, items: [item("ifi--zen-3", { role: "dacamp", dcIn: { usb: true }, ports: { in: { dc: { quote: "USB-C or DC 5V/0.5A" } } } }), item("ifi--zen-can", { role: "amp", dcIn: { usb: true, barrel: true }, ports: { in: { dc: {} } } })] };
  assert.deepEqual(audit(cat).rules["USB-only power, yet the maker lists a DC inlet"].ids, ["ifi--zen-3"]);
});

test("a rule that jumps is a regression; small moves are noise", () => {
  const prev = { rules: { a: { n: 100 }, b: { n: 2 } } };
  assert.deepEqual(regressions(prev, { rules: { a: { n: 108 }, b: { n: 6 } } }), []);
  assert.deepEqual(regressions(prev, { rules: { a: { n: 120 }, b: { n: 9 } } }), [["a", 100, 120], ["b", 2, 9]]);
});
