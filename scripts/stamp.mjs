// Cache-busting without a build step. GitHub Pages caches files for 10 minutes,
// so right after a deploy a browser can mix a new index.html with an old
// i18n.js (showing raw keys like "nav_deal"). This stamps every local
// stylesheet, script and ES-module import with ?v=<stamp> so one deploy is
// always loaded as one consistent set.
//
// Run before committing: node scripts/stamp.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const v = Date.now().toString(36);
const files = ["index.html", ...(await readdir(new URL("src/", root))).filter((f) => f.endsWith(".js")).map((f) => `src/${f}`)];

for (const f of files) {
  const url = new URL(f, root);
  const before = await readFile(url, "utf8");
  const after = before
    // <link href="x.css">, <script src="src/app.js">
    .replace(/((?:href|src)=")((?!https?:|data:|#)[^"?]+\.(?:css|js))(?:\?v=\w+)?"/g, `$1$2?v=${v}"`)
    // import ... from "./x.js"  and  import("./x.js")
    .replace(/((?:from\s+|import\()\s*")(\.\/[^"?]+\.js)(?:\?v=\w+)?"/g, `$1$2?v=${v}"`);
  if (after !== before) await writeFile(url, after);
}
console.log(`stamped ?v=${v}`);
