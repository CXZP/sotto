// Reading makers' spec pages into sockets (used by scripts/maker-ports.mjs).

import { textify } from "./specs.js";
import { extractPorts } from "./ports.js";

// ---------------------------------------------------------------------------
// Label/value pairs ("Digital coaxial in" / "RCA port") into sockets.

const JACK = [
  ["xlr4", /\bxlr ?4\b|4[- ]?pin[- ]xlr|xlr 4[- ]pin|4-?pin (?:balanced )?xlr|4-?cores? xlr|neutrik 4/i],
  ["6.35", /6\.35(?! ?v)|6\.3 ?mm|1\/4|¼/i],
  ["4.4", /4\.4(?! ?v)/i],
  ["3.5", /3\.5(?! ?v)/i],
  ["2.5", /2\.5 ?mm/i],
];
// A value that is a level or a figure, not a socket ("Balanced: 6V RMS").
const FIGURE = /\d\s*(?:v\b|vrms|v rms|mw|w\b|db|Ω|ohm|khz|hz|%)/i;
const CONNECTOR = /\b(?:rca|xlr\d?|optical|toslink|coax\w*|usb|type-?[bc]|s\/?pdif|bluetooth|i2s|aes\d?|hdmi|\d\.\d+ ?mm|jack|port|socket|trs|pentaconn|line[- ]?(?:in|out))\b/i;
export const jacksIn = (s) => JACK.filter(([, re]) => re.test(s)).map(([j]) => j);

/** One "label: value" line into {dir, port, conn} sockets or headphone jacks. */
export function readPair(label, value) {
  const L = label.toLowerCase();
  const V = value.toLowerCase();
  const all = `${L} ${V}`;
  const found = { sockets: [], jacks: [] };
  if (/\b(?:knob|button|switch|indicator|light|screen|display|battery|charging time|weight|size|dimension|trigger)\b/.test(L)) return found;
  const dir = /\b(?:in|input|inputs|receiv\w*)\b/.test(L) ? "in" : /\b(?:out|output|outputs|interface)\b/.test(L) ? "out" : null;
  const add = (port, d = dir, conn) => d && found.sockets.push({ dir: d, port, conn });
  // KA13: "4.4mm plug: Balanced output" names the jack in the label.
  if (/^\d\.\d+ ?mm (?:plug|port|jack)/.test(L) && /output/.test(V) && !/line/.test(V)) {
    found.jacks.push(...jacksIn(label));
    if (/s\/?pdif|coax/.test(V)) add("coax", "out", "spdif35");
    return found;
  }
  if (/headphone|phones?\b|headset|\bpo\b|bal(?:anced)? output interface|balanced out(?:put)? interface|\bbal output\b|^balanced headphone|^balanced output ports?$/.test(L) && !/line/.test(L)) {
    found.jacks.push(...jacksIn(value));
    // A shared socket: "3.5mm port (PO/coaxial out shared)".
    if (/coax/.test(V)) add("coax", "out", "spdif35");
    if (/line/.test(V)) add(/4\.4/.test(V) ? "xlr" : "line", "out", /4\.4/.test(V) ? "4.4" : "3.5");
    return found;
  }
  if (FIGURE.test(V) && !CONNECTOR.test(V)) return found;
  if (/optical|toslink/.test(all)) add("optical");
  if (/coax/.test(all)) add("coax");
  if ((/\busb\b|type-?c/.test(L) || (dir === "in" && /\busb\b/.test(V))) && (/data|transfer|transmission|audio|dac/.test(all) || !/power|charg|host|upgrade|otg|usb-?a\b/.test(all))) add("usb", "in", /type-?b|usb-?b\b/.test(V) ? "usbB" : /type-?c|usb-?c/.test(V) ? "usbC" : undefined);
  if (/\bi2s\b|\biis\b/.test(all)) add("i2s");
  if (/\baes(?:3|\/ebu)?\b/.test(all)) add("aes");
  if (/bluetooth/.test(all) && dir === "in") add("bt");
  // One 3.5 hole for optical and coaxial ("S/PDIF (optical/coaxial)").
  if (/s\/?pdif/.test(V) && /optical/.test(V) && /coax/.test(V)) for (const s of found.sockets) if (["optical", "coax"].includes(s.port)) s.conn = "spdif35";
  if ((/line|preamp|pre-out|analog(?:ue)?\b/.test(L) || (dir && /\brca\b|\bxlr\b|balanced|single-ended/.test(V))) && CONNECTOR.test(V) && !/optical|coax|usb|s\/?pdif|\baes/.test(all)) {
    const bal = /balanced|\bbal\b|xlr/.test(all) && !/single|unbal|s-bal/.test(all);
    const conn = /4\.4/.test(V) ? "4.4" : /3\.5/.test(V) ? "3.5" : undefined;
    if (bal) add("xlr", dir, conn);
    else add(conn ? "line" : "rca", dir, conn);
  }
  if (/^power|power supply|dc (?:power )?in/.test(L) && /\bdc\b|\d+ ?v\b/.test(V) && (/\bdc\b/.test(V) || !/battery|usb|type-?c|\bac\b/.test(V))) add("dc", "in");
  return found;
}

