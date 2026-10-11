import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSheet } from "../scripts/lib/specs.js";

test("table rows become sheet values", () => {
  const html = `<table><tr><td>Frequency Response</td><td>20Hz-40kHz</td></tr><tr><td>Driver</td><td>10mm DLC dynamic driver</td></tr><tr><td>Cable Connector</td><td>0.78mm 2-pin</td></tr><tr><td>Plug</td><td>3.5mm single-ended</td></tr></table>`;
  const s = extractSheet(html);
  assert.equal(s.freq.value, "20Hz-40kHz");
  assert.equal(s.driver.value, "10mm DLC dynamic driver");
  assert.equal(s.connector.value, "0.78mm 2-pin");
  assert.equal(s.plug.value, "3.5mm single-ended");
});

test("list lines for a DAC/amp", () => {
  const html = `<ul><li>DAC Chip: CS43198 x2</li><li>THD+N: 0.0004%</li><li>SNR: 128dB</li><li>PCM: 32bit/768kHz</li><li>DSD: DSD512</li><li>Weight: 13g</li><li>Bluetooth Version: 5.1</li><li>Supported Codecs: LDAC, aptX HD, AAC</li></ul>`;
  const s = extractSheet(html);
  assert.equal(s.dac.value, "CS43198 x2");
  assert.equal(s.thd.value, "0.0004%");
  assert.equal(s.snr.value, "128dB");
  assert.equal(s.pcm.value, "32bit/768kHz");
  assert.equal(s.dsd.value, "DSD512");
  assert.equal(s.weight.value, "13g");
  assert.equal(s.bt.value, "5.1");
  assert.equal(s.codec.value, "LDAC, aptX HD, AAC");
});

test("first match wins, prose and unlabelled lines are skipped", () => {
  const html = `<p>The driver: a marvel of engineering that took us three years to perfect and which we are very proud of, delivering detail and warmth across the whole range of music you love.</p><p>Frequency response: 5Hz-40kHz</p><p>Frequency response: 20Hz-20kHz</p><p>Great bass</p>`;
  const s = extractSheet(html);
  assert.equal(s.freq.value, "5Hz-40kHz");
  assert.equal(s.driver, undefined);
});

test("labels after a '>' bullet (HiFiGo)", () => {
  const s = extractSheet("<p>&gt;Driver Configuration: 24 BA Per Side.</p><p>&gt;Frequency Response Range: 7Hz~35kHz.</p><p>&gt;Connector Type: 0.78mm 2-Pin Connectors.</p><p>&gt;Termination Plug: 3.5mm+4.4mm.</p>");
  assert.equal(s.driver.value, "24 BA Per Side");
  assert.equal(s.freq.value, "7Hz~35kHz");
  assert.equal(s.connector.value, "0.78mm 2-Pin Connectors");
  assert.equal(s.plug.value, "3.5mm+4.4mm");
});

import { extractSpecs, verify } from "../scripts/lib/specs.js";

test("number before the label (Audio46)", () => {
  const { specs, lines } = extractSpecs("<ul><li>34 ohm impedance at 1kHz</li><li>113dB sensitivity at 1kHz</li></ul>");
  assert.equal(specs.impedance[0].value, 34);
  assert.equal(specs.sensitivity[0].value, 113);
  assert.ok(verify("impedance", specs.impedance[0], lines).ok);
});

test("specs inside a long paragraph quote just the sentence", () => {
  const para = `Staying true to the heritage of the Starfield lineup, the Starfield 3 features an eye-catching shell treated with a special iridescent paint finish that shifts colors under different lighting angles. With a low impedance of just 7.7Ω and a high sensitivity of 119dB/Vrms, the Starfield 3 is remarkably easy to drive, sounding dynamic and full whether plugged into a smartphone.`;
  const { specs, lines } = extractSpecs(`<p>${para}</p>`);
  assert.equal(specs.impedance[0].value, 7.7);
  assert.equal(specs.sensitivity[0].value, 119);
  assert.equal(specs.sensitivity[0].unit, "dB/V");
  assert.ok(specs.impedance[0].quote.startsWith("With a low impedance"));
  assert.ok(verify("impedance", specs.impedance[0], lines).ok);
});

test("prose about what an amp can drive is not an impedance", () => {
  const { specs } = extractSpecs(`<p>${"This amplifier is a great match for many setups. ".repeat(4)}It drives headphones with an output impedance below 1Ω and power to spare for anything you own.</p>`);
  assert.equal(specs.impedance.length, 0);
});

test("prose that is about other headphones is not the product's impedance", () => {
  const p = `<p>${"Built by hand in Poland from carefully selected parts. ".repeat(3)}The amplifier delivers exceptional sound on a broad range of headphones, even low-impedance ones (32 ohm). Compared with Fibae 4, the impedance is increased to 10 Ohm @1kHz, promising a more detailed sound.</p>`;
  const { specs } = extractSpecs(p);
  assert.deepEqual(specs.impedance.map((e) => e.value), [10]);
});
