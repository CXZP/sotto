// Direct links to the squig.link graph sites that list each headphone.
//
// squig.link publishes its directory of measurers (squigsites.json) and each
// site publishes a model index (data/phone_book.json); squig.link's own
// cross-site search reads the same files. We read only model names, never the
// measurement files, and write links: data/squig.json { itemId: [{ s, u, t }] }.
// Sites on squig.link's own opt-out list (squigsites.js) are skipped.
//
// Run: node scripts/build-squig.mjs   (about 2 minutes, one request at a time)

import { readFile, writeFile } from "node:fs/promises";

const UA = "SottoBot/0.1 (+https://github.com/CXZP/sotto; links to graph sites, names only)";
const root = new URL("..", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, "");

async function get(url, as = "json") {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      if (res.status === 429) {
        await sleep(60000 * attempt);
        continue;
      }
      if (!res.ok) return null;
      return as === "json" ? await res.json() : await res.text();
    } catch {
      await sleep(3000);
    }
  }
  return null;
}

const sites = await get("https://squig.link/squigsites.json");
if (!Array.isArray(sites)) throw new Error("squigsites.json unavailable");
const js = (await get("https://squig.link/squigsites.js", "text")) ?? "";
const optedOut = new Set([...(js.match(/optedOut\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]));

// Catalog headphones by brand key → [{ id, model key }].
const catalog = JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8"));
const byBrand = new Map();
for (const i of catalog.items) {
  if (!["iem", "headphone"].includes(i.category) || !i.brand) continue;
  const b = key(i.brand);
  if (!byBrand.has(b)) byBrand.set(b, []);
  byBrand.get(b).push({ id: i.id, m: key(i.model) });
}

const out = {};
let read = 0;
for (const site of sites) {
  if (optedOut.has(site.username)) continue;
  const base = site.urlType === "root" ? "https://squig.link" : site.urlType === "altDomain" ? site.altDomain : site.urlType === "subdomain" ? `https://${site.username}.squig.link` : `https://squig.link/lab/${site.username}`;
  for (const db of site.dbs ?? []) {
    await sleep(1500);
    const book = await get(`${base}${db.folder}data/phone_book.json`);
    if (!Array.isArray(book)) continue;
    read++;
    for (const brand of book) {
      const list = byBrand.get(key(brand.name));
      if (!list) continue;
      for (const phone of brand.phones ?? []) {
        // A phone entry may list several variants; the link shares the first.
        const names = Array.isArray(phone.name) ? phone.name : [phone.name];
        const pk = key(names[0]);
        const hit = list.find((x) => x.m && x.m === pk);
        if (!hit) continue;
        // Variants ("(Velvet)", "(Crystal 2, 2 Gray)") are part of the share name.
        const suffix = Array.isArray(phone.suffix) ? phone.suffix[0] : phone.suffix;
        const share = `${brand.name} ${names[0]}${suffix ? ` ${suffix}` : ""}`.replace(/ /g, "_");
        const url = `${base}${db.folder}?share=${encodeURIComponent(share).replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`;
        (out[hit.id] ??= []);
        if (!out[hit.id].some((x) => x.u === url)) out[hit.id].push({ s: site.name, u: url, t: db.type ?? "", ...(suffix ? { v: String(suffix).replace(/^\(|\)$/g, "") } : {}), ...(names.length > 1 || (Array.isArray(phone.file) && phone.file.length > 1) ? { n: Array.isArray(phone.file) ? phone.file.length : names.length } : {}) });
      }
    }
  }
}
for (const k of Object.keys(out)) out[k].sort((a, b) => a.s.localeCompare(b.s));
await writeFile(new URL("data/squig.json", root), JSON.stringify(out));
console.log(`squig.link: ${read} databases read (${optedOut.size} sites opted out, skipped), ${Object.keys(out).length} models linked`);
