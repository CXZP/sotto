import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modelGeometry, modelSockets } from "../src/shape.js";

const layouts = JSON.parse(readFileSync(new URL("../data/layouts.json", import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url)));
const items = new Map((catalog.items ?? catalog).map((i) => [i.id, i]));

for (const [id, lay] of Object.entries(layouts)) {
  if (!lay.model) continue;
  const m = lay.model;

  test(`${id}: model parts sit on the body`, () => {
    const { lines, size } = modelGeometry(m);
    const slack = 2; // a knob or button may stand a little proud of the body
    for (const l of lines) for (const [x, y, z] of l.pts) {
      assert.ok(x >= -slack && x <= size.w + slack, `${l.kind} x ${x}`);
      assert.ok(y >= -slack && y <= size.h + slack, `${l.kind} y ${y}`);
      assert.ok(z >= -slack && z <= size.d + slack, `${l.kind} z ${z}`);
    }
  });

  test(`${id}: model jacks match the jacks we list`, () => {
    const item = items.get(id);
    assert.ok(item, "item exists");
    assert.deepEqual([...modelSockets(m).jacks].sort(), [...(item.jacks ?? [])].sort());
  });

  test(`${id}: model says where it was measured from`, () => {
    assert.match(m.from, /^https:\/\//);
    assert.ok(m.by);
  });
}

test("modelGeometry: a plain box has 12 edges' worth of lines and no labels", () => {
  const g = modelGeometry({ body: { w: 10, h: 20, d: 5 } });
  assert.equal(g.lines.length, 2 + 4);
  assert.equal(g.labels.length, 0);
  assert.ok(g.dots.length > 0);
});

test("modelGeometry: a jack on the top face lands at y = h", () => {
  const g = modelGeometry({ body: { w: 10, h: 20, d: 5 }, parts: [{ kind: "jack", face: "top", x: 5, z: 2.5, r: 1, socket: "3.5", label: "3.5" }] });
  const jack = g.lines.find((l) => l.socket === "3.5");
  assert.ok(jack.pts.every(([, y]) => y === 20));
  assert.deepEqual(g.labels[0].at, [5, 20, 2.5]);
});
