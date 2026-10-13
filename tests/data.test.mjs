import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceOutputs } from "../src/data.js";

test("store-only power: several output impedances on one page keep the highest (FiiO BTR17: <1 Ω SE, <1.5 Ω BAL)", () => {
  const src = [{ url: "https://audio46.com/products/fiio-btr17", quote: "" }];
  const item = {
    specs: {
      power: [{ load: 16, mw: 480, sources: src }, { load: 16, mw: 330, sources: src }],
      zout: [{ value: 1, sources: src }, { value: 1.5, sources: src }],
    },
  };
  const [o] = sourceOutputs(item);
  assert.equal(o.zout, 1.5);
  assert.deepEqual(o.power, [{ load: 16, mw: 480 }]);
});
