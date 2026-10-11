// Rule-based product categorisation from store title / type / tags.
// Deterministic and boring on purpose: every decision can be traced to a rule.

const has = (s, re) => re.test(s);

const RULES = [
  // Things that are not part of a headphone chain, checked first.
  ["skip", /\b(gift card|insurance|warranty|shipping protection|deposit|sample|demo unit fee)\b/i],
  // Vinyl: a turntable is a source, a phono stage sits between it and the amp,
  // and the cartridge decides which phono stage works (MM or MC). Mats,
  // clamps, belts and spare styli are accessories.
  ["accessory", /\b(turntable mats?|platter mats?|slipmats?|record (?:clamps?|weights?|cleaners?|cleaning|brush(?:es)?|sleeves?)|drive belts?|dust ?covers?|headshells?|tonearms?|tonearm lifts?|stylus (?:brush|cleaner|gauge)|cover ?it|lacing bars?|racks?)\b|^(?!.*\bcartridges?\b).*\b(?:replacement )?styl(?:us|i)\b/i],
  // Only next to a vinyl word: "noise isolation" on an IEM is not a turntable foot.
  ["accessory", /^(?=.*\b(?:turntables?|cartridges?|vinyl|records?|tonearms?)\b).*\b(?:isolation|damping|feet|spacers?|clips?|alignment|gauges?|protractors?)\b/i],
  ["phono", /^(?!.*\bturntables?\b).*\b(?:phono ?(?:pre-?amp\w*|stages?|amp\w*|equali[sz]er|box\w*)|step[- ]up transformers?|\bSUT\b|mm\/mc pre-?amp\w*)/i],
  ["turntable", /^(?!.*\b(?:cables?|mats?|covers?)\b).*\b(?:turntables?|record players?)\b/i],
  // "Rega Apheta 3 Moving Coil" names no cartridge but is one.
  ["cartridge", /\b(?:phono )?cartridges?\b|\bmoving[- ](?:coil|magnet|iron)\b/i],
  // Home theatre and room hi-fi (Audio Advice, Addicted to Audio): outside a
  // headphone chain or a desk. "Matrix Audio" is a brand, so only "matrix" with
  // a switch/distribution word counts.
  ["skip", /\b(home theat(?:er|re)|\d+[- ]channel|multi[- ]?channel|in[- ]wall|in[- ]ceiling|on[- ]wall|outdoor|center channel|lcr|floor[- ]?standing|tower speakers?|av receivers?|tuners?|distribution|matrix (?:switch|distribution)|service kit|soundbars?|network (?:audio )?(?:player|transport)|music server|multi-?room|(?:preamp|power|rectifier|output) (?:vacuum )?tubes?|integrated (?:class|stereo)|streaming media players?|pre-?(?:amp\w* )?processors?|av ?\d{1,5}\w*|\d+\.\d+[- ]?ch)\b/i],
  ["accessory", /\b(ear ?tips?|eartip|(?:foam|silicone|memory foam|isolation) tips?|tips for|memory foam|ear ?pads?|earpads?|cushions?|case|pouch|stands?|hanger|filters?|nozzles?|screen protector|cleaning|headband|dust cap|carrying|straps?|cradles?|docking|ear ?hooks?|batter(y|ies)|faceplates?)\b/i],
  ["skip", /\b(beanie|t-?shirts?|hoodies?|merch|toys?|bricks|keychains?|mouse ?pads?|posters?)\b/i],
  ["accessory", /\b(replaceable|quick[- ]switch|impedance|modular) plugs?\b/i],
  ["cable", /\b(cables?|cords?|interconnects?|extensions?)\b/i],
  ["adapter", /\b(adapters?|adaptors?|converters?|converter plugs?|jack converters?)\b/i],
  // CD players and transports (a "CD speaker" or a ripper is not one).
  ["skip", /\b(cd speakers?|cd[- ]rippers?|rippers?|cassettes?)\b/i],
  // Speakers for a desk or a room. Portable Bluetooth/party speakers, speakerphones,
  // grilles, STAX "earspeakers" and speaker amps are not.
  ["skip", /^(?=.*speaker)(?:.*\b(?:portable|waterproof|party ?box|bluetooth (?:wireless )?speaker|compact|speakerphones?|grilles?|earspeakers?|conference|power ?bank)\b|.*\bspeaker amp)/i],
  ["speaker", /\b(?:desktop|active|powered|bookshelf|studio|monitor|stereo|wireless|computer|pc|hi-?fi)\s+(?:loud)?speakers?\b|\bloudspeakers?\b/i],
  ["cd", /\b(?:sa)?cd[- ]?(?:players?|transports?|drives?)\b|\bcd (?:digital )?transport\b|\bdiscdream\b/i],
  ["skip", /\b(microphones?|turntables?|phono|speakers?|subwoofers?|soundbar|records?|vinyl|dj |mixer|network switch|power conditioner|streamers?|receivers?|bluetooth transmitter|power amp(lifier)?s?|integrated amp(lifier)?s?|monoblocks?)\b/i],
  ["wireless", /\b(tws|true wireless|wireless earbuds|wireless headphones?|anc earbuds)\b/i],
  ["dap", /\b(dap|digital audio player|music player|audio player|walkman)\b/i],
  ["dongle", /\b(dongle|(?:type[- ]?c|usb[- ]?c|lightning) to (?:2\.5|3\.5|4\.4)(?:mm)?|portable (usb )?dac|usb[- ]c dac|type[- ]c dac|dac cable|portable dac\/amp|mobile dac|bluetooth (?:dac|receiver|amp)\w*|portable (?:headphone )?amp\w*|btr\d+\w*)\b/i],
  ["desktop", /\b(desktop|headphone amp(lifier)?|dac\/amp|dac amp|dac & amp|dac and (headphone )?amp|tube amp|amplifier|preamp|dac)\b/i],
  // External DC supplies (linear or not) for DACs and amps; bundles with an amp stay amps.
  ["skip", /\b(chargers?|charging|power ?banks?|distribution block|power station|idefender|ground loop|bundle)\b/i],
  ["power", /\b(linear power suppl(?:y|ies)|lps|(?:dc |audio |external |audiophile )?power suppl(?:y|ies)|psu|ipower\w*|power system)\b/i],
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

// Desktop units do three different jobs: a DAC alone (no headphone output),
// a headphone amp alone (needs a DAC in front), or both in one box.
const DAC_WORD = /\b(dac|decoder|digital[- ]to[- ]analog|d\/a conver\w*|streamer|streaming)\b/i;
const AMP_WORD = /\b(headphone amp(lifier)?s?|amp(lifier)?s?|dac\/amp|dac amp|dac & amp|dac and (headphone )?amp|preamp\w*)\b/i;
const COMBO_WORD = /\b(dac\/amp|dac[- ]amp|dac & amp|dac and (headphone )?amp|amp\/dac|all[- ]in[- ]one)\b/i;
const HP_OUT = /\b(headphone (output|out|jack)s?|headphone amp|6\.35\s?mm|4\.4\s?mm (balanced )?(headphone )?out|phones? out)\b/i;
const HAS_DAC = /\b(usb[- ]?(?:b|c)? (?:audio |input)|optical (?:input|in)|coaxial (?:input|in)|decod\w+|es9\d{3}\w*|ak4\d{3}\w*|cs43\d{3}\w*|pcm\d{4}\w*|r-?2r (?:dac|ladder)|bluetooth (?:receiver|input|5))\b/i;
const NO_DAC = /\b(no (?:built[- ]in )?dac|requires? an? (?:external )?dac|without (?:a )?dac|pure (?:analog|analogue) (?:headphone )?amp)\b/i;

export function deskRole(p) {
  const title = p.title ?? "";
  const body = (p.body ?? "").replace(/<[^>]+>/g, " ");
  if (COMBO_WORD.test(title)) return "dacamp";
  const dacT = DAC_WORD.test(title);
  const ampT = AMP_WORD.test(title.replace(/\bpre-?amp\w*\b/gi, ""));
  // A line preamp: volume and inputs, no headphone jack (feeds active speakers or a power amp).
  if (/\bpre-?amp/i.test(title) && !ampT && !HP_OUT.test(body)) return dacT || HAS_DAC.test(body) ? "dac" : "preamp";
  if (dacT && ampT) return "dacamp";
  if (dacT) return HP_OUT.test(body) ? "dacamp" : "dac";
  if (ampT) return HAS_DAC.test(body) && !NO_DAC.test(body) ? "dacamp" : "amp";
  return HAS_DAC.test(body) ? (HP_OUT.test(body) ? "dacamp" : "dac") : "amp";
}

/** Speakers: "passive" needs an amplifier, "active" has one built in. */
export function speakerKind(p) {
  const t = `${p.title} ${(p.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000)}`;
  if (/\bpassive\b/i.test(p.title)) return "passive";
  if (/\b(active|powered|wireless|built-?in amp\w*|bluetooth|streaming)\b/i.test(p.title)) return "active";
  return /\b(built-?in (?:class[- ]?d )?amp\w*|powered|active speakers?|amplifier built in)\b/i.test(t) ? "active" : "passive";
}

export function condition(title) {
  if (/\b(open[- ]box|b[- ]stock|refurbished|certified|pre[- ]owned|used|demo|scratch|dent)\b/i.test(title)) return "open-box/used";
  return "new";
}

// Marketing words stores append. Applied last, and only if a name is left.
const MARKETING = /\b(discontinued|professional|pro audio|studio|reference|stereo|hi[- ]?res|hifi|hi[- ]fi|audiophile|flagship|premium|official|edition stereo|with mic|for (?:audiophiles?|musicians?|gaming)|and|with|the|new|version|x)\b/gi;

const NOISE = [
  // Listing notes after a dash: "805 D4 - Each", "Liberty II - UNIT", "HDI-1600 - A Grade".
  /\s-+\s*(?:each|unit)\b/gi,
  /-*\s*\b(?:[a-c][- ]?)?grade\b/gi,
  /\b(?:uk|eu|us|au) plug\b/gi,
  // Vinyl descriptors ("Debut 10 Turntable" == "Debut 10", "Shibata Moving Coil Phono Cartridge" == "Shibata").
  /\b(?:(?:belt|direct)[- ]drive\s+|(?:semi[- ])?automatic\s+|manual\s+)*(?:turntables?|record players?)\b/gi,
  /\b(?:(?:mm|mc|moving[- ](?:coil|magnet|iron))\s+)*(?:phono\s+)?cartridges?\b|\bmoving[- ](?:coil|magnet|iron)\b/gi,
  /\bphono\s+(?:pre-?amp(?:lifier)?s?|stages?)\b/gi,
  // Stock notes some stores type into the title: "N8ii --- SOLD!", "N8iii --SOLD OUT".
  /-*\s*\bsold(?:\s*out)?\b\s*!*/gi,
  /\((?:[^)]*)\)/g,
  /\[(?:[^\]]*)\]/g,
  /\b(open[- ]box|b[- ]stock|refurbished|apos certified|certified|pre[- ]owned|used|demo|clearance|new|pre[- ]?order|limited edition)\b/gi,
  /\b(in[- ]ear monitors?|iems?|earphones?|earbuds?|headphones?|wired|universal|over[- ]ear|on[- ]ear|open[- ]back|planar magnetic|planar|dynamic drivers?|dynamic|drivers?|hybrid|portable|desktop|usb|dac\/amp|dac amp|headphone amp(lifier)?|amplifier|amp|dac|dongle|balanced|monitors?)\b/gi,
  // Product-type phrases that don't name the model ("JM21 Music Player" == "JM21 Digital Audio Player").
  /\b\d+(?:\.\d+)?\s?mm\b|\b(?:type[- ]?c|usb[- ]?c)\b(?! to)/gi,
  /\b(high[- ]performance|entry[- ]level|composite diaphragm|\d+\s?w power|audio|armature|standard package|package|tribrid|quadbrid|(?:transportable )?digital player|\d{4} revision)\b/gi,
  /\b(in[- ]ears?|(?:digital |hi-?res )?(?:audio|music|mp3) players?|android \d+|jade ?audio|snow ?sky|lossless|bluetooth(?: \d(?:\.\d)?)?|headphone|portable usb)\b/gi,
  // DAC/amp chip names and driver counts.
  /\b(dual|quad)?\s*(es\d{4}\w*|cs\d{5}\w*|ak\d{4}\w*|pcm\d{4}\w*|tpa\d{4}\w*|ricore\w*|rt\d{4}\w*)\b/gi,
  /\b\d+\s*(dd|ba|est|bc|pzt|mems)\b(\s*\+\s*\d+\s*(dd|ba|est|bc|pzt|mems)\b)*/gi,
  /[|–—:,/+&]+/g,
  // Speaker descriptors ("KEF Q350 Passive Bookshelf Speakers" == "KEF Q350").
  /\b((?:passive|active|powered|wireless|bookshelf|desktop|stereo|hi-?fi|high-fidelity|2-way|two-way|three-way)\s+)*(?:loud)?speakers?\b(\s*-?\s*pair)?|\b(?:pair|freight damaged)\b/gi,
  // CD player descriptors ("SMSL PL200 MQA CD Player" == "SMSL PL200 MKII All-in-One CD Player").
  /\b((?:sa)?cd[- ]?(?:players?|transports?|drives?)|cd (?:digital )?transport|digital transport|mqa|chips?|all[- ]in[- ]one|top[- ]loading|compact|rca|optical|portable stereo|stereo)\b/gi,
  // Desktop descriptors that don't name the model ("Warmer R2R Fully Balanced DAC" == "Warmer R2R Tube Buffer").
  /\b(fully balanced|fully differential|fully discrete|fully|discrete|tube buffer|digital[- ]to[- ]analog conver[st][eo]r|decoder|network streaming|network streamng|streaming|streamer|remote control)\b/gi,
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
  // A pass that would erase the whole name is skipped: "CrinEar Reference" and
  // "QDC HiFi" are model names that happen to be marketing words.
  for (const re of NOISE) {
    const next = t.replace(re, " ");
    if (/[a-z0-9]/i.test(next)) t = next;
  }
  const bare = t.replace(MARKETING, " ");
  if (/[a-z0-9]/i.test(bare.replace(/[|–—:,/+&-]+/g, ""))) t = bare;
  // A word the store repeated ("R2R R2R", "M25 M25") counts once.
  const model = t
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\S+)(?: \1\b)+/gi, "$1")
    // Leftover separators once noise words are gone ("PL200T -", "- Grand Tourer").
    .replace(/^[-–—.\s]+|[-–—.\s]+$/g, "");
  const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { key: `${slug(v) || "unknown"}--${slug(model) || "unknown"}`, model };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cartridge type: "mm" (moving magnet / iron, ~2-5 mV, any phono stage),
 * "mc" (moving coil, ~0.2-0.6 mV, needs an MC stage or a step-up transformer),
 * "homc" (high-output MC, works on an MM stage). null when the store doesn't say.
 */
