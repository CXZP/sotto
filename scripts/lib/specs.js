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
  // Not a line/RCA/pre output: that feeds an amp, not headphones.
  zout: new RegExp(`^(?!.*\\b(?:line|rca|pre-?outs?|pre-?amp\\w*)\\b[^:]*:?[^:]*output\\s+impedance)(?!.*\\b(?:line|rca)\\s+output\\s+impedance).*?\\boutput\\s+impedance\\b[^\\d]{0,24}?[:：]?\\s*[<≤]?\\s*${NUM}${OHM}`, "i"),
  sensitivity: new RegExp(
    // "Maximum SPL: >130 dB" is how loud it can go, not its sensitivity.
    `\\b(?:sensitivity|(?<!\\bmax(?:imum)?\\.?\\s{0,3})SPL)\\b[^\\d]{0,24}?[:：]?\\s*${NUM}\\s*(?:±\\s*\\d+(?:\\.\\d+)?\\s*)?dB(?:\\s*SPL)?\\s*(?:\\/|per|@|\\(|at)?\\s*(?:1\\s*)?(V\\s*rms|Vrms|V\\b|mW)?`,
    "i",
  ),
};

// Number first: "34 ohm impedance at 1kHz", "113dB sensitivity at 1kHz" (Audio46).
const IMP_FIRST = new RegExp(`^[^:]{0,20}?\\b${NUM}${OHM}\\s+(?:nominal\\s+)?impedance\\b`, "i");
const SENS_FIRST = new RegExp(`^[^:]{0,20}?\\b${NUM}\\s*dB(?:\\s*SPL)?(?:\\s*\\/\\s*(V\\s*rms|Vrms|V\\b|mW))?\\s+sensitivity\\b`, "i");

// Long paragraphs: specs are often written into a sentence ("a low impedance
// of just 7.7Ω and a high sensitivity of 119dB/Vrms"). Each sentence is
// checked on its own and becomes the quote.
// In prose only plain statements count: "impedance of 18 Ohm", "impedance is
// 14 Ohms", "sensitivity rated at 112dB". Not "low-impedance ones (32 ohm)",
// which is about the headphones an amp can drive.
const LINK = "(?:\\s+(?:rating|rated|is|of|at|just|only|about|around|approximately|nominal|increased|reduced|to|a|an|high|low))*\\s*[:(]?\\s*";
const PROSE = {
  impedance: new RegExp(`(?<![-\\w])(?<!(?:output|input|line)\\s)impedance${LINK}${NUM}${OHM}`, "i"),
  zout: new RegExp(`\\boutput\\s+impedance${LINK}[<≤]?\\s*${NUM}${OHM}`, "i"),
  sensitivity: new RegExp(`(?<![-\\w])sensitivity${LINK}${NUM}\\s*dB(?:\\s*SPL)?\\s*(?:\\/|per|@|\\(|at)?\\s*(?:1\\s*)?(V\\s*rms|Vrms|V\\b|mW)?`, "i"),
};

function sentences(line) {
  return line.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((x) => x.length <= 240);
}

