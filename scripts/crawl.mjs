// Fetches public Shopify product feeds (/products.json) from the stores in
// scripts/stores.json and writes one snapshot per store to cache/raw/.
//
// The snapshot keeps the store's description HTML so the extractor can verify
// quotes against it. cache/ is git-ignored: store text is never redistributed,
// only the facts extracted from it (see scripts/extract.mjs).
//
// Stores marked "specPage" in stores.json keep their spec list on the product
// page instead of in the feed; for products whose feed text is pictures only,
// the crawler reads that page once and keeps just the spec box.
//
// Run: node scripts/crawl.mjs [storeId ...]

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { classify } from "./lib/classify.js";
import { specBlock, noSheet } from "./lib/specpage.js";

const UA = "SottoBot/0.1 (+https://github.com/CXZP/sotto; open-source spec catalog)";
const root = new URL("..", import.meta.url);
const stores = JSON.parse(await readFile(new URL("scripts/stores.json", root), "utf8"));
const only = process.argv.slice(2);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

// Shopify counts requests per visitor IP across every Shopify store, so all
// stores share one budget. Go one request at a time, and the first time any
// store says "slow down" (429), double the gap for the rest of the run and
// wait as long as it asks (Retry-After) before trying again.
let slow = 1;
const pause = (store) => sleep(store.delay * slow);
async function slowDown(res, attempt) {
  slow = Math.min(slow * 2, 8);
  const asked = Number(res.headers.get("retry-after"));
  const wait = Number.isFinite(asked) && asked > 0 ? asked : 60 * attempt;
  console.log(`429 from ${new URL(res.url).host}: waiting ${wait}s, gaps now x${slow}`);
  await sleep(wait);
}
// Product pages fetched per run for stores whose spec list lives on the page
// (see scripts/lib/specpage.js). The rest wait for the next run; pages already
// read are remembered in cache/pages/ until the product changes.
const PAGE_BUDGET = Number(process.env.SPEC_PAGES ?? 400);

await mkdir(new URL("cache/raw/", root), { recursive: true });

for (const store of stores) {
  if (only.length && !only.includes(store.id)) continue;
  if (store.kind === "woo") {
    await writeSnapshot(store, await wooProducts(store));
    continue;
  }
  const meta = (await getJson(`https://${store.host}/meta.json`))?.data;
  const products = [];
  const currencies = new Set();
  for (let page = 1; page <= 100; page++) {
    await pause(store);
    const res = await getJson(`https://${store.host}/products.json?limit=250&page=${page}`);
    const batch = res?.data?.products ?? [];
    // Shopify localises prices by visitor location. The currency actually used
    // is in the cart_currency cookie of each response, not in meta.json.
    if (res?.currency) currencies.add(res.currency);
    // Match-only stores are matched on title and brand alone: their
    // descriptions (page styles and scripts, mostly) are not kept.
    products.push(...batch.map(slim).map((p) => (store.matchOnly ? { ...p, body: "", images: [] } : p)));
    if (batch.length < 250) break;
  }
  if (store.specPage) await addSpecPages(store, products);
  if (currencies.size > 1) throw new Error(`${store.id}: mixed currencies ${[...currencies]}`);
  await writeSnapshot(store, { name: meta?.name, currency: [...currencies][0] ?? meta?.currency ?? null, products });
}

async function writeSnapshot(store, { name, currency, products }) {
  const snapshot = { store: store.id, host: store.host, name: name ?? store.host, currency, fetchedAt: new Date().toISOString(), products };
  await writeFile(new URL(`cache/raw/${store.id}.json`, root), JSON.stringify(snapshot));
  console.log(`${store.id.padEnd(16)} ${String(products.length).padStart(5)} products  ${currency}`);
}

