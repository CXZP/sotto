import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyDiagrams } from "../scripts/lib/diagrams.js";

const IMG = "https://cdn.shopify.com/s/files/1/0670/3248/1941/files/html_template_default_assets_time_01_tm2021_detail_shanling_h2_6.jpg";

test("a labelled image fills the card and names its source (Shanling H2)", () => {
  const g = { id: "shanling--h2", brand: "SHANLING", ports: { in: { usb: { quote: "USB DAC", url: "https://store.example/h2" } }, out: {} } };
  applyDiagrams([g], { "shanling--h2": { image: IMG, page: "https://www.e-earphone.jp/products/434111", complete: true, in: { usb: { label: "USB / DACポート", conn: "usbC" }, dc: { label: "Type-C 充電ポート", conn: "usbC" } }, jacks: ["3.5", "4.4"] } });
  assert.equal(g.ports.in.usb.quote, "USB / DACポート");
  assert.equal(g.ports.in.usb.diagram, true);
  assert.equal(g.ports.in.dc.conn, "usbC");
  assert.deepEqual(g.jacks, ["3.5", "4.4"]);
});

test("the maker's spec page and hand checks still win; a complete read drops store-only sockets", () => {
  const g = { id: "fiio--k11", brand: "FiiO", ports: { in: { usb: { quote: "USB: Type-C", url: "https://www.fiio.com/K11_parameters" }, bt: { quote: "Bluetooth", url: "https://store.example/k11" } }, out: { rca: { quote: "RCA", url: "x", checked: true } } } };
  applyDiagrams([g], { "fiio--k11": { image: IMG, complete: true, in: { usb: { label: "USB IN" } }, out: {} } });
  assert.equal(g.ports.in.usb.url, "https://www.fiio.com/K11_parameters");
  assert.equal(g.ports.in.bt, undefined);
  assert.ok(g.ports.out.rca);
});

test("an entry with nothing found changes nothing", () => {
  const g = { id: "a--b", brand: "A", ports: { in: { usb: { quote: "q", url: "u" } }, out: {} } };
  applyDiagrams([g], { "a--b": { none: "only bare photos" } });
  assert.deepEqual(g.ports.in, { usb: { quote: "q", url: "u" } });
});

test("data/diagram-ports.json: every read names its image and uses known keys", () => {
  const PORTS = ["usb", "coax", "optical", "aes", "i2s", "bt", "rca", "xlr", "line", "phono", "spk", "dc"];
  const JACKS = ["6.35", "4.4", "3.5", "2.5", "xlr4"];
  const d = JSON.parse(readFileSync(new URL("../data/diagram-ports.json", import.meta.url)));
  for (const [id, e] of Object.entries(d)) {
    if (e.none) continue;
    assert.match(e.image, /^https:\/\//, id);
    for (const dir of ["in", "out"]) for (const [p, v] of Object.entries(e[dir] ?? {})) {
      assert.ok(PORTS.includes(p), `${id} ${dir}.${p}`);
      assert.ok(v.label, `${id} ${dir}.${p} label`);
    }
    for (const j of e.jacks ?? []) assert.ok(JACKS.includes(j), `${id} jack ${j}`);
  }
});
