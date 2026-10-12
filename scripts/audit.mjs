// Runs the catalog audit (scripts/lib/audit.js) after a build, writes
// data/audit.json, and warns when a rule's count jumps against the last run.
//
// Run: node scripts/audit.mjs

import { readFile, writeFile } from "node:fs/promises";
import { audit, regressions } from "./lib/audit.js";

const root = new URL("..", import.meta.url);
const file = new URL("data/audit.json", root);
const catalog = JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8"));
const prev = await readFile(file, "utf8").then(JSON.parse, () => null);
const now = { builtAt: catalog.builtAt, ...audit(catalog) };

for (const [name, r] of Object.entries(now.rules)) {
  const before = prev?.rules?.[name]?.n;
  const delta = before == null ? "" : r.n === before ? "" : ` (${r.n > before ? "+" : ""}${r.n - before})`;
  console.log(`${String(r.n).padStart(5)} ${r.severity.padEnd(5)} ${name}${delta}  ${r.ids.slice(0, 3).join(", ")}`);
}
// GitHub Actions shows ::warning:: lines on the run page.
for (const [name, before, n] of regressions(prev, now)) console.log(`::warning::Audit: "${name}" went from ${before} to ${n}`);

await writeFile(file, JSON.stringify(now));
