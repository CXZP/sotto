// Frequency-response files the reader brings: REW / squig.link .txt and
// AutoEq .csv. Parsed and drawn in the browser only; the files never leave
// the reader's computer and Sotto stores no one's measurements.

/**
 * Text → [{ f, db }] sorted by frequency, 20 Hz–20 kHz.
 * Accepts "freq db [phase]" lines split by spaces, tabs, commas or
 * semicolons; comment and header lines (* # " or a word) are skipped. For a
 * CSV with a header, the "raw" column is used when there is one (AutoEq),
 * else the second column.
 */
export function parseFR(text) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  let col = 1;
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^[*#;"/]/.test(line)) continue;
    // Separator: tab or ";" if present; "," for a CSV (dots are the decimals);
    // otherwise spaces, where a "," is a decimal comma (European REW export).
    const sep = /[\t;]/.test(line) ? /[\t;]+/ : line.includes(",") && (line.includes(".") || !/\s/.test(line)) ? /,/ : /\s+/;
    const cells = line.split(sep).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    if (!/^[-+]?\d/.test(cells[0])) {
      // Header: pick the column to plot.
      const names = cells.map((c) => c.toLowerCase().replace(/"/g, ""));
      const i = names.indexOf("raw");
      if (i > 0) col = i;
      continue;
    }
    const num = (c) => Number(String(c).replace(",", "."));
    const f = num(cells[0]);
    const db = num(cells[col] ?? cells[1]);
    if (Number.isFinite(f) && Number.isFinite(db) && f >= 15 && f <= 24000 && Math.abs(db) < 200) out.push({ f, db });
  }
  out.sort((a, b) => a.f - b.f);
  return out;
}

/** dB at a frequency, interpolated on a log-frequency axis. */
export function dbAt(curve, f) {
  if (!curve.length) return NaN;
  if (f <= curve[0].f) return curve[0].db;
  if (f >= curve[curve.length - 1].f) return curve[curve.length - 1].db;
  let lo = 0, hi = curve.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (curve[m].f <= f) lo = m;
    else hi = m;
  }
  const a = curve[lo], b = curve[hi];
  const t = (Math.log(f) - Math.log(a.f)) / (Math.log(b.f) - Math.log(a.f) || 1);
  return a.db + (b.db - a.db) * t;
}

/** Shift so the curve reads `level` dB at `at` Hz (default 0 dB at 1 kHz). */
export function normalize(curve, at = 1000, level = 0) {
  const off = level - dbAt(curve, at);
  return curve.map((p) => ({ f: p.f, db: p.db + off }));
}

/** Resample to `n` log-spaced points, averaging over a 1/`frac`-octave window (0 = no smoothing). */
export function smooth(curve, frac = 0, n = 240) {
  if (!curve.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = 20 * Math.pow(1000, i / (n - 1)); // 20 Hz → 20 kHz
    if (!frac) {
      out.push({ f, db: dbAt(curve, f) });
      continue;
    }
    const k = Math.pow(2, 1 / (2 * frac));
    const pts = curve.filter((p) => p.f >= f / k && p.f <= f * k);
    out.push({ f, db: pts.length ? pts.reduce((s, p) => s + p.db, 0) / pts.length : dbAt(curve, f) });
  }
  return out;
}

const W = 760, H = 380, PAD = { l: 46, r: 16, t: 14, b: 34 };
const FX = [20, 20000];
const lx = (f) => PAD.l + (Math.log10(f / FX[0]) / Math.log10(FX[1] / FX[0])) * (W - PAD.l - PAD.r);

/**
 * SVG of the traces. traces: [{ label, points, color }]. Y range fits the data
 * in 5 dB steps. Returns { svg, yOf } so the caller can place a crosshair.
 */
export function frSvg(traces, { delta = false } = {}) {
  const all = traces.flatMap((t) => t.points.map((p) => p.db));
  let lo = Math.floor((all.length ? Math.min(...all) : -10) / 5) * 5 - 5;
  let hi = Math.ceil((all.length ? Math.max(...all) : 10) / 5) * 5 + 5;
  if (hi - lo < 20) {
    const mid = (hi + lo) / 2;
    lo = Math.floor((mid - 10) / 5) * 5;
    hi = lo + 20;
  }
  const ly = (db) => H - PAD.b - ((db - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const xt = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const step = hi - lo > 40 ? 10 : 5;
  const yt = [];
  for (let v = lo; v <= hi; v += step) yt.push(v);
  const grid = [
    ...xt.map((f) => `<line x1="${lx(f)}" x2="${lx(f)}" y1="${PAD.t}" y2="${H - PAD.b}"/><text x="${lx(f)}" y="${H - PAD.b + 18}" text-anchor="middle">${f >= 1000 ? `${f / 1000}k` : f}</text>`),
    ...yt.map((v) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${ly(v)}" y2="${ly(v)}"${v === 0 && delta ? ' class="zero"' : ""}/><text x="${PAD.l - 8}" y="${ly(v) + 4}" text-anchor="end">${v > 0 ? "+" : ""}${v}</text>`),
  ].join("");
  const paths = traces
    .map((t) => `<path d="${t.points.map((p, i) => `${i ? "L" : "M"}${lx(p.f).toFixed(1)} ${ly(p.db).toFixed(1)}`).join("")}" style="stroke:${t.color}"${t.dashed ? ' stroke-dasharray="6 4"' : ""}/>`)
    .join("");
  const svg = `<svg class="fr-svg" viewBox="0 0 ${W} ${H}" role="img"><g class="fr-grid">${grid}</g><g class="fr-lines">${paths}</g><g class="fr-hover" hidden><line class="fr-cross" y1="${PAD.t}" y2="${H - PAD.b}"/></g><text class="fr-unit" x="${PAD.l}" y="${PAD.t - 2}">dB</text></svg>`;
  return { svg, ly, lx, box: { W, H, PAD }, fOfX: (x) => FX[0] * Math.pow(FX[1] / FX[0], (x - PAD.l) / (W - PAD.l - PAD.r)) };
}
