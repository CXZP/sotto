import { test } from "node:test";
import assert from "node:assert/strict";
import { chainLinks } from "../src/chain.js";
import { classify, cartridgeKind, phonoInputs, deskRole } from "../scripts/lib/classify.js";

const it = (x) => ({ item: { id: x.id ?? "x", ports: { in: {}, out: {} }, ...x } });

test("turntables, phono stages and cartridges get their own categories", () => {
  assert.equal(classify({ title: "Pro-Ject Debut Carbon EVO Turntable" }), "turntable");
  assert.equal(classify({ title: "iFi ZEN Phono MM MC Phono Stage" }), "phono");
  assert.equal(classify({ title: "Pro-Ject Phono Box S2 Ultra" }), "phono");
  assert.equal(classify({ title: "Ortofon 2M Red Moving Magnet Cartridge" }), "cartridge");
  assert.equal(classify({ title: "Rega Apheta 3 Moving Coil" }), "cartridge");
  assert.notEqual(classify({ title: "Turntable Cork Mat" }), "turntable");
  assert.equal(classify({ title: "Ortofon Stylus 2M Blue" }), "accessory");
  assert.notEqual(classify({ title: "KZ ZSN Pro Noise Isolation IEM" }), "accessory");
});

test("MM, MC and high-output MC", () => {
  assert.equal(cartridgeKind({ title: "Sumiko Moonstone Moving Magnet Phono Cartridge", body: "<p>Unlike MC designs...</p>" }), "mm");
  assert.equal(cartridgeKind({ title: "Rega Aphelion 2 MC Cartridge" }), "mc");
  assert.equal(cartridgeKind({ title: "Cambridge Audio Alva MC High-Output MC Cartridge" }), "homc");
  assert.equal(phonoInputs({ title: "Rega Aria MM MC Phono Stage" }), "mm+mc");
  assert.equal(phonoInputs({ title: "Rega Fono Mini", body: "<p>for moving magnet cartridges</p>" }), "mm");
});

test("a line preamp is its own role", () => {
  assert.equal(deskRole({ title: "Schiit Saga Pre Preamplifier", body: "<p>RCA inputs and outputs, remote volume.</p>" }), "preamp");
});

test("turntable straight into a line-only amp needs a phono stage", () => {
  const c = chainLinks({ source: it({ category: "turntable" }), amp: it({ id: "a", category: "desktop", role: "amp", ports: { in: { rca: "RCA in" }, out: {} } }) });
  assert.equal(c.links[0].status, "need_phono");
});

test("turntable with a built-in phono stage goes straight in", () => {
  const c = chainLinks({ source: it({ category: "turntable", features: { phono_pre: "built-in phono preamp" } }), amp: it({ id: "a", category: "desktop", role: "amp", ports: { in: { rca: "RCA in" }, out: {} } }) });
  assert.equal(c.links[0].status, "ok");
});

test("turntable → phono stage → amp, and an MC cartridge on an MM-only stage", () => {
  const phono = it({ id: "p", category: "phono", phonoIn: "mm" });
  const amp = it({ id: "a", category: "desktop", role: "amp", ports: { in: { rca: "RCA in" }, out: {} } });
  const c = chainLinks({ source: it({ category: "turntable" }), dac: phono, amp, cart: it({ id: "c", category: "cartridge", cart: "mc" }) });
  assert.deepEqual(c.links.map((l) => l.status), ["ok", "ok"]);
  assert.equal(c.cart.status, "need_mc");
  assert.equal(c.driver, amp);
});

test("phono stage or line preamp last: no headphone jack", () => {
  assert.equal(chainLinks({ source: it({ category: "turntable" }), dac: it({ id: "p", category: "phono" }) }).dacOnlyLast, true);
  assert.equal(chainLinks({ source: it({ category: "dap" }), amp: it({ id: "a", category: "desktop", role: "preamp" }) }).preampLast, true);
  assert.equal(chainLinks({ source: it({ category: "turntable" }) }).vinylAlone, true);
});
