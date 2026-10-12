// Some store themes keep the spec list out of the product description: the
// feed (/products.json) then holds only pictures or prose, while the product
// page shows a spec table as real text (a Shopify metafield or theme section).
//
// This pulls just the label/value rows out of the product page HTML. Nothing
// else from the page is kept, and the result goes through the same extractor
// and quote check as description text (which only accepts known spec labels).

import { extractSheet } from "./specs.js";

const SPEC_HEAD = /^(?:specifications?|specs?|parameters?|technical (?:specifications?|data|details))\s*:?$/i;
const strip = (s) => s.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>\s*<p[^>]*>/gi, "; ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** HTML of the spec rows on a product page, or "" when there are none. */
export function specBlock(html) {
  const out = [];
  const rows = [];
  const pair = (a, b) => {
    a = strip(a);
    b = strip(b);
    if (a && b && a.length <= 80 && b.length <= 300) rows.push([a, b]);
  };
  // Shenzhenaudio: <div class="tabs-adds-header ...">SPECIFICATIONS</div><p>...</p>
  for (const m of html.matchAll(/class="[^"]*tabs-adds-header[^"]*"[^>]*>\s*([^<]{1,60}?)\s*<\/div>\s*([\s\S]*?)(?=<\/div>)/gi)) {
    if (SPEC_HEAD.test(m[1].trim()) && strip(m[2]).length >= 10) out.push(m[2].trim());
  }
  // Linsoul: <div class="col-name">Impedance</div><div class="col-desc">18 Ohm</div>
  for (const m of html.matchAll(/<div class="col-name">([\s\S]{1,200}?)<\/div>\s*<div class="col-desc">([\s\S]{1,600}?)<\/div>/g)) pair(m[1], m[2]);
  // Definition lists: <dt>Impedance</dt><dd>32Ω</dd> (Linsoul's theme since Oct 2026).
  for (const m of html.matchAll(/<dt[^>]*>([\s\S]{1,200}?)<\/dt>\s*<dd[^>]*>([\s\S]{1,600}?)<\/dd>/gi)) pair(m[1], m[2]);
  // Impact theme feature chart (Headphone Zone, Kitsune HiFi).
  for (const m of html.matchAll(/class="feature-chart__heading[^"]*"[^>]*>([\s\S]{1,300}?)<\/div>\s*<div\s+class="feature-chart__value[^"]*"[^>]*>([\s\S]{1,1500}?)<\/div>\s*<\/div>/g)) pair(m[1], m[2]);
  // Kiwi Ears: <div class="pk-specrow..."><p>label</p><p>value</p></div>
  for (const m of html.matchAll(/class="pk-specrow[^"]*"[^>]*>\s*<p[^>]*>([\s\S]{1,200}?)<\/p>\s*<p[^>]*>([\s\S]{1,600}?)<\/p>/g)) pair(m[1], m[2]);
  // Plain two-cell table rows (Addicted to Audio, Audio Advice, Moon Audio).
  for (const m of html.matchAll(/<tr[^>]*>\s*<t[hd][^>]*>((?:(?!<\/?t[rhd][\s>])[\s\S]){1,300}?)<\/t[hd]>\s*<t[hd][^>]*>((?:(?!<\/?t[rhd][\s>])[\s\S]){1,1200}?)<\/t[hd]>\s*<\/tr>/gi)) pair(m[1], m[2]);
  // "Label: value" list items after a Specifications heading (HiFi Headphones).
  for (const h of html.matchAll(/>\s*(?:Technical\s+)?Specifications?\s*</gi)) {
    const chunk = html.slice(h.index, h.index + 8000);
    for (const li of chunk.matchAll(/<li[^>]*>([\s\S]{1,400}?)<\/li>/gi)) {
      const t = strip(li[1]);
      const c = t.indexOf(":");
      if (c > 0 && c < 60) pair(t.slice(0, c), t.slice(c + 1));
    }
  }
  const seen = new Set();
  const uniq = rows.filter(([a, b]) => {
    const k = `${a}|${b}`;
    return !seen.has(k) && seen.add(k);
  });
  if (uniq.length) out.push(`<table>${uniq.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`);
  return out.join("\n");
}

/** The feed description has no labelled spec lines, so the page may be worth a look. */
export function noSheet(body) {
  return !Object.keys(extractSheet(body ?? "")).length;
}
