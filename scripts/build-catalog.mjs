// Builds data/catalog.json from the crawl snapshots in cache/raw/.
//
// Output holds only facts: category, prices, availability, links, and spec
// values with the verbatim spec line they came from. No store prose or images
// are copied into the repo.
//
// Run: node scripts/build-catalog.mjs

import { readFile, readdir, writeFile } from "node:fs/promises";
import { classify, condition, modelKey, compact } from "./lib/classify.js";
import { extractSpecs, verify } from "./lib/specs.js";

const root = new URL("..", import.meta.url);
const KEEP = new Set(["iem", "headphone", "dongle", "desktop", "dap"]);
const FIELDS = ["impedance", "sensitivity", "zout", "power"];
const ACCESSORY_VARIANT = /\b(case|pouch|bag|cable|cord|tips?|eartips|pads?|filter|adapter|only|replacement|spare|accessor(y|ies)|strap|film|protector|tempered|screen|holster|sleeve|lanyard|dust|stand|cover|skin|sticker|no device|without)\b/i;

const files = (await readdir(new URL("cache/raw/", root))).filter((f) => f.endsWith(".json"));
const groups = new Map();
const stats = { products: 0, kept: 0, byCategory: {}, withSpecs: {}, rejected: 0, stores: {} };

for (const file of files) {
  const snap = JSON.parse(await readFile(new URL(`cache/raw/${file}`, root), "utf8"));
  stats.stores[snap.store] = { name: snap.name, host: snap.host, products: snap.products.length, fetchedAt: snap.fetchedAt };
  for (const p of snap.products) {
    stats.products++;
    let category = classify(p);
    // Stores file small USB DACs under "AMP & DAC". A sub-$40 "desktop" unit that
    // doesn't call itself desktop/tube/preamp is a dongle.
    if (category === "desktop" && Math.max(...p.variants.map((v) => v.price || 0)) < 40 && !/desktop|tube|preamp/i.test(p.title)) category = "dongle";
    stats.byCategory[category] = (stats.byCategory[category] ?? 0) + 1;
    if (!KEEP.has(category)) continue;
    stats.kept++;

    const url = `https://${snap.host}/products/${p.handle}`;
    const { lines, specs } = extractSpecs(p.body);
    const verified = {};
    for (const field of FIELDS) {
      verified[field] = [];
      // Output power and output impedance describe sources, not headphones
      // ("works with amps delivering 125 mW" is a requirement, not a rating).
      const isSource = category === "dongle" || category === "desktop" || category === "dap";
      if ((field === "power" || field === "zout") && !isSource) continue;
      if (field === "impedance" && isSource) continue; // an amp's "impedance" is usually input impedance
      for (const entry of specs[field]) {
        const check = verify(field, entry, lines);
        if (check.ok) verified[field].push({ ...entry, source: url });
        else stats.rejected++;
      }
    }

    const { key, model } = modelKey(p.vendor, p.title);
    const g =
      groups.get(key) ??
      { id: key, brand: p.vendor || null, model, category, offers: [], specs: { impedance: [], sensitivity: [], zout: [], power: [] } };
    // A model listed as "headphone" at one store and "iem" at another keeps the first;
    // the conflict is recorded so a person can look.
    if (g.category !== category) g.categoryConflict = [...new Set([...(g.categoryConflict ?? [g.category]), category])];
    const { price, priceMax, available } = mainPrice(p.variants);
    if (price == null) continue;
    g.offers.push({
      store: snap.store,
      title: p.title,
      url,
      price,
      priceMax: priceMax !== price ? priceMax : undefined,
      currency: snap.currency,
      available,
      condition: condition(p.title),
      seenAt: snap.fetchedAt,
      image: p.image ?? undefined,
    });
    for (const field of FIELDS) g.specs[field].push(...verified[field]);
    groups.set(key, g);
  }
}

// Variants like "Case only" or "Leather case" are accessories sold on the same
// page. They must not become the product's price.
// "Only Blue Leather Case" is an accessory; "M21 + Leather Case" and "M21 without Case" are the product.
function isAccessoryVariant(title) {
  if (/\b(only|spare|replacement|no device)\b/i.test(title)) return true;
  if (/\+|\b(with|without|w\/o?|bundle|set)\b/i.test(title)) return false;
  return ACCESSORY_VARIANT.test(title);
}

function mainPrice(variants) {
  const priced = variants.filter((v) => v.price > 0);
  const main = priced.filter((v) => !isAccessoryVariant(v.title));
  // If every variant looks like an accessory, the product itself probably is one.
  const use = main.length ? main : priced;
  if (!use.length) return { price: null };
  const prices = use.map((v) => v.price);
  return { price: Math.min(...prices), priceMax: Math.max(...prices), available: use.some((v) => v.available) };
}

// The same figure quoted by several stores becomes one value with several sources.
function merge(list) {
  const byValue = new Map();
  for (const e of list) {
    const { source, quote, ...facts } = e;
    const key = JSON.stringify(facts);
    const m = byValue.get(key) ?? { ...facts, sources: [] };
    if (!m.sources.some((s) => s.url === source)) m.sources.push({ url: source, quote });
    byValue.set(key, m);
  }
  return [...byValue.values()];
}

// A price far from the other stores' prices for the same model is more likely a
// wrong variant, a bundle or a currency slip than a real deal. Flag, don't drop.
let suspect = 0;
for (const g of groups.values()) {
  const usd = g.offers.filter((o) => o.currency === "USD" && o.condition === "new").map((o) => o.price).sort((a, b) => a - b);
  if (usd.length < 2) continue;
  const median = usd[Math.floor(usd.length / 2)];
  for (const o of g.offers) {
    if (o.currency === "USD" && (o.price > median * 3 || o.price < median / 3)) {
      o.suspect = true;
      suspect++;
    }
  }
}
stats.suspectPrices = suspect;