export function toEntry(url, pairs) {
  const ports = { in: {}, out: {} };
  const jacks = [];
  for (const [label, value] of pairs) {
    const { sockets, jacks: j } = readPair(label, value);
    const quote = `${label.trim()}: ${value.trim()}`.slice(0, 200);
    for (const s of sockets) ports[s.dir][s.port] ??= { quote, url, ...(s.conn ? { conn: s.conn } : {}) };
    for (const x of j) if (!jacks.includes(x)) jacks.push(x);
  }
  return { url, ports, jacks: jacks.sort((a, b) => ["xlr4", "6.35", "4.4", "3.5", "2.5"].indexOf(a) - ["xlr4", "6.35", "4.4", "3.5", "2.5"].indexOf(b)) };
}
export const count = (e) => Object.keys(e.ports.in).length + Object.keys(e.ports.out).length + e.jacks.length;

// ---------------------------------------------------------------------------
// FiiO: https://www.fiio.com/<MODEL>_parameters, "Buttons and Ports" section.

// The table's rows hold two label/value pairs each; a full-width row starts a new section.
const cellText = (c) => textify(c).join(" ").trim();
export function fiioPairs(html) {
  const pairs = [];
  let inPorts = false;
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((m) => ({ span: /colspan/i.test(m[1]), text: cellText(m[2]) }));
    if (cells.length === 1 || cells[0]?.span) {
      const t = cells[0]?.text ?? "";
      if (/buttons and ports|^ports$|interfaces?/i.test(t)) inPorts = true;
      else if (t) inPorts = false;
      continue;
    }
    if (!inPorts) continue;
    for (let k = 0; k + 1 < cells.length; k += 2) if (cells[k].text && cells[k + 1].text) pairs.push([cells[k].text, cells[k + 1].text]);
  }
  return pairs;
}
// Store names carry extras ("M27 Player Titanium Gold", "K15 *2 Powerful"):
// the full name first, then shorter, never dropping a word that names
// another model ("R2R", "Ultra", "BT", "Mini").
const STEP = /^(?:R2R|ULTRA|PRO|BT|TUBE|MINI|NANO|MAX|PLUS|II|III|S|SE|LE|LITE|A|B|C|AKM|ESS|THX|SABRE)$/;
export function fiioSlugs(model) {
  const words = model.toUpperCase().replace(/\bSNOWSKY\b|\bJADE(?: ?AUDIO)?\b/g, " ").split(/[\s-]+/).map((w) => w.replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  const out = [];
  for (let n = words.length; n > 0; n--) {
    out.push(words.slice(0, n).join(""));
    // Only straight after the model number ("KA5 Ultra", not "KA13 DACs Mini").
    if (n === 2 && STEP.test(words[1])) break;
  }
  return [...new Set(out)];
}

// iFi: <tr class="spec-row"><td><strong>LABEL</strong></td><td>value</td>, values
// split by "Line Section:" / "Headphone Section:" and by ";" or ",".
export function ifiPairs(html) {
  const pairs = [];
  for (const row of html.matchAll(/<tr class="spec-row[^"]*">([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 2) continue;
    const label = cellText(cells[0]).toUpperCase();
    const kind = /POWER SUPPLY/.test(label) ? "Power supply" : /INPUT/.test(label) ? `${/ANALOG/.test(label) ? "Analogue " : /DIGITAL/.test(label) ? "Digital " : ""}input` : /^(?:(?:LINE|HEADPHONE|ANALOG\w*|DIGITAL) )?OUTPUTS?$/.test(label) ? "output" : /OUTPUT IMPEDANCE|OUTPUT VOLTAGE|MAXIMUM OUTPUT POWER|RMS OUTPUT/.test(label) ? "rating" : null;
    if (!kind) continue;
    let sec = /HEADPHONE/.test(label) ? "Headphone" : /LINE|ANALOG/.test(label) ? "Line" : "";
    for (const line of textify(cells[1])) {
      const m = line.match(/^(Line|Headphone) Section:?\s*(.*)$/i);
      if (m) sec = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
      const rest = m ? m[2] : line;
      for (const part of rest.split(/[;,]\s*(?=\d+\s*x|[A-Z])/)) {
        if (!part.trim()) continue;
        // Ratings only say which headphone jacks exist; "No USB audio input" says nothing.
        if (kind === "rating" && !["Headphone", "Line"].includes(sec)) continue;
        if (/^no\b|\bnot\b/i.test(part)) continue;
        // A bare "OUTPUT" row lists levels ("RCA: 3.8V RMS") as often as sockets;
        // on it a jack size is the headphone out.
        if (kind === "output" && !sec) {
          if (/\d\.\d+ ?mm/i.test(part) && !/line/i.test(part)) pairs.push(["Headphone output", part.trim()]);
          else if (!FIGURE.test(part)) pairs.push(["Output", part.trim()]);
          continue;
        }
        const L = kind === "output" || kind === "rating" ? (sec === "Headphone" ? "Headphone output" : sec === "Line" ? "Line output" : "Output") : kind;
        // Power ratings only say which headphone jacks exist.
        if (/MAXIMUM OUTPUT POWER|RMS OUTPUT/.test(label) && sec !== "Headphone") continue;
        pairs.push([L, part.trim()]);
      }
    }
  }
  return pairs;
}

// A manual's "Front panel" / "Rear panel" lists (Topping, as pdftotext gives
// them): "2. 4.4mm balanced headphone output jack", then lines describing it.
// A list runs 1, 2, 3...; any other number or a "2.4" heading ends it.
export function manualPairs(text) {
  const pairs = [];
  let side = null, next = 0, item = null;
  const flush = () => item && pairs.push([item.label, item.lines.join(" ")]) && (item = null);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s{3,}\d+ of \d+\s*$/, "").trim();
    const head = line.match(/^(?:\d+\.\d+\s+)?(front|rear|back) panel\b/i);
    if (head) { flush(); side = head[1].toLowerCase() === "front" ? "Front" : "Rear"; next = 1; continue; }
    if (!side) continue;
    const m = line.match(/^(\d{1,2})\.\s+(\S.*)$/);
    if (m && +m[1] === next) { flush(); item = { label: m[2], lines: [m[2]] }; next++; continue; }
    if (m || /^\d+\.\d+\s+\S/.test(line)) { flush(); side = null; continue; }
    if (item && line && item.lines.length < 4) item.lines.push(line);
  }
  flush();
  return pairs;
}

