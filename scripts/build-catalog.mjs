// Builds data/catalog.json from the crawl snapshots in cache/raw/.
//
// Output holds only facts: category, prices, availability, links, and spec
// values with the verbatim spec line they came from. No store prose or images
// are copied into the repo.
//
// Run: node scripts/build-catalog.mjs

import { readFile, readdir, writeFile } from "node:fs/promises";
import { classify, condition, modelKey, compact, groupKey, deskRole, speakerKind } from "./lib/classify.js";
import { extractSpecs, extractSheet, verify } from "./lib/specs.js";
import { detectLooks } from "./lib/materials.js";
import { dcInput, dcOutputs } from "./lib/dcpower.js";
import { extractPorts, extractFeatures } from "./lib/ports.js";
import { preorder, listedAt } from "./lib/dates.js";
import { appendHistory } from "./lib/history.js";

const root = new URL("..", import.meta.url);
const KEEP = new Set(["iem", "headphone", "dongle", "desktop", "dap", "cd", "power", "speaker"]);
const FIELDS = ["impedance", "sensitivity", "zout", "power"];
const ACCESSORY_VARIANT = /\b(case|pouch|bag|cable|cord|tips?|eartips|earpads?|cushions?|pads?|filter|adapter|only|replacement|spare|accessor(y|ies)|strap|film|protector|tempered|screen|holster|sleeve|lanyard|dust|stand|cover|skin|sticker|no device|without)\b/i;

const files = (await readdir(new URL("cache/raw/", root))).filter((f) => f.endsWith(".json"));
const groups = new Map();
const stats = { products: 0, kept: 0, byCategory: {}, withSpecs: {}, rejected: 0, stores: {} };

