// Cases from ERRORS.pdf (owner's review of the catalog after the store expansion, Oct 2026).
// Each case states what the catalog should say. Cases still wrong are marked
// { todo }: they run and report, but don't fail the check, so CI keeps crawling.
// Remove the todo when a fix makes the case pass.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const db = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
/** Items with an offer whose store title matches. */
const byTitle = (re) => db.items.filter((i) => i.offers.some((o) => re.test(o.title)));
const hpAmp = (i) => i.category === "desktop" && (i.role === "amp" || i.role === "dacamp");
const todo = "ERRORS.pdf — not fixed yet";

// ---------------------------------------------------------------- 1. accessories are not products

const ACCESSORIES = [
  "64 Audio - Replacement Steel and Plastic Needle for IEM VAC",
  "64 Audio - Shirt Clip for IEMs",
  "64 Audio Apex Modules",
  "64 Audio IEM VAC Pro Cordless Micro Vacuum Cleaner For In Ear Monitors - Earphones - Hearing Aids",
  "64 Audio High Fidelity Earplugs",
  "Acoustic Signature Rega Spacer Set",
  "AT-VTAZ1 Azimuth + VTA Alignment Tool",
  "Audeze Headphone Leather Care Kit",
  "Audeze Extended Yoke Rods for LCD Headphones",
  "Audeze In-Ear Groovy Kit",
  "Audeze Maxwell 2 ANC Replacement Dongle",
  "Audeze Maxwell USB-C Wireless Dongle",
  "Astell&Kern AK300 Add-On Module",
  "Astell&Kern SEM2 | All-in-One Module",
  "Astell & Kern SEM2 Interchangeable DAC/AMP module for the SE180 - Discontinued",
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Checked on the built catalog: the title alone may pass while the store's
// product type still pulls the listing into a main category.
for (const title of ACCESSORIES)
  test(`accessory, not a product: ${title}`, { todo }, () => {
    assert.deepEqual(byTitle(new RegExp(`^${esc(title)}$`)).map((i) => `${i.id} (${i.category})`), []);
  });

// A radio is a source (tuner + headphone/line out), like a portable player.
test("FiiO RR13 radio is a source from FiiO, not a headphone or dongle", { todo }, () => {
  const found = byTitle(/FiiO RR13/);
  assert.ok(found.length, "listing missing");
  assert.equal(found.length, 1, found.map((i) => i.id).join(", "));
  assert.equal(found[0].brand, "FiiO");
  assert.equal(found[0].category, "dap");
});

// ---------------------------------------------------------------- 2. store names are not brands

// A store's own name is only a brand when the store makes the thing and says so
// in the title ("Linsoul Avant", "Apos x Salad Dynatone", "Kiwi Ears Aether").
// House brands that don't repeat the store name (checked on the stores' pages):
// Moon Audio's Dragon line (cables, Dragon Inspire amps) and Kitsune HiFi's
// KTE = "Kitsune Tuned Edition" (e.g. KTE SU-2, a tuned Singxer SU2).
const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const STORE_NAMES = new Set([
  ...Object.values(db.stores).flatMap((s) => [norm(s.name), norm(s.host.split(".")[0])]),
  ...Object.keys(db.stores).map(norm),
  "addsoap", "addictedtoaudio", "audio46", "headphonescom",
]);
const HOUSE = /^(moon-audio--dragon|kitsunehifi--kte)/;
test("no model is filed under a store's name unless the store makes it", { todo }, () => {
  const bad = db.items
    .filter((i) => STORE_NAMES.has(norm(i.brand)) && !HOUSE.test(i.id) && !i.offers.some((o) => norm(o.title).includes(norm(i.brand))))
    .map((i) => `${i.id} (${i.brand})`);
  assert.deepEqual(bad, []);
});
test("store merchandise is not a product (gift cards, tees, desk mats, lucky bags, mystery boxes)", { todo }, () => {
  const bad = byTitle(/gift cards?|\btee\b|t-shirt|desk mat|lucky bag|mystery box/i).map((i) => `${i.id} (${i.category})`);
  assert.deepEqual(bad, []);
});
for (const [re, brand] of [
  [/SABAJ A30A/, /^sabaj$/i],
  [/SABAJ A20d/, /^sabaj$/i],
  [/LOXJIE D40 Pro/, /^loxjie$/i],
  [/ELAC Connex DCB41-ADSUM/, /^elac$/i],
  [/FiiO RR13 Portable Radio/, /^fiio$/i],
  [/Little Dot MK9/, /^little dot$/i],
  [/COZOY TAKT C/, /^cozoy$/i],
])
  test(`brand from the title: ${re.source}`, { todo }, () => {
    const found = byTitle(re);
    assert.ok(found.length, "listing missing");
    for (const i of found) assert.match(i.brand ?? "", brand);
  });

// ---------------------------------------------------------------- 3. speaker amps are not headphone amps

// Power amps for passive speakers: no headphone output, rated in watts into 4-8 Ω.
// They must never be offered as a headphone amp or enter the loudness maths.
const SPEAKER_AMPS = [
  /Audio Research Reference 75 SE Amplifier/,
  /Audio Research Reference 150 SE Amplifier/,
  /Audio Research Reference 250 SE Amplifier/,
  /SABAJ A30A FDA Amplifier/,
  /McIntosh MC152 150 Watt Stereo Amplifier/i,
  /Mcintosh MC901 Dual Mono Amplifier/i,
  /Mark Levinson ML-50 .*Monaural Amplifier/,
  /^X250\.8 Stereo Amplifier/,
  /^Ultima 6 Amplifier/,
  /^ETUDE Amplifier/,
  /DALI PHANTOM CI AMP-/,
  /Primare A35\.8 Eight Channel Home Cinema Amplifier/,
  /Klipsch KA-1000-THX Amplifier/, // subwoofer amp for the THX Ultra2 home theatre system
];
for (const re of SPEAKER_AMPS)
  test(`speaker power amp, kept out of headphone maths: ${re.source}`, { todo }, () => {
    const found = byTitle(re);
    assert.ok(found.length, "listing missing");
    for (const i of found) assert.ok(!hpAmp(i), `${i.id} is desktop/${i.role}`);
  });

// The same over the whole catalog: a title that says power / stereo / mono amp,
// watts, home cinema or custom install, and never says headphone.
const SPEAKER_WORDS = /\b(power amp(lifier)?|stereo amp(lifier)?|mono(block|aural)? amp(lifier)?|dual mono amp(lifier)?|\d{2,4}\s?watts?\b|\d\s?x\s?\d{2,4}\s?w\b|home cinema|custom install(ation)?)\b/i;
test("no speaker power amp anywhere is filed as a headphone amp", { todo }, () => {
  const bad = db.items
    .filter((i) => hpAmp(i) && i.offers.some((o) => SPEAKER_WORDS.test(o.title)) && !i.offers.some((o) => /headphone/i.test(o.title)))
    .map((i) => `${i.id} (${i.role})`);
  assert.deepEqual(bad, []);
});

// Integrated and streaming amps drive speakers; some also have a headphone jack.
// They are their own role, "integrated": not a headphone amp, and their watts
// (into 4-8 Ω speakers) never enter the headphone maths.
const INTEGRATED = /\b(streaming amp(lifier)?|streaming dac amp(lifier)?|integrated amp(lifier)?|stereophonic amp(lifier)?|all-in-one amp(lifier)?|all-in-one integrated|air amp|amp ultra)\b/i;
for (const re of [
  /Bluesound POWERNODE EDGE/, /Cambridge Audio Evo 150 SE/, /Cambridge Audio EVO 300/, /EverSolo Play Streaming/, /FiiO R7 All-In-One Streaming/,
  /Hegel H150/, /Marantz Model M1/, /C 3030 Stereophonic/, /NAD C 3050 Stereophonic/, /NAD C 700 V2/, /NAD M10 V3/,
  /Naim Uniti Nova PE/, /Naim Uniti Star/, /Primare I15 MM Integrated/, /Pro-Ject Wireless Box E/, /Roksan Caspian 4G/, /WiiM Amp Pro/,
  // Streaming integrated amps: streamer + amp with speaker terminals (e.g. FiiO AIR AMP).
  /M33 BluOS Streaming DAC Amplifier/, /NAD M33 V2 BluOS/, /WiiM - Amp Ultra/,
])
  test(`integrated / streaming amp: ${re.source}`, { todo }, () => {
    const found = byTitle(re);
    assert.ok(found.length, "listing missing");
    for (const i of found) assert.equal(i.role, "integrated", `${i.id} is ${i.category}/${i.role ?? ""}`);
  });
test("every integrated or streaming amp in the catalog has the integrated role", { todo }, () => {
  const bad = db.items.filter((i) => i.offers.some((o) => INTEGRATED.test(o.title)) && i.role !== "integrated").map((i) => `${i.id} (${i.category}/${i.role ?? ""})`);
  assert.deepEqual(bad, []);
});

// A streamer plays from the network and hands the music on (digital out, or line
// out through its own DAC). No amp: role "streamer", a source in the chain
// (e.g. FiiO SR11, WiiM Pro, iFi NEO Stream). "Streaming DAC" stays a DAC.
const STREAMER = /\b(streamer|wi-?fi (audio )?transport|network (player|transport|streamer)|music server)\b/i;
for (const re of [/iFi NEO Stream High-resolution Wi-Fi Audio Transport/, /iFi NEO Stream 3 High-resolution Wi-Fi Audio Transport/, /Weiss MAN301R/])
  test(`streamer, a source without an amp: ${re.source}`, { todo }, () => {
    const found = byTitle(re);
    assert.ok(found.length, "listing missing");
    for (const i of found) assert.equal(i.role, "streamer", `${i.id} is ${i.category}/${i.role ?? ""}`);
  });
// Not counted: earphones named "Streamer" (KBEAR Streamer) and all-in-one music
// centres with a headphone amp (Shanling EA5 Plus is a DAC/amp).
test("every streamer in the catalog (not a CD player, portable or amp) has the streamer role", { todo }, () => {
  const bad = db.items
    .filter((i) => !["cd", "dap", "speaker", "iem", "headphone"].includes(i.category) && i.offers.some((o) => STREAMER.test(o.title) && !/amp(lifier)?\b|cd|sacd|all-in-one/i.test(o.title)))
    .filter((i) => i.role !== "streamer")
    .map((i) => `${i.id} (${i.category}/${i.role ?? ""})`);
  assert.deepEqual(bad, []);
});

// Line-level preamps drive a power amp, not headphones: role "preamp".
for (const re of [/^XP-12 Line Level Preamplifier/, /^XP-22 Line Level Preamplifier/, /^ULTIMA PRE 2 Preamplifier/, /Goldmund MIMESIS .*Pre Amplifier/, /Benchmark LA4 Line Amplifier/])
  test(`line preamp, not a headphone amp: ${re.source}`, { todo }, () => {
    const found = byTitle(re);
    assert.ok(found.length, "listing missing");
    for (const i of found) assert.equal(i.role, "preamp", i.id);
  });

// Not amplifiers at all, yet filed as one.
for (const re of [/Master Clock/i, /Reference Clock/, /Network Isolator|Network Conditioner|Galvanic Isolator|USB Optical Isolator/, /Kanto DM[12G] .*(Mount|Arm)/])
  test(`not an amplifier: ${re.source}`, { todo }, () => {
    assert.deepEqual(byTitle(re).filter(hpAmp).map((i) => `${i.id} (${i.role})`), []);
  });

// ---------------------------------------------------------------- 4. sources in the right box

test("a CD player that also has a DAC is a CD player: Audio Research CD9", { todo }, () => {
  for (const i of byTitle(/Audio Research Reference CD9/)) assert.equal(i.category, "cd");
});
test("ARCAM Radia CD5 and CD25 are CD players", () => {
  for (const i of byTitle(/ARCAM Radia CD5|Arcam CD25/i)) assert.equal(i.category, "cd");
});
test("a mains-powered streamer is not a portable player: ARCAM Radia ST5", { todo }, () => {
  for (const i of byTitle(/ARCAM Radia ST5/)) assert.notEqual(i.category, "dap");
});
test("DAC & headphone amp is dacamp: AUDALYTIC AH90", { todo }, () => {
  for (const i of byTitle(/AUDALYTIC AH90/)) assert.equal(i.role, "dacamp");
});

// ---------------------------------------------------------------- 5. home theatre stays out

for (const re of [/Anthem AVM 70/, /Anthem AVM 90/])
  test(`home theatre processor kept out: ${re.source}`, { todo }, () => {
    assert.deepEqual(byTitle(re).map((i) => i.id), []);
  });

// ---------------------------------------------------------------- 6. one model, right form factor

// astellnkern.com: "The First Class-A Portable AMP" — analog in (3.5/4.4 mm), battery, no DAC.
test("Astell&Kern PA10 is one model, a portable amp (not a dongle, not desktop)", { todo }, () => {
  const found = byTitle(/PA10/).filter((i) => /astell/i.test(i.brand ?? ""));
  assert.equal(found.length, 1, found.map((i) => i.id).join(", "));
  assert.ok(!["dongle", "desktop"].includes(found[0].category), `${found[0].id} is ${found[0].category}`);
  assert.equal(found[0].role ?? "amp", "amp");
});
// aloaudio.com: USB-C dongle, ESS 9281AC Pro DAC, 3.5 + 4.4 mm out.
test("ALO Audio Pilot II is one model, a USB dongle DAC", { todo }, () => {
  const found = byTitle(/ALO Audio Pilot II/);
  assert.equal(found.length, 1, found.map((i) => i.id).join(", "));
  assert.equal(found[0].category, "dongle");
});
// acoustune.jp/as2002: USB-C dongle with an AK4493S DAC.
test("Acoustune AS2000 and AS2002 are portable DACs, not desktop units", { todo }, () => {
  const found = byTitle(/Acoustune AS200[02]/);
  assert.ok(found.length);
  for (const i of found) assert.equal(i.category, "dongle", i.id);
});

// Whole catalog: the same brand and model name once colours, "wireless",
// "edition", "class-a", spacing and the like are ignored is one model.
const SAME_NOISE = /\b(portable|desktop|headphones?|amplifier|amp|usb|dac|class[- ]?a|balanced|jack|4\.4mm|3\.5mm|with|and|the|for|in-?ear|iems?|earphones?|monitors?|universal|wireless|bluetooth|hifi|hi-fi|edition|version|new|black|silver|white|grey|gray|blue|red|open box|demo unit)\b/gi;
// A cartridge's colour is its model (Ortofon 2M Red / Blue / Black), and a
// wireless model is not the wired one of the same name (HiFiMAN Svanar Wireless).
const COLOUR = /^(black|silver|white|grey|gray|blue|red)$/i;
const sameKey = (i) => {
  const name = (i.model ?? i.id.split("--")[1] ?? "").toLowerCase().replace(/[-_]/g, " ");
  // iFi's "Blue" models are its Bluetooth line (ZEN Blue, ZEN Air Blue), not a finish.
  const kept = name.replace(SAME_NOISE, (w) => ((i.category === "cartridge" && COLOUR.test(w)) || (i.brand === "iFi" && /^blue$/i.test(w)) ? w : " "));
  return `${(i.brand ?? "").toLowerCase()}|${kept.replace(/[^a-z0-9]+/g, "")}${i.category === "wireless" ? "~w" : ""}`;
};
// Pairs the rule above joins that really are different products.
const DIFFERENT = new Set([
  "ifi--zen-3|ifi--zen-blue-3",
  "ifi--zen-3|ifi--zen-blue-3-wireless",
  "ifi--zen-air-blue-hi-resolution|ifi--zen-air-hi-resolution", // ZEN Air Blue: the Bluetooth receiver
  "ifi--zen-air|ifi--zen-air-blue",
  "ifi--zen-blue-v2|ifi--zen-v2", // ZEN Blue V2 (Bluetooth) vs ZEN DAC V2
  "wiim--amp-pro-wireless|wiim--pro-wireless", // WiiM Amp Pro (streaming amp) vs WiiM Pro (streamer)
]);
test("no model is split across several entries (whole catalog)", { todo }, () => {
  const groups = new Map();
  for (const i of db.items) {
    const k = sameKey(i);
    if (k.split("|")[1].length < 2) continue;
    groups.set(k, [...(groups.get(k) ?? []), i.id]);
  }
  const split = [...groups.values()].filter((ids) => ids.length > 1 && !ids.slice(1).every((id) => DIFFERENT.has(`${ids[0]}|${id}`)));
  assert.deepEqual(split.map((ids) => ids.join(" = ")), []);
});

// ---------------------------------------------------------------- 7. pre-owned is used stock of the same model

test("PREOWNED (one word) is used stock, not a new model", { todo }, () => {
  const bad = db.items.filter((i) => /preowned/.test(i.id)).map((i) => i.id);
  assert.deepEqual(bad, []);
});
test("no model id carries a stock-condition word (pre-owned, open box, demo, discontinued...)", { todo }, () => {
  const bad = db.items.filter((i) => /(^|-)(pre-?owned|preowned|pre-?sale|pre-?order|open-box|b-stock|refurbished|demo|clearance|used|discontinued)(-|$)/.test(i.id)).map((i) => i.id);
  assert.deepEqual(bad, []);
});
test("'Pre Sale' is not part of a model name", { todo }, () => {
  const bad = db.items.filter((i) => /pre-?sale|pre-?order/.test(i.id)).map((i) => i.id);
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------- 8. the home-page dongle has a picture

test("every model has a photo (whole catalog)", { todo }, () => {
  assert.deepEqual(db.items.filter((i) => !i.image && !i.offers.some((o) => o.image)).map((i) => `${i.id} (${i.category})`), []);
});
test("Apple USB-C to 3.5 mm adapter has an image", { todo }, () => {
  const i = db.items.find((x) => x.id === "apple--c-to-adapter");
  assert.ok(i, "missing");
  assert.ok(i.image || i.offers.some((o) => o.image), "no image");
});
