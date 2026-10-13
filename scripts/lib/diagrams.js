// Sockets read off the maker's own labelled images (data/diagram-ports.json):
// a picture of the box with each socket named, copied label by label, with the
// image it came from. It beats store text; a maker spec page or a hand-checked
// entry still wins. A "complete" read (every face with sockets shown) also drops
// store-read sockets the images don't show.

import { groupKey } from "./classify.js";
import { isMakerUrl } from "./sources.js";

/** Applies diagram reads to catalog items in place. `hand`: groupKeys of hand-checked items. */
export function applyDiagrams(catalog, diagrams, hand = new Set()) {
  const byKey = new Map(catalog.map((g) => [groupKey(g.id), g]));
  for (const [id, d] of Object.entries(diagrams)) {
    const g = byKey.get(groupKey(id));
    if (!g || !d.image || hand.has(groupKey(g.id))) continue;
    const src = (label, conn, n) => ({ quote: label, url: d.image, page: d.page, diagram: true, ...(conn ? { conn } : {}), ...(n > 1 ? { n } : {}) });
    const kept = (v) => v && (isMakerUrl(v.url, g.brand) || v.checked);
    g.ports ??= { in: {}, out: {} };
    for (const dir of ["in", "out"]) {
      g.ports[dir] ??= {};
      if (d.complete) for (const [p, v] of Object.entries(g.ports[dir])) if (!d[dir]?.[p] && !kept(v)) delete g.ports[dir][p];
      for (const [p, v] of Object.entries(d[dir] ?? {})) if (!kept(g.ports[dir][p])) g.ports[dir][p] = src(v.label, v.conn, v.n);
    }
    if (d.complete) g.portsComplete = { url: d.image };
    if (d.jacks?.length) {
      g.jacks = [...d.jacks];
      g.jackSource = { url: d.image, page: d.page, labels: d.jackLabels ?? {} };
    }
    if (d.switches?.length) g.switches = d.switches.map((label) => ({ label, url: d.image }));
  }
}
