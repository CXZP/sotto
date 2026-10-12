// Store-title rules from the ERRORS.pdf review, checked on titles alone (no crawl needed).

import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, titleRole, deskRole, modelKey, looseKey, jpModelTitle, condition } from "../scripts/lib/classify.js";

const cat = (title, extra = {}) => classify({ title, ...extra });

test("parts, care items and merch are not products", () => {
  for (const t of ["64 Audio Apex Modules", "Audeze Headphone Leather Care Kit", "Audeze Maxwell 2 ANC Replacement Dongle", "64 Audio High Fidelity Earplugs", "Rega Planar 6 Feet", "Cayin C201 Module (For N6III)"])
    assert.equal(cat(t), "accessory", t);
  for (const t of ["Headphones.com Unisex Tee", "HiFiGo Mystery Box", "TEAC CG-10M Master Clock Generator", "Matrix Audio SI-1 | Network Isolator", "Anthem AVM 70 Preamp/Processor"])
    assert.equal(cat(t), "skip", t);
});

test("products that only mention a part stay products", () => {
  assert.equal(cat("64 Audio Volür Universal In-Ear Monitor (Includes m12 Apex Module)"), "iem");
  assert.equal(cat("TOPPING L50 Headphone Amp NFCA Modules"), "desktop");
  assert.equal(cat("Cayin HA-1A MK3 Vacuum Tube Headphone Amplifier"), "desktop");
  assert.equal(cat("QDC Anole VX Earplugs Custom Earphones High-end Flagship"), "iem");
  assert.equal(cat("Etymotic MK5 Isolator Earphones"), "iem");
});

test("form factors: radio, portable amp, CD player, cartridge vs turntable", () => {
  assert.equal(cat("FiiO RR13 Portable Radio"), "dap");
  assert.equal(cat("Astell&Kern PA10 | Portable Class-A Headphone Amp"), "portable");
  assert.equal(cat("iBasso PB6 Macaw | Balanced Portable Tube Amp"), "portable");
  assert.equal(cat("Audio Research Reference CD9 Compact Disc Player/DAC"), "cd");
  assert.equal(cat("Ortofon MC Cadenza Red Turntable Cartridge"), "cartridge");
  assert.equal(cat("Music Hall MMF-1.5 Turntable With Music Hall Melody Cartridge"), "turntable");
  assert.equal(cat("Acoustune AS2002", { tags: ["Portable-DAC-Amps"] }), "dongle");
  assert.equal(cat("Audio-Technica ATH-M20x Studio Monitor Headphones"), "headphone");
});

test("speaker amps, streamers and preamps get their own role", () => {
  assert.equal(titleRole("Cambridge Audio EVO 300 Streaming Amplifier"), "integrated");
  assert.equal(titleRole("NAD C 3050 Stereophonic Amplifier with MDC2"), "integrated");
  assert.equal(titleRole("WiiM - Amp Ultra"), "integrated");
  assert.equal(titleRole("iFi NEO Stream High-resolution Wi-Fi Audio Transport and DAC"), "streamer");
  assert.equal(titleRole("McIntosh MC152 150 Watt Stereo Amplifier"), "poweramp");
  assert.equal(titleRole("Mark Levinson ML-50 Monaural Amplifier - Pair"), "poweramp");
  assert.equal(titleRole("XP-12 Line Level Preamplifier"), "preamp");
  assert.equal(titleRole("Benchmark LA4 Line Amplifier"), "preamp");
  assert.equal(titleRole("AUDALYTIC AH90 AK4191+AK4499 Desktop DAC & Headphone Amplifier"), "dacamp");
  // An amp that is also a preamp is still a headphone amp.
  assert.notEqual(titleRole("Violectric HPA V550 Amp/Preamp"), "preamp");
  assert.notEqual(titleRole("Woo Audio WA22 (2nd gen) Balanced Amp and Preamp"), "preamp");
  // "KBEAR Streamer" is an IEM.
  assert.equal(cat("【KBEAR Streamer——Clearance】Handmade Molded 1DD HiFi IEM Headphones"), "iem");
});

test("a bare 'Amplifier' title is a speaker amp only when the description says speakers", () => {
  const body = "<p>Features KT150 vacuum tube to deliver power from the amplifier to your speakers.</p>";
  assert.equal(deskRole({ title: "Audio Research Reference 75 SE Amplifier", body }), "poweramp");
  assert.notEqual(deskRole({ title: "Burson Audio Soloist GT4 Headphone Amplifier", body: "<p>Speaker outputs on the back.</p>" }), "poweramp");
});

