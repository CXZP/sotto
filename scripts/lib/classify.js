// Rule-based product categorisation from store title / type / tags.
// Deterministic and boring on purpose: every decision can be traced to a rule.

const has = (s, re) => re.test(s);

// Amps that drive speakers: integrated (inputs, volume and a speaker amp in one
// box, often a streamer too) and power amps (no volume, speaker terminals).
// Their watts are into 4-8 Ω speakers and must never meet headphone maths.
export const INTEGRATED = /\b(?:streaming (?:dac )?amp(?:lifier)?|integrated (?:stereo )?amp(?:lifier)?|stereophonic amp(?:lifier)?|all-in-one (?:streaming |integrated )?amp(?:lifier)?|all-in-one integrated|air amp|wiim\W+amp|bluos streaming)\b/i;
export const STREAMER = /\b(?:streamers?|wi-?fi (?:audio )?transport|network (?:player|transport|streamer)|music server|streaming (?:music )?player|(?:network )?streaming transport|digital (?:audio )?transport)\b/i;
const POWER_AMP = /\b(?:power amp(?:lifier)?|stereo amp(?:lifier)?|mon(?:o|oblock|aural) amp(?:lifier)?|dual mono amp(?:lifier)?|\d{2,4}\s?watts?|\d\s?x\s?\d{2,4}\s?w|home cinema|custom install(?:ation)?)\b/i;
const SPEAKER_BODY = /\b(?:watts? per channel|wpc|speaker (?:terminals?|outputs?|binding posts?)|binding posts?|\d+[- ]?w(?:atts?)? (?:into|@) (?:an? )?[248]\s?(?:ohms?|Ω)|(?:power|signal) (?:from the amplifier )?to (?:your|the) speakers|subwoofers?|ohm (?:output taps|speakers))\b/i;
// A description that opens by calling the box a network player or music server.
const STREAMER_BODY = /\b(?:network player|music server|roon (?:based|ready) music (?:archive|server)|wi-?fi (?:audio )?transport)\b/i;

