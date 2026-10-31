// Voltage-vs-impedance chart. Log-log. One SVG, no library.
//
// Curves: what a source can deliver at each load (from calc.availableVrms).
// Points: what each headphone needs at the chosen peak level, at its impedance.
// A point under a curve is drivable. Status is shown by shape + colour + legend,
// never colour alone.

import { availableVrms } from "./calc.js?v=mvw64wbk";

let W = 760;
let H = 440;
const PAD = { l: 88, r: 100, t: 20, b: 72 };
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
  const { curves, points, labels, fmt, peak = 95, crest = 15, overkillSpl = 130, size } = opts;
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
    // Label in the middle of what's visible of the zone at one impedance, and
    // only where the zone is tall enough on screen not to run into the next one.
    const zl = 10 ** ((Math.log10(X[0]) * 2 + Math.log10(X[1]) * 3) / 5);
    const yLo = ly(lo == null ? Y[0] : clampY(env(zl) * lo));
    const yHi = ly(hi == null ? Y[1] : clampY(env(zl) * hi));
    const text = yLo - yHi >= 22 ? `<text class="zl ${cls}" x="${lx(zl)}" y="${(yLo + yHi) / 2 + 4}" text-anchor="middle">${esc(label)}</text>` : "";
    return `<polygon class="zone ${cls}" points="${[...top, ...bottom].join(" ")}"/>${text}`;
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
    grid.push(`<text class="t" x="${lx(z)}" y="${H - PAD.b + 24}" text-anchor="middle">${z}</text>`);
  }
  for (const v of ys) {
    grid.push(`<line class="g" x1="${PAD.l}" x2="${W - PAD.r}" y1="${ly(v)}" y2="${ly(v)}"/>`);
    grid.push(`<text class="t" x="${PAD.l - 12}" y="${ly(v) + 4.5}" text-anchor="end">${v >= 1 ? v : +(v * 1000).toFixed(0) + "m"}V</text>`);
  }

  // Curves are clipped to the plot, not pressed flat against its edge when
  // zoomed in; the label goes at the last point still in view.
  const curveParts = curves.map((c) => {
    const pts = [];
    let last = null;
    for (let i = 0; i <= 80; i++) {
      const z = 10 ** (Math.log10(X[0]) + (i / 80) * (Math.log10(X[1]) - Math.log10(X[0])));
      const v = availableVrms(c.output, z).vrms;
      if (!v) continue;
      pts.push(`${lx(z).toFixed(1)},${ly(v).toFixed(1)}`);
      if (inY(v)) last = [lx(z), ly(v)];
    }
    return {
      line: pts.length ? `<polyline class="curve${c.dashed ? " dashed" : ""}" points="${pts.join(" ")}"/>` : "",
      label: last ? `<text class="cl" x="${last[0] + 6}" y="${last[1] + 4}">${esc(c.label)}</text>` : "",
    };
  });
  const curveSvg = `<g clip-path="url(#plot-clip)">${curveParts.map((c) => c.line).join("")}</g>${curveParts.map((c) => c.label).join("")}`;

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
        <text class="axis" x="${(PAD.l + W - PAD.r) / 2}" y="${H - 16}" text-anchor="middle">${esc(labels.x)}</text>
        <text class="axis" transform="translate(22 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)" text-anchor="middle">${esc(labels.y)}</text>
        ${pointSvg}
        ${curveSvg}
        <text class="axis hint-y" x="${PAD.l + 6}" y="${PAD.t + 12}">↑ ${esc(labels.harder)}</text>
        <text class="axis hint-y" x="${PAD.l + 6}" y="${H - PAD.b - 6}">↓ ${esc(labels.easier)}</text>
      </svg>
      <div class="map-hint" hidden></div>
      <p class="zoom-hint">${esc(labels.zoomHint ?? "Ctrl + scroll or pinch to zoom · drag to move")}</p>
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
    if (el._drag?.moved) return;
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
  // Like a map: drag to move, Ctrl + scroll / trackpad pinch / two fingers to
  // zoom at the pointer, double-click to zoom in. A plain scroll still scrolls
  // the page; a short press is still a click on the nearest dot.
  el._nearest = nearest;
  el._size = { w: W, h: H };
  if (!el._wired) wire(el);
  el.querySelectorAll("[data-zoom]").forEach((b) =>
    b.addEventListener("click", () => (b.dataset.zoom === "reset" ? setView(el, null) : zoomAt(el, 0.5, 0.5, b.dataset.zoom === "in" ? 0.5 : 2))),
  );
}

// ---------------------------------------------------------------------------
// Map-style view changes, in log space, kept inside the full range.

