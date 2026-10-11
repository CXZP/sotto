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