const RULES = [
  // Things that are not part of a headphone chain, checked first.
  ["skip", /\b(gift card|insurance|warranty|shipping protection|deposit|sample|demo unit fee)\b/i],
  // Vinyl: a turntable is a source, a phono stage sits between it and the amp,
  // and the cartridge decides which phono stage works (MM or MC). Mats,
  // clamps, belts and spare styli are accessories.
  ["accessory", /\b(turntable mats?|platter mats?|slipmats?|record (?:clamps?|weights?|cleaners?|cleaning|brush(?:es)?|sleeves?)|drive belts?|dust ?covers?|headshells?|tonearms?|tonearm lifts?|stylus (?:brush|cleaner|gauge)|cover ?it|lacing bars?|racks?)\b|^(?!.*\bcartridges?\b).*\b(?:replacement )?styl(?:us|i)\b/i],
  // Only next to a vinyl word: "noise isolation" on an IEM is not a turntable foot.
  ["accessory", /^(?=.*\b(?:turntables?|cartridges?|vinyl|records?|tonearms?)\b).*\b(?:isolation|damping|feet|spacers?|clips?|alignment|gauges?|protractors?)\b/i],
  // Integrated and streaming amps drive speakers, even with a phono input or a
  // CD drive ("Primare I15 MM Integrated Amplifier with MM Phono Stage"). Kept as
  // their own role, never as headphone amps. Home-theatre ones stay out (below).
  ["desktop", new RegExp(`^(?!.*\\b(?:home (?:theat|cinema)|\\d+[- ]channel|multi[- ]?channel)\\b).*${INTEGRATED.source}`, "i")],
  // Streamers: a network source with no amp ("iFi NEO Stream Wi-Fi Audio Transport").
  // "KBEAR Streamer" is an IEM named Streamer.
  ["desktop", new RegExp(`^(?!.*\\b(?:amp(?:lifier)?s?|speakers?|(?:sa)?cd|iems?|earphones?|headphones?|portable)\\b).*${STREAMER.source}`, "i")],
  // Clocks, isolators, network conditioners and screen mounts are not amps.
  ["skip", /\b(?:master|reference|word) clocks?\b|\bclock (?:generators?|synchroni[sz]ers?)\b|^(?!.*\bearphones?\b).*\bisolators?\b|\bnetwork conditioners?\b|\b(?:monitor|display|desktop) mounts?\b|\bmonitor arms?\b|\b(?:full )?system\b.*\bmaster clock\b/i],
  ["phono", /^(?!.*\bturntables?\b(?!\s+phono))(?!.*\bwith (?:a |built-in )?phono\b).*\b(?:phono ?(?:pre-?amp\w*|stages?|amp\w*|equali[sz]er|box\w*)|step[- ]up transformers?|\bSUT\b|mm\/mc pre-?amp\w*)/i],
  // "Turntable with Cartridge" is a turntable; "MC Cadenza Red Turntable Cartridge" is not.
  ["turntable", /^(?!.*\b(?:cables?|mats?|covers?)\b)(?!.*\bturntable cartridges?\b).*\b(?:turntables?|record players?)\b/i],
  // "Rega Apheta 3 Moving Coil" names no cartridge but is one.
  ["cartridge", /\b(?:phono )?cartridges?\b|\bmoving[- ](?:coil|magnet|iron)\b/i],
  // Home theatre and room hi-fi (Audio Advice, Addicted to Audio): outside a
  // headphone chain or a desk. "Matrix Audio" is a brand, so only "matrix" with
  // a switch/distribution word counts.
  ["skip", /\b(home theat(?:er|re)|\d+[- ]channel|multi[- ]?channel|in[- ]wall|in[- ]ceiling|on[- ]wall|outdoor|center channel|lcr|floor[- ]?standing|tower speakers?|av receivers?|tuners?|distribution|matrix (?:switch|distribution)|service kit|soundbars?|network (?:audio )?(?:player|transport)|music server|multi-?room|(?:preamp|power|rectifier|output) (?:vacuum )?tubes?|integrated (?:class|stereo)|streaming media players?|pre-?(?:amp\w* )?processors?|pre-?amp\w*\s*\/\s*processors?|av ?\d{1,5}\w*|\d+\.\d+[- ]?ch)\b/i],
  ["accessory", /\b(ear ?tips?|eartip|ear ?loops?|for (?:tws|true wireless|airpods)|(?:foam|silicone|memory foam|isolation) tips?|tips for|memory foam|ear ?pads?|earpads?|cushions?|case|pouch|stands?|hanger|filters?|nozzles?|screen protector|cleaning|headband|dust cap|carrying|straps?|cradles?|docking|ear ?hooks?|batter(y|ies)|faceplates?)\b/i],
  // Parts and care items sold under a product's name ("64 Audio Apex Modules",
  // "Audeze Maxwell Replacement Dongle", "Cayin C201 Module (For N6III)").
  // A player or amp that merely mentions its modules is still the product.
  ["accessory", /^(?!.*\b(?:music player|in-ear monitors?|headphone amp(?:lifier)?|includes?)\b)(?!.*\b(?:nfca|volume control) modules?\b).*\bmodules?\b/i],
  ["accessory", /\b(?:care|cleaning|tuning|tip replacement|groovy|strobe|crossover|upgrade) kits?\b|\b(?:shirt|cable) clips?\b|\byoke(?: rods?)?\b|\bspacers?\b|\balignment tools?\b|\bazimuth\b|\bneedles?\b|\bvacuum cleaners?\b|\bfeet\b|\bthrust balls?\b|\bbearings?\b|\bstubs?\b|\btru-?lift\b|\bvac(?: tips?)?\b|\b(?:replacement|wireless|[248]k) dongle\b|^(?!.*\bearphones?\b).*\bear ?plugs?\b/i],
  ["skip", /\bhdmi\b.*\bpower suppl(?:y|ies)\b/i],
  ["skip", /\b(beanie|t-?shirts?|tees?|hoodies?|merch|toys?|bricks|keychains?|mouse ?pads?|desk ?mats?|posters?|gaming mouse|lucky bags?|mystery box(?:es)?|gift cards?)\b/i],
  // A radio is a source with its own headphone out, like a portable player.
  ["dap", /^(?!.*\bspeakers?\b).*\b(?:fm |portable |retro )*radio\b/i],
  ["accessory", /\b(replaceable|quick[- ]switch|impedance|modular) plugs?\b/i],
  ["cable", /\b(cables?|cords?|interconnects?|extensions?)\b/i],
  ["adapter", /\b(adapters?|adaptors?|converters?|converter plugs?|jack converters?)\b/i],
  // CD players and transports (a "CD speaker" or a ripper is not one).
  ["skip", /\b(cd speakers?|cd[- ]rippers?|rippers?|cassettes?)\b/i],
  // Two products sold together ("Moondrop - Chu III + FiiO - BTR11"): not one
  // model. "Portable DAC + Headphone Amp - Master Tuned" is one product.
  ["skip", /\s-\s[^+]+\s\+\s(?!(?:headphone(?! zone)|dac|amp|preamp|portable|usb)\b)[^+]+\s-\s/i],
  // Speakers for a desk or a room. Portable Bluetooth/party speakers, speakerphones,
  // grilles, STAX "earspeakers" and speaker amps are not.
  ["skip", /^(?=.*speaker)(?:.*\b(?:portable|waterproof|party ?box|bluetooth (?:wireless )?speaker|compact|speakerphones?|grilles?|earspeakers?|conference|power ?bank)\b|.*\bspeaker amp)/i],
  ["speaker", /\b(?:desktop|active|powered|bookshelf|studio|monitor|stereo|wireless|computer|pc|hi-?fi)\s+(?:loud)?speakers?\b|\bloudspeakers?\b/i],
  ["cd", /\b(?:sa)?cd[- ]?(?:players?|transports?|drives?)\b|\bcd (?:digital )?transport\b|\bcompact dis[ck] (?:players?|transports?)\b|\bdiscdream\b/i],
  ["skip", /\b(microphones?|turntables?|phono|speakers?|subwoofers?|soundbar|records?|vinyl|dj |mixer|network switch|power conditioner|streamers?(?!.*\b(?:iems?|earphones?)\b)|receivers?|bluetooth transmitter|power amp(lifier)?s?|integrated amp(lifier)?s?|monoblocks?)\b/i],
  ["wireless", /\b(tws|(?:true|truly) wireless|wireless earbuds|wireless headphones?|anc earbuds)\b/i],
  ["dap", /\b(dap|digital audio player|music player|audio player|walkman)\b/i],
  // A battery amp with an analog input only (no DAC): its own form factor.
  // One with a DAC is turned back into a dongle when the catalog is built.
  ["portable", /\bportable (?:(?!dac\b)[\w-]+ ){0,3}amp(?:lifier)?s?\b/i],
  ["dongle", /\b(dongle|ear[- ]?hooks?|(?:type[- ]?c|usb[- ]?c|lightning) to (?:2\.5|3\.5|4\.4)(?:mm)?|portable[- ](?:balanced[- ])?(usb[- ])?dac|usb[- ]c dac|type[- ]c dac|dac cable|portable dac\/amp|mobile dac|bluetooth (?:dac|receiver|amp)\w*|portable (?:headphone )?amp\w*|btr\d+\w*)\b/i],
  ["desktop", /\b(desktop|headphone amp(lifier)?|dac\/amp|dac amp|dac & amp|dac and (headphone )?amp|tube amp|amplifier|preamp|dac)\b/i],
  // External DC supplies (linear or not) for DACs and amps; bundles with an amp stay amps.
  ["skip", /\b(chargers?|charging|power ?banks?|distribution block|power station|idefender|ground loop|bundle)\b/i],
  ["power", /\b(linear power suppl(?:y|ies)|lps|(?:dc |audio |external |audiophile )?power suppl(?:y|ies)|psu|ipower\w*|power system)\b/i],
  // "Studio Monitor Headphones" are headphones.
  ["iem", /\b(iems?|in[- ]ear|earphones?|earbuds?|universal iem|monitors?(?! headphones?))\b/i],
  ["headphone", /\b(headphones?|over[- ]ear|open[- ]back|closed[- ]back|planar)\b/i],
];