// Older Topping manuals label a panel drawing with callouts instead of a list:
// "Front panel" on its own line, then indented lines holding several labels
// spaced apart, up to the next unindented heading ("Display").
export function calloutPairs(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let k = 0; k < lines.length; k++) {
    if (!/^ {0,8}(?:front|rear|back) panel\s*$/i.test(lines[k])) continue;
    // A contents page lists "Front panel" then "Rear panel 1 3.Output settings".
    const following = lines.slice(k + 1).find((l) => l.trim()) ?? "";
    if (/^\s*(?:front|rear|back) panel\b|^\s*display\b/i.test(following)) continue;
    const body = [];
    for (let j = k + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim()) continue;
      if (/^\S.{0,40}$/.test(l.trimEnd()) && !/\s{2,}/.test(l.trim())) break;
      body.push(l);
    }
    // A contents page lists "Front panel" then "Rear panel" with nothing between.
    if (body.length < 2) continue;
    for (const l of body) for (const chunk of l.trim().split(/\s{2,}/)) {
      const c = chunk.trim();
      if (c.length < 4 || c.length > 70 || !/[a-z]{3}/i.test(c) || /^(?:see|\*|press|rotate|please)\b/i.test(c)) continue;
      pairs.push([c, c]);
    }
  }
  return pairs;
}

// Schiit: prose specs; the store reader finds "Inputs: ..." lines, jacks from the output lines.
export function schiitEntry(url, html) {
  // Only the spec lines ("Inputs: Coaxial SPDIF, ..."): the prose also talks about other models.
  const specs = textify(html).filter((l) => /^(?:inputs?|outputs?)\s*:/i.test(l) && l.length < 160);
  const ports = extractPorts(specs.join("<br>")) ?? { in: {}, out: {} };
  for (const dir of ["in", "out"]) for (const k of Object.keys(ports[dir])) ports[dir][k] = { quote: ports[dir][k], url };
  const lines = textify(html).filter((l) => /output|headphone|trs|xlr/i.test(l) && /ohm|output:/i.test(l));
  const jacks = [...new Set(lines.flatMap((l) => (/preamp|line/i.test(l) ? [] : jacksIn(l))))];
  return { url, ports, jacks };
}