const MIN_SPAN = { x: Math.log10(1.6), y: Math.log10(2) };
const viewOf = (el) => el._zoom ?? { x: [...X0], y: [...Y0] };
function fit(r, full, minSpan) {
  let [a, b] = r;
  const [fa, fb] = full.map(Math.log10);
  if (b - a > fb - fa) return [fa, fb];
  if (b - a < minSpan) {
    const c = (a + b) / 2;
    [a, b] = [c - minSpan / 2, c + minSpan / 2];
  }
  if (a < fa) [a, b] = [fa, fa + (b - a)];
  if (b > fb) [a, b] = [fb - (b - a), fb];
  return [a, b];
}
function setView(el, v) {
  if (v) {
    const full = v.x[0] <= X0[0] * 1.001 && v.x[1] >= X0[1] * 0.999 && v.y[0] <= Y0[0] * 1.001 && v.y[1] >= Y0[1] * 0.999;
    if (full) v = null;
  }
  el._zoom = v;
  if (el._raf) return;
  el._raf = requestAnimationFrame(() => {
    el._raf = 0;
    renderChart(el, el._chartOpts);
  });
}
/** Zoom by k (<1 in) around a point given as fractions of the plot (0..1 from left / bottom). */
function zoomAt(el, fx, fy, k, from = viewOf(el)) {
  const around = (r, f, full, min) => {
    const [a, b] = r.map(Math.log10);
    const p = a + (b - a) * f;
    return fit([p - (p - a) * k, p + (b - p) * k], full, min).map((n) => 10 ** n);
  };
  setView(el, { x: around(from.x, fx, X0, MIN_SPAN.x), y: around(from.y, fy, Y0, MIN_SPAN.y) });
}
/** Move by a fraction of the plot (dfx right, dfy up). */
function panBy(el, dfx, dfy, from) {
  const shift = (r, f, full, min) => {
    const [a, b] = r.map(Math.log10);
    const d = (b - a) * f;
    return fit([a - d, b - d], full, min).map((n) => 10 ** n);
  };
  setView(el, { x: shift(from.x, dfx, X0, MIN_SPAN.x), y: shift(from.y, dfy, Y0, MIN_SPAN.y) });
}

// Listeners live on the container, which stays while the SVG inside is redrawn.
function wire(el) {
  el._wired = true;
  const plot = (ev) => {
    const svg = el.querySelector(".chart-box svg");
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const { w, h } = el._size;
    const px = ((ev.clientX - box.left) / box.width) * w;
    const py = ((ev.clientY - box.top) / box.height) * h;
    return { fx: (px - PAD.l) / (w - PAD.l - PAD.r), fy: (h - PAD.b - py) / (h - PAD.t - PAD.b), pw: (box.width * (w - PAD.l - PAD.r)) / w, ph: (box.height * (h - PAD.t - PAD.b)) / h };
  };
  const inSvg = (ev) => ev.target.closest?.(".chart-box svg");
  let hintTimer = 0;
  const hint = (text) => {
    const box = el.querySelector(".map-hint");
    if (!box || !text) return;
    box.textContent = text;
    box.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (box.hidden = true), 1200);
  };

  el.addEventListener(
    "wheel",
    (ev) => {
      if (!inSvg(ev)) return;
      // Trackpad pinch arrives as a wheel event with ctrlKey.
      if (!(ev.ctrlKey || ev.metaKey)) return hint(el._chartOpts.labels.ctrlHint);
      ev.preventDefault();
      const p = plot(ev);
      zoomAt(el, p.fx, p.fy, Math.exp(Math.max(-1, Math.min(1, ev.deltaY * 0.01)) * 0.25));
    },
    { passive: false },
  );
  el.addEventListener("dblclick", (ev) => {
    if (!inSvg(ev)) return;
    const p = plot(ev);
    zoomAt(el, p.fx, p.fy, ev.shiftKey ? 2 : 0.5);
  });

  const touches = new Map();
  el.addEventListener("pointerdown", (ev) => {
    if (!inSvg(ev) || ev.button > 0) return;
    if (ev.pointerType === "touch") {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        el._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: plot({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }), from: viewOf(el) };
        el._drag = null;
      } else el._drag = { x: ev.clientX, y: ev.clientY, from: viewOf(el), moved: false, touch: true, id: ev.pointerId };
      return;
    }
    el._drag = { x: ev.clientX, y: ev.clientY, from: viewOf(el), moved: false, id: ev.pointerId };
    el.setPointerCapture?.(ev.pointerId);
  });
  el.addEventListener("pointermove", (ev) => {
    if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (el._pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0) zoomAt(el, el._pinch.mid.fx, el._pinch.mid.fy, el._pinch.d / d, el._pinch.from);
      return;
    }
    const g = el._drag;
    if (!g || g.id !== ev.pointerId) return;
    const dx = ev.clientX - g.x;
    const dy = ev.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    // One finger scrolls the page (two fingers move the chart), like an embedded map.
    if (g.touch) return void (el._drag = null);
    g.moved = true;
    el.querySelector(".tip")?.setAttribute("hidden", "");
    const p = plot(ev);
    if (p) panBy(el, dx / p.pw, -dy / p.ph, g.from);
  });
  const end = (ev) => {
    touches.delete(ev.pointerId);
    if (touches.size < 2) el._pinch = null;
    const g = el._drag;
    if (!g || g.id !== ev.pointerId) return;
    el._drag = null;
    if (g.moved || ev.type !== "pointerup") return;
    const { best } = el._nearest?.(ev) ?? {};
    if (best) el._chartOpts.onPick?.(best.p.id);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
