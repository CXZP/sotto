// Spec extraction from store descriptions.
//
// Rule: every extracted value carries `quote`, a verbatim line of the source
// text, and must survive verify(): the quote is found in the text and the same
// number re-parses out of the quote. Anything that can't be verified is dropped.
// An AI extractor, if ever added, must go through the same verify().

const ENTITIES = { "&nbsp;": " ", "&#160;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&ohm;": "Ω", "&Omega;": "Ω", "&plusmn;": "±", "&ge;": "≥", "&le;": "≤" };

function decode(s) {
  return s
    .replace(/&(?:nbsp|amp|lt|gt|quot|ohm|Omega|plusmn|ge|le|#160|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** HTML → plain lines. Table cells become "label: value" on one line. */
export function textify(html) {
  let s = html ?? "";
  // Some stores double-escape their HTML; decode until tags are real.
  for (let i = 0; i < 2 && /&lt;\/?[a-z]/i.test(s); i++) s = decode(s);
  s = s
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ": ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|tr|div|h\d|ul|ol|table|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = decode(s)
    .replace(/Ω/g, "Ω") // OHM SIGN → GREEK CAPITAL OMEGA, so one regex fits both
    .replace(/[ \t ]+/g, " ");
  const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
  // "Impedance" on one line and "32Ω" on the next: join them.
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (next && LABEL_ONLY.test(cur) && /^[<≤≥~≈]?\s*\d/.test(next)) {
      out.push(`${cur.replace(/[:：]\s*$/, "")}: ${next}`);
      i++;
    } else out.push(cur);
  }
  return out;
}

const LABEL_ONLY = /^(nominal\s+)?(output\s+|input\s+)?(impedance|sensitivity|output power|rated power)\s*[:：]?$/i;

const NUM = "(\\d+(?:\\.\\d+)?)";
const OHM = "\\s*(?:Ω|ohms?\\b)";

const PATTERNS = {
  impedance: new RegExp(`^(?!.*\\b(?:output|input|line)\\b)[^:]*?\\bimpedance\\b[^\\d]{0,24}?[:：]?\\s*[~≈]?\\s*${NUM}${OHM}`, "i"),
  zout: new RegExp(`\\boutput\\s+impedance\\b[^\\d]{0,24}?[:：]?\\s*[<≤]?\\s*${NUM}${OHM}`, "i"),
  sensitivity: new RegExp(
    `\\b(?:sensitivity|SPL)\\b[^\\d]{0,24}?[:：]?\\s*${NUM}\\s*(?:±\\s*\\d+(?:\\.\\d+)?\\s*)?dB(?:\\s*SPL)?\\s*(?:\\/|per|@|\\(|at)?\\s*(?:1\\s*)?(V\\s*rms|Vrms|V\\b|mW)?`,
    "i",
  ),
};

// "240mW @ 32Ω", "240 mW (32Ω", "L+R≥240mW+240mW (32Ω", "@ 32Ω: 240 mW"
const POWER_A = new RegExp(`${NUM}\\s*mW(?:\\s*\\+\\s*\\d+(?:\\.\\d+)?\\s*mW)?\\s*(?:x\\s*2\\s*)?(?:@|at|\\(|into|into a)\\s*${NUM}${OHM}`, "gi");
const POWER_B = new RegExp(`@\\s*${NUM}${OHM}\\s*[:：]\\s*${NUM}\\s*mW`, "gi");

// The unit often trails the number: "102 dB @ 1 kHz, 1mW", "97 dB (1 V)".
// Look a short way ahead, stopping at the next spec label.
function unitNear(line, from) {
  const rest = line.slice(from, from + 32).split(/\b(?:impedance|frequency|response|thd|weight|driver|cable)\b/i)[0];
  if (/\bm\s*W\b|mW/.test(rest)) return "dB/mW";
  if (/\bV\s*rms\b|Vrms|\b1\s*V\b|\/\s*V\b/i.test(rest)) return "dB/V";
  return null;
}

function unitOf(raw) {
  if (!raw) return null;
  return /mW/i.test(raw) ? "dB/mW" : "dB/V";
}

/** Extract { impedance, sensitivity, zout, power } from description HTML. */
export function extractSpecs(html) {
  const lines = textify(html);
  const found = { impedance: [], sensitivity: [], zout: [], power: [] };
  for (const line of lines) {
    if (line.length > 240) continue; // prose, not a spec line
    for (const field of ["impedance", "zout", "sensitivity"]) {
      const m = line.match(PATTERNS[field]);
      if (!m) continue;
      const value = Number(m[1]);
      if (field === "sensitivity") {
        found.sensitivity.push({ value, unit: unitOf(m[2]) ?? unitNear(line, m.index + m[0].length), quote: line });
      } else {
        found[field].push({ value, quote: line });
      }
    }
    for (const m of line.matchAll(POWER_A)) found.power.push({ load: Number(m[2]), mw: Number(m[1]), quote: line });
    for (const m of line.matchAll(POWER_B)) found.power.push({ load: Number(m[1]), mw: Number(m[2]), quote: line });
  }
  return { lines, specs: dedupe(found) };
}

function dedupe(found) {
  const out = {};
  for (const [k, list] of Object.entries(found)) {
    const seen = new Set();
    out[k] = list.filter((e) => {
      const key = JSON.stringify({ ...e, quote: undefined });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return out;
}

/**
 * Independent check for one extracted value against the source lines.
 * Used for regex output and for any future AI output alike.
 */
export function verify(field, entry, lines) {
  if (!entry.quote || !lines.includes(entry.quote)) return { ok: false, why: "quote not found in source" };
  const nums = (entry.quote.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const want = field === "power" ? [entry.mw, entry.load] : [entry.value];
  if (!want.every((n) => nums.includes(n))) return { ok: false, why: "number not in quote" };
  const bounds = {
    impedance: (e) => e.value >= 1 && e.value <= 2000,
    zout: (e) => e.value >= 0 && e.value <= 200,
    sensitivity: (e) => e.value >= 70 && e.value <= 140,
    power: (e) => e.mw > 0 && e.mw <= 50000 && e.load >= 4 && e.load <= 2000,
  };
  if (!bounds[field](entry)) return { ok: false, why: "out of physical range" };
  return { ok: true };
}
