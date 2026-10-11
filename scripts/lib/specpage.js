// Some store themes keep the spec list out of the product description: the
// feed (/products.json) then holds only pictures or prose, while the product
// page shows a spec box as real text (a Shopify metafield or theme section).
// Shenzhenaudio ("SPECIFICATIONS" box) and Linsoul ("Technical Details" table)
// do this.
//
// This pulls just that box out of the product page HTML. Nothing else from the
// page is kept, and the result goes through the same extractor and quote check
// as description text.

import { extractSheet } from "./specs.js";

const SPEC_HEAD = /^(?:specifications?|specs?|parameters?|technical (?:specifications?|data|details))\s*:?$/i;
const strip = (s) => s.replace(/<[^>]+>/g, "").trim();

/** HTML of the spec box(es) on a product page, or "" when there is none. */
export function specBlock(html) {
  const out = [];
  // Shenzhenaudio: <div class="tabs-adds-header ...">SPECIFICATIONS</div><p>...</p>
  const re = /class="[^"]*tabs-adds-header[^"]*"[^>]*>\s*([^<]{1,60}?)\s*<\/div>\s*([\s\S]*?)(?=<\/div>)/gi;
  for (const m of html.matchAll(re)) {
    if (!SPEC_HEAD.test(m[1].trim())) continue;
    const body = m[2].trim();
    if (strip(body).length >= 10) out.push(body);
  }
  // Linsoul: rows of <div class="col-name">Impedance</div><div class="col-desc">18 Ohm</div>,
  // kept as a table so each row reads "Impedance: 18 Ohm".
  const rows = [...html.matchAll(/<div class="col-name">([\s\S]{1,80}?)<\/div>\s*<div class="col-desc">([\s\S]{1,300}?)<\/div>/g)]
    .map((m) => [strip(m[1]), strip(m[2])])
    .filter(([a, b]) => a && b);
  if (rows.length) out.push(`<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`);
  return out.join("\n");
}

/** The feed description has no labelled spec lines, so the page may be worth a look. */
export function noSheet(body) {
  return !Object.keys(extractSheet(body ?? "")).length;
}
