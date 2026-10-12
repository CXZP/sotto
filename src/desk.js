// Desk blueprint: boxes on a grid joined by cables, each cable checked port to
// port. Pure functions; the page (app.js) draws and wires them.
//
// Ports come from the same place as the chain check (store spec lines, user
// reports, category facts). A box whose ports nobody has stated gets a "?"
// socket: a cable to it is "unknown", never "wrong".

import { portsOf, DIGITAL, ANALOG } from "./chain.js?v=mv5d3qx9";

/** Things on a desk that aren't catalog items. */
export const DESK_DEVICES = {
  phone: { out: ["usb", "bt"] },
  computer: { out: ["usb", "optical"] },
  tv: { out: ["optical"] },
};

const HP_SOURCES = new Set(["dongle", "portable", "dap"]);
const SPEAKER_ROLES = new Set(["integrated", "poweramp"]);

/** {in: [...], out: [...]} sockets for a node: {device} or {item}. */
export function nodePorts(node) {
  if (node.device) return { in: [], out: [...(DESK_DEVICES[node.device]?.out ?? [])] };
  const i = node.item;
  const p = portsOf({ item: i }, node.reports ?? null);
  const ins = [...p.in];
  const outs = [...p.out];
  // Headphone sockets: what drives headphones, and the headphones themselves.
  if (["iem", "headphone"].includes(i.category)) ins.push("hp");
  if (i.category === "wireless") ins.push("bt");
  const drives = HP_SOURCES.has(i.category) || (i.category === "desktop" && ["dacamp", "amp"].includes(i.role));
  if (drives) outs.push("hp");
  if (i.category === "desktop" && SPEAKER_ROLES.has(i.role)) outs.push("spk");
  if (i.category === "speaker") ins.push(i.speaker === "passive" ? "spk" : "rca");
  // DC power: a supply's output, and boxes that state a DC input.
  if (i.category === "power") outs.push("dc");
  if (i.dcIn) ins.push("dc");
  if (["dongle", "dap"].includes(i.category) && /bluetooth|btr\d|ldac|aptx/i.test(i.offers?.map((o) => o.title).join(" ") ?? "")) ins.push("bt");
  // Nobody has said: one socket that takes anything, checked as "unknown".
  if (!ins.length && !["turntable", "cd", "dap", "power"].includes(i.category)) ins.push("?");
  if (!outs.length && !["iem", "headphone", "wireless", "speaker"].includes(i.category)) outs.push("?");
  return { in: [...new Set(ins)], out: [...new Set(outs)] };
}

/**
 * Whether a cable from socket `a` (an output) to socket `b` (an input) works.
 * status: ok | check | adapter | unknown | no; `why` is a message key.
 */
export function cableCheck(a, b) {
  if (a === "?" || b === "?") return { status: "unknown", why: "dk_unknown" };
  if (a === b) return a === "i2s" ? { status: "check", why: "dk_i2s" } : a === "dc" ? { status: "check", why: "dk_dc" } : { status: "ok", why: "dk_ok" };
  if (a === "dc" || b === "dc") return { status: "no", why: "dk_dc_only" };
  if (a === "phono") return { status: "no", why: "dk_phono" };
  const line = (x) => ["rca", "xlr", "line"].includes(x);
  if (line(a) && line(b)) return { status: "adapter", why: "dk_line_adapter" };
  if (a === "hp" && line(b)) return { status: "check", why: "dk_hp_line" };
  if (a === "spk" || b === "spk") return { status: "no", why: "dk_spk" };
  if (DIGITAL.includes(a) && (ANALOG.includes(b) || b === "hp")) return { status: "no", why: "dk_need_dac" };
  if ((ANALOG.includes(a) || a === "hp") && DIGITAL.includes(b)) return { status: "no", why: "dk_analog_digital" };
  return { status: "no", why: "dk_mismatch" };
}

/** Desk state <-> a short string for links: nodes [[ref, x, y]], cables [[from, port, to, port]]. */
export function encodeDesk(desk) {
  const json = JSON.stringify({ n: desk.nodes.map((n) => [n.ref, Math.round(n.x), Math.round(n.y)]), c: desk.cables.map((c) => [c.from, c.out, c.to, c.in]) });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeDesk(str) {
  try {
    const json = decodeURIComponent(escape(atob(String(str).replace(/-/g, "+").replace(/_/g, "/"))));
    const d = JSON.parse(json);
    return {
      nodes: (d.n ?? []).filter((n) => Array.isArray(n) && typeof n[0] === "string").map(([ref, x, y]) => ({ ref, x: Number(x) || 0, y: Number(y) || 0 })),
      cables: (d.c ?? []).filter((c) => Array.isArray(c) && c.length === 4).map(([from, out, to, inp]) => ({ from: Number(from), out: String(out), to: Number(to), in: String(inp) })),
    };
  } catch {
    return { nodes: [], cables: [] };
  }
}

/**
 * Cables for boxes laid out in chain order (source → … → headphones): between
 * each pair, the sockets that work best (a direct match before an adapter).
 */
export function autoCables(nodes) {
  const rank = { ok: 0, check: 1, adapter: 2, unknown: 3 };
  const cables = [];
  for (let k = 0; k + 1 < nodes.length; k++) {
    const a = nodePorts(nodes[k]).out;
    const b = nodePorts(nodes[k + 1]).in;
    let best = null;
    for (const o of a)
      for (const i of b) {
        const s = cableCheck(o, i).status;
        if (s in rank && (!best || rank[s] < best.r)) best = { r: rank[s], out: o, in: i };
      }
    if (best) cables.push({ from: k, out: best.out, to: k + 1, in: best.in });
  }
  return cables;
}
