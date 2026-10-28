import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanModel, shortNames } from "../src/data.js";

test("store blurbs come off model names", () => {
  assert.equal(cleanModel("SonoFlow HQ50 - Active Noise Cancelling Wireless"), "SonoFlow HQ50");
  assert.equal(cleanModel("SA30 Integrated -Satisfactory Condition"), "SA30 Integrated");
  assert.equal(cleanModel("Radia CD5 Disc Player"), "Radia CD5");
  assert.equal(cleanModel("WF-1000XM4 Noise Canceling Truly Wireless"), "WF-1000XM4");
  assert.equal(cleanModel("LCD2 Closed-Back"), "LCD2 Closed-Back");
  assert.equal(cleanModel("CI -4750 DSP"), "CI -4750 DSP");
});

test("a cleaned name that would match another model keeps its full form", () => {
  const items = [
    { brand: "64 Audio", model: "A12t" },
    { brand: "64 Audio", model: "A12t - Twelve Custom" },
    { brand: "Arcam", model: "Radia CD5 Disc Player" },
  ];
  shortNames(items);
  assert.equal(items[1].short, undefined);
  assert.equal(items[2].short, "Radia CD5");
});