test("one model, one key: finishes, editions, stock words and store descriptions", () => {
  const k = (v, t, c = "headphone") => looseKey(modelKey(v, t).key, c);
  assert.equal(k("KEF", "KEF Q350 Black"), k("KEF", "KEF Q350"));
  assert.equal(k("Final Audio", "Final Audio D8000 Pro Edition"), k("Final Audio", "Final Audio D8000 Pro"));
  assert.equal(k("Topping", "Topping A900 PREOWNED | Desktop Headphone Amplifier", "desktop"), k("Topping", "Topping A900", "desktop"));
  assert.equal(k("ALO Audio", "ALO Audio Pilot II | Portable Balanced USB DAC", "dongle"), k("ALO Audio", "ALO Audio Pilot II USB DAC with Balanced 4.4mm Jack", "dongle"));
  assert.equal(k("iFi", "iFi ZEN DAC v3", "desktop"), k("iFi", "iFi ZEN DAC 3", "desktop"));
  // Different products stay apart.
  assert.notEqual(k("Ortofon", "Ortofon 2M Red Cartridge", "cartridge"), k("Ortofon", "Ortofon 2M Blue Cartridge", "cartridge"));
  assert.notEqual(k("HIFIMAN", "HIFIMAN Svanar Wireless", "wireless"), k("HIFIMAN", "HIFIMAN Svanar", "iem"));
  assert.notEqual(k("iFi", "iFi ZEN Air Blue", "desktop"), k("iFi", "iFi ZEN Air DAC", "desktop"));
  assert.notEqual(k("WiiM", "WiiM Amp Pro Wireless Streaming Amplifier", "desktop"), k("WiiM", "WiiM Pro Wireless Audio Streamer", "desktop"));
  assert.notEqual(k("DCS", "Lina DAC X Streaming Music Player", "desktop"), k("DCS", "Lina Headphone Amplifier", "desktop"));
  assert.notEqual(k("iFi", "iFi ZEN Air Phono Preamplifier", "phono"), k("iFi", "iFi ZEN Air DAC", "desktop"));
});

test("Japanese store titles: the model name, or nothing for parts and incomplete units", () => {
  assert.equal(jpModelTitle("【中古】SE846+UNI ブラック 【SE846BABK+UNI-A】【名古屋】"), "SE846+UNI");
  assert.equal(jpModelTitle("【中古】Px7 S3 アンスラサイト・ブラック【PX7S3/AB】【日本橋】"), "Px7 S3");
  assert.equal(jpModelTitle("【中古】RU9 ポータブルNutube USB DAC/アンプ【日本橋】"), "RU9 Nutube USB DAC/");
  assert.equal(jpModelTitle("【中古】Lotoo ICS-PG1 PAW Gold用レザーケース【秋葉原】"), null);
  assert.equal(jpModelTitle("DT 880 32Ohm用ドライバー 1個【980287】"), null);
  assert.equal(jpModelTitle("【中古】MDR-7506(イヤーパッド欠品)【日本橋】"), null);
  assert.equal(condition("【中古】KA17 Black 【FIO-KA17-B】【秋葉原】"), "open-box/used");
  assert.equal(condition("DC-Tonfa"), "new");
});

test("a store category that names the kind wins, unless the title says part or cable", () => {
  assert.equal(cat("Allnic HPA-15000", { kind: "desktop", type: "TUBE HEADPHONES AMPLIFIERS" }), "desktop");
  assert.equal(cat("FiiO QX11 DAC-Amp", { kind: "dongle" }), "dongle");
  assert.equal(cat("FiiO KA17 USB-C Cable", { kind: "dongle" }), "cable");
});

test("wireless earphones: one model whatever the store adds, tips for them are accessories", () => {
  const k = (v, t) => looseKey(modelKey(v, t).key, "wireless");
  assert.equal(k("Sony", "Sony WF-1000XM5 Truly Wireless Noise Canceling"), k("Sony", "Sony WF-1000XM5 Noise Cancellation True Wireless"));
  assert.equal(k("Moondrop", "Moondrop Pudding TWS"), k("Moondrop", "Moondrop Pudding True Wireless"));
  assert.equal(cat("HONKAI: STAR RAIL × MOONDROP Sparxie RT-Adaptive ANC Mini Hi-Fi TWS"), "wireless");
  assert.equal(cat("AZLA SednaEarfit Crystal for TWS"), "accessory");
  assert.equal(cat("Moondrop EVO II / EVO 2 Wireless Ear-hook DAC & AMP"), "dongle");
});

test("wireless: \"for ASMR\" is the ASMR model; ear loops are accessories", () => {
  const k = (v, t) => looseKey(modelKey(v, t).key, "wireless");
  assert.equal(k("Final Audio", "Final Audio ZE500 for ASMR True Wireless"), k("Final Audio", "Final Audio ZE500 ASMR True Wireless"));
  assert.equal(cat("iFi GO pod Ear Loops"), "accessory");
});

test("power supplies: one model whatever the store's description", () => {
  const k = (v, t) => looseKey(modelKey(v, t).key, "power");
  assert.equal(k("FiiO", "FiiO Darkside Pro Linear Power Supply"), k("FiiO", "Fiio Darkside Pro low-noise regulated linear power supply"));
  assert.equal(k("FiiO", "FiiO Darkside Mini Noise Reduction Power Supply"), k("FiiO", "Fiio Darkside Mini Active purification & Noise Cancelling Power Supply (UK plug version)"));
  assert.notEqual(k("FiiO", "FiiO Darkside Pro Linear Power Supply"), k("FiiO", "FiiO Darkside Mini Noise Reduction Power Supply"));
});

