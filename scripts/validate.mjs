// Validates data/*.json. Run: node scripts/validate.mjs
// Errors fail the run (CI blocks the PR). Warnings are printed for reviewers.

import { readFileSync } from "node:fs";
import { dbPerMwToDbPerV } from "../src/calc.js";

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const headphones = load("headphones.json");
const amps = load("amps.json");
const devices = load("devices.json");

const JACKS = ["3.5", "6.35", "4.4", "2.5", "xlr4"];
const KINDS = ["claimed", "measured"];
const ids = new Set();

function checkId(item, where) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id ?? "")) err(where, `id "${item.id}" must be kebab-case`);
  if (ids.has(item.id)) err(where, `duplicate id "${item.id}"`);
  ids.add(item.id);
}

function checkSource(url, where) {
  if (!url) return err(where, "missing source URL");
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") err(where, `source must be https: ${url}`);
  } catch {
    err(where, `invalid source URL: ${url}`);
  }
}

function checkKind(kind, where) {
  if (!KINDS.includes(kind)) err(where, `kind must be one of ${KINDS.join(", ")}`);
}

function checkNote(note, where) {
  if (note && (typeof note.th !== "string" || typeof note.en !== "string")) {
    err(where, "notes need both th and en text");
  }
}

for (const hp of headphones) {
  const where = `headphones/${hp.id}`;
  checkId(hp, where);
  if (!hp.brand || !hp.model) err(where, "brand and model are required");
  if (!["iem", "over-ear"].includes(hp.type)) err(where, `type "${hp.type}" must be iem or over-ear`);
  if (!["dynamic", "planar", "hybrid", "ba", "electrostatic"].includes(hp.driver)) err(where, `unknown driver "${hp.driver}"`);

  if (!hp.impedance?.length) err(where, "at least one impedance value is required");
  for (const z of hp.impedance ?? []) {
    if (!(z.value > 0)) err(where, "impedance must be a positive number");
    checkKind(z.kind, where);
    checkSource(z.source, where);
    checkNote(z.note, where);
  }

  if (!hp.sensitivity?.length) err(where, "at least one sensitivity value is required");
  const ohms = hp.impedance?.[0]?.value;
  const asDbPerV = [];
  for (const s of hp.sensitivity ?? []) {
    if (!["dB/V", "dB/mW"].includes(s.unit)) err(where, `sensitivity unit "${s.unit}" must be dB/V or dB/mW`);
    if (!(s.value > 60 && s.value < 140)) err(where, `sensitivity ${s.value} looks wrong`);
    checkKind(s.kind, where);
    checkSource(s.source, where);
    checkNote(s.note, where);
    if (ohms) asDbPerV.push({ ...s, dbPerV: s.unit === "dB/V" ? s.value : dbPerMwToDbPerV(s.value, ohms) });
  }
  // Disagreement between sources is useful information, not an error.
  if (asDbPerV.length > 1) {
    const values = asDbPerV.map((s) => s.dbPerV);
    const spread = Math.max(...values) - Math.min(...values);
    if (spread > 3) warn(where, `sources disagree on sensitivity by ${spread.toFixed(1)} dB (shown to users)`);
  }

  if (hp.stockPlug != null && !JACKS.includes(hp.stockPlug)) err(where, `stockPlug "${hp.stockPlug}" is not a known jack`);
  if (hp.stockPlug != null && !hp.stockPlugSource) warn(where, "stockPlug has no source");
  for (const n of hp.notes ?? []) {
    checkNote(n, where);
    if (n.source) checkSource(n.source, where);
  }
}

function checkOutputs(outputs, where) {
  for (const o of outputs) {
    const w = `${where} [${o.jack}]`;
    if (!JACKS.includes(o.jack)) err(w, `unknown jack "${o.jack}"`);
    checkKind(o.kind, w);
    checkSource(o.source, w);
    checkNote(o.note, w);
    const hasData = o.power?.length || o.voltage?.length || o.vmax != null || o.vrules?.length;
    if (!hasData) err(w, "needs power[], voltage[], vmax or vrules");
    for (const p of o.voltage ?? []) {
      if (!(p.load > 0 && p.vrms > 0)) err(w, "voltage entries need positive load and vrms");
    }
    for (const p of o.power ?? []) {
      if (!(p.load > 0 && p.mw > 0)) err(w, "power entries need positive load and mw");
    }
    if (o.zout == null) warn(w, "output impedance unknown — the 1/8 rule check will be skipped");
  }
}

for (const amp of amps) {
  const where = `amps/${amp.id}`;
  checkId(amp, where);
  if (!["dongle", "desktop"].includes(amp.kind)) err(where, `kind "${amp.kind}" must be dongle or desktop`);
  if (!["usb-c", "usb", "usb-a"].includes(amp.input)) err(where, `unknown input "${amp.input}"`);
  if (!amp.outputs?.length) err(where, "at least one output is required");
  checkOutputs(amp.outputs ?? [], where);
  if (amp.price) checkSource(amp.price.source, where);
}

for (const dev of devices) {
  const where = `devices/${dev.id}`;
  checkId(dev, where);
  checkNote(dev.name, where);
  if (!["usb-c", "usb-a", "lightning"].includes(dev.port)) err(where, `unknown port "${dev.port}"`);
  checkOutputs(dev.outputs ?? [], where);
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(
  `\n${headphones.length} headphones, ${amps.length} amps, ${devices.length} devices — ` +
    `${errors.length} errors, ${warnings.length} warnings`,
);
process.exit(errors.length ? 1 : 0);