export function classify(p) {
  const title = p.title ?? "";
  const tags = (Array.isArray(p.tags) ? p.tags.join(" ") : p.tags) ?? "";
  // A store whose own categories are reliable sets p.kind (see crawl.mjs). The
  // title still wins when it says the product is a part, a cable or not ours.
  if (p.kind) {
    const fromTitle = RULES.find(([, re]) => has(title, re))?.[0];
    return ["accessory", "skip", "cable", "adapter", "power"].includes(fromTitle) ? fromTitle : p.kind;
  }
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

/**
 * The role a store title states outright, or null when only the description can tell.
 * Speaker amps come first: "integrated" (streaming / integrated amps), "streamer"
 * (network source, no amp) and "poweramp" (speaker power amp, no headphone out).
 */
export function titleRole(title) {
  if (INTEGRATED.test(title)) return "integrated";
  if (STREAMER.test(title) && !/\bamp(?:lifier)?s?\b/i.test(title)) return "streamer";
  if (/\bheadphones?\b/i.test(title)) return COMBO_WORD.test(title) || /\bdac (?:&|and) headphone amp/i.test(title) ? "dacamp" : null;
  if (POWER_AMP.test(title)) return "poweramp";
  // "Line Level Preamplifier", "Pre Amplifier", "Line Amplifier": a preamp, unless it
  // names a DAC or another amp too ("Amp/Preamp", "Head Amplifier + Tube Pre-Amplifier").
  const pre = /\bpre[- ]?amp\w*|\bline (?:level )?amp(?:lifier)?\b/gi;
  if (pre.test(title) && !/\bdac\b/i.test(title) && !/\bamp(?:lifier)?s?\b/i.test(title.replace(pre, " "))) return "preamp";
  return COMBO_WORD.test(title) ? "dacamp" : null;
}

export function deskRole(p) {
  const title = p.title ?? "";
  const body = (p.body ?? "").replace(/<[^>]+>/g, " ");
  const stated = titleRole(title);
  if (stated) return stated;
  const dacT = DAC_WORD.test(title);
  const ampT = AMP_WORD.test(title.replace(/\bpre-?amp\w*\b/gi, ""));
  // Descriptions only decide for titles that don't say headphone or portable.
  const plain = !/\b(?:headphones?|iems?|portable)\b/i.test(title);
  // An amp called only "Amplifier" whose description (or store type) puts it in front of speakers.
  if (plain && ampT && !dacT && !HP_OUT.test(body) && (SPEAKER_BODY.test(body) || /\bpower amp/i.test(p.type ?? ""))) return "poweramp";
  if (plain && !ampT && !HP_OUT.test(body) && STREAMER_BODY.test(body.slice(0, 200))) return "streamer";
  // A bare title ("Naim UNITI NOVA", "Cambridge Audio EVO 150") whose description
  // opens by calling it an integrated or streaming amp.
  if (plain && INTEGRATED.test(body.slice(0, 400))) return "integrated";
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

/**
 * The model name in a Japanese store title, or null for parts and add-ons.
 * "【中古】SE846+UNI ブラック 【SE846BABK+UNI-A】【名古屋】" -> "SE846+UNI": the
 * bracketed notes (condition, part number, branch) and Japanese words (colours,
 * notes) go. "PAW Gold用レザーケース" (a case "for" the PAW Gold) is not the PAW Gold.
 */
export function jpModelTitle(title) {
  // 欠品: a used unit missing parts (pads, cable) doesn't price the whole product.
  if (/欠品/.test(title)) return null;
  const t = title.replace(/【[^】]*】/g, " ").replace(/[(（][^)）]*[^\x00-\x7f][^)）]*[)）]/g, " ");
  if (/用|ケース|ケーブル|イヤーピース|イヤーパッド|イヤパッド|ドライバー|交換|アダプタ|プラグ|充電|スタンド|ポーチ|フィルム|セット|ジャンク/.test(t)) return null;
  const name = t.replace(/[^\x00-\x7f]+/g, " ").replace(/\s+/g, " ").trim();
  return /[a-z0-9]/i.test(name) ? name : null;
}

