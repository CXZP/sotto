// Back panels: a box's rear drawn the way real gear looks (RCA pairs stacked
// L over R, female XLR in, male XLR out, Toslink, USB-B or USB-C, binding
// posts, DC barrel, IEC inlet), in a chassis whose shape and finish echo the
// brand's house style. No logos or copied artwork: generic shapes only.
//
// panelSpec(node) lays the sockets out and says where each one is, so the page
// can put plugs and cables on them; panelSvg(spec) draws it. Socket labels are
// silkscreen English (as printed on real gear), not translated.

import { nodePorts } from "./desk.js?v=mv5k7yf1";
import { gearSvg } from "./gear.js?v=mv5k7yf1";

/** House styles: shape and finish, by brand (lower case). */
const BRAND_CHASSIS = {
  topping: ["slim", "silver"],
  questyle: ["slim", "silver"],
  yulong: ["slim", "black"],
  smsl: ["compact", "black"],
  fiio: ["compact", "black"],
  xduoo: ["compact", "black"],
  "fosi audio": ["compact", "black"],
  "burson audio": ["compact", "black"],
  ferrum: ["compact", "black"],
  "aune audio": ["compact", "black"],
  "matrix audio": ["compact", "silver"],
  "schiit audio": ["compact", "silver"],
  "pro-ject": ["compact", "black"],
  rega: ["compact", "black"],
  ifi: ["zen", "silver"],
  "chord electronics": ["jewel", "silver"],
  gustard: ["inset", "silver"],
  audalytic: ["inset", "black"],
  denafrips: ["full", "black"],
  violectric: ["full", "black"],
  "cambridge audio": ["full", "grey"],
  nad: ["full", "graphite"],
  arcam: ["full", "black"],
  rotel: ["full", "black"],
  marantz: ["full", "champagne"],
  denon: ["full", "black"],
  mcintosh: ["full", "black"],
  naim: ["full", "black"],
  hegel: ["full", "black"],
  primare: ["full", "black"],
  technics: ["full", "silver"],
  eversolo: ["full", "black"],
  "hifi rose": ["full", "black"],
  bluesound: ["compact", "black"],
  cayin: ["wood", "black"],
  "feliks audio": ["wood", "black"],
  "woo audio": ["wood", "black"],
  "little dot": ["wood", "black"],
  "muse hifi": ["wood", "black"],
};

const FINISH = {
  black: { face: "#1c1d20", edge: "#0d0d0f", ink: "#d9d9d9", frame: "#5a5d63" },
  graphite: { face: "#2a2c30", edge: "#16171a", ink: "#d9d9d9", frame: "#62666d" },
  grey: { face: "#3a3d42", edge: "#232528", ink: "#e4e4e4", frame: "#70747b" },
  silver: { face: "#cfd2d6", edge: "#9fa3a8", ink: "#2b2d30", frame: "#7f8388" },
  champagne: { face: "#d8cdb6", edge: "#a99c80", ink: "#3a3326", frame: "#8a7e66" },
};

/** {style, finish} for a node. */
export function chassisOf(node) {
  if (node.device) return { style: "device", finish: "black" };
  const i = node.item;
  if (i.category === "dongle") return { style: "dongle", finish: "black" };
  if (["portable", "dap", "wireless"].includes(i.category)) return { style: "pocket", finish: "black" };
  if (["iem", "headphone"].includes(i.category)) return { style: "plug", finish: "black" };
  if (i.category === "speaker") return { style: "speaker", finish: "black", active: i.speaker !== "passive" };
  if (i.category === "turntable") return { style: "plinth", finish: "black" };
  const b = BRAND_CHASSIS[String(i.brand ?? "").toLowerCase()];
  if (b) return { style: b[0], finish: b[1] };
  return { style: ["integrated", "poweramp", "streamer"].includes(i.role) || i.category === "cd" ? "full" : "compact", finish: "black" };
}

