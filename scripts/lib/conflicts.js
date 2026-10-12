// When sources disagree on a headphone's impedance or sensitivity.
//
// Not a disagreement: rounding (32 vs 32.5 Ω), or the same sensitivity in the
// other unit (102 dB/mW on 32 Ω is 117 dB/V). A real disagreement is settled
// by the maker's own page or a hand-checked value; otherwise the field is
// marked as conflicting and stays out of the loudness maths, instead of the
// build picking whichever value more stores copied.

import { isMakerUrl } from "./sources.js";

const near = (a, b, tol) => Math.abs(a - b) <= tol;
// dB/mW → dB/V on a given impedance: 1 mW into Z ohms is sqrt(Z/1000) V.
const toDbV = (e, z) => (e.unit === "dB/mW" ? e.value + 10 * Math.log10(1000 / z) : e.unit === "dB/V" ? e.value : null);

/** Groups of values that mean the same thing. */
function groups(field, list, z) {
  const out = [];
  for (const e of list) {
    const key = field === "impedance" ? e.value : toDbV(e, z);
    if (key == null) continue; // unit unknown: can't take a side
    const tol = field === "impedance" ? Math.max(0.5, key * 0.05) : 1.5;
    const g = out.find((x) => near(x.key, key, tol));
    if (g) g.entries.push(e);
    else out.push({ key, entries: [e] });
  }
  return out;
}

const trusted = (e, brand) => e.kind === "measured" || e.curated || e.sources?.some((s) => isMakerUrl(s.url, brand));

/**
 * Puts a maker / hand-checked value first. Returns the fields that still
 * disagree (no trusted value to settle them).
 */
export function settle(specs, brand) {
  const open = [];
  const z = specs.impedance?.[0]?.value;
  for (const field of ["impedance", "sensitivity"]) {
    const list = specs[field];
    if (!list?.length) continue;
    const gs = groups(field, list, z);
    if (gs.length < 2) continue;
    const winner = gs.find((g) => g.entries.some((e) => trusted(e, brand)));
    if (winner) {
      const lead = winner.entries.find((e) => trusted(e, brand));
      specs[field] = [lead, ...list.filter((e) => e !== lead)];
    } else open.push(field);
  }
  return open;
}