export function cartridgeKind(p) {
  for (const t of [p.title ?? "", (p.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 4000)]) {
    if (/\bhigh[- ]output (?:mc|moving[- ]coil)\b|\bHOMC\b/i.test(t)) return "homc";
    // Uppercase MM/MC only: "mc" and "mm" in lowercase are often other words.
    if (/\bmoving[- ](?:magnet|iron)\b/i.test(t) || /\bM[MI]\b/.test(t)) return "mm";
    if (/\bmoving[- ]coil\b/i.test(t) || /\bMC\b(?![\/-]?\s*MM)/.test(t)) return "mc";
  }
  return null;
}

/** Which cartridges a phono stage takes: "mm", "mc" or "mm+mc"; null when not stated. */
export function phonoInputs(p) {
  const t = `${p.title ?? ""} ${(p.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 6000)}`;
  if (/\bMM\s*\/\s*MC\b|\bMC\s*\/\s*MM\b|\bMM\s*(?:and|&|\+)\s*MC\b/i.test(t)) return "mm+mc";
  const mc = /\bmoving[- ]coil\b|step[- ]up transformer|\bSUT\b/i.test(t) || /\bMC\b/.test(t);
  const mm = /\bmoving[- ]magnet\b/i.test(t) || /\bMM\b/.test(t);
  return mc && mm ? "mm+mc" : mc ? "mc" : mm ? "mm" : null;
}
