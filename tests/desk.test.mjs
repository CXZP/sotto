// Desk blueprint: sockets per box, cable checks, share codes (src/desk.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { nodePorts, cableCheck, encodeDesk, decodeDesk, autoCables } from "../src/desk.js";

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
