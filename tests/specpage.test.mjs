import { test } from "node:test";
import assert from "node:assert/strict";
import { specBlock, noSheet } from "../scripts/lib/specpage.js";
import { extractSheet, extractSpecs, verify } from "../scripts/lib/specs.js";

const PAGE = `<div class="tabs-adds-blocks"><div class="tabs-adds-header border-color-border border-b">
    SPECIFICATIONS
</div>
<p><span class="metafield-multi_line_text_field">Frequency Response: 12Hz-44kHz<br />
Sensitivity: 119dB/Vrms(@1kHz)<br />
Impedance: 7.7Ω±15%(@1kHz)<br />
Connector: 0.78-2pin</span></p>
</div>
<div class="tabs-adds-blocks"><div class="tabs-adds-header">WHAT IN BOX?</div><p><span>Cable * 1<br />Case * 1</span></p></div>`;

test("spec box from a product page, box contents left out", () => {
  const b = specBlock(PAGE);
  assert.match(b, /Impedance/);
  assert.doesNotMatch(b, /Case \* 1/);
  const specs = extractSpecs(b).specs;
  assert.equal(specs.impedance[0].value, 7.7);
  assert.equal(specs.sensitivity[0].value, 119);
  assert.equal(extractSheet(b).connector.value, "0.78-2pin");
});

test("no spec box, nothing added", () => {
  assert.equal(specBlock("<div>Buy now</div>"), "");
});

test("feeds without a spec list are worth a page visit", () => {
  assert.ok(noSheet('<p><img src="a.jpg"></p><p>The UI-09 offers an impedance of 18 Ohm.</p>'));
  assert.ok(!noSheet("<p>Impedance: 18 Ohm</p><p>Frequency Response: 20Hz-20kHz</p>"));
});

test("Linsoul technical-details rows read as label: value", () => {
  const b = specBlock('<div class="row"><div class="col-name">Impedance</div><div class="col-desc">18 Ohm @ 1kHz</div></div><div class="row"><div class="col-name">Frequency Range</div><div class="col-desc">20Hz – 20KHz</div></div>');
  assert.equal(extractSpecs(b).specs.impedance[0].value, 18);
  assert.equal(extractSheet(b).freq.value, "20Hz – 20KHz");
});

test("store page layouts: feature chart, spec rows, tables, spec lists", () => {
  const chart = specBlock(`<div class="feature-chart__table-row"><div\n class="feature-chart__heading bold"\n >\n Impedance\n </div><div\n class="feature-chart__value text-subdued"\n >32 Ohms</div></div>`);
  assert.equal(extractSpecs(chart).specs.impedance[0].value, 32);
  const kiwi = specBlock(`<div class="pk-specrow2 flex"><p class="m-0">Impedance</p><p class="m-0">13 Ohm</p></div>`);
  assert.equal(extractSpecs(kiwi).specs.impedance[0].value, 13);
  const table = specBlock(`<table><tr><td colspan="2"><strong>Specifications</strong></td></tr><tr><td>Drivers</td><td>40mm dynamic</td></tr></table>`);
  assert.equal(extractSheet(table).driver.value, "40mm dynamic");
  const list = specBlock(`<h3>Technical Specifications</h3><ul><li>Headphone Output Power (Balanced 4.4mm RMS): 6.94V/1,513mW (@ 32Ω)</li><li>Line Output Impedance: ≤205Ω (BAL 4.4mm)</li><li>Output Impedance: ≤0.4Ω BAL</li></ul>`);
  const { specs, lines } = extractSpecs(list);
  assert.deepEqual(specs.zout.map((e) => e.value), [0.4]);
  assert.equal(specs.power[0].mw, 1513);
  assert.ok(verify("power", specs.power[0], lines).ok);
});

test("definition-list spec boxes (Linsoul's theme since Oct 2026)", () => {
  const html = `<h2 class="lsp-h2">Technical details</h2><dl class="lsps-list"><div><dt>Sensitivity</dt><dd>119dB/Vrms (@1kHz)</dd></div><div><dt>Impedance</dt><dd>7.7Ω ±15% (@1kHz)</dd></div></dl>`;
  const { specs } = extractSpecs(specBlock(html));
  assert.deepEqual(specs.impedance.map((e) => e.value), [7.7]);
  assert.equal(specs.sensitivity[0].value, 119);
});

test("Maximum SPL is not sensitivity", () => {
  const { specs } = extractSpecs("<p>Maximum SPL: Greater than 130 dB SPL</p><p>Sensitivity: 98dB SPL/mW at 1kHz</p>");
  assert.deepEqual(specs.sensitivity.map((e) => e.value), [98]);
});

test("sensitivity quoted at another drive level becomes dB/V or dB/mW", () => {
  const sens = (h) => extractSpecs(`<p>${h}</p>`).specs.sensitivity.map((e) => [e.value, e.unit]);
  // Campfire: 94 dB from 12.1 mV is 132 dB/V, not 94.
  assert.deepEqual(sens("SPL: 94db @ 1 kHz - 12.10 mVrms"), [[132.3, "dB/V"]]);
  assert.deepEqual(sens("Sensitivity: 110dB(1kHz/500mVrms)"), [[116, "dB/V"]]);
  assert.deepEqual(sens("Sensitivity: 105 dB @ 0.5mW"), [[108, "dB/mW"]]);
  // 64 Audio: the mV is what 1 mW takes; the figure is already dB/mW.
  assert.deepEqual(sens("Sensitivity : 106 dB/mW @ 1kHz @ 1mW (84mV)"), [[106, "dB/mW"]]);
});
