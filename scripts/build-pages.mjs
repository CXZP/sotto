// Static page + share card (OG image) for every catalog model, plus sitemap.
//
// The app is a single page with #hash routes, which link previews (Facebook,
// LINE, Discord, X) and search engines can't read. Each model therefore also
// gets a plain HTML page at /p/<id>/ with its own title, description and a
// 1200×630 PNG card. Cards use only our own text (no store photos are copied).
//
// Output goes to a deploy folder (default _site/), never into the repo.
// Run: node scripts/build-pages.mjs [outDir]

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const root = new URL("..", import.meta.url);
const out = new URL(`${process.argv[2] ?? "_site"}/`, root);
const SITE = (process.env.SITE_URL ?? "https://cxzp.github.io/sotto").replace(/\/$/, "");
const catalog = JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8"));

const CAT = { iem: "IEM", headphone: "Headphones", dongle: "USB DAC/amp dongle", desktop: "Desktop DAC/amp", dap: "Music player", cd: "CD player / transport", power: "DC power supply", speaker: "Speakers" };
const ROLE = { dac: "Desktop DAC", amp: "Desktop headphone amp", dacamp: "Desktop DAC/amp" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const name = (i) => (i.brand ? `${i.brand} ${i.model}` : i.model);
const money = (n, c) => new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD", maximumFractionDigits: 0 }).format(n);

function facts(i) {
  const z = i.specs?.impedance?.[0];
  const s = i.specs?.sensitivity?.[0];
  const p = i.specs?.power?.find((x) => x.load === 32) ?? i.specs?.power?.[0];
  const parts = [];
  if (z) parts.push(`${+z.value.toFixed(1)} Ω`);
  if (s) parts.push(`${+s.value.toFixed(1)} ${s.unit ?? "dB"}`);
  if (p) parts.push(`${Math.round(p.mw)} mW @ ${p.load} Ω`);
  return parts;
}

function priceInfo(i) {
  const offers = (i.offers ?? []).filter((o) => o.price != null && !o.suspect && o.condition === "new");
  if (!offers.length) return null;
  const cur = offers[0].currency;
  const same = offers.filter((o) => o.currency === cur).map((o) => o.price);
  return { low: Math.min(...same), high: Math.max(...same), currency: cur, stores: new Set(offers.map((o) => o.store)).size };
}

// ---------------------------------------------------------------- share card

const fontDir = new URL("cache/fonts/", root);
const FONTS = {
  "Inter-400.ttf": "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf",
  "Inter-700.ttf": "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
};
await mkdir(fontDir, { recursive: true });
for (const [f, url] of Object.entries(FONTS)) {
  const path = new URL(f, fontDir);
  if (!existsSync(path)) await writeFile(path, Buffer.from(await (await fetch(url)).arrayBuffer())); // Inter, SIL OFL 1.1
}
const fontFiles = Object.keys(FONTS).map((f) => new URL(f, fontDir).pathname.replace(/^\/([A-Z]:)/, "$1"));

/** Split a title into at most 2 lines of roughly `max` characters. */
function wrap(text, max) {
  const words = text.split(" ");
  const lines = [""];
  for (const w of words) {
    const cur = lines.at(-1);
    if ((cur + " " + w).trim().length > max && cur) {
      if (lines.length === 2) {
        lines[1] = `${lines[1]}…`;
        break;
      }
      lines.push(w);
    } else lines[lines.length - 1] = `${cur} ${w}`.trim();
  }
  return lines;
}

function cardSvg({ kicker, title, line1, line2 }) {
  const size = title.length > 34 ? 60 : 76;
  const lines = wrap(title, size === 60 ? 30 : 24);
  const bars = [[0, 24, 36], [30, 12, 60], [60, 20, 44], [90, 32, 20]]
    .map(([x, y, h]) => `<rect x="${x}" y="${y}" width="16" height="${h}" rx="8" fill="#fff"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b0b0d"/>
  <rect x="40" y="40" width="1120" height="550" rx="36" fill="#1c1c1f"/>
  <g transform="translate(96 96)">${bars}</g>
  <text x="230" y="146" font-family="Inter" font-weight="700" font-size="44" fill="#fff">Sotto</text>
  <text x="96" y="250" font-family="Inter" font-weight="400" font-size="32" fill="#9a9aa2">${esc(kicker)}</text>
  ${lines.map((l, n) => `<text x="96" y="${330 + n * (size + 10)}" font-family="Inter" font-weight="700" font-size="${size}" fill="#fff">${esc(l)}</text>`).join("")}
  <text x="96" y="${lines.length === 2 ? 500 : 440}" font-family="Inter" font-weight="400" font-size="34" fill="#d6d6db">${esc(line1)}</text>
  <text x="96" y="548" font-family="Inter" font-weight="700" font-size="34" fill="#5ac46b">${esc(line2)}</text>
</svg>`;
}

const png = (svg) =>
  new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Inter" }, fitTo: { mode: "width", value: 1200 } }).render().asPng();

// ---------------------------------------------------------------- pages

function page(i) {
  const n = name(i);
  const f = facts(i);
  const pr = priceInfo(i);
  const url = `${SITE}/p/${i.id}/`;
  const app = `${SITE}/#item/${encodeURIComponent(i.id)}`;
  const kind = (ROLE[i.role] ?? CAT[i.category]) ?? i.category;
  const desc = [kind, ...f, pr ? `from ${money(pr.low, pr.currency)} at ${pr.stores} store${pr.stores > 1 ? "s" : ""}` : null, "Sourced specs, real prices, and whether your phone or amp can drive it."]
    .filter(Boolean)
    .join(" · ");
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: n,
    ...(i.brand ? { brand: { "@type": "Brand", name: i.brand } } : {}),
    category: kind,
    url,
    ...(pr ? { offers: { "@type": "AggregateOffer", lowPrice: pr.low, highPrice: pr.high, priceCurrency: pr.currency, offerCount: pr.stores } } : {}),
  };
  const specRows = ["impedance", "sensitivity", "zout", "power"]
    .flatMap((k) => (i.specs?.[k] ?? []).slice(0, 3).map((e) => [k, e]))
    .map(([k, e]) => {
      const v = k === "power" ? `${Math.round(e.mw)} mW @ ${e.load} Ω` : k === "sensitivity" ? `${e.value} ${e.unit ?? "dB (unit not stated)"}` : `${e.value} Ω`;
      const label = { impedance: "Impedance", sensitivity: "Sensitivity", zout: "Output impedance", power: "Output power" }[k];
      const src = e.sources?.[0]?.url;
      return `<li><b>${label}:</b> ${esc(v)}${src ? ` <a class="src" href="${esc(src)}" rel="nofollow noopener">${esc(new URL(src).hostname.replace(/^www\./, ""))}</a>` : ""}</li>`;
    })
    .join("");
  const offers = (i.offers ?? [])
    .filter((o) => o.price != null)
    .sort((a, b) => a.price - b.price)
    .map((o) => `<li><a href="${esc(o.url)}" rel="nofollow noopener">${esc(catalog.stores[o.store]?.name ?? o.store)}</a> — ${money(o.price, o.currency)}${o.condition !== "new" ? " (open box/used)" : ""}${o.available ? "" : " · sold out"}</li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(n)} — specs, prices, will it drive? | Sotto</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Sotto">
<meta property="og:title" content="${esc(n)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og/${i.id}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../../style.css">
<link rel="stylesheet" href="../../catalog.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
<main class="static-page">
  <p><a href="../../">Sotto</a> › <a href="../../#catalog?cat=${i.category}">${esc(kind)}</a>${i.brand ? ` › <a href="../../#catalog?brand=${encodeURIComponent(i.brand)}">${esc(i.brand)}</a>` : ""}</p>
  <h1>${esc(n)}</h1>
  <p class="lead">${esc(desc)}</p>
  <p><a class="pill primary" href="${app}">Open in Sotto: check it with your phone or amp →</a></p>
  ${specRows ? `<h2>Specs (with sources)</h2><ul>${specRows}</ul>` : ""}
  ${offers ? `<h2>Prices by store</h2><p class="muted small">Store feed prices seen ${esc(catalog.builtAt.slice(0, 10))}, before shipping and tax.</p><ul>${offers}</ul>` : ""}
  <p class="muted small">Sotto is open source and not affiliated with any brand or store. Store links are not affiliate links.</p>
</main>
</body>
</html>`;
}

// ---------------------------------------------------------------- write

await mkdir(new URL("p/", out), { recursive: true });
await mkdir(new URL("og/", out), { recursive: true });
const t0 = Date.now();
for (const i of catalog.items) {
  const dir = new URL(`p/${i.id}/`, out);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("index.html", dir), page(i));
  const pr = priceInfo(i);
  await writeFile(
    new URL(`og/${i.id}.png`, out),
    png(
      cardSvg({
        kicker: [i.brand, (ROLE[i.role] ?? CAT[i.category])].filter(Boolean).join(" · "),
        title: i.model,
        line1: facts(i).join("  ·  ") || "Specs, prices and compatibility",
        line2: pr ? `from ${money(pr.low, pr.currency)} · ${pr.stores} store${pr.stores > 1 ? "s" : ""}` : "Will your phone or amp drive it?",
      }),
    ),
  );
}
// Home card
await writeFile(
  new URL("og/default.png", out),
  png(cardSvg({ kicker: "Open-source headphone checker", title: "Will it plug in? Is it loud enough?", line1: `${catalog.items.length.toLocaleString("en-US")} models · sourced specs · real prices`, line2: "Do you need an amp?" })),
);

const urls = [`${SITE}/`, ...catalog.items.map((i) => `${SITE}/p/${i.id}/`)];
await writeFile(
  new URL("sitemap.xml", out),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${catalog.builtAt.slice(0, 10)}</lastmod></url>`).join("\n")}\n</urlset>\n`,
);
await writeFile(new URL("robots.txt", out), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`${catalog.items.length} pages + cards in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