// Stores list their own name as the vendor for products they resell
// ("The Hangout by Crinacle" for "CrinEar Project Monolith"). For those, take
// the real brand from the start of the title when it is a brand seen elsewhere.
const STORE_VENDOR = /^(the hangout by crinacle|hifigo|linsoul( audio)?|apos|audio46|bloom audio|shenzhenaudio|headphones.com|addsoap|discontinued|silentpower|kitsunehifi)$/i;
// One brand, several spellings: "Ferrum" / "Ferrum Audio", "SMSL" / "S.M.S.L",
// "iFi" / "iFi Audio". Same key = same brand; the most used spelling wins.
const brandKey = (b) => {
  const k = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return k.length > 7 && k.endsWith("audio") ? k.slice(0, -5) : k;
};
const spellingCount = new Map();
for (const file of files) {
  const snap = JSON.parse(await readFile(new URL(`cache/raw/${file}`, root), "utf8"));
  for (const p of snap.products) {
    const v = p.vendor?.trim();
    if (!v || STORE_VENDOR.test(v)) continue;
    const m = spellingCount.get(brandKey(v)) ?? new Map();
    m.set(v, (m.get(v) ?? 0) + 1);
    spellingCount.set(brandKey(v), m);
  }
}
const isMixed = (x) => x !== x.toUpperCase() && x !== x.toLowerCase();
const canonical = new Map([...spellingCount].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1] || isMixed(b[0]) - isMixed(a[0]))[0][0]]));
const knownBrands = new Set([...spellingCount.values()].flatMap((m) => [...m.keys()]));
const brandsLongestFirst = [...knownBrands].sort((a, b) => b.length - a.length);
function realVendor(p) {
  let v = (p.vendor ?? "").trim();
  if (STORE_VENDOR.test(v)) {
    const title = p.title.toLowerCase();
    v = brandsLongestFirst.find((b) => title.startsWith(`${b.toLowerCase()} `)) ?? v;
  }
  return canonical.get(brandKey(v)) ?? v;
}
/** Remove every spelling of the brand from a title, not only the canonical one. */
function stripBrand(vendor, title) {
  const spellings = [...(spellingCount.get(brandKey(vendor))?.keys() ?? [vendor])].sort((a, b) => b.length - a.length);
  let t = ` ${title} `;
  for (const sp of spellings) t = t.replace(new RegExp(`(^|[^a-z0-9])${sp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9]|$)`, "gi"), "$1 ");
  return t.trim();
}

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

    const url = p.url ?? `https://${snap.host}/products/${p.handle}`; // WooCommerce stores give their own link
    const { lines, specs } = extractSpecs(p.body);
    const verified = {};
    for (const field of FIELDS) {
      verified[field] = [];
      // Output power and output impedance describe sources, not headphones
      // ("works with amps delivering 125 mW" is a requirement, not a rating).
      const isSource = category === "dongle" || category === "desktop" || category === "dap" || category === "cd";
      if ((field === "power" || field === "zout") && !isSource) continue;
      if (field === "impedance" && isSource) continue; // an amp's "impedance" is usually input impedance
      // "DT 990 PRO 250 ohm": the title names the impedance, so a description
      // that says otherwise (copied from a sibling model) is not used.
      const titled = field === "impedance" && p.title.match(/\b(\d{2,3})\s*(?:Ω|ohms?\b)/i);
      for (const entry of specs[field]) {
        if (titled && entry.value !== Number(titled[1])) {
          stats.rejected++;
          continue;
        }
        const check = verify(field, entry, lines);
        if (check.ok) verified[field].push({ ...entry, source: url });
        else stats.rejected++;
      }
    }

    const vendor = realVendor(p);
    const { key, model } = modelKey(vendor, stripBrand(vendor, p.title));
    const gk = groupKey(key);
    const g =
      groups.get(gk) ??
      { id: key, brand: vendor || null, model, category, offers: [], specs: { impedance: [], sensitivity: [], zout: [], power: [] } };
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
      listedAt: listedAt(p) ?? undefined,
      preorder: preorder(p, snap.fetchedAt) ?? undefined,
    });
    for (const field of FIELDS) g.specs[field].push(...verified[field]);
    // Photo set for the item page: the store with the most photos (links only).
    if ((p.images?.length ?? 0) > (g.photos?.src.length ?? 1)) g.photos = { store: snap.store, url, src: p.images };
    if (category === "desktop") (g.roleVotes ??= []).push(deskRole(p));
    if (category === "speaker") g.speaker ??= speakerKind(p);
    // DC power: what a box needs, what a supply gives (first store with a stated line wins).
    if (category === "desktop" || category === "cd") {
      const need = !g.dcIn && dcInput(p.body);
      if (need) g.dcIn = { ...need, url };
    }
    // Ports and switches: the union over every store, first quote per port wins.
    if (category === "desktop" || category === "cd" || category === "dap" || category === "dongle" || category === "speaker") {
      const ports = extractPorts(p.body);
      if (ports)
        for (const dir of ["in", "out"])
          for (const [k, quote] of Object.entries(ports[dir])) {
            g.ports ??= { in: {}, out: {} };
            g.ports[dir][k] ??= { quote, url };
          }
      for (const [k, quote] of Object.entries(extractFeatures(p.body))) {
        g.features ??= {};
        g.features[k] ??= { quote, url };
      }
    }
    // The rest of the spec sheet (frequency response, drivers, DAC chip...): first store per field wins.
    for (const [k, e] of Object.entries(extractSheet(p.body, lines))) {
      g.sheet ??= {};
      g.sheet[k] ??= { value: e.value, store: snap.store };
    }
    if (category === "power" && !g.dcOut) {
      const out = dcOutputs(p.body);
      if (out) g.dcOut = { ...out, url };
    }
    // Materials / looks with the store sentence they came from (first store wins).
    if (category !== "power") {
      const looks = detectLooks({ title: p.title, tags: p.tags, body: p.body });
      for (const kind of ["materials", "styles"])
        for (const [k, quote] of Object.entries(looks[kind])) {
          g[kind] ??= {};
          g[kind][k] ??= { quote, url };
        }
    }
    groups.set(gk, g);
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
  if (groups.has(groupKey(key))) return groupKey(key);
  const [brand, model] = key.split("--");
  const want = compact(model);
  const candidates = [...groups.values()].filter((g) => {
    const [b, m] = g.id.split("--");
    return b === brand && compact(m).startsWith(want) && !/(?:^|-)(x|bt|wireless|m)(?:-|$)/.test(m.slice(model.length));
  });
  candidates.sort((a, b) => a.id.length - b.id.length || b.offers.length - a.offers.length);
  return candidates[0] ? groupKey(candidates[0].id) : groupKey(key);
}