// Hand-checked entries (data/headphones.json, data/amps.json) join the same
// catalog. They win where they exist: measured values and per-jack outputs.
const curatedHp = JSON.parse(await readFile(new URL("data/headphones.json", root), "utf8"));
const curatedAmps = JSON.parse(await readFile(new URL("data/amps.json", root), "utf8"));
const asSpec = (e) => ({ value: e.value, ...(e.unit ? { unit: e.unit } : {}), kind: e.kind, sources: [{ url: e.source }], ...(e.note ? { note: e.note } : {}) });
let curatedMatched = 0;

// Find the store listing a hand-checked entry refers to: same brand, and the
// store's model name starts with the curated one once hyphens are ignored.
// Among candidates prefer the shortest name (fewest extra words), then most offers.
function findGroup(key) {
  if (groups.has(key)) return key;
  const [brand, model] = key.split("--");
  const want = compact(model);
  const candidates = [...groups.values()].filter((g) => {
    const [b, m] = g.id.split("--");
    return b === brand && compact(m).startsWith(want) && !/(?:^|-)(x|bt|wireless|m)(?:-|$)/.test(m.slice(model.length));
  });
  candidates.sort((a, b) => a.id.length - b.id.length || b.offers.length - a.offers.length);
  return candidates[0]?.id ?? key;
}

function attach(entry, category, extra) {
  const { key: rawKey, model } = modelKey(entry.brand, `${entry.brand} ${entry.model}`);
  const key = findGroup(rawKey);
  const existing = groups.get(key);
  if (existing) curatedMatched++;
  const g = existing ?? { id: key, brand: entry.brand, model: entry.model, category, offers: [], specs: { impedance: [], sensitivity: [], zout: [], power: [] } };
  g.curated = true;
  g.curatedId = entry.id;
  Object.assign(g, extra(g));
  groups.set(key, g);
}

for (const hp of curatedHp) {
  attach(hp, hp.type === "iem" ? "iem" : "headphone", (g) => ({
    category: hp.type === "iem" ? "iem" : "headphone",
    driver: hp.driver,
    drivers: hp.drivers,
    back: hp.back,
    cable: hp.cable,
    stockPlug: hp.stockPlug ?? null,
    notes: hp.notes,
    curatedSpecs: { impedance: hp.impedance.map(asSpec), sensitivity: hp.sensitivity.map(asSpec) },
  }));
}
for (const amp of curatedAmps) {
  attach(amp, amp.kind, () => ({ category: amp.kind, input: amp.input, outputs: amp.outputs }));
}

const KIND_RANK = { measured: 0, claimed: 1 };
// Order: measured first, then values with a stated unit, then the most-quoted.
const rank = (list) =>
  list.sort(
    (a, b) =>
      KIND_RANK[a.kind ?? "claimed"] - KIND_RANK[b.kind ?? "claimed"] ||
      Number(b.unit != null || b.load != null) - Number(a.unit != null || a.load != null) ||
      b.sources.length - a.sources.length,
  );

const catalog = [...groups.values()]
  .map((g) => {
    const specs = Object.fromEntries(Object.entries(g.specs).map(([k, v]) => [k, merge(v).map((e) => ({ ...e, kind: "claimed" }))]));
    // A hand-checked value equal to a store value is one value with more sources.
    for (const [k, curated] of Object.entries(g.curatedSpecs ?? {})) {
      for (const c of curated) {
        const same = specs[k].find((e) => e.value === c.value && (e.unit ?? null) === (c.unit ?? null));
        if (same) {
          same.kind = c.kind;
          same.sources = [...c.sources, ...same.sources];
          if (c.note) same.note = c.note;
        } else specs[k].push(c);
      }
    }
    for (const k of Object.keys(specs)) {
      rank(specs[k]);
      if (!specs[k].length) delete specs[k];
    }
    const { curatedSpecs, ...rest } = g;
    return { ...rest, specs };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
stats.curatedMatched = curatedMatched;

for (const g of catalog) {
  const c = g.category;
  stats.withSpecs[c] ??= { models: 0, impedance: 0, sensitivity: 0, sensitivityWithUnit: 0, power: 0, zout: 0 };
  const w = stats.withSpecs[c];
  w.models++;
  if (g.specs.impedance) w.impedance++;
  if (g.specs.sensitivity) w.sensitivity++;
  if (g.specs.sensitivity?.some((s) => s.unit)) w.sensitivityWithUnit++;
  if (g.specs.power) w.power++;
  if (g.specs.zout) w.zout++;
}

// Stores spell brands differently (MoonDrop / Moondrop / MOONDROP). Use one
// spelling per brand: the most common, preferring mixed case on ties.
{
  const norm = (b) => b.toLowerCase().replace(/[^a-z0-9]/g, "");
  const spellings = new Map();
  for (const i of catalog) {
    if (!i.brand) continue;
    const m = spellings.get(norm(i.brand)) ?? new Map();
    m.set(i.brand, (m.get(i.brand) ?? 0) + 1);
    spellings.set(norm(i.brand), m);
  }
  const mixed = (s) => s !== s.toUpperCase() && s !== s.toLowerCase();
  const pick = new Map([...spellings].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1] || mixed(b[0]) - mixed(a[0]))[0][0]]));
  for (const i of catalog) if (i.brand) i.brand = pick.get(norm(i.brand));
}

await writeFile(new URL("data/catalog.json", root), JSON.stringify({ builtAt: new Date().toISOString(), stores: stats.stores, items: catalog }));
console.log(JSON.stringify({ ...stats, models: catalog.length }, null, 2));
