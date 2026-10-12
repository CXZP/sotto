// DC power facts from store spec lines: what a device needs (DC input) and
// what a power supply gives (DC outputs). Each value keeps its verbatim line.
// Used only to say "voltage matches / enough current"; plug size and polarity
// are left for the reader to check, because stores rarely state them.

import { textify } from "./specs.js";

const N = String.raw`(\d+(?:\.\d+)?)`;
// "12V/2.5A", "DC 12V 2A", "15 VDC at 2 A", "12V/≥2.5A", "5V ⎓ 1A"
const PAIR = new RegExp(String.raw`${N}\s*V(?:\s*DC)?\b\s*(?:[\/⎓=,:-]|at)?\s*≥?\s*(?:${N}\s*(m?A)\b)?`, "gi");
// "9V to 18V DC", "22-30 V DC", "22-30VDC"
const RANGE = new RegExp(String.raw`${N}\s*V?\s*(?:-|–|~|to)\s*${N}\s*V\s*(?:DC)?`, "i");

const DEVICE_LINE = /\b(power (?:input|supply|requirement|adapter|inlet)s?|input voltage|supply voltage|rated input|dc[- ]?in(?:put)?)\b|^\s*dc\s*\d/i;
const SUPPLY_LINE = /\b(output|dc out)/i;
const NOT_DC = /\b(ac|mains|charg\w*|battery|output power|speaker|usb[- ]?c pd)\b|\bw\b|×|x\s*\d+\s*w/i;

function pairs(text) {
  const out = [];
  for (const m of text.matchAll(PAIR)) {
    const v = Number(m[1]);
    if (!(v >= 3 && v <= 60)) continue; // mains voltages and stray numbers
    const a = m[2] ? Number(m[2]) / (m[3].toLowerCase() === "ma" ? 1000 : 1) : null;
    if (!out.some((p) => p.v === v)) out.push({ v, ...(a ? { a } : {}) });
  }
  return out;
}

const USB_POWER = /\busb\b|type[- ]?c/i;
const BARREL = /\bor\s+dc\b|\bdc\s*(?:jack|inlet|input|socket|in\b)|\bbarrel\b|\b5\.5\s*(?:x|×|\*|\/)\s*2\.[15]|\bexternal power\b|\bpower (?:input|inlet|socket)\b/i;
function powerPlugs(line) {
  if (!USB_POWER.test(line)) return {};
  return BARREL.test(line) ? { usb: true, barrel: true } : { usb: true };
}

/** A DC inlet the maker lists among the sockets ("USB-C or DC 5V/0.5A (centre +ve)"). */
export function dcFromSocket(quote) {
  const p = pairs(quote.replace(/\bac\s*\d+\s*[-–~]\s*\d+\s*v\S*/gi, " "));
  return p.length ? { needs: p, quote, barrel: true, ...(USB_POWER.test(quote) ? { usb: true } : {}) } : null;
}

/** What a device needs. {volts:[...]} or {range:[lo,hi]}, with amps when stated. */
export function dcInput(html) {
  for (const line of textify(html)) {
    if (line.length > 220 || !DEVICE_LINE.test(line) || /\boutput\b/i.test(line)) continue;
    const dcPart = line.replace(/\bac\s*\d+\s*[-–~]\s*\d+\s*v\S*/gi, " ");
    const r = dcPart.match(RANGE);
    if (r && /dc/i.test(line)) {
      const lo = Number(r[1]), hi = Number(r[2]);
      if (lo >= 3 && hi <= 60 && lo < hi) return { range: [lo, hi], quote: line };
    }
    if (NOT_DC.test(dcPart.replace(/\bdc\b.*$/i, "")) && !/\bdc\b/i.test(dcPart)) continue;
    const p = pairs(dcPart);
    // USB-powered boxes take a USB cable, not a barrel-plug supply. "USB-C or DC 5V"
    // (iFi ZEN DAC 3) takes either: the barrel inlet must not be hidden.
    if (p.length) return { needs: p, quote: line, ...powerPlugs(line) };
  }
  return null;
}

/** What a power supply gives: [{v, a?}] per selectable output. */
export function dcOutputs(html) {
  const found = [];
  let quote = null;
  for (const line of textify(html)) {
    if (line.length > 220 || !SUPPLY_LINE.test(line) || /\binput\b/i.test(line)) continue;
    // Adjustable supplies: "Output voltage: 5V–30V adjustable"
    const r = line.match(RANGE);
    if (r && !found.length) {
      const lo = Number(r[1]), hi = Number(r[2]);
      if (lo >= 3 && hi <= 60 && lo < hi) return { range: [lo, hi], quote: line };
    }
    const p = pairs(line.replace(/[+-](?=\d)/g, ""));
    if (!p.length) continue;
    for (const x of p) if (!found.some((f) => f.v === x.v)) found.push(x);
    quote ??= line;
    if (found.some((f) => f.a)) break;
  }
  return found.length ? { outputs: found, quote } : null;
}

export { fits } from "../../src/dcfit.js";