// Socket cells: width of the slot each kind takes on the panel, and whether
// it's a stereo pair (L over R).
const CELL = { rca: 56, xlr: 124, phono: 72, coax: 62, optical: 64, usb: 46, aes: 66, i2s: 60, bt: 40, dc: 44, spk: 116, hp: 46, line: 56, "?": 70 };
const PAIR = new Set(["rca", "xlr", "phono", "line"]);
const LABEL = {
  in: { usb: "USB IN", optical: "OPTICAL IN", coax: "COAXIAL IN", aes: "AES/EBU", i2s: "I2S IN", bt: "BT", rca: "LINE IN", line: "LINE IN", xlr: "BALANCED IN", phono: "PHONO", dc: "DC IN", spk: "SPEAKER", hp: "", "?": "?" },
  out: { usb: "USB OUT", optical: "OPTICAL OUT", coax: "COAXIAL OUT", aes: "AES OUT", i2s: "I2S OUT", bt: "BT", rca: "LINE OUT", line: "LINE OUT", xlr: "BALANCED OUT", phono: "PHONO OUT", dc: "DC OUT", spk: "SPEAKERS", hp: "PHONES", "?": "?" },
};

/** The plug a headphone ends in: what the store says, else the usual one. */
export function hpPlug(item) {
  const p = item?.stockPlug ?? item?.plug;
  if (["3.5", "4.4", "6.35", "2.5"].includes(p)) return p;
  return item?.category === "headphone" ? "6.35" : "3.5";
}

/**
 * Layout for a node's rear panel: {w, h, chassis, groups, sockets, label}.
 * sockets: [{port, dir, glyph, x, y, pair, jack}] in panel units; (x, y) is
 * where a plug sits (a pair's centre).
 */