export function condition(title) {
  if (/中古|展示品|アウトレット/.test(title)) return "open-box/used";
  if (/\b(open[- ]box|b[- ]stock|refurbished|certified|pre[- ]?owned|used|demo|scratch|dent|display unit)\b/i.test(title)) return "open-box/used";
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
  // "Phono Preamplifier" keeps "Phono": "ZEN Air Phono" is not "ZEN Air DAC".
  /(?<=\bphono\s+)(?:pre-?amp(?:lifier)?s?|stages?)\b/gi,
  // Stock notes some stores type into the title: "N8ii --- SOLD!", "N8iii --SOLD OUT".
  /-*\s*\bsold(?:\s*out)?\b\s*!*/gi,
  /\((?:[^)]*)\)/g,
  /\[(?:[^\]]*)\]/g,
  /\b(open[- ]box|b[- ]stock|refurbished|apos certified|certified|pre[- ]?owned|used|demo|clearance|new|pre[- ]?(?:order|sale)|limited edition|discontinued)\b/gi,
  // "RR13 Portable Retro FM Radio with Bluetooth Connectivity" == "RR13 Portable Radio".
  /\b(?:retro\s+)?(?:fm\s+)?radio\b|\bconnectivity\b|\bclass[- ]?a\b|\b(?:headphone\s+)?jacks?\b/gi,
  // Driver counts in words ("ZERO: RED Dual Dynamic Drivers" == "Zero:RED").
  /\b(?:single|dual|triple|quad)\s+dynamic(?:\s+drivers?)?\b/gi,
  /\b(in[- ]ear monitors?|iems?|earphones?|earbuds?|headphones?|wired|universal|over[- ]ear|on[- ]ear|open[- ]back|planar magnetic|planar|dynamic drivers?|dynamic|drivers?|hybrid|portable|desktop|usb|dac\/amp|dac amp|headphone amp(lifier)?|amplifier|amp|dac|dongle|balanced|monitors?)\b/gi,
  // Product-type phrases that don't name the model ("JM21 Music Player" == "JM21 Digital Audio Player").
  /\b\d+(?:\.\d+)?\s?mm\b|\b(?:type[- ]?c|usb[- ]?c)\b(?! to)/gi,
  // "RS8 II Flagship Digital Audio Player" == "RS8 II"; "D400 Pro High-Resolution USB DAC" == "D400 Pro".
  /\b(?:(?:flagship|portable|transportable|lossless)\s+)*digital\s+(?:audio\s+)?players?\b|\bhi(?:gh)?[- ]?res(?:olution)?\b/gi,
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
  /\b(fully balanced|fully differential|fully discrete|fully|discrete|tube buffer|with gan charger|digital[- ]to[- ]analog conver[st][eo]r|decoder|network streaming|network streamng|streaming|streamer|remote control)\b/gi,
];

