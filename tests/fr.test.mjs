import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFR, dbAt, normalize, smooth } from "../src/fr.js";

// Made-up test curves (not anyone's measurement): flat, with a +5 dB bass shelf.
const flat = Array.from({ length: 50 }, (_, i) => 20 * Math.pow(1000, i / 49));
const shelf = (f) => (f < 100 ? 5 : f < 200 ? 5 - 5 * Math.log2(f / 100) : 0);

test("REW / squig.link text: comments skipped, spaces or tabs", () => {
  const txt = `* Measurement data\n* Freq(Hz) SPL(dB) Phase\n${flat.map((f) => `${f.toFixed(3)} ${(80 + shelf(f)).toFixed(2)} 0.0`).join("\n")}`;
  const c = parseFR(txt);
  assert.equal(c.length, 50);
  assert.ok(Math.abs(dbAt(c, 20) - 85) < 0.01);
  assert.ok(Math.abs(dbAt(c, 1000) - 80) < 0.01);
  assert.equal(parseFR("20\t70\n1000\t80").length, 2);
});

test("AutoEq CSV: header row, the raw column is used", () => {
  const csv = `frequency,raw,smoothed,error\n20.00,3.50,3.40,1.0\n1000.00,0.00,0.10,0.0\n10000.00,-2.00,-1.90,0.5`;
  const c = parseFR(csv);
  assert.deepEqual(c.map((p) => p.db), [3.5, 0, -2]);
});

test("European decimal commas with spaces or semicolons", () => {
  assert.deepEqual(parseFR("20,5 71,25\n1000,0 80,0").map((p) => p.db), [71.25, 80]);
  assert.deepEqual(parseFR("20,5;71,25\n1000;80").map((p) => p.f), [20.5, 1000]);
});

test("normalize to 0 dB at 1 kHz, then smoothing keeps a shelf's shape", () => {
  const c = normalize(parseFR(flat.map((f) => `${f} ${80 + shelf(f)}`).join("\n")));
  assert.ok(Math.abs(dbAt(c, 1000)) < 1e-9);
  assert.ok(Math.abs(dbAt(c, 30) - 5) < 0.01);
  const s = smooth(c, 6);
  assert.equal(s.length, 240);
  assert.ok(Math.abs(dbAt(s, 5000)) < 0.2);
});

test("garbage in, nothing out", () => {
  assert.equal(parseFR("hello\nworld").length, 0);
  assert.equal(parseFR("").length, 0);
});
