// Fetches public Shopify product feeds (/products.json) from the stores in
// scripts/stores.json and writes one snapshot per store to cache/raw/.
//
// The snapshot keeps the store's description HTML so the extractor can verify
// quotes against it. cache/ is git-ignored: store text is never redistributed,
// only the facts extracted from it (see scripts/extract.mjs).
//
// Run: node scripts/crawl.mjs [storeId ...]

import { mkdir, writeFile, readFile } from "node:fs/promises";

const UA = "SottoBot/0.1 (+https://github.com/CXZP/sotto; open-source spec catalog)";
const root = new URL("..", import.meta.url);
const stores = JSON.parse(await readFile(new URL("scripts/stores.json", root), "utf8"));
const only = process.argv.slice(2);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

await mkdir(new URL("cache/raw/", root), { recursive: true });

for (const store of stores) {
  if (only.length && !only.includes(store.id)) continue;
  const meta = (await getJson(`https://${store.host}/meta.json`))?.data;
  const products = [];
  const currencies = new Set();
  for (let page = 1; page <= 100; page++) {
    await sleep(store.delay);
    const res = await getJson(`https://${store.host}/products.json?limit=250&page=${page}`);
    const batch = res?.data?.products ?? [];
    // Shopify localises prices by visitor location. The currency actually used
    // is in the cart_currency cookie of each response, not in meta.json.
    if (res?.currency) currencies.add(res.currency);
    products.push(...batch.map(slim));
    if (batch.length < 250) break;
  }
  if (currencies.size > 1) throw new Error(`${store.id}: mixed currencies ${[...currencies]}`);
  const snapshot = {
    store: store.id,
    host: store.host,
    name: meta?.name ?? store.host,
    currency: [...currencies][0] ?? meta?.currency ?? null,
    fetchedAt: new Date().toISOString(),
    products,
  };
  await writeFile(new URL(`cache/raw/${store.id}.json`, root), JSON.stringify(snapshot));
  console.log(`${store.id.padEnd(16)} ${String(products.length).padStart(5)} products  ${snapshot.currency}`);
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
    // Keep every variant: "Case only" or "Cable only" options must not set the price.
    variants: p.variants.map((v) => ({ title: v.title, price: Number(v.price), available: v.available })),
    body: p.body_html ?? "",
  };
}

async function getJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        // Ask for the US market so prices come back in USD wherever the crawler runs.
        headers: { "user-agent": UA, accept: "application/json", cookie: "localization=US; cart_currency=USD" },
      });
      if (res.status === 429) {
        await sleep(30 * attempt);
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
