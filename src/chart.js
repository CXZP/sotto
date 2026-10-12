// Voltage-vs-impedance chart. Log-log. One SVG, no library.
//
// Curves: what a source can deliver at each load (from calc.availableVrms).
// Points: what each headphone needs at the chosen peak level, at its impedance.
// A point under a curve is drivable. Status is shown by shape + colour + legend,
// never colour alone.

import { availableVrms } from "./calc.js?v=mv4mt936";

let W = 760;
let H = 440;
const PAD = { l: 58, r: 92, t: 18, b: 46 };
// Full range; zooming narrows X and Y for one chart.
const X0 = [8, 1000];
const Y0 = [0.003, 40];
let X = [...X0];
let Y = [...Y0];
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
export function renderChart(el, opts) {
  const { curves, points, labels, onPick, fmt, peak = 95, crest = 15, overkillSpl = 130, size } = opts;
  el._chartOpts = opts;
  W = size?.w ?? 760;
  H = size?.h ?? 440;
  X = el._zoom?.x ?? [...X0];
  Y = el._zoom?.y ?? [...Y0];
  const zoomed = !!el._zoom;
  const inX = (z) => z >= X[0] && z <= X[1];
  const inY = (v) => v >= Y[0] && v <= Y[1];
  // Shaded zones that match the verdict rules exactly, so the picture explains
  // itself: a dot's zone is its status. Boundaries follow the best output.
  const env = (z) => Math.max(0, ...curves.map((c) => availableVrms(c.output, z).vrms ?? 0));
  const zs = [];
  for (let i = 0; i <= 80; i++) zs.push(10 ** (Math.log10(X[0]) + (i / 80) * (Math.log10(X[1]) - Math.log10(X[0]))));
  const band = (lo, hi, cls, label) => {
    // lo/hi: multipliers on the envelope (null = chart edge)
    const top = zs.map((z) => `${lx(z).toFixed(1)},${ly(hi == null ? Y[1] : clampY(env(z) * hi)).toFixed(1)}`);
    const bottom = zs.map((z) => `${lx(z).toFixed(1)},${ly(lo == null ? Y[0] : clampY(env(z) * lo)).toFixed(1)}`).reverse();
    const zl = 180;
    const mid = lo == null ? env(zl) * hi / 6 : hi == null ? Math.min(env(zl) * lo * 2.5, Y[1] / 1.6) : Math.sqrt(env(zl) * lo * env(zl) * hi);
    return `<polygon class="zone ${cls}" points="${[...top, ...bottom].join(" ")}"/><text class="zl ${cls}" x="${lx(zl)}" y="${ly(clampY(mid)) + 4}" text-anchor="middle">${esc(label)}</text>`;
  };
  const crestK = 10 ** (crest / 20);
  const overK = 10 ** (-(overkillSpl - peak) / 20);
  const zones = curves.length
    ? [band(crestK, null, "z-insufficient", labels.insufficient), band(1, crestK, "z-tight", labels.tight), band(overK, 1, "z-ok", labels.ok), band(null, overK, "z-overkill", labels.overkill)].join("")
    : "";
  const grid = [];
  const xTicks = [10, 16, 32, 64, 100, 300, 600, 1000];
  const xFine = [8, 12, 20, 24, 40, 50, 80, 150, 200, 250, 400, 500, 800];
  const xs = xTicks.filter(inX);
  if (xs.length < 4) xs.push(...xFine.filter(inX));
  const decades = Math.log10(Y[1] / Y[0]);
  const ys = [0.001, 0.01, 0.1, 1, 10].filter(inY);
  if (decades < 2.5) for (const d of [0.001, 0.01, 0.1, 1, 10]) for (const m of [2, 5]) if (inY(d * m)) ys.push(d * m);
  for (const z of xs) {
    grid.push(`<line class="g" x1="${lx(z)}" x2="${lx(z)}" y1="${PAD.t}" y2="${H - PAD.b}"/>`);
    grid.push(`<text class="t" x="${lx(z)}" y="${H - PAD.b + 16}" text-anchor="middle">${z}</text>`);
  }
  for (const v of ys) {
    grid.push(`<line class="g" x1="${PAD.l}" x2="${W - PAD.r}" y1="${ly(v)}" y2="${ly(v)}"/>`);
    grid.push(`<text class="t" x="${PAD.l - 8}" y="${ly(v) + 4}" text-anchor="end">${v >= 1 ? v : +(v * 1000).toFixed(0) + "m"}V</text>`);
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
  const sorted = [...points].filter((p) => !zoomed || (inX(p.z) && inY(p.v))).sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight));
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
      <div class="zoom-ctl">
        <button type="button" data-zoom="in" title="${esc(labels.zoomIn ?? "Zoom in")}" aria-label="${esc(labels.zoomIn ?? "Zoom in")}">＋</button>
        <button type="button" data-zoom="out" title="${esc(labels.zoomOut ?? "Zoom out")}" aria-label="${esc(labels.zoomOut ?? "Zoom out")}">－</button>
        ${zoomed ? `<button type="button" data-zoom="reset" title="${esc(labels.zoomReset ?? "Reset")}">⟲</button>` : ""}
      </div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.aria)}">
        <defs><clipPath id="plot-clip"><rect x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}"/></clipPath></defs>
        <g clip-path="url(#plot-clip)">${zones}</g>
        ${grid.join("")}
        <text class="axis hint-y" x="${PAD.l + 6}" y="${PAD.t + 12}">↑ ${esc(labels.harder)}</text>
        <text class="axis hint-y" x="${PAD.l + 6}" y="${H - PAD.b - 6}">↓ ${esc(labels.easier)}</text>
        <text class="axis" x="${(PAD.l + W - PAD.r) / 2}" y="${H - 8}" text-anchor="middle">${esc(labels.x)}</text>
        <text class="axis" transform="translate(14 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)" text-anchor="middle">${esc(labels.y)}</text>
        ${pointSvg}
        ${curveSvg}
        <rect class="zoombox" hidden/>
      </svg>
      <p class="zoom-hint">${esc(labels.zoomHint ?? "Drag across the chart to zoom")}</p>
      <div class="tip" hidden></div>
    </div>`;

  const svg = el.querySelector(".chart-box svg");
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
  // Drag a box to zoom into it; a short press is still a click on the nearest dot.
  const toSvg = (ev) => {
    const box = svg.getBoundingClientRect();
    return [((ev.clientX - box.left) / box.width) * W, ((ev.clientY - box.top) / box.height) * H];
  };
  const zAt = (px) => 10 ** (Math.log10(X[0]) + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (Math.log10(X[1]) - Math.log10(X[0])));
  const vAt = (py) => 10 ** (Math.log10(Y[0]) + ((H - PAD.b - py) / (H - PAD.t - PAD.b)) * (Math.log10(Y[1]) - Math.log10(Y[0])));
  const rerender = (zoom) => {
    el._zoom = zoom;
    renderChart(el, el._chartOpts);
  };
  const zb = svg.querySelector(".zoombox");
  let start = null;
  svg.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "touch") return; // touch keeps scrolling; use the buttons
    start = toSvg(ev);
  });
  svg.addEventListener("pointermove", (ev) => {
    if (!start) return;
    const [x, y] = toSvg(ev);
    zb.hidden = false;
    zb.setAttribute("x", Math.min(x, start[0]));
    zb.setAttribute("y", Math.min(y, start[1]));
    zb.setAttribute("width", Math.abs(x - start[0]));
    zb.setAttribute("height", Math.abs(y - start[1]));
  });
  const endDrag = (ev) => {
    if (!start) return;
    const [x, y] = toSvg(ev);
    const [sx, sy] = start;
    start = null;
    zb.hidden = true;
    if (Math.abs(x - sx) > 12 && Math.abs(y - sy) > 12) {
      const xs2 = [zAt(Math.min(x, sx)), zAt(Math.max(x, sx))];
      const ys2 = [vAt(Math.max(y, sy)), vAt(Math.min(y, sy))];
      rerender({ x: [Math.max(xs2[0], X0[0]), Math.min(xs2[1], X0[1])], y: [Math.max(ys2[0], Y0[0]), Math.min(ys2[1], Y0[1])] });
      return;
    }
    const { best } = nearest(ev);
    if (best && onPick) onPick(best.p.id);
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointerleave", () => {
    start = null;
    zb.hidden = true;
  });
  // Buttons: halve or double the visible range (in log space) around the centre.
  const scale = (k) => {
    const sc = (r, full) => {
      const [a, b] = r.map(Math.log10);
      const c = (a + b) / 2;
      const h = ((b - a) / 2) * k;
      const lo = Math.max(c - h, Math.log10(full[0]));
      const hi = Math.min(c + h, Math.log10(full[1]));
      return [10 ** lo, 10 ** hi];
    };
    const x = sc(X, X0), y = sc(Y, Y0);
    const full = x[0] <= X0[0] * 1.001 && x[1] >= X0[1] * 0.999 && y[0] <= Y0[0] * 1.001 && y[1] >= Y0[1] * 0.999;
    rerender(full ? null : { x, y });
  };
  el.querySelectorAll("[data-zoom]").forEach((b) =>
    b.addEventListener("click", () => (b.dataset.zoom === "reset" ? rerender(null) : scale(b.dataset.zoom === "in" ? 0.5 : 2))),
  );
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
