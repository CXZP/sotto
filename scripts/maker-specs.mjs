// Headphone output figures from the makers' pages that scripts/maker-ports.mjs
// already read (cache/makers/): output power per load, output impedance, and
// the same per headphone jack where the page ties them to one (3.5 vs 4.4 mm).
// Adds { power, zout, outputs } to the entries in data/maker-ports.json; the
// catalog build uses them only for models no store gives these figures for.
//
// Reads cached pages only, never the network: run maker-ports.mjs first.
// Run: node scripts/maker-specs.mjs

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extractSpecs, textify, verify } from "./lib/specs.js";
import { jackOutputs } from "./lib/jacks.js";

const root = new URL("../", import.meta.url);
const OUT = new URL("data/maker-ports.json", root);
const maker = JSON.parse(await readFile(OUT, "utf8"));
const AMPS = new Set(["dongle", "portable", "desktop", "dap"]);
const cached = (url, ext) => new URL(`cache/makers/${url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_")}${ext}`, root);

let withPower = 0;
let withOutputs = 0;
for (const [id, e] of Object.entries(maker)) {
  delete e.power;
  delete e.zout;
  delete e.outputs;
  if (!e.url || !AMPS.has(e.category)) continue;
  // A page, or a PDF manual's text (one line per text line).
  const page = cached(e.url, ".html");
  const pdf = cached(e.url, ".txt");
  const html = existsSync(page) ? await readFile(page, "utf8") : existsSync(pdf) ? (await readFile(pdf, "utf8")).split(/\r?\n/).map((l) => `<p>${l}</p>`).join("") : null;
  if (!html) continue;
  const { lines, specs } = extractSpecs(html);
  // The same quote check as store text: the number must be on the line it came from.
  const power = specs.power.filter((x) => verify("power", x, lines).ok).map(({ load, mw, quote }) => ({ load, mw, quote: quote.slice(0, 200) }));
  const zout = specs.zout.filter((x) => verify("zout", x, lines).ok).map(({ value, quote }) => ({ value, quote: quote.slice(0, 200) }));
  if (power.length) (e.power = power), withPower++;
  if (zout.length) e.zout = zout;
  const outs = jackOutputs(textify(html), e.category);
  if (outs) (e.outputs = outs.map(({ jack, power: p, voltage, zout: z, quotes }) => ({ jack, power: p, voltage, zout: z, quote: quotes.join(" / ").slice(0, 300) }))), withOutputs++;
}
await writeFile(OUT, JSON.stringify(maker, null, 1) + "\n");
console.log(`${withPower} models with output power, ${withOutputs} with figures per jack`);