export function panelSpec(node) {
  const chassis = chassisOf(node);
  const ports = nodePorts(node);
  const sockets = [];
  const groups = [];
  const i = node.item;
  // Headphones: nothing on a panel, just the plug at the end of the cable.
  if (chassis.style === "plug") {
    const jack = hpPlug(i);
    sockets.push({ port: "hp", dir: "in", glyph: "hpplug", x: 160, y: 96, jack });
    return { w: 220, h: 128, chassis, groups, sockets, kind: i.category };
  }
  // A dongle: a stick with its jacks at one end and its own short cable to a
  // USB-C plug at the other. That plug goes straight into the phone or
  // computer, so its USB "socket" is the end of its own cable.
  if (chassis.style === "dongle") {
    sockets.push({ port: "hp", dir: "out", glyph: "jack", jack: "3.5", x: 40, y: 44, bal: false });
    sockets.push({ port: "hp", dir: "out", glyph: "jack", jack: "4.4", x: 40, y: 98, bal: true });
    // A store that lists a USB-C input means a socket on the body (a cable you
    // can swap, as on the KA17 or Questyle M15); otherwise the cable is built in.
    const detachable = !!i.ports?.in?.usb;
    for (const p of ports.in) sockets.push({ port: p, dir: "in", glyph: p === "usb" ? (detachable ? "usbC" : "tether") : p, x: p === "usb" && detachable ? 184 : 236, y: 68 });
    return { w: 260, h: 140, chassis: { ...chassis, detachable }, groups, sockets };
  }
  const usbKind = ["full", "wood", "plinth", "slim", "inset"].includes(chassis.style) ? "usbB" : "usbC";
  // A screw-on antenna socket on a box; on a phone or pocket device, just the radio.
  const btKind = ["pocket", "device"].includes(chassis.style) ? "bt" : "sma";
  // Order on the panel: digital in, analog in, analog out, digital out, power.
  const order = ["usb", "optical", "coax", "aes", "i2s", "bt", "phono", "rca", "line", "xlr", "spk", "hp", "dc", "?"];
  const cells = [];
  // A store's bare "line" is the RCA (or XLR) socket when those are listed too.
  for (const dir of ["in", "out"])
    for (const p of ports[dir]) if (!(p === "line" && (ports[dir].includes("rca") || ports[dir].includes("xlr")))) cells.push({ port: p, dir, rank: order.indexOf(p) + (dir === "out" ? (["usb", "optical", "coax", "aes", "i2s", "bt", "dc"].includes(p) ? 40 : 15) : 0) });
  cells.sort((a, b) => a.rank - b.rank);
  const pad = 22;
  const top = chassis.style === "pocket" || chassis.style === "device" ? 16 : 24;
  const cellH = 96;
  let x = pad + (chassis.style === "wood" ? 30 : chassis.style === "inset" ? 14 : 0);
  // Headphone outs are on the front: kept in their own dashed frame on the left.
  const hp = cells.filter((c) => c.port === "hp");
  const rest = cells.filter((c) => c.port !== "hp");
  const jacks = hp.length ? (["pocket"].includes(chassis.style) ? ["3.5", "4.4"] : i?.category === "desktop" ? ["6.35", "4.4"] : ["3.5"]) : [];
  // Small boxes put an RCA pair side by side (R, L); bigger ones stack it (L over R).
  const horiz = ["compact", "zen", "pocket", "jewel"].includes(chassis.style);
  const place = (c, label, dashed, extra = {}) => {
    const w = (horiz && ["rca", "line", "phono"].includes(c.port) ? 30 : 0) + (CELL[c.port] ?? 56);
    groups.push({ x, y: top, w, h: cellH, label, dashed, bal: ["xlr", "aes"].includes(c.port) ? true : ["rca", "line", "phono"].includes(c.port) ? false : null });
    const glyph = c.port === "usb" ? usbKind : c.port === "bt" ? btKind : c.port === "xlr" ? (c.dir === "in" ? "xlrF" : "xlrM") : c.port === "line" ? "rca" : c.port;
    sockets.push({ port: c.port, dir: c.dir, glyph, x: x + w / 2, y: top + 42, pair: PAIR.has(c.port), horiz: horiz && ["rca", "line", "phono"].includes(c.port), ...extra });
    x += w + 8;
  };
  if (hp.length) {
    const w = 40 * jacks.length + 12;
    groups.push({ x, y: top, w, h: cellH, label: "PHONES", dashed: true, front: true });
    jacks.forEach((j, k) => sockets.push({ port: "hp", dir: "out", glyph: "jack", jack: j, x: x + 26 + k * 40, y: top + 42, alt: k > 0 }));
    x += w + 8;
  }
  // Sockets nobody has listed: one dashed frame, an IN and an OUT side.
  const unknown = rest.filter((c) => c.port === "?");
  for (const c of rest) if (c.port !== "?") place(c, LABEL[c.dir][c.port] ?? c.port.toUpperCase(), false);
  if (unknown.length) {
    const w = 52 * unknown.length + 12;
    groups.push({ x, y: top, w, h: cellH, label: "NOT LISTED", dashed: true });
    unknown.forEach((c, k) => sockets.push({ port: "?", dir: c.dir, glyph: "?", x: x + 32 + k * 52, y: top + 42, tag: c.dir.toUpperCase() }));
    x += w + 8;
  }
  // Mains inlet on boxes that plug into the wall (not a DC-only box or a pocket one).
  const mains = (["full", "wood", "slim", "compact", "jewel", "zen", "plinth", "inset"].includes(chassis.style) || chassis.active) && !ports.in.includes("dc");
  // A power supply always takes mains: that is its job.
  if (mains && (["full", "wood", "slim", "inset"].includes(chassis.style) || i?.category === "power" || chassis.active)) {
    groups.push({ x, y: top, w: 74, h: cellH, label: "AC IN", deco: "iec" });
    x += 82;
  }
  const w = Math.max(x + pad - 8 + (chassis.style === "wood" ? 30 : 0), ["full", "inset"].includes(chassis.style) ? 560 : chassis.style === "pocket" ? 200 : 260);
  // Centre the row inside a wider chassis.
  const shift = (w - (x + pad - 8 + (chassis.style === "wood" ? 30 : 0))) / 2;
  if (shift > 0) {
    for (const g of groups) g.x += shift;
    for (const s of sockets) s.x += shift;
  }
  // An active speaker: room above the inputs for the amp plate's fins.
  const lift = chassis.active ? 52 : 0;
  for (const g of groups) g.y += lift;
  for (const s of sockets) s.y += lift;
  return { w, h: cellH + top * 2 + lift + (chassis.style === "pocket" ? 0 : chassis.style === "inset" ? 20 : 6), chassis, groups, sockets };
}

// ---------------------------------------------------------------------------
// Drawing

