import { test } from "node:test";
import assert from "node:assert/strict";
import { specBlock, noSheet } from "../scripts/lib/specpage.js";
import { extractSheet, extractSpecs } from "../scripts/lib/specs.js";

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
