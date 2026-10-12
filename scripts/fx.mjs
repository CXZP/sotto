// Writes data/fx.json: US dollars per unit of each currency, from the European
// Central Bank's daily reference rates (free to use, published around 16:00 CET
// on working days). The page shows store prices in the store's own currency and
// an approximate amount in the reader's chosen one; these rates make that amount.
//
// Run: node scripts/fx.mjs   (the deploy job runs it before publishing)
// If the ECB can't be reached, the file already in data/ is kept.

import { writeFile } from "node:fs/promises";

const URL_ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const out = new URL("../data/fx.json", import.meta.url);

try {
  const res = await fetch(URL_ECB, { headers: { "user-agent": "SottoBot/0.1 (+https://github.com/CXZP/sotto)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const perEur = { EUR: 1 };
  for (const [, code, rate] of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) perEur[code] = Number(rate);
  if (!date || !perEur.USD) throw new Error("no USD rate in the ECB file");
  // ECB quotes units per euro; turn that into US dollars per unit.
  const usdPer = Object.fromEntries(Object.entries(perEur).map(([c, r]) => [c, Number((perEur.USD / r).toPrecision(6))]));
  await writeFile(out, `${JSON.stringify({ date, source: "European Central Bank euro reference rates", url: URL_ECB, usdPer }, null, 1)}\n`);
  console.log(`fx: ${Object.keys(usdPer).length} currencies, ${date}`);
} catch (e) {
  console.log(`fx: kept the rates already in data/fx.json (${e.message})`);
}
