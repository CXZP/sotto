// Sockets from makers' own spec pages: FiiO ("<MODEL>_parameters", a
// "Buttons and Ports" table), iFi (the specification list) and Schiit (specs
// and description). Writes data/maker-ports.json, one entry per catalog
// model, every socket with the line it came from and the page URL. The
// catalog build fills in what stores don't list from it.
//
// Run: node scripts/maker-ports.mjs [fiio|ifi|schiit ...]
// Slow on purpose (one page every few seconds), pages cached in cache/makers/.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { toEntry, count, fiioPairs, ifiPairs, schiitEntry, fiioSlug } from "./lib/makerpages.js";

const root = new URL("../", import.meta.url);
const UA = "Mozilla/5.0 (compatible; SottoBot/1.0; +https://cxzp.github.io/sotto/)";
const DELAY = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2);

await mkdir(new URL("cache/makers/", root), { recursive: true });
const catalog = JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8"));
const OUT = new URL("data/maker-ports.json", root);
const result = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : {};
const ELECTRONICS = new Set(["desktop", "dongle", "portable", "dap", "cd", "phono", "turntable", "power"]);

let last = 0;
async function get(url) {
  const file = new URL(`cache/makers/${url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_")}.html`, root);
  if (existsSync(file)) return readFile(file, "utf8");
  // A page that wasn't there last time isn't asked for again (delete cache/makers to retry).
  const missing = new URL(`${file.href}.404`);
  if (existsSync(missing)) return null;
  const wait = last + DELAY - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res.ok) {
    console.log(`  ${res.status} ${url}`);
    if (res.status === 404) await writeFile(missing, "");
    return null;
  }
  const html = await res.text();
  await writeFile(file, html);
  return html;
}

// ---------------------------------------------------------------------------

// The maker page whose name is in the model's name and every store's title,
// the longest such ("ZEN DAC 3" over "ZEN DAC").
const squash = (s) => String(s).toLowerCase().replace(/\b(?:ifi|schiit|audio)\b/g, "").replace(/[^a-z0-9]/g, "");
function bestPage(item, pages) {
  const titles = [item.model, ...item.offers.map((o) => o.title)].map(squash);
  const fits = pages.filter((p) => {
    const k = squash(p.key);
    return k.length > 2 && titles.every((t) => t.includes(k)) && squash(item.model).startsWith(k.slice(0, 3));
  });
  return fits.sort((a, b) => squash(b.key).length - squash(a.key).length)[0] ?? null;
}

const models = catalog.items.filter((i) => ELECTRONICS.has(i.category));
let done = 0;

if (!only.length || only.includes("fiio")) {
  for (const i of models.filter((i) => i.brand === "FiiO")) {
    const url = `https://www.fiio.com/${fiioSlug(i.model)}_parameters`;
    const html = await get(url);
    const pairs = html ? fiioPairs(html) : [];
    if (!pairs.length) continue;
    // FiiO's table lists every socket on the box.
    const e = { ...toEntry(url, pairs), complete: true };
    if (count(e)) (result[i.id] = { ...e, category: i.category }), done++;
    console.log(`fiio ${i.id}: ${Object.keys(e.ports.in)} | ${Object.keys(e.ports.out)} | ${e.jacks}`);
  }
}

if (!only.length || only.includes("ifi")) {
  // The maker's own product list gives every page address.
  const handles = [];
  for (let p = 1; p < 5; p++) {
    const res = await fetch(`https://ifi-audio.com/products.json?limit=250&page=${p}`, { headers: { "user-agent": UA } });
    const j = res.ok ? await res.json() : { products: [] };
    if (!j.products.length) break;
    handles.push(...j.products.map((x) => ({ handle: x.handle, title: x.title })));
    await sleep(DELAY);
  }
  for (const i of models.filter((i) => i.brand === "iFi")) {
    const h = bestPage(i, handles.map((x) => ({ ...x, key: x.title })));
    if (!h) continue;
    const url = `https://ifi-audio.com/products/${h.handle}`;
    const html = await get(url);
    if (!html) continue;
    const e = toEntry(url, ifiPairs(html));
    if (count(e)) (result[i.id] = { ...e, category: i.category }), done++;
    console.log(`ifi ${i.id} <- ${h.handle}: ${Object.keys(e.ports.in)} | ${Object.keys(e.ports.out)} | ${e.jacks}`);
  }
}

if (!only.length || only.includes("schiit")) {
  const list = await get("https://www.schiit.com/");
  const links = [...new Set([...(list ?? "").matchAll(/href=['"](?:https:\/\/www\.schiit\.com)?\/products\/([a-z0-9-]+)['"]/gi)].map((m) => m[1]))];
  for (const i of models.filter((i) => i.brand === "Schiit Audio")) {
    const h = bestPage(i, links.map((x) => ({ handle: x, key: x })))?.handle;
    if (!h) continue;
    const url = `https://www.schiit.com/products/${h}`;
    const html = await get(url);
    if (!html) continue;
    const e = schiitEntry(url, html);
    if (count(e)) (result[i.id] = { ...e, category: i.category }), done++;
    console.log(`schiit ${i.id} <- ${h}: ${Object.keys(e.ports.in)} | ${Object.keys(e.ports.out)} | ${e.jacks}`);
  }
}

await writeFile(OUT, JSON.stringify(result, null, 1) + "\n");
console.log(`${done} models with maker sockets this run; ${Object.keys(result).length} in total`);
