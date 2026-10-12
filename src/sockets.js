// The sockets a box has, as a person checks them: inputs and outputs with how
// many of each, and the headphone jacks. Shared by the check queue (what the
// person saw), the build (applying a person's fix) and the item page (whether
// what we show now is what was checked). No imports: runs in the browser and Node.

export const CHECK_IN = ["usb", "coax", "optical", "aes", "i2s", "bt", "rca", "xlr", "line", "phono", "dc"];
export const CHECK_OUT = ["usb", "coax", "optical", "aes", "i2s", "bt", "rca", "xlr", "line", "phono", "spk"];
export const CHECK_JACKS = ["6.35", "4.4", "3.5", "2.5", "xlr4"];

function count(v) {
  if (Number.isInteger(v?.n)) return Math.min(8, Math.max(1, v.n));
  const m = String(v?.quote ?? "").match(/^\s*(\d)\s*[x×]\s/i);
  return m ? Number(m[1]) : 1;
}

/** {in:{port:n}, out:{port:n}, jacks:[...], jacksStated} for an item, sorted for comparing. */
export function socketsOf(item) {
  const side = (dir, keys) => {
    const out = {};
    for (const k of keys) if (item?.ports?.[dir]?.[k]) out[k] = count(item.ports[dir][k]);
    return out;
  };
  const ins = side("in", CHECK_IN);
  if (item?.dcIn && !item.dcIn.usb && !ins.dc) ins.dc = 1;
  if (item?.dcIn?.barrel && !ins.dc) ins.dc = 1;
  const jacks = Array.isArray(item?.jacks) ? [...item.jacks] : [...new Set((item?.outputs ?? []).map((o) => o.jack).filter(Boolean))];
  jacks.sort((a, b) => CHECK_JACKS.indexOf(a) - CHECK_JACKS.indexOf(b));
  return { in: ins, out: side("out", CHECK_OUT), jacks, jacksStated: jacks.length > 0 };
}

/** Same sockets? (What was checked is still what we show.) */
export function sameSockets(a, b) {
  const key = (s) => JSON.stringify({ in: Object.entries(s?.in ?? {}).sort(), out: Object.entries(s?.out ?? {}).sort(), jacks: [...(s?.jacks ?? [])].sort() });
  return key(a) === key(b);
}

/**
 * The latest check of an item's sockets, and what it means now:
 * "checked" (still matches), "fixed" (a person gave the right list),
 * "changed" (checked, but our data moved since), or null.
 */
export function checkState(item, checks) {
  const mine = (checks ?? []).filter((c) => c.item_id === item.id && c.field === "sockets").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const last = mine[0];
  if (!last) return null;
  if (last.verdict === "fixed") return { state: "fixed", check: last };
  return { state: sameSockets(last.shown, socketsOf(item)) ? "checked" : "changed", check: last };
}
