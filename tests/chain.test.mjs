import { test } from "node:test";
import assert from "node:assert/strict";
import { link, portsOf, chainLinks } from "../src/chain.js";

const item = (o) => ({ item: { id: o.id ?? "x", category: o.category ?? "desktop", role: o.role, ports: o.ports } });
const cd = item({ id: "cd", category: "cd", ports: { out: { rca: "Line out", coax: "Coaxial out", optical: "Optical out" } } });
const dac = item({ id: "dac", role: "dac", ports: { in: { usb: "", optical: "", coax: "" }, out: { rca: "", xlr: "" } } });
const amp = item({ id: "amp", role: "amp", ports: { in: { rca: "", xlr: "" } } });
const phone = { device: { id: "phone", port: "usb-c" } };

test("CD transport to DAC uses a shared digital port", () => {
  const l = link(portsOf(cd), portsOf(dac), "digital");
  assert.equal(l.status, "ok");
  assert.deepEqual(l.via, ["coax", "optical"]);
});

test("unknown ports are 'unknown', not 'no'", () => {
  const bare = item({ id: "bare", role: "dac" });
  assert.equal(link(portsOf(cd), portsOf(bare), "digital").status, "unknown");
});

test("a phone can't feed an amp-only box", () => {
  const c = chainLinks({ source: phone, amp });
  assert.equal(c.links[0].status, "need_dac");
});

test("CD → DAC → amp: two links, the amp drives the headphones", () => {
  const c = chainLinks({ source: cd, dac, amp });
  assert.equal(c.links.length, 2);
  assert.equal(c.links[1].kind, "analog");
  assert.equal(c.links[1].status, "ok");
  assert.equal(c.driver, amp);
});

test("DAC → DAC/amp is an analog link into its line input", () => {
  const dacamp = item({ id: "k11", role: "dacamp", ports: { in: { usb: "", rca: "" } } });
  const c = chainLinks({ source: phone, dac, amp: dacamp });
  assert.equal(c.links[1].kind, "analog");
  assert.deepEqual(c.links[1].via, ["rca"]);
});

test("a DAC-only box at the end has no headphone output", () => {
  assert.equal(chainLinks({ source: cd, dac }).dacOnlyLast, true);
});

test("user reports add ports the store didn't list", () => {
  const bare = item({ id: "dp11", category: "cd" });
  const c = chainLinks({ source: bare, dac }, { dp11: [{ out: ["coax"] }] });
  assert.equal(c.links[0].status, "ok");
});
