// Desk blueprint: sockets per box, cable checks, share codes (src/desk.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { nodePorts, cableCheck, encodeDesk, decodeDesk, autoCables, wireNew, flowLayout } from "../src/desk.js";

test("sockets: a phone sends USB, a dongle drives headphones, headphones take them", () => {
  assert.deepEqual(nodePorts({ device: "phone" }).out, ["usb", "bt"]);
  const dongle = nodePorts({ item: { category: "dongle", offers: [] } });
  assert.ok(dongle.in.includes("usb") && dongle.out.includes("hp"));
  assert.deepEqual(nodePorts({ item: { category: "iem", offers: [] } }).in, ["hp"]);
});

test("cables: same socket ok, line types need a cable, digital into analog doesn't work", () => {
  assert.equal(cableCheck("usb", "usb").status, "ok");
  assert.equal(cableCheck("i2s", "i2s").status, "check");
  assert.equal(cableCheck("rca", "xlr").status, "adapter");
  assert.equal(cableCheck("optical", "rca").status, "no");
  assert.equal(cableCheck("phono", "rca").status, "no");
  assert.equal(cableCheck("?", "usb").status, "unknown");
});

test("share codes round-trip", () => {
  const desk = { nodes: [{ ref: "dev:phone", x: 20, y: 40 }, { ref: "moondrop--blessing-3", x: 300, y: 40 }], cables: [{ from: 0, out: "usb", to: 1, in: "hp" }] };
  assert.deepEqual(decodeDesk(encodeDesk(desk)), desk);
  assert.deepEqual(decodeDesk("not base64!"), { nodes: [], cables: [] });
});

test("a chain lays out with the best cable between each pair", () => {
  const nodes = [{ device: "phone" }, { item: { category: "dongle", offers: [] } }, { item: { category: "iem", offers: [] } }];
  assert.deepEqual(autoCables(nodes), [{ from: 0, out: "usb", to: 1, in: "usb" }, { from: 1, out: "hp", to: 2, in: "hp" }]);
});

test("a new box wires itself: from the best box upstream, to boxes nothing feeds yet", () => {
  const phone = { device: "phone" };
  const dongle = { item: { category: "dongle", offers: [] } };
  const iem = { item: { category: "iem", offers: [] } };
  // Put on in any order: IEM first, then the phone, then the dongle in between.
  assert.deepEqual(wireNew([iem, phone], [], 1), []); // a phone's USB can't drive an IEM
  const cables = wireNew([iem, phone, dongle], [], 2);
  assert.deepEqual(cables, [{ from: 1, out: "usb", to: 2, in: "usb" }, { from: 2, out: "hp", to: 0, in: "hp" }]);
});

test("flow layout: rows follow the signal, top to bottom", () => {
  const nodes = [{ item: { category: "iem", offers: [] } }, { device: "phone" }, { item: { category: "dongle", offers: [] } }, { item: { category: "power", offers: [] } }];
  const cables = [{ from: 1, out: "usb", to: 2, in: "usb" }, { from: 2, out: "hp", to: 0, in: "hp" }];
  const { pos } = flowLayout(nodes, cables);
  assert.ok(pos[1].y < pos[2].y && pos[2].y < pos[0].y);
  assert.equal(pos[1].x, pos[2].x); // one column
  assert.ok(pos[3].side); // the power supply isn't in the signal path
  // Nothing wired yet: still in signal order by kind.
  const loose = flowLayout(nodes.slice(0, 3), []).pos;
  assert.ok(loose[1].y < loose[2].y && loose[2].y < loose[0].y);
});

test("flow layout: two sources side by side above the box they share", () => {
  const amp = { item: { category: "desktop", role: "integrated", offers: [], ports: { in: { rca: 2 } } } };
  const tt = { item: { category: "turntable", offers: [], features: { phono_pre: true } } };
  const cd = { item: { category: "cd", offers: [], ports: { out: { rca: 1 } } } };
  const cables = [{ from: 1, out: "rca", to: 0, in: "rca" }, { from: 2, out: "rca", to: 0, in: "rca" }];
  const { pos, width } = flowLayout([amp, tt, cd], cables);
  assert.equal(pos[1].y, pos[2].y);
  assert.ok(pos[0].y > pos[1].y);
  assert.ok(Math.abs(pos[0].x + 90 - width / 2) < 1); // the amp is centred under both
});

test("an amp takes every source: phono stage and DAC both go in", () => {
  const amp = { item: { category: "desktop", role: "integrated", offers: [], ports: { in: { rca: 1, phono: 1 } } } };
  const tt = { item: { category: "turntable", offers: [] } };
  const pre = { item: { category: "phono", offers: [] } };
  const cd = { item: { category: "cd", offers: [], ports: { out: { coax: 1 } } } };
  const dac = { item: { category: "desktop", role: "dac", offers: [], ports: { in: { coax: 1 }, out: { rca: 1 } } } };
  const nodes = [tt, cd, pre, dac, amp];
  const cables = [];
  for (let k = 0; k < nodes.length; k++) cables.push(...wireNew(nodes.slice(0, k + 1), cables, k));
  assert.deepEqual(cables, [
    { from: 0, out: "phono", to: 2, in: "phono" },
    { from: 1, out: "coax", to: 3, in: "coax" },
    { from: 3, out: "rca", to: 4, in: "rca" },
    { from: 2, out: "rca", to: 4, in: "rca" },
  ]);
});

test("a store's bare 'line' socket is a check, not an adapter", () => {
  assert.equal(cableCheck("line", "rca").status, "check");
  assert.equal(cableCheck("rca", "line").why, "dk_line_generic");
});