function attach(entry, category, extra) {
  const { key: rawKey, model } = modelKey(entry.brand, `${entry.brand} ${entry.model}`);
  const key = findGroup(rawKey);
  const existing = groups.get(key);
  if (existing) curatedMatched++;
  const g = existing ?? { id: rawKey, brand: entry.brand, model: entry.model, category, offers: [], specs: { impedance: [], sensitivity: [], zout: [], power: [] } };
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
  // Every hand-checked amp takes a digital (USB) input, so it is a DAC and amp in one.
  attach(amp, amp.kind, () => ({ category: amp.kind, input: amp.input, outputs: amp.outputs, ...(amp.kind === "desktop" ? { role: "dacamp" } : {}) }));
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

const photoSets = {};
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
    const { curatedSpecs, roleVotes, photos, ...rest } = g;
    if (photos) photoSets[rest.id] = photos;
    // Any store calling it a DAC/amp, or a headphone output power rating, means it has both.
    if (rest.category === "desktop" && !rest.role) {
      const v = roleVotes ?? [];
      // Stores disagree ("DAC & Headphone Amp" vs "line outputs only"). A stated
      // headphone power rating settles it; otherwise the majority, and a tie stays DAC.
      const n = (r) => v.filter((x) => x === r).length;
      rest.role = specs.power?.length && (n("dac") || n("dacamp")) ? "dacamp" : n("dacamp") > n("dac") ? "dacamp" : n("dac") ? "dac" : n("dacamp") ? "dacamp" : "amp";
    }
    if (rest.category !== "desktop") delete rest.role;
    // First time any store listed it: the release calendar's date for this model.
    const listed = rest.offers.map((o) => o.listedAt).filter(Boolean).sort()[0];
    if (listed) rest.listedAt = listed;
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

// Models no tracked store sells yet, added by hand from the maker's own page
// (data/extra-items.json, every value quoted with its source). A store listing
// for the same model later takes over the prices; the hand-added facts stay.
{
  const extra = JSON.parse(await readFile(new URL("data/extra-items.json", root), "utf8"));
  for (const e of extra) {
    const hit = catalog.find((g) => groupKey(g.id) === groupKey(e.id));
    if (hit) {
      for (const k of ["role", "ports", "dcIn", "notes", "addedFrom"]) if (e[k] && !hit[k]) hit[k] = e[k];
    } else catalog.push({ offers: [], specs: {}, ...e });
  }
  catalog.sort((a, b) => a.id.localeCompare(b.id));
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

// Price history: catalog.json is rebuilt each week, so changes are appended to
// their own file. A new point only when a store's price or stock changed.
{
  const file = new URL("data/prices.json", root);
  const prev = await readFile(file, "utf8").then(JSON.parse, () => ({}));
  const day = Object.values(stats.stores).map((s) => s.fetchedAt).sort().at(-1)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  await writeFile(file, JSON.stringify(appendHistory(prev, catalog, day)));
}

// Extra photos live in their own file so the main catalog stays small; the
// item page loads it on demand.
await writeFile(new URL("data/photos.json", root), JSON.stringify(photoSets));
await writeFile(new URL("data/catalog.json", root), JSON.stringify({ builtAt: new Date().toISOString(), stores: stats.stores, items: catalog }));
console.log(JSON.stringify({ ...stats, models: catalog.length }, null, 2));