/**
 * Grouping key: brand + hyphen-free model, with a model repeated by the store
 * collapsed ("blessing3-blessing-3" -> "blessing3"). "dawn-pro-2" and
 * "dawn-pro2" match; "dawn-pro" and "dawn-pro-2" stay apart.
 */
export function groupKey(key) {
  const [brand, model = ""] = key.split("--");
  // Roman numerals as separate words mean the same as digits ("chu-ii" == "chu-2").
  // "ZEN DAC v3" == "ZEN DAC 3".
  const roman = { ii: "2", iii: "3", iv: "4", mkii: "mk2", mkiii: "mk3", v2: "2", v3: "3", v4: "4" };
  let m = model
    .split("-")
    // also glued on: "chuii" == "chu2"
    .map((w) => roman[w] ?? w.replace(/^([a-z0-9]{2,}?)(iii|ii)$/, (_, a, r) => a + (r === "ii" ? "2" : "3")))
    .join("");
  if (m.length % 2 === 0 && m.slice(0, m.length / 2) === m.slice(m.length / 2)) m = m.slice(0, m.length / 2);
  return `${brand}--${m}`;
}

// Words that don't make another model: finishes and "edition" ("Q350 Black" ==
// "Q350", "D8000 Pro Edition" == "D8000 Pro"). Not for cartridges, where the
// colour is the model (Ortofon 2M Red / Blue / Black), nor iFi's "Blue"
// (ZEN Air Blue is the Bluetooth model).
const FINISH = new Set(["black", "white", "silver", "grey", "gray", "blue", "red", "green", "gold", "matte", "edition", "wireless"]);
// Words stores add to wireless earphones that never name the model
// ("WF-1000XM5 Truly Wireless Noise Canceling" == "WF-1000XM5 TWS").
const WIRELESS_WORDS = new Set(["for", "anc", "bluetooth", "hybrid", "hi", "fi", "noise", "cancelling", "canceling", "cancellation", "active", "adaptive", "earbuds", "earphones", "headphones", "headset", "ipx4", "ipx5", "sports"]);
// And power supplies: "Darkside Pro Linear Power Supply" == "Darkside Pro | Low-Noise Regulated ...".
const POWER_WORDS = new Set(["linear", "power", "supply", "supplies", "psu", "lps", "low", "noise", "regulated", "reduction", "active", "purification", "cancelling", "canceling", "uk", "eu", "us", "plug", "version", "dc"]);

/**
 * Grouping key across stores: groupKey without finish words. A wireless version
 * (filed under "wireless") stays apart from the wired one of the same name
 * (HiFiMAN Svanar vs Svanar Wireless).
 */
