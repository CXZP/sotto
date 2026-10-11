// Parse every site and script file, so a syntax error fails `npm run check`
// (and the deploy) instead of shipping a blank page.
import { readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const dirs = ["src", "scripts", "scripts/lib"];
let bad = 0;
for (const d of dirs) {
  for (const f of await readdir(new URL(`${d}/`, root))) {
    if (!/\.(m?js)$/.test(f)) continue;
    const path = fileURLToPath(new URL(`${d}/${f}`, root));
    try {
      execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
    } catch (e) {
      bad++;
      console.error(String(e.stderr).split("\n").slice(0, 4).join("\n"));
    }
  }
}
if (bad) process.exit(1);
console.log("syntax ok");
