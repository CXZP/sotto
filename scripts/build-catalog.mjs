// Builds data/catalog.json from the crawl snapshots in cache/raw/.
//
// Output holds only facts: category, prices, availability, links, and spec
// values with the verbatim spec line they came from. No store prose or images
// are copied into the repo.
//
// Run: node scripts/build-catalog.mjs

import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { classify, condition, jpModelTitle, modelKey, compact, groupKey, looseKey, deskRole, titleRole, speakerKind, cartridgeKind, phonoInputs } from "./lib/classify.js";
import { extractSpecs, extractSheet, verify } from "./lib/specs.js";
import { detectLooks } from "./lib/materials.js";
import { dcInput, dcOutputs, dcFromSocket } from "./lib/dcpower.js";
import { extractPorts, extractFeatures } from "./lib/ports.js";
import { preorder, listedAt } from "./lib/dates.js";
import { jackOutputs } from "./lib/jacks.js";
import { isMakerUrl } from "./lib/sources.js";
import { settle } from "./lib/conflicts.js";
import { socketsOf, sameSockets } from "../src/sockets.js";
import { appendHistory } from "./lib/history.js";

const root = new URL("..", import.meta.url);
const KEEP = new Set(["iem", "headphone", "wireless", "dongle", "portable", "desktop", "dap", "cd", "power", "speaker", "turntable", "phono", "cartridge"]);
// Roles for boxes that drive speakers or only stream: their watts are into
// speakers and never enter the headphone maths.
const NOT_HP_ROLES = new Set(["integrated", "poweramp", "streamer"]);
const FIELDS = ["impedance", "sensitivity", "zout", "power"];
const ACCESSORY_VARIANT = /\b(case|pouch|bag|cable|cord|tips?|eartips|earpads?|cushions?|pads?|filter|adapter|only|replacement|spare|accessor(y|ies)|strap|film|protector|tempered|screen|holster|sleeve|lanyard|dust|stand|cover|skin|sticker|no device|without)\b/i;

const files = (await readdir(new URL("cache/raw/", root))).filter((f) => f.endsWith(".json"));
// Stores whose titles don't say what a product is (e-earphone: "【中古】M8T【秋葉原】")
// only add offers to models other stores already list. They never start a model.
const MATCH_ONLY = new Set(JSON.parse(await readFile(new URL("scripts/stores.json", root), "utf8")).filter((s) => s.matchOnly).map((s) => s.id));
const isMatchOnly = (file) => MATCH_ONLY.has(file.replace(/\.json$/, ""));
// Titles with non-breaking or doubled spaces ("DAC&nbsp;& Headphone Amp") read as plain words.
async function readSnap(file) {
  const snap = JSON.parse(await readFile(new URL(`cache/raw/${file}`, root), "utf8"));
  for (const p of snap.products) p.title = (p.title ?? "").replace(/\s+/g, " ").trim();
  return snap;
}
const groups = new Map();
const stats = { products: 0, kept: 0, byCategory: {}, withSpecs: {}, rejected: 0, stores: {} };