const GOLD = "#d8b55a";
// Balanced / unbalanced marks, coloured the way cable guides do.
const BAL = "#5fd3a0";
const UNBAL = "#f2786d";
const ring = (r, fill, stroke = "#00000055", sw = 1) => `<circle r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

/** One socket glyph centred on (0, 0). */
export function socketGlyph(s, ink) {
  switch (s.glyph) {
    case "rca":
    case "phono": {
      const one = (c) => `${ring(15, GOLD)}${ring(10, "#111")}${ring(6, c, "none")}${ring(2.2, "#000", "none")}`;
      if (s.horiz) return `<g transform="translate(-21,0)">${one("#d33")}</g><g transform="translate(21,0)">${one("#f2f2f2")}</g><text x="-21" y="28" font-size="8" text-anchor="middle" fill="${ink}">R</text><text x="21" y="28" font-size="8" text-anchor="middle" fill="${ink}">L</text>${s.glyph === "phono" ? `<g transform="translate(0,-24)">${ring(5, "#bbb")}${ring(2, "#555", "none")}</g>` : ""}`;
      return `<g transform="translate(0,-20)">${one("#f2f2f2")}</g><g transform="translate(0,22)">${one("#d33")}</g><text x="-22" y="-16" font-size="8" fill="${ink}">L</text><text x="-22" y="26" font-size="8" fill="${ink}">R</text>${s.glyph === "phono" ? `<g transform="translate(24,0)">${ring(5, "#bbb")}${ring(2, "#555", "none")}</g>` : ""}`;
    }
    case "coax":
      return `${ring(15, GOLD)}${ring(10, "#111")}${ring(6, "#f1c232", "none")}${ring(2.2, "#000", "none")}`;
    case "optical":
      return `<rect x="-15" y="-14" width="30" height="28" rx="4" fill="#111" stroke="#00000066"/><path d="M-8 -6h16v6a8 8 0 0 1-16 0z" fill="#2a2a2a" stroke="#555"/><circle cy="1" r="3" fill="#000"/>`;
    case "usbC":
      return `<rect x="-11" y="-5" width="22" height="10" rx="5" fill="#111" stroke="#888"/><rect x="-6" y="-1.5" width="12" height="3" rx="1.5" fill="#666"/>`;
    case "usbB":
      return `<path d="M-10 -6l4 -4h12l4 4v16h-20z" fill="#111" stroke="#888"/><rect x="-6" y="-4" width="12" height="9" fill="#e9e9e9"/>`;
    case "aes":
    case "xlrF":
    case "xlrM": {
      const one = (male) =>
        `${ring(24, "#2a2a2c", "#8a8d92", 3)}${ring(20, "#141416", "none")}${[
          [-7, -4],
          [7, -4],
          [0, 7],
        ]
          .map(([a, b]) => (male ? `<circle cx="${a}" cy="${b}" r="2.6" fill="${GOLD}"/>` : `<circle cx="${a}" cy="${b}" r="3" fill="#000" stroke="#555"/>`))
          .join("")}<rect x="-3" y="${male ? 18 : -24}" width="6" height="5" rx="1" fill="${male ? GOLD : "#8a8d92"}"/>`;
      if (s.glyph === "aes") return one(false);
      const male = s.glyph === "xlrM";
      return `<g transform="translate(-30,0)">${one(male)}</g><g transform="translate(30,0)">${one(male)}</g><text x="-30" y="38" font-size="8" text-anchor="middle" fill="${ink}">R</text><text x="30" y="38" font-size="8" text-anchor="middle" fill="${ink}">L</text>`;
    }
    case "i2s":
      return `<path d="M-18 -7h36v7l-5 6h-26l-5-6z" fill="#f4f4f4" stroke="#888"/><path d="M-14 -4h28v4l-3 4h-22l-3-4z" fill="#111"/><path d="M-11 -1h22" stroke="#d8b55a" stroke-width="1.5" stroke-dasharray="1.2 1.2"/><text y="20" font-size="7" text-anchor="middle" fill="${ink}">HDMI</text>`;
    case "sma":
      return `<path d="M-9 -5l4.5-8h9l4.5 8-4.5 8h-9z" fill="${GOLD}" stroke="#00000066"/>${ring(4, "#b8932f", "none")}${ring(1.5, "#000", "none")}`;
    case "bt":
      return `<rect x="-4" y="-30" width="8" height="40" rx="4" fill="#111" stroke="#444"/><rect x="-7" y="6" width="14" height="10" rx="2" fill="#2a2a2a"/>`;
    case "dc":
      return `${ring(11, "#1a1a1a", "#888", 2)}${ring(5, "#000", "none")}${ring(1.6, GOLD, "none")}`;
    case "spk": {
      const post = (c) => `${ring(11, c, "#00000088")}${ring(5, "#00000055", "none")}${ring(2.5, GOLD, "none")}`;
      return [
        [-40, -14, "#c22"],
        [-40, 18, "#111"],
        [40, -14, "#c22"],
        [40, 18, "#111"],
      ]
        .map(([a, b, c]) => `<g transform="translate(${a},${b})">${post(c)}</g>`)
        .join("") + `<text x="-40" y="40" font-size="8" text-anchor="middle" fill="${ink}">R</text><text x="40" y="40" font-size="8" text-anchor="middle" fill="${ink}">L</text>`;
    }
    case "jack": {
      const r = { "2.5": 4, "3.5": 6, "4.4": 7.5, "6.35": 11 }[s.jack] ?? 6;
      // A 6.35 socket sits in a hex nut; the dot says balanced (4.4) or not.
      const hex = (n) => `<polygon points="${Array.from({ length: 6 }, (_, k) => `${(n * Math.cos((Math.PI / 3) * k)).toFixed(1)},${(n * Math.sin((Math.PI / 3) * k)).toFixed(1)}`).join(" ")}" fill="#a3a6ab" stroke="#00000066"/>`;
      return `${s.jack === "6.35" ? hex(r + 7) : ""}${ring(r + 4, "#8a8d92", "#00000066")}${ring(r, "#0b0b0b", "none")}${ring(r - 2.5, "#1d1d1d", "none")}<text y="${r + 20}" font-size="8" text-anchor="middle" fill="${ink}">${s.jack}</text><circle cy="${-r - 13}" r="2.6" fill="${s.jack === "4.4" ? BAL : UNBAL}"/>`;
    }
    case "hpplug":
    case "tether":
      return "";
    case "?":
      return `<circle r="15" fill="none" stroke="${ink}" stroke-dasharray="3 3" opacity=".7"/><text y="7" font-size="18" font-weight="700" text-anchor="middle" fill="${ink}">?</text>${s.tag ? `<text y="32" font-size="8" text-anchor="middle" fill="${ink}">${s.tag}</text>` : ""}`;
    default:
      return ring(10, "#222");
  }
}

