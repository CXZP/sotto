// Rule-based product categorisation from store title / type / tags.
// Deterministic and boring on purpose: every decision can be traced to a rule.

const has = (s, re) => re.test(s);

const RULES = [
  // Things that are not part of a headphone chain, checked first.
  ["skip", /\b(gift card|insurance|warranty|shipping protection|deposit|sample|demo unit fee)\b/i],
  ["accessory", /\b(ear ?tips?|eartip|ear ?pads?|earpads?|cushions?|case|pouch|stand|hanger|filters?|nozzles?|screen protector|cleaning|headband|dust cap|carrying|straps?|cradles?|docking|ear ?hooks?|batter(y|ies)|faceplates?)\b/i],
  ["skip", /\b(beanie|t-?shirts?|hoodies?|merch|toys?|bricks|keychains?|mouse ?pads?|posters?)\b/i],
  ["accessory", /\b(replaceable|quick[- ]switch|impedance|modular) plugs?\b/i],
  ["cable", /\b(cables?|cords?|interconnects?|extensions?)\b/i],
  ["adapter", /\b(adapters?|adaptors?|converters?|converter plugs?|jack converters?)\b/i],
  ["skip", /\b(microphones?|turntables?|phono|cd players?|speakers?|subwoofers?|soundbar|records?|vinyl|dj |mixer|network switch|power supply|lps|power conditioner|streamers?|receivers?|bluetooth transmitter|power amp(lifier)?s?|integrated amp(lifier)?s?|monoblocks?)\b/i],
  ["wireless", /\b(tws|true wireless|wireless earbuds|wireless headphones?|anc earbuds)\b/i],
  ["dap", /\b(dap|digital audio player|music player|audio player|walkman)\b/i],
  ["dongle", /\b(dongle|(?:type[- ]?c|usb[- ]?c|lightning) to (?:2\.5|3\.5|4\.4)(?:mm)?|portable (usb )?dac|usb[- ]c dac|type[- ]c dac|dac cable|portable dac\/amp|mobile dac)\b/i],
  ["desktop", /\b(desktop|headphone amp(lifier)?|dac\/amp|dac amp|dac & amp|dac and (headphone )?amp|tube amp|amplifier|preamp|dac)\b/i],
  ["iem", /\b(iems?|in[- ]ear|earphones?|earbuds?|universal iem|monitors?)\b/i],
  ["headphone", /\b(headphones?|over[- ]ear|open[- ]back|closed[- ]back|planar)\b/i],
];

export function classify(p) {
  const title = p.title ?? "";
  const tags = (Array.isArray(p.tags) ? p.tags.join(" ") : p.tags) ?? "";
  // Title first, then the store's product type, then tags (tags are noisy: "Desktop HiFi" on an IEM).
  for (const text of [title, p.type ?? "", tags]) {
    for (const [cat, re] of RULES) if (has(text, re)) return cat;
  }
  return "other";
}

export function condition(title) {
  if (/\b(open[- ]box|b[- ]stock|refurbished|certified|pre[- ]owned|used|demo|scratch|dent)\b/i.test(title)) return "open-box/used";
  return "new";
}

const NOISE = [
  /\((?:[^)]*)\)/g,
  /\[(?:[^\]]*)\]/g,
  /\b(open[- ]box|b[- ]stock|refurbished|apos certified|certified|pre[- ]owned|used|demo|clearance|new|pre[- ]?order|limited edition)\b/gi,
  /\b(in[- ]ear monitors?|iems?|earphones?|earbuds?|headphones?|wired|universal|over[- ]ear|on[- ]ear|open[- ]back|planar magnetic|planar|dynamic drivers?|dynamic|drivers?|hybrid|portable|desktop|usb|dac\/amp|dac amp|headphone amp(lifier)?|amplifier|amp|dac|dongle|balanced|monitors?)\b/gi,
  // Marketing words stores append that don't change the product.
  /\b(discontinued|professional|pro audio|studio|reference|stereo|hi[- ]?res|hifi|hi[- ]fi|audiophile|flagship|premium|official|edition stereo|with mic|for (?:audiophiles?|musicians?|gaming)|and|with|the|new|version|x)\b/gi,
  // Product-type phrases that don't name the model ("JM21 Music Player" == "JM21 Digital Audio Player").
  /\b\d+(?:\.\d+)?\s?mm\b|\b(?:type[- ]?c|usb[- ]?c)\b(?! to)/gi,
  /\b(high[- ]performance|entry[- ]level|composite diaphragm|\d+\s?w power|audio|armature|standard package|package|tribrid|quadbrid|(?:transportable )?digital player|\d{4} revision)\b/gi,
  /\b(in[- ]ears?|(?:digital |hi-?res )?(?:audio|music|mp3) players?|android \d+|jade ?audio|lossless|bluetooth(?: \d(?:\.\d)?)?|headphone|portable usb)\b/gi,
  // DAC/amp chip names and driver counts.
  /\b(dual|quad)?\s*(es\d{4}\w*|cs\d{5}\w*|ak\d{4}\w*|pcm\d{4}\w*|tpa\d{4}\w*|ricore\w*|rt\d{4}\w*)\b/gi,
  /\b\d+\s*(dd|ba|est|bc|pzt|mems)\b(\s*\+\s*\d+\s*(dd|ba|est|bc|pzt|mems)\b)*/gi,
  /[|–—:,/+&]+/g,
];

/**
 * Grouping key: brand + hyphen-free model, with a model repeated by the store
 * collapsed ("blessing3-blessing-3" -> "blessing3"). "dawn-pro-2" and
 * "dawn-pro2" match; "dawn-pro" and "dawn-pro-2" stay apart.
 */
export function groupKey(key) {
  const [brand, model = ""] = key.split("--");
  // Roman numerals as separate words mean the same as digits ("chu-ii" == "chu-2").
  const roman = { ii: "2", iii: "3", iv: "4", mkii: "mk2", mkiii: "mk3" };
  let m = model
    .split("-")
    // also glued on: "chuii" == "chu2"
    .map((w) => roman[w] ?? w.replace(/^([a-z]{2,}?)(iii|ii)$/, (_, a, r) => a + (r === "ii" ? "2" : "3")))
    .join("");
  if (m.length % 2 === 0 && m.slice(0, m.length / 2) === m.slice(m.length / 2)) m = m.slice(0, m.length / 2);
  return `${brand}--${m}`;
}

/** Hyphen-free form for loose matching ("dc04pro" == "dc04-pro"). */
export function compact(key) {
  return key.replace(/-/g, "");
}

/** Normalised key so the same model at different stores groups together. */
export function modelKey(vendor, title) {
  let t = ` ${title} `;
  const v = (vendor ?? "").trim();
  if (v) t = t.replace(new RegExp(`\\b${escapeRe(v)}\\b`, "gi"), " ");
  for (const re of NOISE) t = t.replace(re, " ");
  const model = t.replace(/\s+/g, " ").trim();
  const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { key: `${slug(v) || "unknown"}--${slug(model) || "unknown"}`, model };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
