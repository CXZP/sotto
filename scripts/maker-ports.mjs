// Sockets from makers' own spec pages: FiiO ("<MODEL>_parameters", a
// "Buttons and Ports" table), iFi (the specification list) and Schiit (specs
// and description). Writes data/maker-ports.json, one entry per catalog
// model, every socket with the line it came from and the page URL. The
// catalog build fills in what stores don't list from it.
//
// Run: node scripts/maker-ports.mjs [fiio|ifi|schiit|topping|smsl ...]
// Topping needs pdftotext (poppler) on the PATH.
// Slow on purpose (one page every few seconds), pages cached in cache/makers/.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { toEntry, count, fiioPairs, ifiPairs, schiitEntry, fiioSlugs, manualPairs, calloutPairs, smslPairs } from "./lib/makerpages.js";

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

// A PDF's text, kept next to the pages (the PDF itself isn't kept).
async function pdfText(url) {
  const txt = new URL(`cache/makers/${url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_")}.txt`, root);
  if (existsSync(txt)) return readFile(txt, "utf8");
  const wait = last + DELAY - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) return console.log(`  ${res.status} ${url}`), null;
  const pdf = new URL(`${txt.href}.pdf`);
  await writeFile(pdf, Buffer.from(await res.arrayBuffer()));
  try {
    execFileSync("pdftotext", ["-layout", fileURLToPath(pdf), fileURLToPath(txt)], { stdio: "ignore" });
  } catch {
    console.log(`  pdftotext failed on ${url}`);
    return null;
  }
  const text = await readFile(txt, "utf8");
  // A picture-only manual is kept, to be read by eye (cache/ isn't committed).
  if (text.trim().length > 500) await rm(pdf, { force: true });
  return text;
}

// ---------------------------------------------------------------------------

// The maker page whose name is in the model's name and every store's title,
// the longest such ("ZEN DAC 3" over "ZEN DAC").
const squash = (s) => String(s).toLowerCase().replace(/\b(?:ifi|schiit|topping|audio)\b/g, "").replace(/[^a-z0-9]/g, "");
function bestPage(item, pages) {
  const titles = [item.model, ...item.offers.map((o) => o.title)].map(squash);
  const fits = pages.filter((p) => {
    const k = squash(p.key);
    // "A900 Ultra" isn't the A900: what's left of the name mustn't be a model step.
    const rest = squash(item.model).split(k).slice(1).join(k);
    if (/^(?:ultra(?!res)|pro|plus|ii|iii|iv|se|le|lite|mk|max|r2r|octo|sabre|velvet|v\d?$|s$)/.test(rest)) return false;
    return k.length > 2 && titles.every((t) => t.includes(k)) && squash(item.model).startsWith(k.slice(0, 3));
  });
  return fits.sort((a, b) => squash(b.key).length - squash(a.key).length)[0] ?? null;
}

const models = catalog.items.filter((i) => ELECTRONICS.has(i.category));
let done = 0;

// Store names no slug guess reaches: the K9 with dual ES9068AS and THX AAA is the
// K9 Pro ESS; the K7 page covers the K7 BT; "AIR Power" is the AIR AMP.
const FIIO_PAGE = [
  [/^K9 THX/i, "k9proess"],
  [/^K7 BT/i, "k7"],
  [/^AIR Power/i, "AIRAMP"],
];

