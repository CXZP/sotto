// Brand logos from Simple Icons (icons released as CC0; the marks themselves
// stay their owners' trademarks and are used only to identify the brand).
// Only exact name matches: "Matrix Audio" is not the Matrix chat protocol.
// Brands without an icon get initials in the page instead.
//
// Run: node scripts/build-logos.mjs   (after build-catalog)

import { readFile, writeFile } from "node:fs/promises";
import * as icons from "simple-icons";

const root = new URL("..", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8"));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const byTitle = new Map();
for (const i of Object.values(icons)) if (i?.title && i.path) byTitle.set(norm(i.title), i);

// Same brand, different name in Simple Icons.
const ALIAS = { "Roon Labs": "Roon", Yamaha: "Yamaha Corporation" };
const out = {};
for (const brand of new Set(catalog.items.map((i) => i.brand).filter(Boolean))) {
  const icon = byTitle.get(norm(ALIAS[brand] ?? brand));
  if (icon) out[brand] = { path: icon.path, title: icon.title, slug: icon.slug, ...(icon.guidelines ? { guidelines: icon.guidelines } : {}) };
}
// Logos from the brands' own homepages (scripts/fetch-logos.mjs), each checked by eye.
const ok = JSON.parse(await readFile(new URL("data/logos-ok.json", root), "utf8"));
for (const [brand, x] of Object.entries(ok)) if (x.file && !out[brand]) out[brand] = { img: `data/logos/${x.file}`, ...(x.mask ? { mask: true } : {}) };
await writeFile(new URL("data/logos.json", root), JSON.stringify(out));
console.log(`${Object.keys(out).length} logos: ${Object.keys(out).join(", ")}`);