// "240mW @ 32Ω", "240 mW (32Ω", "L+R≥240mW+240mW (32Ω", "@ 32Ω: 240 mW"
// "1,513mW (@ 32Ω)": thousands commas and "(@" are common too.
const POWER_A = new RegExp(`(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*mW(?:\\s*\\+\\s*\\d+(?:\\.\\d+)?\\s*mW)?\\s*(?:x\\s*2\\s*)?(?:\\(\\s*@|@|at|\\(|into|into a)\\s*${NUM}${OHM}`, "gi");
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
    if (line.length > 240) {
      // Prose: label-first patterns only, one sentence at a time.
      for (const sent of sentences(line))
        for (const field of ["impedance", "zout", "sensitivity"]) {
          const m = sent.match(PROSE[field]);
          if (!m) continue;
          const value = Number(m[1]);
          if (field === "sensitivity") found.sensitivity.push({ value, unit: unitOf(m[2]) ?? unitNear(sent, m.index + m[0].length), quote: sent });
          else found[field].push({ value, quote: sent });
        }
      continue;
    }
    const imp = line.match(IMP_FIRST);
    if (imp) found.impedance.push({ value: Number(imp[1]), quote: line });
    const sens = line.match(SENS_FIRST);
    if (sens) found.sensitivity.push({ value: Number(sens[1]), unit: unitOf(sens[2]) ?? unitNear(line, sens.index + sens[0].length), quote: line });
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
    for (const m of line.matchAll(POWER_A)) found.power.push({ load: Number(m[2]), mw: Number(m[1].replace(/,/g, "")), quote: line });
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
  // The quote is a whole line, or one sentence of a paragraph.
  if (!entry.quote || !lines.some((l) => l === entry.quote || (entry.quote.length >= 20 && l.includes(entry.quote)))) return { ok: false, why: "quote not found in source" };
  const nums = (entry.quote.replace(/(\d),(?=\d{3}(?!\d))/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
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

// The rest of a spec sheet: "Frequency Response: 20Hz-40kHz", "DAC Chip: CS43198".
// Only labelled lines count, the value is what follows the label, and the
// first label match wins. Values are short facts; prose lines are skipped.
export const SHEET = [
  ["freq", /^(?:frequency\s*(?:response|range)|FR)\b/i],
  ["driver", /^(?:drivers?(?:\s*(?:units?|configuration|config|type|size))?|drive\s*units?|transducers?)\b/i],
  ["thd", /^(?:THD(?:\s*\+\s*N)?|total\s+harmonic\s+distortion)\b/i],
  ["snr", /^(?:SNR|S\/N|signal[\s-]to[\s-]noise(?:\s*ratio)?)\b/i],
  ["dr", /^dynamic\s+range\b/i],
  ["crosstalk", /^(?:crosstalk|channel\s+separation|separation)\b/i],
  ["weight", /^(?:net\s+)?weight\b/i],
  ["cable", /^cable(?:\s*(?:length|material|type))?\s*$/i],
  ["connector", /^(?:(?:cable\s+)?connectors?|pin\s*type|connection\s+type|earphone\s+interface)\b/i],
  ["plug", /^(?:plugs?|termination|jack|headphone\s+(?:outputs?|jacks?))\b/i],
  ["dac", /^(?:DAC(?:\s*chips?)?|decod(?:ing|er)\s*chips?|chipset)\b/i],
  ["ampchip", /^(?:amp(?:lifier)?\s*chips?|op-?amps?)\b/i],
  ["pcm", /^(?:PCM|sampl(?:ing|e)\s*rate|max(?:imum)?\s*sampl(?:ing|e)\s*rate)\b/i],
  ["dsd", /^DSD\b/i],
  ["bt", /^bluetooth(?:\s*(?:version|chip))?\b/i],
  ["codec", /^(?:(?:bluetooth\s+|supported\s+|audio\s+)?codecs?)\b/i],
  ["battery", /^(?:battery(?:\s*(?:life|capacity))?|playback\s+time|play\s*time|music\s+playback)\b/i],
];

/** { key: { value, quote } } from the description's labelled lines. */
export function extractSheet(html, lines = textify(html)) {
  const out = {};
  for (const line of lines) {
    if (line.length > 160) continue;
    // Bullets stores put before a label: "•", "-", ">" (HiFiGo), "▶", "◆"...
    const m = line.match(/^[•\-*·>›»▶►◆◇■□✓✔➤→–—\s]*([^:：]{1,40}?)\s*[:：]\s*(.+)$/);
    if (!m) continue;
    const [, label, raw] = m;
    const value = raw.replace(/\s+/g, " ").trim().replace(/[;,.]$/, "");
    if (!value || value.length > 100 || !/[\p{L}\p{N}]/u.test(value)) continue;
    for (const [key, re] of SHEET) {
      if (out[key] || !re.test(label.trim())) continue;
      out[key] = { value, quote: line };
      break;
    }
  }
  return out;
}
