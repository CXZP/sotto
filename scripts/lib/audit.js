// Catalog audit: rules that find entries contradicting themselves or each other.
// Passing a rule does not make an entry right (every store may copy the same
// wrong figure); failing one makes it wrong or unknown for sure. The counts are
// a floor on the errors, and a regression alarm when a new store or rule change
// makes them jump.

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const HP = new Set(["iem", "headphone"]);
const SRC = new Set(["dongle", "desktop", "dap"]);
const hpAmp = (i) => i.category === "desktop" && (i.role === "amp" || i.role === "dacamp");
const titles = (i) => i.offers.map((o) => o.title);

// Same brand + model once colours, "wireless", "edition", spacing... are ignored.
const SAME_NOISE = /\b(portable|desktop|headphones?|amplifier|amp|usb|dac|class[- ]?a|balanced|jack|4\.4mm|3\.5mm|with|and|the|for|in-?ear|iems?|earphones?|monitors?|universal|wireless|bluetooth|hifi|hi-fi|edition|version|new|black|silver|white|grey|gray|red|open box|demo unit)\b/gi;
const sameKey = (i) => `${norm(i.brand)}|${(i.model ?? "").toLowerCase().replace(/[-_]/g, " ").replace(SAME_NOISE, " ").replace(/[^a-z0-9]+/g, "")}`;

/** [name, severity, test(item, ctx)] — "error": contradiction; "gap": can't compute. */
export const RULES = [
  ["sources disagree, nothing settles it", "error", (i) => !!i.conflicts?.length],
  ["stores disagree on the kind of thing", "error", (i) => !!i.categoryConflict],
  ["brand is a store's name", "error", (i, c) => c.stores.has(norm(i.brand)) && !titles(i).some((t) => norm(t).includes(norm(i.brand))) && !/^(moon-audio--dragon|kitsunehifi--kte)/.test(i.id)],
  ["stock-condition word in the model id", "error", (i) => /(^|-)(pre-?owned|preowned|pre-?sale|pre-?order|open-box|b-stock|refurbished|demo|clearance|used|discontinued)(-|$)/.test(i.id)],
  ["USB-only power, yet the maker lists a DC inlet", "error", (i) => i.dcIn?.usb && !i.dcIn.barrel && !!i.ports?.in?.dc],
  ["a jack with power figures missing from the jack list", "error", (i) => !!i.jacks?.length && (i.outputs ?? []).some((o) => o.jack && !i.jacks.includes(o.jack))],
  ["speaker amp filed as a headphone amp", "error", (i) => hpAmp(i) && titles(i).some((t) => /\b(power amp(lifier)?|stereo amp(lifier)?|mono(block|aural)? amp|\d{2,4}\s?watts?\b|home cinema|custom install)/i.test(t)) && !titles(i).some((t) => /headphone/i.test(t))],
  ["headphones carrying an amp's power figure", "error", (i) => HP.has(i.category) && !!i.specs?.power?.length],
  ["store merchandise as a product", "error", (i) => titles(i).some((t) => /gift cards?|\btee\b|t-shirt|desk mat|lucky bag|mystery box/i.test(t))],
  ["one model split across entries", "error", (i, c) => c.split.has(i.id)],
  ["no photo", "gap", (i) => !i.image && !i.offers.some((o) => o.image)],
  ["headphones without impedance + sensitivity", "gap", (i) => HP.has(i.category) && !(i.specs?.impedance && i.specs?.sensitivity)],
  ["source without any power figure", "gap", (i) => SRC.has(i.category) && i.role !== "dac" && i.role !== "streamer" && !i.outputs?.length && !i.specs?.power?.length],
];

export function audit(catalog) {
  const stores = new Set([...Object.values(catalog.stores ?? {}).flatMap((s) => [norm(s.name), norm(s.host?.split(".")[0])]), "addsoap", "addictedtoaudio"]);
  const byKey = new Map();
  for (const i of catalog.items) {
    const k = sameKey(i);
    if (k.split("|")[1].length >= 2) byKey.set(k, [...(byKey.get(k) ?? []), i.id]);
  }
  const split = new Set([...byKey.values()].filter((ids) => ids.length > 1).flat());
  const ctx = { stores, split };
  const rules = {};
  for (const [name, severity, fn] of RULES) {
    const ids = catalog.items.filter((i) => fn(i, ctx)).map((i) => i.id);
    rules[name] = { severity, n: ids.length, ids };
  }
  return { models: catalog.items.length, rules };
}

/** Rules that grew past noise since the last audit: [name, before, now]. */
export function regressions(prev, now) {
  const out = [];
  for (const [name, r] of Object.entries(now.rules)) {
    const before = prev?.rules?.[name]?.n;
    if (before == null) continue;
    if (r.n - before > Math.max(5, before * 0.1)) out.push([name, before, r.n]);
  }
  return out;
}