if (!only.length || only.includes("fiio")) {
  for (const i of models.filter((i) => i.brand === "FiiO")) {
    let url, pairs = [];
    // Older pages are lower case ("/btr7_parameters").
    const named = FIIO_PAGE.find(([re]) => re.test(i.model))?.[1];
    for (const slug of named ? [named] : fiioSlugs(i.model).flatMap((s) => [s, s.toLowerCase()])) {
      url = `https://www.fiio.com/${slug}_parameters`;
      const html = await get(url);
      pairs = html ? fiioPairs(html) : [];
      if (pairs.length) break;
    }
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

if (!only.length || only.includes("topping")) {
  // Topping's spec tabs are pictures; the words are in the user manuals
  // (PDF, read with poppler's pdftotext). Older manuals are pictures too.
  const products = new Map();
  for (const cat of ["dac", "dac-amp-combo", "headphone-amp", "power-amplifier", "portable", "preamplifier", "player", "others"]) {
    const html = await get(`https://www.toppingaudio.com/products-list/${cat}`);
    for (const m of (html ?? "").matchAll(/\{id:\d+,slug:"([a-z0-9-]+)",category_id:\d+,title:"([^"]+)"/g)) products.set(m[1], m[2]);
  }
  const pages = [...products].map(([handle, title]) => ({ handle, key: title }));
  // Add-on boards and modules aren't the box they fit in.
  for (const i of models.filter((i) => i.brand === "TOPPING" && !/module|upgrade|board|\bcard\b|power supply/i.test(i.model))) {
    const h = bestPage(i, pages);
    if (!h) continue;
    const html = await get(`https://www.toppingaudio.com/product-item/${h.handle}`);
    const manual = [...(html ?? "").matchAll(/download_url:"(https:\/\/dl\.topping\.audio\/[^"]+\.pdf)"/g)].map((m) => m[1]).find((u) => /\/(?:um|usermanual)\//.test(u) && !/quick/i.test(u));
    if (!manual) continue;
    const text = await pdfText(manual);
    const listed = manualPairs(text ?? "");
    const fromList = toEntry(manual, listed);
    const e = count(fromList) ? fromList : toEntry(manual, calloutPairs(text ?? ""));
    if (count(e)) (result[i.id] = { ...e, category: i.category }), done++;
    console.log(`topping ${i.id} <- ${h.handle}: ${Object.keys(e.ports.in)} | ${Object.keys(e.ports.out)} | ${e.jacks}`);
  }
}

if (!only.length || only.includes("smsl")) {
  // SMSL's manual library lists every model with its PDF.
  const html = (await get("https://www.smsl-audio.com/portal/product/downlist/id/12.html")) ?? "";
  const roman = (s) => s.replace(/Ⅱ/g, "II").replace(/Ⅲ/g, "III");
  const sq = (x) => roman(x).toLowerCase().replace(/\bsmsl\b/g, "").replace(/mk ?iii\b/g, "mk3").replace(/mk ?ii\b/g, "mk2").replace(/[^a-z0-9]/g, "");
  const manuals = [...html.matchAll(/data-name="([^"]+)"[\s\S]*?href="([^"]+\.pdf)"/g)].map((m) => ({ key: sq(m[1]), name: roman(m[1]), url: new URL(m[2], "https://www.smsl-audio.com/").href }));
  for (const i of models.filter((i) => /^smsl$/i.test(i.brand))) {
    const own = sq(i.model);
    const titles = [own, ...i.offers.map((o) => sq(o.title))];
    const fit = manuals.filter((m) => m.key.length > 1 && own.startsWith(m.key) && titles.every((t) => t.includes(m.key))).sort((a, b) => b.key.length - a.key.length)[0];
    if (!fit) continue;
    // "VMV A1 Pro" isn't the VMV A1; "C200 Pro ESS" (the chip) or a repeated "MK2" is.
    let rest = own.slice(fit.key.length);
    while (rest && fit.key.endsWith(rest.slice(0, 3))) rest = rest.slice(3);
    if (/^(?:pro|ultra|mk\d|ii|se\b|ex$|es$|s$|n$|plus|max|r$)/.test(rest)) continue;
    const text = await pdfText(fit.url);
    const listed = smslPairs(text ?? "");
    const fromList = toEntry(fit.url, listed);
    const e = count(fromList) ? fromList : toEntry(fit.url, calloutPairs(text ?? ""));
    if (count(e)) (result[i.id] = { ...e, category: i.category }), done++;
    console.log(`smsl ${i.id} <- ${fit.name}: ${(text ?? "").length} chars | ${Object.keys(e.ports.in)} | ${Object.keys(e.ports.out)} | ${e.jacks}`);
  }
}

await writeFile(OUT, JSON.stringify(result, null, 1) + "\n");
console.log(`${done} models with maker sockets this run; ${Object.keys(result).length} in total`);