// Stores list their own name as the vendor for products they resell
// ("The Hangout by Crinacle" for "CrinEar Project Monolith"). For those, take
// the real brand from the start of the title when it is a brand seen elsewhere.
const STORE_VENDOR = /^(the hangout by crinacle|hifigo|linsoul( audio)?|apos|audio46|bloom audio|shenzhenaudio|headphones.com|addsoap|discontinued|silentpower|kitsunehifi|audio advice|addicted to audio|turntablelab\.com)$/i;
// Makers no store lists as a vendor, so only a title names them.
const MAKERS = ["Little Dot", "SABAJ", "LOXJIE", "COZOY", "ELAC"];
// House lines that don't repeat the store's name: Kitsune Tuned Edition, Moon Audio's Dragon.
// Sub-brands a parent company sells under its own name too: sub-brand -> parent brandKey.
const SUB_BRANDS = { Audalytic: "gustard" };
const HOUSE_LINE = /^(?:kte|dragon)\b/i;
// One brand, several spellings: "Ferrum" / "Ferrum Audio", "SMSL" / "S.M.S.L",
// "iFi" / "iFi Audio". Same key = same brand; the most used spelling wins.
const brandKey = (b) => {
  const k = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return k.length > 7 && k.endsWith("audio") ? k.slice(0, -5) : k;
};
const spellingCount = new Map();
for (const file of files) {
  if (isMatchOnly(file)) continue; // "水月雨 (MOONDROP)" is not a spelling to show
  const snap = await readSnap(file);
  for (const p of snap.products) {
    const v = p.vendor?.trim();
    if (!v || STORE_VENDOR.test(v)) continue;
    const m = spellingCount.get(brandKey(v)) ?? new Map();
    m.set(v, (m.get(v) ?? 0) + 1);
    spellingCount.set(brandKey(v), m);
  }
}
// Makers named only in titles use the maker's own spelling; short names stores
// put before the model ("Astell & Kern AK PA10") count as the brand too.
const ALIASES = { astellkern: ["AK"] };
for (const m of MAKERS) spellingCount.set(brandKey(m), new Map([...(spellingCount.get(brandKey(m)) ?? []), [m, 1e6]]));
for (const [k, list] of Object.entries(ALIASES)) for (const a of list) spellingCount.get(k)?.set(a, 0);
const isMixed = (x) => x !== x.toUpperCase() && x !== x.toLowerCase();
const canonical = new Map([...spellingCount].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1] || isMixed(b[0]) - isMixed(a[0]))[0][0]]));
const knownBrands = new Set([...spellingCount.values()].flatMap((m) => [...m.keys()]));
const brandsLongestFirst = [...knownBrands].sort((a, b) => b.length - a.length);
function realVendor(p) {
  let v = (p.vendor ?? "").trim();
  if (STORE_VENDOR.test(v)) {
    const title = p.title.toLowerCase();
    const named = [...brandsLongestFirst, ...MAKERS].find((b) => title.startsWith(`${b.toLowerCase()} `));
    // No brand in the title: the store's name is not one either, unless the
    // title says it or it is a house line. Better no brand than a wrong one.
    v = named ?? (title.includes(v.toLowerCase()) || HOUSE_LINE.test(p.title) ? v : "");
  } else if (v && !brandKey(p.title).includes(brandKey(v))) {
    // The store's vendor field names another maker than the title does
    // ("Questyle CMA Eighteen" filed under iFi): the title wins.
    const title = p.title.toLowerCase();
    v = brandsLongestFirst.find((b) => b.length > 2 && title.startsWith(`${b.toLowerCase()} `)) ?? v;
  }
  // A maker's own sub-brand named in the title is the brand ("Gustard Audalytic DR70").
  const sub = Object.keys(SUB_BRANDS).find((b) => SUB_BRANDS[b] === brandKey(v) && new RegExp(`\\b${b}\\b`, "i").test(p.title));
  if (sub) v = sub;
  return canonical.get(brandKey(v)) ?? v;
}
/** Remove every spelling of the brand from a title, not only the canonical one. */
function stripBrand(vendor, title) {
  const parent = Object.entries(SUB_BRANDS).find(([b]) => brandKey(b) === brandKey(vendor))?.[1];
  const spellings = [...(spellingCount.get(brandKey(vendor))?.keys() ?? [vendor]), ...(parent ? spellingCount.get(parent)?.keys() ?? [] : [])].sort((a, b) => b.length - a.length);
  let t = ` ${title} `;
  for (const sp of spellings) t = t.replace(new RegExp(`(^|[^a-z0-9])${sp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9]|$)`, "gi"), "$1 ");
  return t.trim();
}

