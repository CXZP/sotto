// Back panels: every socket a box has is drawn, inside the panel, without overlaps (src/panel.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { panelSpec, chassisOf, hpPlug, frontSpec, hasFront, countOf } from "../src/panel.js";
import { nodePorts } from "../src/desk.js";

const boxes = [
  { device: "phone" },
  { item: { category: "desktop", role: "dacamp", brand: "TOPPING", offers: [], ports: { in: { usb: {}, optical: {}, coax: {}, xlr: {} }, out: { rca: {}, xlr: {} } } } },
  { item: { category: "desktop", role: "dac", brand: "AUDALYTIC", offers: [] } },
  { item: { category: "desktop", role: "integrated", brand: "ARCAM", offers: [], ports: { in: { rca: {}, phono: {} } } } },
  { item: { category: "dongle", brand: "FiiO", offers: [] } },
  { item: { category: "speaker", speaker: "passive", offers: [] } },
  { item: { category: "turntable", offers: [] } },
];

test("every socket a box has is on its panel, inside it, and frames don't overlap", () => {
  for (const n of boxes) {
    const spec = panelSpec(n);
    const ports = nodePorts(n);
    for (const dir of ["in", "out"])
      for (const p of ports[dir]) if (!(p === "hp" && hasFront(n)) && !(p === "line" && (ports[dir].includes("rca") || ports[dir].includes("xlr")))) assert.ok(spec.sockets.some((s) => s.port === p && s.dir === dir), `${JSON.stringify(n).slice(0, 60)} ${dir} ${p}`);
    for (const s of spec.sockets) assert.ok(s.x > 0 && s.x < spec.w && s.y > 0 && s.y < spec.h);
    const g = [...spec.groups].sort((a, b) => a.x - b.x);
    for (let k = 1; k < g.length; k++) assert.ok(g[k].x >= g[k - 1].x + g[k - 1].w);
  }
});

test("house styles: Topping slim, Gustard/Audalytic inset, dongles, a headphone is its plug", () => {
  assert.equal(chassisOf(boxes[1]).style, "slim");
  assert.equal(chassisOf(boxes[2]).style, "inset");
  assert.equal(chassisOf(boxes[4]).style, "dongle");
  assert.equal(hpPlug({ category: "headphone" }), "6.35");
  assert.equal(hpPlug({ category: "iem" }), "3.5");
});

test("XLR: female sockets in, male out", () => {
  const spec = panelSpec(boxes[1]);
  assert.equal(spec.sockets.find((s) => s.port === "xlr" && s.dir === "in").glyph, "xlrF");
  assert.equal(spec.sockets.find((s) => s.port === "xlr" && s.dir === "out").glyph, "xlrM");
});

test("a dongle: built-in cable unless a store lists a USB-C input socket", () => {
  const usbIn = (n) => panelSpec(n).sockets.find((s) => s.port === "usb" && s.dir === "in").glyph;
  assert.equal(usbIn(boxes[4]), "tether");
  assert.equal(usbIn({ item: { category: "dongle", offers: [], ports: { in: { usb: { quote: "Inputs: USB Type-C" } } } } }), "usbC");
});

test("a power supply: mains in, DC out", () => {
  const spec = panelSpec({ item: { category: "power", brand: "FiiO", offers: [] } });
  assert.ok(spec.groups.some((g) => g.deco === "iec"));
  assert.ok(spec.sockets.some((s) => s.port === "dc" && s.dir === "out"));
});

test("a desk box: headphone jacks on its front, counts from the maker", () => {
  const amp = { item: { category: "desktop", role: "amp", brand: "GUSTARD", offers: [], jacks: ["xlr4", "6.35", "4.4"], ports: { in: { xlr: { quote: "2x XLR balanced" }, rca: { quote: "1x RCA stereo" } }, out: {} } } };
  assert.ok(hasFront(amp));
  assert.deepEqual(frontSpec(amp).sockets.map((s) => s.jack), ["xlr4", "6.35", "4.4"]);
  assert.equal(panelSpec(amp).sockets.filter((s) => s.port === "xlr").length, 2);
  assert.ok(!panelSpec(amp).sockets.some((s) => s.port === "hp"));
  assert.equal(countOf({ ports: { in: { rca: { quote: "Single-ended line input: RCA port*4", n: 4 } } } }, "in", "rca"), 4);
});