/** A plug head for a socket kind, drawn over the socket at (0, 0). */
export function plugGlyph(glyph, jack, horiz = false) {
  switch (glyph) {
    case "rca":
    case "phono": {
      const one = (c) => `${ring(18, "#2b2b2e", "#000", 1.5)}${ring(13, "#c9a24a", "none")}${ring(9, c, "none")}`;
      if (horiz) return `<g transform="translate(-21,0)">${one("#c62828")}</g><g transform="translate(21,0)">${one("#e9e9e9")}</g><rect x="-4" y="-3" width="8" height="6" fill="#2b2b2e"/>`;
      return `<g transform="translate(0,-20)">${one("#e9e9e9")}</g><g transform="translate(0,22)">${one("#c62828")}</g><rect x="-3" y="-4" width="6" height="8" fill="#2b2b2e"/>`;
    }
    case "coax":
      return `${ring(18, "#2b2b2e", "#000", 1.5)}${ring(13, "#c9a24a", "none")}${ring(9, "#f1c232", "none")}`;
    case "optical":
      return `<rect x="-17" y="-16" width="34" height="32" rx="6" fill="#26272a" stroke="#000"/><rect x="-9" y="-8" width="18" height="16" rx="3" fill="#3a3b3f"/>`;
    case "usbC":
    case "usbB":
      return `<rect x="-16" y="-11" width="32" height="22" rx="6" fill="#2f3033" stroke="#000"/><rect x="-10" y="-4" width="20" height="8" rx="3" fill="#4a4b50"/>`;
    case "aes":
    case "xlrF":
    case "xlrM": {
      const one = `${ring(27, "#202022", "#000", 1.5)}${ring(23, "#a7aab0", "none")}${ring(19, "#202022", "none")}<rect x="-4" y="-26" width="8" height="6" rx="2" fill="#a7aab0"/>`;
      return glyph === "aes" ? one : `<g transform="translate(-30,0)">${one}</g><g transform="translate(30,0)">${one}</g>`;
    }
    case "i2s":
      return `<rect x="-22" y="-12" width="44" height="24" rx="5" fill="#2f3033" stroke="#000"/>`;
    case "dc":
      return `${ring(13, "#2b2b2e", "#000", 1.5)}${ring(7, "#4a4b50", "none")}`;
    case "spk": {
      const ban = (c) => `${ring(12, c, "#000", 1.5)}${ring(5, "#c9a24a", "none")}`;
      return [
        [-40, -14, "#c62828"],
        [-40, 18, "#222"],
        [40, -14, "#c62828"],
        [40, 18, "#222"],
      ]
        .map(([a, b, c]) => `<g transform="translate(${a},${b})">${ban(c)}</g>`)
        .join("");
    }
    case "jack":
    case "hpplug": {
      const r = { "2.5": 7, "3.5": 9, "4.4": 11, "6.35": 15 }[jack] ?? 9;
      return `${ring(r + 4, "#2b2b2e", "#000", 1.5)}${ring(r, "#c9a24a", "none")}${ring(r - 4, "#2b2b2e", "none")}`;
    }
    default:
      return ring(14, "#2b2b2e", "#000", 1.5);
  }
}