test("store words around DAC and TWS names don't split a model", () => {
  const k = (v, t, c) => looseKey(modelKey(v, t).key, c);
  const r26 = k("Gustard", "Gustard R26II", "desktop");
  assert.equal(k("Gustard", "Gustard R26 II / R26II Decoder 26 Bit Network Streamng DAC Fully Discrete R2R BT5.1 with Remote Control", "desktop"), r26);
  assert.equal(k("Gustard", "Gustard R26 Il Discrete R2R Network Streaming DAC", "desktop"), r26);
  assert.notEqual(k("Gustard", "GUSTARD R26 R2R Digital to Analog Convertor (DAC)", "desktop"), r26);
  assert.notEqual(k("FiiO", "FiiO K11 R2R", "desktop"), k("FiiO", "FiiO K11", "desktop"));
  const x30 = k("Gustard", "GUSTARD DAC-X30", "desktop");
  assert.equal(k("Gustard", "Gustard X30 Quad ES9039SPRO*4 Network Streaming Decoder Desktop DAC", "desktop"), x30);
  assert.equal(k("Gustard", "GUSTARD X30 4xES9039SPRO Streamer Digital to Analog Convertor (DAC)", "desktop"), x30);
  // A bare "Moondrop Ultrasonic" stays apart: without "true wireless" we can't tell earbuds from an over-ear.
  const us = k("Moondrop", "Moondrop Ultrasonic TWS", "wireless");
  assert.equal(k("Moondrop", "Moondrop UltraSonic Bluetooth 5.3 Hybrid Hi-Fi ANC True Wireless Earbuds", "wireless"), us);
  assert.equal(k("Moondrop", "MOONDROP ULTRASONIC 1BA+1DD True Wireless Headphone (TWS)", "wireless"), us);
  assert.equal(cat("MoonDrop ULTRASONIC True Wireless Earphones with Active Noise Cancellation"), "wireless");
});

test("near names that are different products stay apart", () => {
  const k = (v, t, c) => looseKey(modelKey(v, t).key, c);
  assert.notEqual(k("Mark Levinson", "Mark Levinson No. 585.5 Integrated Amplifier", "desktop"), k("Mark Levinson", "Mark Levinson No. 585 Integrated Amplifier", "desktop"));
  assert.notEqual(k("Sennheiser", "Sennheiser ACCENTUM OPEN True Wireless Earbuds", "wireless"), k("Sennheiser", "Sennheiser Accentum True Wireless Earphones", "wireless"));
  assert.notEqual(k("Sennheiser", "Sennheiser Momentum 4 Wireless Headphones", "wireless"), k("Sennheiser", "Sennheiser MOMENTUM True Wireless 4", "wireless"));
  assert.equal(k("Sony", "Sony WF-1000XM5 Truly Wireless Noise Canceling", "wireless"), k("Sony", "Sony WF-1000XM5 Noise Cancellation True Wireless", "wireless"));
});

test("a bundle of two products is skipped; Warmer R2R Tube DAC is the Warmer R2R; QR65 is speakers", () => {
  assert.equal(classify({ title: "Moondrop - Chu III + FiiO - BTR11" }), "skip");
  assert.equal(looseKey(modelKey("FiiO", "FiiO WARMER R2R Tube DAC").key, "desktop"), looseKey(modelKey("FiiO", "FiiO Warmer R2R | Desktop R2R DAC and Tube Buffer").key, "desktop"));
  assert.notEqual(looseKey("pro-ject--tube-box-ds3-b", "desktop"), looseKey("pro-ject--box-ds3-b", "desktop"));
  assert.equal(classify({ title: "Edifier QR65 Active Wireless Speakers with GaN Charger" }), "speaker");
  assert.equal(modelKey("Edifier", "Edifier QR65 Active Wireless Speakers with GaN Charger").model, "QR65");
});

test("not bundles, not merged: iFi iDSD GR 2 MT is one product; Little Dot I+ Tube is not the DAC I", () => {
  assert.equal(classify({ title: "iFi iDSD GR 2 MT - Ultra-Res Portable DAC + Headphone Amp - Master Tuned Series" }) === "skip", false);
  assert.notEqual(looseKey(modelKey("Little Dot", "LITTLEDOT I+ Tube Headphone Amplifier").key, "desktop"), looseKey("little-dot--dac-i", "desktop"));
  assert.equal(looseKey(modelKey("Cayin", "Cayin HA-1A MK3 Tube Headphone Amplifier").key, "desktop"), looseKey("cayin--ha-1a-mk3", "desktop"));
});

test("a store's own bundle with another brand's DAC is still a bundle", () => {
  assert.equal(classify({ title: "Moondrop - Chu III + Headphone Zone X ddHiFi - Hi-Res DAC" }), "skip");
  assert.notEqual(classify({ title: "iFi iDSD GR 2 MT - Ultra-Res Portable DAC + Headphone Amp - Master Tuned Series" }), "skip");
});
