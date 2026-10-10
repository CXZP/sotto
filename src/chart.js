// Voltage-vs-impedance chart. Log-log. One SVG, no library.
//
// Curves: what a source can deliver at each load (from calc.availableVrms).
// Points: what each headphone needs at the chosen peak level, at its impedance.
// A point under a curve is drivable. Status is shown by shape + colour + legend,
// never colour alone.

import { availableVrms } from "./calc.js?v=mv2wr92c";

const W = 760;
const H = 440;
const PAD = { l: 58, r: 92, t: 18, b: 46 };
const X = [8, 1000];
const Y = [0.003, 40];
const lx = (z) => PAD.l + ((Math.log10(z) - Math.log10(X[0])) / (Math.log10(X[1]) - Math.log10(X[0]))) * (W - PAD.l - PAD.r);
const ly = (v) => H - PAD.b - ((Math.log10(v) - Math.log10(Y[0])) / (Math.log10(Y[1]) - Math.log10(Y[0]))) * (H - PAD.t - PAD.b);
const clampY = (v) => Math.min(Math.max(v, Y[0]), Y[1]);

const SHAPE = {
  ok: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`,
  overkill: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`,
  tight: (x, y, r) => `<path d="M${x} ${y - r * 1.2}L${x + r * 1.1} ${y + r * 0.8}H${x - r * 1.1}Z"/>`,
  insufficient: (x, y, r) => `<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}" class="x"/>`,
  ambiguous: (x, y, r) => `<rect x="${x - r * 0.8}" y="${y - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" transform="rotate(45 ${x} ${y})"/>`,
};

/**
 * @param el container
 * @param o.curves [{ label, output, dashed }]
 * @param o.points [{ id, label, z, v, status, highlight }]
 * @param o.labels { x, y, ok, tight, insufficient, ambiguous }
 * @param o.onPick (id) => void
 */
export function renderChart(el, { curves, points, labels, onPick, fmt }) {
  const grid = [];
  for (const z of [10, 16, 32, 64, 100, 300, 600, 1000]) {
    grid.push(`<line class="g" x1="${lx(z)}" x2="${lx(z)}" y1="${PAD.t}" y2="${H - PAD.b}"/>`);
    grid.push(`<text class="t" x="${lx(z)}" y="${H - PAD.b + 16}" text-anchor="middle">${z}</text>`);
  }
  for (const v of [0.01, 0.1, 1, 10]) {
    grid.push(`<line class="g" x1="${PAD.l}" x2="${W - PAD.r}" y1="${ly(v)}" y2="${ly(v)}"/>`);
    grid.push(`<text class="t" x="${PAD.l - 8}" y="${ly(v) + 4}" text-anchor="end">${v >= 1 ? v : v * 1000 + "m"}V</text>`);
  }

  const curveSvg = curves
    .map((c) => {
      const pts = [];
      for (let i = 0; i <= 80; i++) {
        const z = 10 ** (Math.log10(X[0]) + (i / 80) * (Math.log10(X[1]) - Math.log10(X[0])));
        const v = availableVrms(c.output, z).vrms;
        if (v) pts.push(`${lx(z).toFixed(1)},${ly(clampY(v)).toFixed(1)}`);
      }
      if (!pts.length) return "";
      const last = pts[pts.length - 1].split(",");
      return `<polyline class="curve${c.dashed ? " dashed" : ""}" points="${pts.join(" ")}"/>
        <text class="cl" x="${Number(last[0]) + 6}" y="${Number(last[1]) + 4}">${esc(c.label)}</text>`;
    })
    .join("");

  // Background points first, highlighted last so it sits on top.
  const sorted = [...points].sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight));
  const pointSvg = sorted
    .map((p) => {
      const x = lx(Math.min(Math.max(p.z, X[0]), X[1]));
      const y = ly(clampY(p.v));
      const r = p.highlight ? 7 : 3.6;
      return `<g class="pt s-${p.status}${p.highlight ? " hl" : ""}" data-id="${esc(p.id)}">${SHAPE[p.status]?.(x, y, r) ?? SHAPE.ok(x, y, r)}${
        p.highlight ? `<text class="hl-label" x="${x + 11}" y="${y - 9}">${esc(p.label)}</text>` : ""
      }</g>`;
    })
    .join("");

  el.innerHTML = `
    <div class="legend" role="list">
      ${["ok", "overkill", "tight", "insufficient", "ambiguous"]
        .map((s) => `<span role="listitem" class="lg s-${s}"><svg viewBox="-8 -8 16 16" aria-hidden="true">${SHAPE[s](0, 0, 5)}</svg>${esc(labels[s])}</span>`)
        .join("")}
      ${curves.some((c) => c.dashed) ? `<span class="lg"><svg viewBox="0 0 22 8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" class="curve dashed"/></svg>balanced</span>` : ""}
    </div>
    <div class="chart-box">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.aria)}">
        ${grid.join("")}
        <text class="axis" x="${(PAD.l + W - PAD.r) / 2}" y="${H - 8}" text-anchor="middle">${esc(labels.x)}</text>
        <text class="axis" transform="translate(14 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)" text-anchor="middle">${esc(labels.y)}</text>
        ${pointSvg}
        ${curveSvg}
      </svg>
      <div class="tip" hidden></div>
    </div>`;

  const svg = el.querySelector("svg");
  const tip = el.querySelector(".tip");
  const coords = sorted.map((p) => ({ p, x: lx(Math.min(Math.max(p.z, X[0]), X[1])), y: ly(clampY(p.v)) }));

  const nearest = (ev) => {
    const box = svg.getBoundingClientRect();
    const sx = ((ev.clientX - box.left) / box.width) * W;
    const sy = ((ev.clientY - box.top) / box.height) * H;
    let best = null;
    let bestD = 14 * (W / box.width);
    for (const c of coords) {
      const d = Math.hypot(c.x - sx, c.y - sy);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return { best, box };
  };

  svg.addEventListener("pointermove", (ev) => {
    const { best, box } = nearest(ev);
    if (!best) {
      tip.hidden = true;
      return;
    }
    const p = best.p;
    tip.innerHTML = `<b>${esc(p.label)}</b><span>${esc(fmt.z(p.z))} · ${esc(labels.need)} ${esc(fmt.v(p.v))}</span><span class="s-${p.status}">${esc(labels[p.status] ?? "")}</span>`;
    tip.hidden = false;
    const left = (best.x / W) * box.width;
    const top = (best.y / H) * box.height;
    tip.style.transform = `translate(${Math.min(left + 12, box.width - 220)}px, ${Math.max(top - 64, 0)}px)`;
  });
  svg.addEventListener("pointerleave", () => (tip.hidden = true));
  svg.addEventListener("click", (ev) => {
    const { best } = nearest(ev);
    if (best && onPick) onPick(best.p.id);
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
