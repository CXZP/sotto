// Pulls people's checks (supabase/checks.sql) into data/checks.json before a
// build, so the catalog can carry them. Reads with the publishable key, like the
// site; nothing secret. If Supabase can't be reached, the last file stays.
//
// Run: node scripts/fetch-checks.mjs

import { writeFile } from "node:fs/promises";
import { SUPABASE_URL, SUPABASE_KEY } from "../src/config.js";

const res = await fetch(`${SUPABASE_URL}/rest/v1/checks?select=item_id,field,verdict,shown,data,evidence_url,note,created_at&order=created_at.asc`, {
  headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
}).catch(() => null);
if (!res?.ok) {
  // Table not created yet (404/400) or offline: keep whatever was there.
  console.log(`checks: not fetched (${res?.status ?? "offline"}); keeping data/checks.json`);
  process.exit(0);
}
const rows = await res.json();
await writeFile(new URL("../data/checks.json", import.meta.url), JSON.stringify(rows));
console.log(`checks: ${rows.length}`);