// What stores add to DAC names: "R26 II / R26II Decoder 26 Bit Network Streaming
// DAC Fully Discrete R2R BT5.1" and "X30 Quad ES9039SPRO*4" are the R26 II and X30.
// "R2R" names a model at most brands (FiiO K11 vs K11 R2R); only lineups that are all R2R drop it.
const ALL_R2R = new Set(["gustard", "denafrips", "holo", "musician"]);
const DESK_WORDS = new Set(["renderer", "decoder", "network", "streaming", "streamer", "digital", "analog", "analogue", "convertor", "converter", "dac", "quad", "dual", "discrete", "fully", "with", "remote", "control", "certified", "apos", "desktop", "powerful", "wi", "fi", "transport"]);
// Phono stages: "ZEN Phono 3 MM/MC Phono Stage" == "ZEN Phono 3 - Phono Preamp" == "ZEN Phono v3".
const PHONO_WORDS = new Set(["phono", "pre", "preamp", "preamplifier", "stage", "mm", "mc", "turntable", "desktop"]);
const CHIP = /^(?:\d+x)?(?:es9\d{3}|ak4\d{3}|cs43\d{3}|pcm\d{4}|ad\d{4})\w*$/;
function deskWords(words, brand) {
  const out = [];
  for (let n = 0; n < words.length; n++) {
    const w = words[n] === "il" ? "ii" : words[n]; // "R26 Il": a store's typo for II
    // "ZEN CAN 3 Pre" (Headphone Amp/Pre-Amp): the same box.
    if ((w === "pre" || w === "preamplifier") && n > 0) continue;
    if (DESK_WORDS.has(w) || CHIP.test(w) || (w === "r2r" && ALL_R2R.has(brand))) continue;
    if (w === "bit" || (/^\d+$/.test(w) && words[n + 1] === "bit")) continue; // "26 bit"
    if (/^bt\d$/.test(w) || (/^\d$/.test(w) && /^bt\d$/.test(words[n - 1] ?? ""))) continue; // "BT5.1"
    // "Warmer R2R Tube (DAC)": what it uses, not the model. Not when little is
    // left: Little Dot "I+ Tube" is not the "DAC I".
    if (w === "tube" && n === words.length - 1 && out.join("").length >= 3) continue;
    out.push(w);
  }
  return out;
}

export function looseKey(key, category) {
  const [brand, model = ""] = key.split("--");
  let words = model.replace(/(^|-)collector-?s(?=-|$)/g, "$1").split("-").filter(Boolean);
  if (category === "desktop") words = deskWords(words, brand);
  // "UltraSonic Bluetooth 5.3 Hybrid Hi-Fi ANC", "1BA+1DD": not the model
  if (category === "wireless") words = words.filter((w, n) => !/^\d+(?:ba|dd)$/.test(w) && !(/^\d$/.test(w) && [words[n - 1], words[n - 2]].includes("bluetooth")));
  const keep = words.filter((w) =>
    category === "cartridge" ? w !== "edition" : (!FINISH.has(w) || (brand === "ifi" && w === "blue")) && !(category === "wireless" && WIRELESS_WORDS.has(w)) && !(category === "power" && POWER_WORDS.has(w)) && !(category === "phono" && PHONO_WORDS.has(w)),
  );
  // True wireless earbuds vs a wireless over-ear of the same name (Momentum 4 vs Momentum True Wireless 4).
  const tws = category === "wireless" && words.some((w) => ["true", "truly", "ture", "tws"].includes(w));
  const kept = keep.filter((w) => !(category === "wireless" && ["true", "truly", "ture", "tws"].includes(w)));
  const k = groupKey(`${brand}--${(kept.length ? kept : words).join("-")}${tws ? "-tws" : ""}`);
  // A phono stage named like another box ("ZEN Air Phono" vs "ZEN Air DAC") stays apart too.
  return category === "wireless" ? `${k}~w` : category === "phono" ? `${k}~p` : k;
}

/** Hyphen-free form for loose matching ("dc04pro" == "dc04-pro"). */
export function compact(key) {
  return key.replace(/-/g, "");
}

/** Normalised key so the same model at different stores groups together. */
export function modelKey(vendor, title) {
  // "Model | Description" (Bloom Audio): the part after the bar never names the model.
  let t = ` ${title.split(" | ")[0]} `;
  // "ES9039SPRO*4": how many chips, not part of the model.
  t = t.replace(/\*\s*\d+\b/g, " ");
  const v = (vendor ?? "").trim();
  if (v) t = t.replace(new RegExp(`\\b${escapeRe(v)}\\b`, "gi"), " ");
  // A model whose name starts with "Amp" ("WiiM Amp Pro") keeps it: it is not the noise word.
  t = t.replace(/^\s*amp\b/i, " Ampname");
  // "Lina DAC X" is not "Lina Headphone Amp": an X after DAC names the model, not a collab.
  t = t.replace(/\bdac x\b/gi, "DAC Xname");
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
    .replace(/\bAmpname\b/, "Amp")
    .replace(/\bXname\b/, "X")
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
