// Desk blueprint: boxes on a grid joined by cables, each cable checked port to
// port. Pure functions; the page (app.js) draws and wires them.
//
// Ports come from the same place as the chain check (store spec lines, user
// reports, category facts). A box whose ports nobody has stated gets a "?"
// socket: a cable to it is "unknown", never "wrong".

import { portsOf, DIGITAL, ANALOG } from "./chain.js?v=mv5jpis5";

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
  // "line" is a store saying line level without naming the socket.
  if (line(a) && line(b)) return a === "line" || b === "line" ? { status: "check", why: "dk_line_generic" } : { status: "adapter", why: "dk_line_adapter" };
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

/**
 * Where a box sits in the signal path, top to bottom. `side` boxes (power
 * supplies, cartridges) hang beside the box they serve instead of in a row.
 */
export function stageOf(node) {
  if (node.device) return 0;
  const i = node.item;
  if (i.category === "power" || i.category === "cartridge") return "side";
  if (["dap", "cd", "turntable"].includes(i.category) || i.role === "streamer") return 0;
  if (i.category === "phono") return 1;
  if (["dongle", "portable"].includes(i.category) || ["dac", "dacamp"].includes(i.role)) return 2;
  if (["preamp", "amp", "integrated"].includes(i.role)) return 3;
  if (i.role === "poweramp") return 4;
  if (["iem", "headphone", "wireless", "speaker"].includes(i.category)) return 5;
  return 2;
}

const RANK = { ok: 0, check: 1, adapter: 2, unknown: 3 };

/** Boxes with several inputs that usually all get used: DACs, preamps, amps. */
const HUB_ROLES = new Set(["dac", "dacamp", "preamp", "amp", "integrated"]);
const isHub = (n) => n?.item?.category === "desktop" && HUB_ROLES.has(n.item.role);

/**
 * Cables for box `k` just put on a desk. Its input: the best box upstream (a
 * direct match first, a box not yet feeding anything next, the nearest stage
 * last); a DAC or amp also takes every other upstream box that feeds nothing
 * yet. Its output: the best box downstream that nothing feeds yet (or a DAC or
 * amp). A power supply goes to the first box with a free DC input. Existing
 * cables stay.
 */
export function wireNew(nodes, cables, k) {
  const ports = nodes.map((n) => (n ? nodePorts(n) : { in: [], out: [] }));
  const stage = nodes.map((n) => (n ? stageOf(n) : null));
  const all = [...cables];
  const fed = (j) => all.some((c) => c.to === j);
  const used = (j) => all.some((c) => c.from === j);
  const linked = (a, b) => all.some((c) => c.from === a && c.to === b);
  const best = (a, b) => {
    let top = null;
    for (const o of ports[a].out)
      for (const i of ports[b].in) {
        const s = cableCheck(o, i).status;
        if (s in RANK && (!top || RANK[s] < top.r)) top = { r: RANK[s], from: a, out: o, to: b, in: i };
      }
    return top;
  };
  const add = [];
  const put = (b) => {
    const c = { from: b.from, out: b.out, to: b.to, in: b.in };
    add.push(c);
    all.push(c);
  };
  const inPath = (j) => nodes[j] && j !== k && stage[j] !== "side";
  if (stage[k] === "side") {
    if (!ports[k].out.includes("dc")) return add;
    const j = nodes.findIndex((n, j) => n && j !== k && ports[j].in.includes("dc") && !all.some((c) => c.to === j && c.in === "dc"));
    if (j >= 0) put({ from: k, out: "dc", to: j, in: "dc" });
    return add;
  }
  const upstream = nodes.map((_, j) => j).filter((j) => inPath(j) && stage[j] < stage[k]);
  if (!fed(k)) {
    let pick = null;
    for (const j of upstream) {
      const b = best(j, k);
      if (!b) continue;
      const score = b.r * 10 + (used(j) ? 5 : 0) + (stage[k] - stage[j]);
      if (!pick || score < pick.score) pick = { ...b, score };
    }
    if (pick) put(pick);
  }
  if (isHub(nodes[k]))
    for (const j of upstream) {
      if (used(j)) continue;
      const b = best(j, k);
      if (b && b.r <= RANK.adapter) put(b);
    }
  let down = null;
  nodes.forEach((n, j) => {
    if (!inPath(j) || stage[j] <= stage[k] || linked(k, j) || (fed(j) && !isHub(n))) return;
    const b = best(k, j);
    if (!b || b.r > RANK.adapter) return;
    const score = b.r * 10 + (stage[j] - stage[k]) + (fed(j) ? 3 : 0);
    if (!down || score < down.score) down = { ...b, score };
  });
  if (down && !used(k)) put(down);
  return add;
}

