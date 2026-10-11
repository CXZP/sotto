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
// Moon Audio's Dragon line and Kitsune's KTE phono stage are house brands
// that don't repeat the store name.
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

for (const re of [/Audio Research Reference 75 SE Amplifier/, /Audio Research Reference 150 SE Amplifier/, /Audio Research Reference 250 SE Amplifier/, /SABAJ A30A FDA Amplifier/])
  test(`speaker power amp, kept out of headphone maths: ${re.source}`, { todo }, () => {
    const found = byTitle(re);
    assert.ok(found.length, "listing missing");
    for (const i of found) assert.ok(!hpAmp(i), `${i.id} is desktop/${i.role}`);
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

test("Astell&Kern PA10 is one model, a portable amp (not a dongle)", { todo }, () => {
  const found = byTitle(/PA10/).filter((i) => /astell/i.test(i.brand ?? ""));
  assert.equal(found.length, 1, found.map((i) => i.id).join(", "));
  assert.notEqual(found[0].category, "dongle");
});
test("ALO Audio Pilot II is one model, a USB dongle DAC", { todo }, () => {
  const found = byTitle(/ALO Audio Pilot II/);
  assert.equal(found.length, 1, found.map((i) => i.id).join(", "));
  assert.equal(found[0].category, "dongle");
});
test("Acoustune AS2000 and AS2002 are portable DACs, not desktop units", { todo }, () => {
  const found = byTitle(/Acoustune AS200[02]/);
  assert.ok(found.length);
  for (const i of found) assert.equal(i.category, "dongle", i.id);
});

// ---------------------------------------------------------------- 7. pre-owned is used stock of the same model

test("PREOWNED (one word) is used stock, not a new model", { todo }, () => {
  const bad = db.items.filter((i) => /preowned/.test(i.id)).map((i) => i.id);
  assert.deepEqual(bad, []);
});
test("'Pre Sale' is not part of a model name", { todo }, () => {
  const bad = db.items.filter((i) => /pre-?sale|pre-?order/.test(i.id)).map((i) => i.id);
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------- 8. the home-page dongle has a picture

test("Apple USB-C to 3.5 mm adapter has an image", { todo }, () => {
  const i = db.items.find((x) => x.id === "apple--c-to-adapter");
  assert.ok(i, "missing");
  assert.ok(i.image || i.offers.some((o) => o.image), "no image");
});
