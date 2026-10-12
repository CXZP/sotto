// Per-jack output figures from a store's spec lines.
//
// Stores list power and output impedance for each headphone jack, in either order:
//   "Output Power: Balanced (4.4mm) ≥241mW at 32Ω; ≥4V at 300Ω / S-Balanced (3.5mm) ≥100mW at 32Ω; ≥2V at 300Ω"
//   "RMS OUTPUT POWER : ≥241mW @ 32Ω; 4V @ 300Ω (Balanced);"  +  next line "≥100mW @ 32Ω; 2V @ 300Ω (S-Balanced*)"
// Merging those into one jack and taking the highest figure tells a 3.5 mm user
// they get the 4.4 mm output. Here every figure keeps its jack; when any figure
// in a line can't be tied to a jack, the whole set is dropped (no guessing).

const NUM = "(\\d+(?:\\.\\d+)?)";
const OHM = "\\s*(?:Ω|ohms?\\b)";
const AT = "\\s*(?:@|at|into|\\/)\\s*";
const POWER = new RegExp(`${NUM}\\s*(mW|W)\\b${AT}${NUM}${OHM}`, "g");
const VOLT = new RegExp(`${NUM}\\s*V(?:rms)?${AT}${NUM}${OHM}`, "gi");
const ZOUT = new RegExp(`[<≤]?\\s*${NUM}${OHM}`, "gi");

const POWER_LABEL = /\b(?:(?:rms\s+)?output\s+power|power\s+output|max(?:imum)?\s+output|rated\s+power)\b/i;
const ZOUT_LABEL = /\boutput\s+impedance\b/i;
const OTHER_LABEL = /^[^:：]{2,40}[:：]/;
// A continuation line carries figures and no label of its own.
const CONTINUES = /^[≥≤<>~\s]*\d/;

// Jack words. Explicit sizes first; "S-Balanced" (iFi's 3.5 mm) before "Balanced".
const JACK_WORDS = [
  ["4.4", /\b4\.4\s?mm\b|\b4\.4\b/i],
  ["3.5", /\b3\.5\s?mm\b|\b3\.5\b|\bs-?balanced\b|\bsingle[- ]ended\b|\bunbalanced\b|\bse\b/i],
  ["2.5", /\b2\.5\s?mm\b/i],
  ["6.35", /\b6\.35\s?mm\b|\b6\.3\s?mm\b|\b1\/4["”]?/i],
  ["xlr4", /\bxlr\b/i],
  ["4.4", /\bbalanced\b|\bbal\b/i],
];
const MARKER = new RegExp(JACK_WORDS.map(([, re]) => re.source).join("|"), "gi");

function jackOf(text, category) {
  for (const [jack, re] of JACK_WORDS) {
    if (!re.test(text)) continue;
    // Desktop gear: "single-ended" is usually the 6.35 mm jack, "balanced" may be XLR.
    if (category === "desktop" && !/\d\s?mm|\bxlr\b|\b4\.4\b|\b3\.5\b|\b6\.3/i.test(text)) return null;
    return jack;
  }
  return null;
}

/** Figures in one line, each tied to the jack word before or after it. */
function figures(line, field, category) {
  const body = line.replace(/^[^:：]*[:：]/, (m) => (POWER_LABEL.test(m) || ZOUT_LABEL.test(m) ? " ".repeat(m.length) : m));
  const marks = [...body.matchAll(MARKER)].map((m) => ({ at: m.index, jack: jackOf(m[0], category) }));
  const found = [];
  if (field === "power") {
    for (const m of body.matchAll(POWER)) found.push({ at: m.index, kind: "power", load: +m[3], mw: m[2] === "W" ? +m[1] * 1000 : +m[1] });
    for (const m of body.matchAll(VOLT)) found.push({ at: m.index, kind: "voltage", load: +m[2], vrms: +m[1] });
  } else {
    for (const m of body.matchAll(ZOUT)) found.push({ at: m.index, kind: "zout", value: +m[1] });
  }
  if (!found.length) return [];
  found.sort((a, b) => a.at - b.at);
  // Jack words lead ("Balanced (4.4mm) 241mW...") or trail ("241mW ... (Balanced)").
  const leads = marks.length && marks[0].at < found[0].at;
  for (const f of found) {
    const m = leads ? marks.filter((k) => k.at < f.at).at(-1) : marks.find((k) => k.at > f.at);
    f.jack = m?.jack ?? null;
  }
  return found;
}

/** [{ jack, power:[{load,mw}], voltage:[{load,vrms}], zout, quote }] or null. */
export function jackOutputs(lines, category) {
  const all = [];
  let field = null;
  for (const line of lines) {
    if (line.length > 240) {
      field = null;
      continue;
    }
    if (POWER_LABEL.test(line)) field = "power";
    else if (ZOUT_LABEL.test(line)) field = "zout";
    else if (!(field && CONTINUES.test(line)) || OTHER_LABEL.test(line)) {
      field = null;
      continue;
    }
    const f = figures(line, field, category);
    if (f.some((x) => !x.jack)) return null;
    for (const x of f) all.push({ ...x, quote: line });
  }
  const jacks = new Set(all.filter((x) => x.kind !== "zout").map((x) => x.jack));
  // One jack named once is no better than the old reading; two or more is the point.
  if (jacks.size < 2) return null;
  return [...jacks].map((jack) => {
    const mine = all.filter((x) => x.jack === jack);
    const out = { jack, power: [], voltage: [], zout: null, quotes: [...new Set(mine.map((x) => x.quote))] };
    for (const x of mine) {
      if (x.kind === "power" && !out.power.some((p) => p.load === x.load)) out.power.push({ load: x.load, mw: x.mw });
      if (x.kind === "voltage" && !out.voltage.some((p) => p.load === x.load)) out.voltage.push({ load: x.load, vrms: x.vrms });
      if (x.kind === "zout" && out.zout == null) out.zout = x.value;
    }
    return out;
  });
}
