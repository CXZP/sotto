import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dbPerMwToDbPerV,
  dbPerVToDbPerMw,
  required,
  availableVrms,
  powerCheck,
  outputImpedanceCheck,
  plugInto,
  bestConnection,
  headphoneSpecs,
} from "../src/calc.js";

const close = (actual, expected, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected} ± ${tol}, got ${actual}`);

test("dB/mW ↔ dB/V conversion", () => {
  // 1 V into 1000 Ω is exactly 1 mW, so both units agree.
  close(dbPerMwToDbPerV(100, 1000), 100);
  // 1 V into 32 Ω is 31.25 mW → +14.95 dB.
  close(dbPerMwToDbPerV(100, 32), 114.95);
  close(dbPerVToDbPerMw(dbPerMwToDbPerV(96, 250), 250), 96);
});

test("Simgot EA500LM: the two published sensitivities agree after conversion", () => {
  // 107 dB/mW at 21 Ω should be ~123.8 dB/V; Simgot says 123–124 dB/V.
  close(dbPerMwToDbPerV(107, 21), 123.78, 0.01);
});

test("required voltage, current, power", () => {
  // HD 600: 97 dB/V, 300 Ω. 100 dB needs +3 dB over 1 V.
  const r = required(100, 97, 300);
  close(r.vrms, 1.4125, 0.001);
  close(r.ma, 4.708, 0.01);
  close(r.mw, 6.65, 0.01);
});

test("available voltage at a rated load is exact", () => {
  const ka3se = { power: [{ load: 32, mw: 130 }, { load: 300, mw: 14 }], vmax: 2, zout: 0.5 };
  const a = availableVrms(ka3se, 32);
  close(a.vrms, Math.sqrt(0.13 * 32));
  assert.equal(a.method, "rated");
});

test("available voltage interpolates on log-log axes", () => {
  const out = { power: [{ load: 16, mw: 120 }, { load: 32, mw: 240 }] };
  // V(16) = 1.386, V(32) = 2.771 → V ~ R^1 → V(18) ≈ 1.559
  const a = availableVrms(out, 18);
  close(a.vrms, 1.559, 0.002);
  assert.equal(a.method, "interpolated");
});

test("below the lowest rated load the output is treated as current-limited", () => {
  const out = { power: [{ load: 32, mw: 120 }] };
  const a = availableVrms(out, 16);
  close(a.vrms, Math.sqrt(0.12 * 32) / 2);
});

test("above the highest rated load voltage rises only up to vmax", () => {
  const out = { power: [{ load: 32, mw: 120 }], vmax: 4 };
  close(availableVrms(out, 300).vrms, 4);
  // Without vmax we stay at the last rated voltage.
  close(availableVrms({ power: [{ load: 32, mw: 120 }] }, 300).vrms, Math.sqrt(0.12 * 32));
});

test("voltage-per-load ratings work like power ratings", () => {
  // iBasso DC04 Pro balanced: 3 Vrms @ 32 Ω, 4 Vrms @ 300 Ω
  const out = { voltage: [{ load: 32, vrms: 3 }, { load: 300, vrms: 4 }] };
  close(availableVrms(out, 32).vrms, 3);
  close(availableVrms(out, 300).vrms, 4);
  const mid = availableVrms(out, 100).vrms;
  assert.ok(mid > 3 && mid < 4);
});

test("vmax-only outputs apply the output-impedance voltage divider", () => {
  const apple = { vmax: 0.5, zout: 0.3 };
  close(availableVrms(apple, 18).vrms, (0.5 * 18) / 18.3);
});

test("Mac headphone jack switches voltage by load", () => {
  const mac = { vrules: [{ maxLoad: 150, vrms: 1.25 }, { maxLoad: 1000, vrms: 3 }] };
  close(availableVrms(mac, 32).vrms, 1.25);
  close(availableVrms(mac, 300).vrms, 3);
});

const hd600 = {
  impedance: [{ value: 300, kind: "claimed" }],
  sensitivity: [{ value: 97, unit: "dB/V", kind: "claimed" }],
  driver: "dynamic",
};
const chu2 = {
  impedance: [{ value: 18, kind: "claimed" }],
  sensitivity: [{ value: 119, unit: "dB/V", kind: "claimed" }],
  driver: "dynamic",
};

test("HD 600 on the Apple A2155 dongle is not enough", () => {
  const r = powerCheck(hd600, { vmax: 0.5, zout: 0.3 }, { level: 80, crest: 15 });
  // 0.5 V into 300 Ω reaches about 91 dB; 80 dB average fits, 95 dB peaks do not.
  close(r.maxSpl, 90.97, 0.01);
  assert.equal(r.status, "tight");
});

test("Chu II on the Apple A2155 dongle is plenty", () => {
  const r = powerCheck(chu2, { vmax: 0.5, zout: 0.3 }, { level: 80, crest: 15 });
  assert.equal(r.status, "ok");
  assert.ok(r.peakMargin > 15);
});

test("very sensitive IEM on a big desktop amp is flagged as overkill", () => {
  const dx5bal = { power: [{ load: 16, mw: 7600 }, { load: 32, mw: 6400 }] };
  const r = powerCheck(chu2, dx5bal, { level: 80, crest: 15 });
  assert.equal(r.status, "overkill");
  assert.ok(r.maxSpl > 130);
});

test("a big margin alone is not overkill: HD 600 on a desktop amp is normal", () => {
  const dx5bal = { power: [{ load: 300, mw: 990 }, { load: 600, mw: 490 }] };
  const r = powerCheck(hd600, dx5bal, { level: 80, crest: 15 });
  assert.equal(r.status, "ok"); // reaches ~122 dB max
});

test("measured sensitivity is preferred over claimed", () => {
  const xs = {
    impedance: [{ value: 18, kind: "claimed" }],
    sensitivity: [
      { value: 92, unit: "dB/mW", kind: "claimed" },
      { value: 105.4, unit: "dB/V", kind: "measured" },
    ],
  };
  close(headphoneSpecs(xs).dbPerV, 105.4);
});

test("1/8 rule", () => {
  const blessing3 = { impedance: [{ value: 14.8, kind: "claimed" }], driver: "hybrid" };
  assert.equal(outputImpedanceCheck(blessing3, { zout: 2.4 }).status, "warn-strong");
  assert.equal(outputImpedanceCheck(blessing3, { zout: 0.7 }).status, "ok");
  assert.equal(outputImpedanceCheck(hd600, { zout: null }).status, "unknown");
});

test("plug compatibility and adapter safety", () => {
  assert.equal(plugInto("3.5", "3.5").status, "direct");
  assert.equal(plugInto("3.5", "6.35").status, "adapter");
  assert.equal(plugInto("4.4", "3.5").status, "adapter"); // balanced cable into SE jack: safe
  assert.equal(plugInto("3.5", "4.4").status, "danger"); // SE plug into balanced jack: risky
  assert.equal(plugInto("4.4", "xlr4").status, "adapter");
});

test("best connection prefers a direct, then balanced, path", () => {
  const outputs = [{ jack: "6.35" }, { jack: "4.4" }, { jack: "xlr4" }];
  assert.equal(bestConnection("4.4", outputs).output.jack, "4.4");
  assert.equal(bestConnection("3.5", outputs).output.jack, "6.35");
});
