// Reading makers' spec pages into sockets (scripts/lib/makerpages.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { smslPairs, fiioSlugs, readPair, fiioPairs, ifiPairs, toEntry, manualPairs, calloutPairs } from "../scripts/lib/makerpages.js";

const sockets = (label, value) => readPair(label, value).sockets.map((s) => `${s.dir}:${s.port}${s.conn ? `:${s.conn}` : ""}`);

test("FiiO port rows", () => {
  assert.deepEqual(sockets("Digital coaxial in", "RCA port"), ["in:coax"]);
  assert.deepEqual(sockets("Single-ended line-out", "RCA port"), ["out:rca"]);
  assert.deepEqual(sockets("Balanced line output port", "XLR3 balanced plug"), ["out:xlr"]);
  assert.deepEqual(sockets("USB", "Type-C USB (Power supply/Data transfer)"), ["in:usb:usbC"]);
  assert.deepEqual(readPair("Balanced headphone out", "Standard 4.4mm port").jacks, ["4.4"]);
  assert.deepEqual(sockets("Knob", "Encoder knob"), []);
  assert.deepEqual(readPair("Phone Output", "3.5mm single-ended+6.35mm single-ended+2.5mm balanced+4.4mm balanced").jacks, ["6.35", "4.4", "3.5", "2.5"]);
  assert.deepEqual(readPair("Balanced output ports", "Standard 4.4mm * 1 4-cores XLR * 1").jacks, ["xlr4", "4.4"]);
  const ka13 = readPair("3.5mm plug", "Single-ended/SPDIF output (shared)");
  assert.deepEqual([ka13.jacks, ka13.sockets.map((s) => s.port)], [["3.5"], ["coax"]]);
});

test("iFi rows: connectors yes, levels no", () => {
  assert.deepEqual(sockets("Analogue input", "1 x Balanced 4.4mm"), ["in:xlr:4.4"]);
  assert.deepEqual(sockets("Digital input", "1x S/PDIF (optical/coaxial)"), ["in:optical:spdif35", "in:coax:spdif35"]);
  assert.deepEqual(sockets("input", "Balanced: 6V RMS"), []);
  assert.deepEqual(sockets("Digital input", "1x AES3 (XLR)"), ["in:aes"]);
  assert.deepEqual(readPair("Headphone output", "UNBAL: 3.5V max. @ 600Ω").jacks, []);
});

test("a FiiO table and an iFi spec list", () => {
  const fiio = `<table><tr><td colspan="4">Buttons and Ports</td></tr>
    <tr><td>USB</td><td>Type-C (data transmission)</td><td>Digital optical in</td><td>Optical port</td></tr>
    <tr><td>Headphone out</td><td>Standard 6.35mm port</td><td>balanced output interface</td><td>standard 4.4mm socket</td></tr>
    <tr><td colspan="4">Power Supply Parameters</td></tr><tr><td>Power Supply</td><td>DC 12V/2A</td></tr></table>`;
  const e = toEntry("u", fiioPairs(fiio));
  assert.deepEqual(Object.keys(e.ports.in), ["usb", "optical"]);
  assert.deepEqual(e.jacks, ["6.35", "4.4"]);
  const ifi = `<tr class="spec-row"><td><strong>INPUT</strong></td><td>USB Type-C</td></tr>
    <tr class="spec-row hidden-row"><td><strong>OUTPUT IMPEDANCE</strong></td><td><b>Line Section: </b><br>Balanced 4.4mm ≤200Ω; Single-Ended RCA ≤100Ω</td></tr>
    <tr class="spec-row"><td><strong>OUTPUT</strong></td><td>RCA: 3.8V RMS</td></tr>`;
  const f = toEntry("u", ifiPairs(ifi));
  assert.deepEqual(Object.keys(f.ports.in), ["usb"]);
  assert.deepEqual(Object.keys(f.ports.out).sort(), ["rca", "xlr"]);
  assert.equal(f.ports.out.xlr.conn, "4.4");
});

test("Topping manuals: numbered lists and callouts", () => {
  const listed = ["2.1 Front panel", "1. 3.5mm headphone / headset jack", "2. 4.4mm balanced headphone output jack", "3. Screen", "2.3 Rear panel",
    "1. 4.4mm balanced stereo output", "     This port is a Line Out output.", "2. SPDIF optical input", "3. USB input & power input",
    "     The DX1 II USB port handles both audio data transmission and power supply.", "3. Connection"].join(String.fromCharCode(10));
  const a = toEntry("u", manualPairs(listed));
  assert.deepEqual([Object.keys(a.ports.in), Object.keys(a.ports.out), a.jacks], [["optical", "usb"], ["xlr"], ["4.4", "3.5"]]);
  const drawn = ["   Front panel", "   Rear panel                1   3.Output settings   12", "Front panel",
    "     4.4mm balanced headphone output jack        Menu", "4-PIN-XLR headphone output jack     Screen", "Rear panel",
    "      Balanced XLR output         Coaxial SPDIF input", "      Power input (AC 100-277V 50Hz/60Hz)    Single-ended RCA output", "Display"].join(String.fromCharCode(10));
  const b = toEntry("u", calloutPairs(drawn));
  assert.deepEqual([Object.keys(b.ports.in), Object.keys(b.ports.out).sort(), b.jacks], [["coax"], ["rca", "xlr"], ["xlr4", "4.4"]]);
});

test("FiiO page names from store names", () => {
  assert.deepEqual(fiioSlugs("M27 Player Titanium Gold"), ["M27PLAYERTITANIUMGOLD", "M27PLAYERTITANIUM", "M27PLAYER", "M27"]);
  assert.deepEqual(fiioSlugs("K15 *2 Powerful"), ["K152POWERFUL", "K152", "K15"]);
  assert.deepEqual(fiioSlugs("M25 R2R M25"), ["M25R2RM25", "M25R2R"]);
  assert.deepEqual(fiioSlugs("Echo Mini 512MB"), ["ECHOMINI512MB", "ECHOMINI"]);
  assert.deepEqual(fiioSlugs("KA13 DACs Mini -Class").at(-1), "KA13");
  assert.deepEqual(fiioSlugs("KA5 Ultra"), ["KA5ULTRA"]);
});

test("SMSL manuals: dotted spec rows and the numbered panel key", () => {
  const text = [
    "Input ............................................. USB / Optical / Coaxial / Bluetooth",
    "Output ........................................... RCA/XLR/4.4mm Headphone Jack/",
    "",
    "                 6.35mm Headphone Jack/4-Pin XLR Headphone Jack",
    "Output impedance ................................ XLR            200",
    "USB ................................Windows 7 / 8 / 8.1 / 10 / 11",
    "7 RCA output             8 Bluetooth antenna  9 Balanced output",
    "4               5 4.4mm         6 6.35mm",
  ].join(String.fromCharCode(10));
  const e = toEntry("u", smslPairs(text));
  assert.deepEqual([Object.keys(e.ports.in), Object.keys(e.ports.out).sort(), e.jacks], [["usb", "optical", "coax", "bt"], ["rca", "xlr"], ["xlr4", "6.35", "4.4"]]);
});
