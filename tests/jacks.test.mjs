import { test } from "node:test";
import assert from "node:assert/strict";
import { jackOutputs } from "../scripts/lib/jacks.js";
import { textify } from "../scripts/lib/specs.js";

const byJack = (outs) => Object.fromEntries(outs.map(({ jack, power, voltage, zout }) => [jack, { power, voltage, zout }]));

// Issue #2: iFi GO link Max at hifiheadphones.co.uk (jack words lead).
test("jack words before the figures, two jacks on one line", () => {
  const lines = textify("<p>Output Power: Balanced (4.4mm) ≥241mW at 32Ω; ≥4V at 300Ω / S-Balanced (3.5mm) ≥100mW at 32Ω; ≥2V at 300Ω</p>");
  assert.deepEqual(byJack(jackOutputs(lines, "dongle")), {
    "4.4": { power: [{ load: 32, mw: 241 }], voltage: [{ load: 300, vrms: 4 }], zout: null },
    "3.5": { power: [{ load: 32, mw: 100 }], voltage: [{ load: 300, vrms: 2 }], zout: null },
  });
});

// Issue #3: iFi GO Link 2 Max at audio46 (jack words trail, second jack on the next line).
test("jack words after the figures, continuation lines, output impedance per jack", () => {
  const lines = textify(
    "<table><tr><td>RMS OUTPUT POWER</td><td>≥241mW @ 32Ω; 4V @ 300Ω (Balanced);<br>≥100mW @ 32Ω; 2V @ 300Ω (S-Balanced*)</td></tr>" +
      "<tr><td>OUTPUT IMPEDANCE</td><td>&lt;0.7Ω (Balanced);<br>&lt;0.35Ω (S-Balanced*)</td></tr>" +
      "<tr><td>SNR &amp; DNR</td><td>≥130dBA (Balanced @ 600Ω);<br>≥125dBA (S-Balanced @ 600Ω)</td></tr></table>",
  );
  assert.deepEqual(byJack(jackOutputs(lines, "dongle")), {
    "4.4": { power: [{ load: 32, mw: 241 }], voltage: [{ load: 300, vrms: 4 }], zout: 0.7 },
    "3.5": { power: [{ load: 32, mw: 100 }], voltage: [{ load: 300, vrms: 2 }], zout: 0.35 },
  });
});

test("iFi's own wording: 'via 4.4mm'", () => {
  const lines = textify("<p>RMS OUTPUT POWER: 241mW @ 32Ω; 4V @ 300Ω via 4.4mm</p><p>100mW @ 32Ω; 2V @ 300Ω via 3.5mm</p><p>OUTPUT IMPEDANCE: 0.35Ω via 4.4mm; 0.7Ω via 3.5mm</p>");
  const o = byJack(jackOutputs(lines, "dongle"));
  assert.equal(o["4.4"].zout, 0.35);
  assert.equal(o["3.5"].zout, 0.7);
  assert.deepEqual(o["3.5"].power, [{ load: 32, mw: 100 }]);
});

test("figures that can't be tied to a jack give nothing (no guessing)", () => {
  assert.equal(jackOutputs(textify("<p>Output Power: 120mW @ 32Ω, 4.4mm: 240mW @ 32Ω</p>"), "dongle"), null);
  // High/low gain on one jack is not two jacks.
  assert.equal(jackOutputs(textify("<p>Output Power: 300mW @ 32Ω (high gain); 100mW @ 32Ω (low gain)</p>"), "dongle"), null);
  // A single named jack is no improvement on the plain reading.
  assert.equal(jackOutputs(textify("<p>Output Power: 3.5mm 120mW @ 32Ω</p>"), "dongle"), null);
});

test("desktop: bare 'single-ended' / 'balanced' don't name a jack", () => {
  assert.equal(jackOutputs(textify("<p>Output Power: Balanced 2W @ 32Ω / Single-ended 1W @ 32Ω</p>"), "desktop"), null);
  const o = byJack(jackOutputs(textify("<p>Output Power: 6.35mm 1000mW @ 32Ω / 4.4mm 2W @ 32Ω</p>"), "desktop"));
  assert.deepEqual(o["6.35"].power, [{ load: 32, mw: 1000 }]);
  assert.deepEqual(o["4.4"].power, [{ load: 32, mw: 2000 }]);
});
