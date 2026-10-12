import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "../scripts/lib/conflicts.js";

const e = (value, url, extra = {}) => ({ value, kind: "claimed", sources: [{ url }], ...extra });
const store = "https://audio46.com/products/x";

test("rounding and the other unit are not a disagreement", () => {
  const specs = {
    impedance: [e(32, store), e(32.5, "https://linsoul.com/x")],
    sensitivity: [e(102, store, { unit: "dB/mW" }), e(117, "https://hifigo.com/x", { unit: "dB/V" })],
  };
  assert.deepEqual(settle(specs, "Moondrop"), []);
});

test("the maker's page settles a disagreement and goes first", () => {
  const specs = { impedance: [e(16, store), e(16, "https://bloomaudio.com/x"), e(32, "https://moondroplab.com/en/products/x")] };
  assert.deepEqual(settle(specs, "Moondrop"), []);
  assert.equal(specs.impedance[0].value, 32);
});

test("no maker value: the field is marked, not decided by vote", () => {
  const specs = { sensitivity: [e(110, store, { unit: "dB/mW" }), e(110, "https://hifigo.com/x", { unit: "dB/mW" }), e(98, "https://linsoul.com/x", { unit: "dB/mW" })], impedance: [e(32, store)] };
  assert.deepEqual(settle(specs, "Kiwi Ears"), ["sensitivity"]);
});

test("a measured or hand-checked value settles it too", () => {
  const specs = { impedance: [e(300, store), e(150, "https://hifigo.com/x", { kind: "measured" })] };
  assert.deepEqual(settle(specs, "Sennheiser"), []);
  assert.equal(specs.impedance[0].value, 150);
});

test("unit unknown takes no side", () => {
  const specs = { impedance: [e(32, store)], sensitivity: [e(105, store), e(110, "https://hifigo.com/x", { unit: "dB/mW" })] };
  assert.deepEqual(settle(specs, "X"), []);
});