/** Card and gap sizes for the flow layout, in px. */
export const FLOW = { w: 180, h: 172, gx: 40, gy: 92, side: 150 };

/**
 * Signal-flow layout: rows top to bottom by the longest cable path from a
 * source (boxes with no cable go by their stage), each row centred and ordered
 * under its inputs; side boxes sit to the right of the box they serve.
 * Returns {pos: [{x, y, side}], width, height}.
 */
export function flowLayout(nodes, cables) {
  const n = nodes.length;
  const stage = nodes.map((x) => (x ? stageOf(x) : "side"));
  const main = (j) => stage[j] !== "side";
  const links = cables.filter((c) => main(c.from) && main(c.to) && c.from !== c.to);
  const parents = nodes.map((_, j) => links.filter((c) => c.to === j).map((c) => c.from));
  const wired = new Set(links.flatMap((c) => [c.from, c.to]));
  const rank = new Array(n).fill(null);
  const visit = (j, seen) => {
    if (rank[j] != null) return rank[j];
    if (seen.has(j)) return 0; // a loop: stop here
    seen.add(j);
    const ps = parents[j];
    rank[j] = ps.length ? Math.max(...ps.map((p) => visit(p, seen))) + 1 : 0;
    return rank[j];
  };
  for (let j = 0; j < n; j++) if (main(j) && wired.has(j)) visit(j, new Set());
  // Unwired boxes: by stage, among the rows the stages give.
  const stages = [...new Set(stage.filter((s, j) => main(j)))].sort((a, b) => a - b);
  for (let j = 0; j < n; j++) if (main(j) && rank[j] == null) rank[j] = stages.indexOf(stage[j]);
  const rows = [];
  for (let j = 0; j < n; j++) if (main(j)) (rows[rank[j]] ??= []).push(j);
  const order = new Array(n).fill(0);
  const filled = rows.filter(Boolean);
  filled.forEach((row) => {
    const bary = (j) => (parents[j].length ? parents[j].reduce((s, p) => s + order[p], 0) / parents[j].length : wired.has(j) ? -1 : 1e6 + j);
    row.sort((a, b) => bary(a) - bary(b) || a - b);
    row.forEach((j, x) => (order[j] = x));
  });
  // Side boxes: beside the box their cable goes to, or a turntable for a cartridge.
  const host = nodes.map((x, j) => {
    if (main(j)) return null;
    const c = cables.find((c) => c.from === j && main(c.to));
    if (c) return c.to;
    if (x?.item?.category === "cartridge") {
      const tt = nodes.findIndex((y) => y?.item?.category === "turntable");
      if (tt >= 0) return tt;
    }
    return null;
  });
  const sidesOf = (j) => host.map((h, s) => (h === j ? s : -1)).filter((s) => s >= 0);
  const rowWidth = (row) => row.reduce((w, j) => w + FLOW.w + sidesOf(j).length * (FLOW.side + FLOW.gx / 2), 0) + Math.max(0, row.length - 1) * FLOW.gx;
  const loose = nodes.map((_, j) => j).filter((j) => !main(j) && host[j] == null);
  if (loose.length) filled.push(loose);
  const width = Math.max(FLOW.w, ...filled.map((row, r) => (r === filled.length - 1 && loose.length ? row.length * FLOW.w + (row.length - 1) * FLOW.gx : rowWidth(row))));
  const pos = new Array(n).fill(null);
  filled.forEach((row, r) => {
    const y = r * (FLOW.h + FLOW.gy);
    const isLoose = loose.length && r === filled.length - 1;
    let x = (width - (isLoose ? row.length * FLOW.w + (row.length - 1) * FLOW.gx : rowWidth(row))) / 2;
    for (const j of row) {
      pos[j] = { x, y, side: !main(j) };
      x += FLOW.w;
      if (!isLoose)
        for (const s of sidesOf(j)) {
          x += FLOW.gx / 2;
          pos[s] = { x, y: y + (FLOW.h - 110) / 2, side: true, host: j };
          x += FLOW.side;
        }
      x += FLOW.gx;
    }
  });
  return { pos, width, height: filled.length * FLOW.h + Math.max(0, filled.length - 1) * FLOW.gy };
}