/** The whole panel as an SVG fragment (no outer <svg>), at (0, 0). */
export function panelSvg(spec, name = "") {
  const { w, h, chassis } = spec;
  const f = FINISH[chassis.finish] ?? FINISH.black;
  const ink = f.ink;
  const body = (() => {
    switch (chassis.style) {
      case "slim":
        return `<rect x="0" y="4" width="${w}" height="${h - 14}" rx="10" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/>${[0.13, 0.87].map((k) => `<path d="M${w * k - 16} ${h - 10} a16 9 0 0 0 32 0z" fill="#ededed" stroke="#b9bcc0"/>`).join("")}`;
      case "zen":
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2.4}" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/>`;
      case "jewel":
        return `<rect x="0" y="4" width="${w}" height="${h - 8}" rx="14" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/><circle cx="${w - 20}" cy="20" r="6" fill="#7fb3ff" opacity=".7"/>`;
      case "wood":
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/><rect x="0" y="0" width="26" height="${h}" rx="6" fill="url(#wood)"/><rect x="${w - 26}" y="0" width="26" height="${h}" rx="6" fill="url(#wood)"/>`;
      case "pocket":
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/>`;
      case "plinth":
        return `<rect x="0" y="8" width="${w}" height="${h - 16}" rx="4" fill="#1a1a1a" stroke="#000" stroke-width="2"/>${[0.1, 0.9].map((k) => `<rect x="${w * k - 14}" y="${h - 10}" width="28" height="10" rx="4" fill="#111"/>`).join("")}`;
      case "speaker":
        // An active speaker: an amp plate with cooling fins above its inputs.
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="url(#wood)" stroke="#3b2414" stroke-width="2"/><rect x="12" y="8" width="${w - 24}" height="${h - 16}" rx="8" fill="#1b1c1f"/>${chassis.active ? Array.from({ length: Math.floor((w - 40) / 10) }, (_, k) => `<rect x="${22 + k * 10}" y="14" width="5" height="40" rx="2" fill="#2c2e33"/>`).join("") : ""}`;
      case "device":
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="16" fill="#202124" stroke="#0b0b0c" stroke-width="2"/>`;
      case "dongle":
        return `<rect x="22" y="18" width="${chassis.detachable ? 176 : 150}" height="104" rx="16" fill="#26272b" stroke="#0b0b0c" stroke-width="2"/><rect x="22" y="18" width="34" height="104" rx="12" fill="#8f9399"/>${chassis.detachable ? "" : `<rect x="172" y="58" width="22" height="20" rx="6" fill="#1b1c1f"/><path d="M194 68 C210 68 220 68 236 68" stroke="#3a3b3f" stroke-width="7" fill="none" stroke-linecap="round"/>`}<circle cx="150" cy="40" r="2.5" fill="#3fd07a"/>`;
      case "plug":
        return gearSvg(spec.kind === "iem" ? "iem" : "headphone", "#9aa0a6").replace("<svg ", `<svg x="10" y="4" width="120" height="120" `) + `<path d="M110 92 C130 92 140 96 160 96" stroke="#3a3b3f" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      case "inset": {
        const screw = (a, b) => `<g transform="translate(${a},${b})">${ring(5, "#9a9da3", "#00000088")}<path d="M-3 0h6M0 -3v6" stroke="#444" stroke-width="1.2"/></g>`;
        return `<rect x="0" y="0" width="${w}" height="${h - 10}" rx="6" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/><rect x="10" y="8" width="${w - 20}" height="${h - 26}" rx="4" fill="#23262d" stroke="#0005"/>${screw(22, 20)}${screw(w - 22, 20)}${screw(22, h - 30)}${screw(w - 22, h - 30)}${[0.18, 0.82].map((k) => `<ellipse cx="${w * k}" cy="${h - 6}" rx="34" ry="6" fill="#c9ccd1" stroke="#8d9096"/>`).join("")}`;
      }
      case "full":
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="5" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/>${[0.08, 0.92].map((k) => `<rect x="${w * k - 18}" y="${h - 4}" width="36" height="6" rx="2" fill="#0a0a0a"/>`).join("")}`;
      default:
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="${f.face}" stroke="${f.edge}" stroke-width="2"/>${[0.15, 0.85].map((k) => `<rect x="${w * k - 20}" y="${h - 6}" width="40" height="8" rx="2" fill="#0e0e10"/>`).join("")}`;
    }
  })();
  const groups = spec.groups
    .map(
      (g) =>
        `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="6" fill="none" stroke="${f.frame}" stroke-width="1" ${g.dashed ? 'stroke-dasharray="4 4"' : ""}/>` +
        (g.deco === "iec"
          ? `<g transform="translate(${g.x + g.w / 2},${g.y + 42})"><rect x="-22" y="-26" width="44" height="22" rx="3" fill="#111"/><rect x="-8" y="-22" width="16" height="14" rx="2" fill="#2a2a2a" stroke="#555"/><path d="M-22 4h44l-6 22h-32z" fill="#111" stroke="#555"/><rect x="-14" y="10" width="4" height="9" fill="#ccc"/><rect x="10" y="10" width="4" height="9" fill="#ccc"/><rect x="-2" y="16" width="4" height="8" fill="#ccc"/></g>`
          : "") +
        (g.bal == null ? "" : `<circle cx="${g.x + g.w / 2}" cy="${g.y + 8}" r="3" fill="${g.bal ? BAL : UNBAL}"><title>${g.bal ? "balanced" : "unbalanced"}</title></circle>`) +
        `<text x="${g.x + g.w / 2}" y="${g.y + g.h - 7}" font-size="8.5" letter-spacing=".04em" text-anchor="middle" fill="${ink}">${g.label}</text>`,
    )
    .join("");
  const sockets = spec.sockets.map((s) => `<g class="pn-sock" data-port="${s.port}" data-dir="${s.dir}"${s.jack ? ` data-jack="${s.jack}"` : ""} transform="translate(${s.x},${s.y})">${socketGlyph(s, ink)}</g>`).join("");
  const title = name ? `<text x="${chassisInset(spec)}" y="${spec.chassis.style === "inset" ? 22 : 15}" font-size="9" font-weight="600" fill="${ink}" opacity=".75">${escXml(name)}</text>` : "";
  return `${body}${groups}${sockets}${spec.chassis.style === "plug" ? "" : title}`;
}
function chassisInset(spec) {
  return spec.chassis.style === "wood" ? 36 : ["slim", "zen", "inset"].includes(spec.chassis.style) ? 34 : 12;
}
function escXml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/** Gradients the panels use; put once inside the outer <svg>. */
export const PANEL_DEFS = `<defs><linearGradient id="wood" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#7a4426"/><stop offset=".5" stop-color="#5b3019"/><stop offset="1" stop-color="#83502d"/></linearGradient></defs>`;