// WooCommerce stores (Jaben) publish the same facts through the public Store
// API: /wp-json/wc/store/v1/products. Thai stores write the model in English
// and then a Thai description in the title; the model is the part before the
// first Thai letter, the whole title still goes to the category guess.
const THAI = /[\u0E00-\u0E7F]/;
async function wooProducts(store) {
  const products = [];
  let currency = null;
  for (let page = 1; page <= 60; page++) {
    await pause(store);
    const res = await getJson(`https://${store.host}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    const batch = Array.isArray(res?.data) ? res.data : [];
    for (const p of batch) {
      const unit = 10 ** (p.prices?.currency_minor_unit ?? 0);
      currency ??= p.prices?.currency_code ?? null;
      const name = decode(p.name ?? "");
      const cut = name.search(THAI);
      products.push({
        id: p.id,
        handle: p.slug,
        url: p.permalink,
        title: (cut > 0 ? name.slice(0, cut) : name).trim(),
        vendor: p.brands?.[0]?.name ?? "",
        type: (p.categories ?? []).map((c) => decode(c.name)).join(" "),
        tags: [name, ...(p.tags ?? []).map((t) => decode(t.name))],
        updatedAt: null,
        publishedAt: null,
        createdAt: null,
        variants: [{ title: "", price: Number(p.prices?.price) / unit, available: Boolean(p.is_in_stock) }],
        image: p.images?.[0]?.src ?? null,
        images: (p.images ?? []).slice(0, 12).map((x) => x.src),
        body: `${p.short_description ?? ""}\n${p.description ?? ""}`,
      });
    }
    if (batch.length < 100) break;
  }
  return { name: store.name, currency, products };
}

function decode(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");
}

function slim(p) {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    type: p.product_type,
    tags: p.tags,
    updatedAt: p.updated_at,
    // When the store put the page up: the release calendar uses the earliest store.
    publishedAt: p.published_at ?? null,
    createdAt: p.created_at ?? null,
    // Keep every variant: "Case only" or "Cable only" options must not set the price.
    variants: p.variants.map((v) => ({ title: v.title, price: Number(v.price), available: v.available })),
    // Only the URL of the store's first product photo. The page loads it from
    // the store's CDN and links back; images are never copied into the repo.
    image: p.images?.[0]?.src ?? null,
    // The other photos (ports, box, accessories), also as links only.
    images: (p.images ?? []).slice(0, 12).map((x) => x.src),
    body: p.body_html ?? "",
  };
}

/** Adds the product page's spec box to descriptions without a spec list. */
async function addSpecPages(store, products) {
  const file = new URL(`cache/pages/${store.id}.json`, root);
  await mkdir(new URL("cache/pages/", root), { recursive: true });
  const seen = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));
  const save = () => writeFile(file, JSON.stringify(seen));
  let fetched = 0;
  let found = 0;
  let failedInRow = 0;
  for (const p of products) {
    if (!noSheet(p.body) || ["other", "skip"].includes(classify(p))) continue;
    let hit = seen[p.id];
    if (hit?.updatedAt !== p.updatedAt) {
      // Stop for this run when out of budget or when the store keeps saying
      // "slow down": the pages left are picked up next week.
      if (fetched >= PAGE_BUDGET || failedInRow >= 5) continue;
      await pause(store);
      fetched++;
      const html = await getText(`https://${store.host}/products/${p.handle}`);
      if (html == null) {
        failedInRow++;
        continue;
      }
      failedInRow = 0;
      hit = seen[p.id] = { updatedAt: p.updatedAt, spec: specBlock(html) };
      if (fetched % 25 === 0) await save();
    }
    if (hit.spec) {
      found++;
      p.body += `
<div data-from="product-page">${hit.spec}</div>`;
    }
  }
  await save();
  const stopped = failedInRow >= 5 ? ", stopped early: store asked to slow down" : "";
  console.log(`${store.id.padEnd(16)} spec boxes from product pages: ${found} (${fetched} pages fetched${stopped})`);
}

async function getText(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html", cookie: "localization=US; cart_currency=USD" } });
      if (res.status === 429) {
        await slowDown(res, attempt);
        continue;
      }
      return res.ok ? await res.text() : null;
    } catch {
      await sleep(5 * attempt);
    }
  }
  return null;
}

async function getJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        // Ask for the US market so prices come back in USD wherever the crawler runs.
        headers: { "user-agent": UA, accept: "application/json", cookie: "localization=US; cart_currency=USD" },
      });
      if (res.status === 429) {
        await slowDown(res, attempt);
        continue;
      }
      if (!res.ok) return null;
      const currency = res.headers.get("set-cookie")?.match(/cart_currency=(\w+)/)?.[1] ?? null;
      return { data: await res.json(), currency };
    } catch {
      await sleep(5 * attempt);
    }
  }
  return null;
}