for (const file of files) {
  if (isMatchOnly(file)) continue; // added after the hand-checked entries, below
  const snap = await readSnap(file);
  stats.stores[snap.store] = { name: snap.name, host: snap.host, products: snap.products.length, fetchedAt: snap.fetchedAt, ...(snap.ships ? { ships: snap.ships, country: snap.country } : {}) };
  for (const p of snap.products) {
    stats.products++;
    let category = classify(p);
    // Stores file small USB DACs under "AMP & DAC". A sub-$40 "desktop" unit that
    // doesn't call itself desktop/tube/preamp is a dongle.
    if (category === "desktop" && Math.max(...p.variants.map((v) => v.price || 0)) < 40 && !/desktop|tube|preamp/i.test(p.title)) category = "dongle";
    // A "portable headphone amp" with a DAC inside (USB in, a decoder) is a dongle.
    if (category === "portable" && deskRole(p) !== "amp") category = "dongle";
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
      const isSource = ["dongle", "portable", "desktop", "dap", "cd", "turntable", "phono", "cartridge"].includes(category);
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
    const gk = looseKey(key, category);
    const g =
      groups.get(gk) ??
      { id: key, brand: vendor || null, model, category, offers: [], specs: { impedance: [], sensitivity: [], zout: [], power: [] } };
    // A model listed as "headphone" at one store and "iem" at another keeps the first;
    // the conflict is recorded so a person can look.
    // The shortest name in the group names it ("Warmer R2R" over "WARMER R2R Tube").
    if (groups.has(gk) && key.length < g.id.length) Object.assign(g, { id: key, model });
    (g.catVotes ??= {})[category] = (g.catVotes[category] ?? 0) + 1;
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
    // Figures per headphone jack (4.4 mm vs 3.5 mm). Without this, every figure
    // lands on one unnamed jack and the highest wins, so a 3.5 mm user is told
    // they get the 4.4 mm output. First store that ties every figure to a jack
    // wins; hand-checked outputs (data/amps.json) replace these further down.
    if (!g.outputs && ["dongle", "portable", "desktop", "dap"].includes(category)) {
      const outs = jackOutputs(lines, category);
      if (outs) g.outputs = outs.map(({ jack, power, voltage, zout, quotes }) => ({ jack, kind: "claimed", power, voltage, zout, source: url, quote: quotes.join(" / "), fromStore: true }));
    }
    // Photo set for the item page: the store with the most photos (links only).
    if ((p.images?.length ?? 0) > (g.photos?.src.length ?? 1)) g.photos = { store: snap.store, url, src: p.images };
    if (category === "desktop") {
      (g.roleVotes ??= []).push(deskRole(p));
      // A role the title states outright beats roles guessed from descriptions.
      g.roleStated ??= titleRole(p.title) ?? undefined;
    }
    if (category === "speaker") g.speaker ??= speakerKind(p);
    // Vinyl: MM or MC cartridge, and which of them a phono stage takes (first store that says).
    if (category === "cartridge") g.cart ??= cartridgeKind(p) ?? undefined;
    if (category === "phono" || (category === "desktop" && /\bphono\b/i.test(p.body ?? ""))) g.phonoIn ??= phonoInputs(p) ?? undefined;
    // DC power: what a box needs, what a supply gives (first store with a stated line wins).
    if (category === "desktop" || category === "cd") {
      const need = !g.dcIn && dcInput(p.body);
      if (need) g.dcIn = { ...need, url };
    }
    // Ports and switches: the union over every store, first quote per port wins.
    if (["desktop", "cd", "dap", "dongle", "portable", "speaker", "turntable", "phono"].includes(category)) {
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
function findGroup(key, category) {
  if (groups.has(looseKey(key, category))) return looseKey(key, category);
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
  // A collaboration ("Truthear × Crinacle Zero:RED") is filed by stores under the
  // first brand, with the partner in the model name.
  const [lead, ...partners] = entry.brand.split(/\s+[×x]\s+/);
  const { key: rawKey, model } = modelKey(lead, `${lead} ${partners.join(" ")} ${entry.model}`);
  const key = findGroup(rawKey, category);
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
  // A maker's photo (a link, like store photos) for models no tracked store sells.
  // Spec-sheet lines from the maker's page replace the store's (a store may copy a sibling's text).
  attach(amp, amp.kind, (g) => ({ category: amp.kind, input: amp.input, outputs: amp.outputs, ...(amp.kind === "desktop" ? { role: "dacamp" } : {}), ...(amp.image ? { image: amp.image } : {}), ...(amp.sheet ? { sheet: { ...g.sheet, ...amp.sheet } } : {}) }));
}

// Match-only stores: a listing joins a model already in the catalog when its
// brand and model name give exactly one match. Anything less is left out; a
// missing offer costs less than a wrong one. Each model gets the store's
// cheapest unit in stock, new and used apart (used units are one listing each).
function matchVendor(p, name) {
  const k = brandKey(p.vendor ?? "");
  if (canonical.has(k)) return canonical.get(k);
  // "HiBy Digital" is HiBy; "その他ブランド" ("other brands") puts the brand in the title.
  const prefix = k && [...canonical.keys()].filter((c) => c.length >= 4 && k.startsWith(c)).sort((a, b) => b.length - a.length)[0];
  if (prefix) return canonical.get(prefix);
  return brandsLongestFirst.find((b) => b.length > 2 && name.toLowerCase().startsWith(`${b.toLowerCase()} `)) ?? null;
}
for (const file of files.filter(isMatchOnly)) {
  const snap = await readSnap(file);
  stats.stores[snap.store] = { name: snap.name, host: snap.host, products: snap.products.length, fetchedAt: snap.fetchedAt, ...(snap.ships ? { ships: snap.ships, country: snap.country } : {}) };
  const best = new Map();
  for (const p of snap.products) {
    stats.products++;
    const name = jpModelTitle(p.title);
    const vendor = name && matchVendor(p, name);
    if (!vendor) continue;
    const { key } = modelKey(vendor, stripBrand(vendor, name));
    // Model keys drop "Earbuds" / "Headphones", so "QuietComfort Earbuds" and
    // "QuietComfort Headphones" share a key: the word must agree with the model's type.
    const fits = (g) => !(/\b(?:ear ?buds?|buds|true wireless|in-ear)\b/i.test(name) && g.category === "headphone") && !(/\bheadphones?\b/i.test(name) && ["iem", "wireless"].includes(g.category));
    const hits = [...new Set([looseKey(key, "iem"), looseKey(key, "wireless"), looseKey(key, "phono"), groupKey(key)])].filter((k) => groups.has(k) && fits(groups.get(k)));
    if (hits.length !== 1) continue;
    const { price, available } = mainPrice(p.variants);
    if (price == null || !available) continue;
    const cond = p.type === "中古" ? "open-box/used" : condition(p.title);
    const slot = `${hits[0]}|${cond}`;
    if (best.get(slot)?.offer.price <= price) continue;
    const url = `https://${snap.host}/products/${p.handle}`;
    best.set(slot, { key: hits[0], offer: { store: snap.store, title: p.title, url, price, currency: snap.currency, available, condition: cond, seenAt: snap.fetchedAt } });
  }
  for (const { key, offer } of best.values()) groups.get(key).offers.push(offer);
  stats.stores[snap.store].matched = best.size;
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

// Keyed by the item itself: ids are settled further down.
const photoSets = new Map();
const catalog = [...groups.values()]
  .map((g) => {
    const specs = Object.fromEntries(Object.entries(g.specs).map(([k, v]) => [k, merge(v).map((e) => ({ ...e, kind: "claimed" }))]));
    // A hand-checked value equal to a store value is one value with more sources.
    for (const [k, curated] of Object.entries(g.curatedSpecs ?? {})) {
      for (const c of curated) {
        const same = specs[k].find((e) => e.value === c.value && (e.unit ?? null) === (c.unit ?? null));
        if (same) {
          same.kind = c.kind;
          same.curated = true;
          same.sources = [...c.sources, ...same.sources];
          if (c.note) same.note = c.note;
        } else specs[k].push({ ...c, curated: true });
      }
    }
    for (const k of Object.keys(specs)) {
      rank(specs[k]);
      if (!specs[k].length) delete specs[k];
    }
    // Sources that disagree: the maker's page or a hand-checked value decides;
    // otherwise the field is marked and left out of the maths (scripts/lib/conflicts.js).
    const conflicts = settle(specs, g.brand);
    const { curatedSpecs, roleVotes, roleStated, photos, catVotes, ...rest } = g;
    // Stores disagree on the kind of thing: one store filing "iFi Neo Stream"
    // under headphones doesn't make it headphones when most say otherwise.
    if (catVotes && rest.categoryConflict) {
      const [top, n] = Object.entries(catVotes).sort((a, b) => b[1] - a[1])[0];
      // Only out of headphones: a store filing amps under "headphones" is common;
      // dongle vs desktop is settled by the titles below.
      const ears = ["headphone", "iem"];
      if (ears.includes(rest.category) && !ears.includes(top) && n > (catVotes[rest.category] ?? 0)) rest.category = top;
    }

    // Stores disagree on desktop vs dongle ("Pilot II USB DAC" vs "Pilot II | Portable
    // Balanced USB DAC"): a title that says portable or dongle settles it.
    const says = (re) => rest.offers.some((o) => re.test(o.title));
    if (rest.category === "desktop" && rest.categoryConflict?.includes("dongle") && says(/\b(portable|dongle)\b/i) && !says(/\bdesktop\b/i)) rest.category = "dongle";
    if (rest.category === "dongle" && rest.categoryConflict?.includes("desktop") && says(/\bdesktop\b/i) && !says(/\b(portable|dongle)\b/i)) rest.category = "desktop";
    // Any store calling it a DAC/amp, or a headphone output power rating, means it has both.
    if (rest.category === "desktop" && !rest.role) {
      const v = roleVotes ?? [];
      // Stores disagree ("DAC & Headphone Amp" vs "line outputs only"). A stated
      // headphone power rating settles it; otherwise the majority, and a tie stays DAC.
      const n = (r) => v.filter((x) => x === r).length;
      const top = ["integrated", "streamer", "poweramp"].find((r) => n(r) && n(r) >= v.length / 2);
      rest.role = roleStated ?? top ?? (specs.power?.length && (n("dac") || n("dacamp")) ? "dacamp" : n("dacamp") > n("dac") ? "dacamp" : n("dac") ? "dac" : n("dacamp") ? "dacamp" : n("preamp") > n("amp") ? "preamp" : "amp");
    }
    // A portable amp has an analog input only, like a desktop amp-only box.
    if (rest.category === "portable") rest.role = "amp";
    if (!["desktop", "portable"].includes(rest.category)) delete rest.role;
    if (NOT_HP_ROLES.has(rest.role)) {
      delete specs.power;
      delete specs.zout;
    }
    // First time any store listed it: the release calendar's date for this model.
    const listed = rest.offers.map((o) => o.listedAt).filter(Boolean).sort()[0];
    if (listed) rest.listedAt = listed;
    const item = { ...rest, specs, ...(conflicts.length ? { conflicts } : {}) };
    if (photos) photoSets.set(item, photos);
    return item;
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

const handPorts = new Map();
// Models no tracked store sells yet, and facts stores leave out (sockets most
// of all), added by hand from the maker's own page (data/extra-items.json,
// every value quoted with its source). A store listing for the same model
// takes over the prices; the hand-added facts stay.
{
  const extra = JSON.parse(await readFile(new URL("data/extra-items.json", root), "utf8"));
  for (const e of extra) {
    const hit = catalog.find((g) => groupKey(g.id) === groupKey(e.id) || (g.category === e.category && looseKey(g.id, g.category) === looseKey(e.id, e.category)));
    if (hit) {
      for (const k of ["dcIn", "notes", "addedFrom", "jacks", "look"]) if (e[k] && !hit[k]) hit[k] = e[k];
      // Figures from the maker's manual go first; a store's same figure isn't repeated.
      for (const [k, list] of Object.entries(e.specs ?? {})) {
        const same = (a, b) => (a.load ?? null) === (b.load ?? null) && (a.mw ?? a.value) === (b.mw ?? b.value);
        hit.specs ??= {};
        hit.specs[k] = [...list.map((x) => ({ kind: "claimed", ...x })), ...(hit.specs[k] ?? []).filter((x) => !list.some((y) => same(x, y)))];
      }
      // The role read off the maker's page beats the one guessed from store titles.
      if (e.role) hit.role = e.role;
      // So does the kind of box (a dongle a store filed as a desktop DAC/amp).
      if (e.category && e.category !== hit.category) {
        hit.category = e.category;
        if (e.category !== "desktop" && !e.role) delete hit.role;
      }
      // Sockets from the maker fill in what stores don't list; a store's own line stays.
      // A maker's full socket list (portsComplete) replaces what was read off store pages,
      // which can be wrong ("line in" on a DAC that has none).
      if (e.ports && e.portsComplete) hit.ports = structuredClone(e.ports);
      else if (e.ports) {
        // Kept aside too, so a maker's full table below doesn't drop them.
        handPorts.set(hit, e.ports);
        hit.ports ??= { in: {}, out: {} };
        for (const dir of ["in", "out"]) for (const [p, v] of Object.entries(e.ports[dir] ?? {})) hit.ports[dir][p] ??= v;
      }
    } else catalog.push({ offers: [], specs: {}, ...e });
  }
  catalog.sort((a, b) => a.id.localeCompare(b.id));
}

// Sockets read off makers' spec pages (data/maker-ports.json, scripts/maker-ports.mjs),
// each with its line and URL. A full ports table (FiiO's) replaces what was read off
// store pages; a partial one fills gaps. Hand-checked entries above win over both.
{
  const file = new URL("data/maker-ports.json", root);
  const maker = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  const hand = new Set(JSON.parse(await readFile(new URL("data/extra-items.json", root), "utf8")).filter((e) => e.portsComplete).map((e) => groupKey(e.id)));
  // Entries are filed under the ids of the catalog they were read against: follow
  // that catalog's aliases and the loose key when models have merged since.
  const before = await readFile(new URL("data/catalog.json", root), "utf8").then((t) => JSON.parse(t).aliases ?? {}, () => ({}));
  const byKey = new Map(catalog.map((g) => [groupKey(g.id), g]));
  const byLoose = new Map(catalog.map((g) => [looseKey(g.id, g.category), g]));
  for (const [id, m] of Object.entries(maker)) {
    const g = byKey.get(groupKey(id)) ?? byKey.get(groupKey(before[id] ?? "")) ?? (m.category ? byLoose.get(looseKey(id, m.category)) : null);
    if (!g || hand.has(groupKey(g.id))) continue;
    if (m.jacks?.length && !g.jacks) g.jacks = m.jacks;
    if (m.complete) {
      g.ports = structuredClone(m.ports);
      for (const dir of ["in", "out"]) for (const [p, v] of Object.entries(handPorts.get(g)?.[dir] ?? {})) g.ports[dir][p] = v;
    }
    else {
      g.ports ??= { in: {}, out: {} };
      for (const dir of ["in", "out"]) for (const [p, v] of Object.entries(m.ports[dir] ?? {})) g.ports[dir][p] ??= v;
    }
  }
}

// The maker's DC inlet wins over a store's power sentence (iFi ZEN DAC 3: a
// store wrote "powered by USB-C"; iFi lists "USB-C or DC 5V/0.5A", and the
// photos show the barrel inlet).
for (const g of catalog) {
  const dc = g.ports?.in?.dc;
  if (!dc?.quote || !isMakerUrl(dc.url, g.brand)) continue;
  const d = dcFromSocket(dc.quote);
  if (d) g.dcIn = { ...d, url: dc.url };
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

// Ids are page addresses, and reviews, owner and port reports are filed under
// them, so a model keeps the id its store listings had last week (when the brand
// still matches). Ids that disappear (two entries merged, a brand corrected)
// become aliases of the new id, so old links and old reports still find it.
let aliases = {};
{
  const prev = await readFile(new URL("data/catalog.json", root), "utf8").then(JSON.parse, () => null);
  const oldByUrl = new Map((prev?.items ?? []).flatMap((i) => i.offers.map((o) => [o.url, i.id])));
  const brandOf = (id) => id.split("--")[0];
  // Ids the owner flagged as wrong (stock words in a model name) are not kept, only aliased.
  const STOCK = /(^|-)(pre-?owned|preowned|pre-?sale|pre-?order|open-box|b-stock|refurbished|demo|clearance|used|discontinued)(-|$)/;
  const claims = [];
  // Hand-checked entries no store sells have no listing URL to follow: their own
  // entry id (data/amps.json, headphones.json...) carries the old id over, ahead
  // of any store vote. Without this a naming change moves them (the home page's
  // Apple dongle became "apple--usb-c-to-adapter").
  const oldByCurated = new Map((prev?.items ?? []).filter((i) => i.curatedId).map((i) => [i.curatedId, i.id]));
  for (const g of catalog) {
    const old = g.curatedId && oldByCurated.get(g.curatedId);
    if (old && brandOf(old) === brandOf(g.id) && !STOCK.test(old)) claims.push({ g, old, n: Infinity, same: old === g.id });
  }
  for (const g of catalog) {
    const votes = new Map();
    for (const o of g.offers) {
      const old = oldByUrl.get(o.url);
      if (old && brandOf(old) === brandOf(g.id) && !STOCK.test(old)) votes.set(old, (votes.get(old) ?? 0) + 1);
    }
    // Only an old id that still names this model (finish words aside) is kept;
    // an old name that was wrong ("addsoap--sabaj-a30a", "wiim--pro-wireless" for
    // the Amp Pro) becomes an alias instead.
    for (const [old, n] of votes) if (looseKey(old, g.category) === looseKey(g.id, g.category)) claims.push({ g, old, n, same: old === g.id });
  }
  // When an old entry is split in two, the part whose new name is the old id
  // keeps it; otherwise the part with more of its listings.
  claims.sort((a, b) => b.same - a.same || b.n - a.n || a.old.localeCompare(b.old));
  const taken = new Set();
  const keep = new Map();
  for (const c of claims) {
    if (keep.has(c.g) || taken.has(c.old)) continue;
    keep.set(c.g, c.old);
    taken.add(c.old);
  }
  // The rest keep their new id; one that clashes gets its category appended.
  for (const g of catalog) {
    if (keep.has(g)) g.id = keep.get(g);
    else {
      if (taken.has(g.id)) g.id = `${g.id}-${g.category}`;
      taken.add(g.id);
    }
  }
  const now = new Set(catalog.map((g) => g.id));
  const newByUrl = new Map(catalog.flatMap((g) => g.offers.map((o) => [o.url, g.id])));
  const newByCurated = new Map(catalog.filter((g) => g.curatedId).map((g) => [g.curatedId, g.id]));
  for (const i of prev?.items ?? []) {
    if (now.has(i.id)) continue;
    const to = i.offers.map((o) => newByUrl.get(o.url)).find(Boolean) ?? (i.curatedId && newByCurated.get(i.curatedId));
    if (to) aliases[i.id] = to;
  }
  // Older aliases stay, pointed at wherever their model is now.
  for (const [from, to] of Object.entries(prev?.aliases ?? {})) {
    const target = now.has(to) ? to : aliases[to];
    if (target && !now.has(from) && !aliases[from]) aliases[from] = target;
  }
  catalog.sort((a, b) => a.id.localeCompare(b.id));
  stats.aliases = Object.keys(aliases).length;
}

// People's checks (supabase/checks.sql → data/checks.json, scripts/fetch-checks.mjs).
// A person's word is the last word: a fix replaces the sockets every other
// source gave; an "ok" marks the entry checked while it still shows what the
// person saw, and asks for a new look when the data has moved since.
{
  const file = new URL("data/checks.json", root);
  const checks = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : [];
  const byId = new Map(catalog.map((g) => [g.id, g]));
  const latest = new Map();
  for (const c of checks) {
    const id = byId.has(c.item_id) ? c.item_id : aliases[c.item_id];
    if (id && c.field === "sockets") latest.set(id, { ...c, item_id: id });
  }
  for (const [id, c] of latest) {
    const g = byId.get(id);
    if (c.verdict === "fixed" && c.data) {
      const src = { quote: "Checked by a person", url: c.evidence_url || "https://cxzp.github.io/sotto/#check", checked: true };
      const side = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, n]) => [k, { ...src, n }]));
      g.ports = { in: side(c.data.in), out: side(c.data.out) };
      g.jacks = c.data.jacks ?? [];
      if (!c.data.in?.dc && g.dcIn && !g.dcIn.usb) delete g.dcIn;
      if (c.data.in?.dc && g.dcIn) g.dcIn.barrel = true;
      g.checked = { state: "fixed", at: c.created_at };
    } else if (c.verdict === "ok") {
      g.checked = sameSockets(c.shown, socketsOf(g)) ? { state: "checked", at: c.created_at } : { state: "changed", at: c.created_at };
    }
  }
  stats.checked = latest.size;
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
await writeFile(new URL("data/photos.json", root), JSON.stringify(Object.fromEntries([...photoSets].map(([i, p]) => [i.id, p]))));
await writeFile(new URL("data/catalog.json", root), JSON.stringify({ builtAt: new Date().toISOString(), stores: stats.stores, items: catalog, aliases }));
console.log(JSON.stringify({ ...stats, models: catalog.length }, null, 2));
