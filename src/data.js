// Loads the catalog and turns catalog entries into the shapes calc.js expects.

import { powerCheck, outputImpedanceCheck } from "./calc.js?v=mv4m1luu";

export const HEADPHONE_CATS = new Set(["iem", "headphone"]);
export const SOURCE_CATS = new Set(["dongle", "portable", "desktop", "dap", "cd"]);

export async function loadData() {
  const [catalog, devices, zh, logos] = await Promise.all([
    fetch("data/catalog.json?v=mv4m1luu").then((r) => r.json()),
    fetch("data/devices.json?v=mv4m1luu").then((r) => r.json()),
    fetch("data/brands-zh.json?v=mv4m1luu").then((r) => r.json()).catch(() => ({ names: {} })),
    fetch("data/logos.json?v=mv4m1luu").then((r) => r.json()).catch(() => ({})),
  ]);
  const byId = new Map(catalog.items.map((i) => [i.id, i]));
  // Old ids (merged or renamed models) → the current id, and the reverse.
  const aliasesTo = new Map();
  for (const [from, to] of Object.entries(catalog.aliases ?? {})) aliasesTo.set(to, [...(aliasesTo.get(to) ?? []), from]);
  return { ...catalog, devices, byId, aliasesTo, zhNames: zh.names, logos };
}

let photos;
/** Extra store photos per item ({ store, url, src[] }), loaded on first use. */
export function loadPhotos() {
  photos ??= fetch("data/photos.json?v=mv4m1luu").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return photos;
}

/** Headphone numbers for calc.js, or null if not computable. Handles unit-less sensitivity. */
export function hpModel(item) {
  const z = item.specs?.impedance?.[0];
  const s = item.specs?.sensitivity?.[0];
  if (!z || !s) return null;
  const base = { impedance: [{ value: z.value, kind: z.kind }], driver: item.driver };
  if (s.unit) return { ...base, sensitivity: [{ value: s.value, unit: s.unit, kind: s.kind }], unitKnown: true };
  // Store didn't say dB/V or dB/mW. Keep both readings; callers decide.
  return {
    ...base,
    unitKnown: false,
    variants: ["dB/V", "dB/mW"].map((unit) => ({ ...base, sensitivity: [{ value: s.value, unit, kind: s.kind }] })),
  };
}

/** Outputs for calc.js. Curated entries have per-jack outputs; store-only entries get one unnamed output. */
export function sourceOutputs(item) {
  if (item.outputs?.length) return item.outputs;
  const power = item.specs?.power;
  if (!power?.length) return [];
  // Several gain modes or jacks may be listed: keep the highest figure per load.
  const best = new Map();
  for (const p of power) if (!best.has(p.load) || best.get(p.load).mw < p.mw) best.set(p.load, p);
  return [
    {
      jack: null,
      kind: "claimed",
      power: [...best.values()].map((p) => ({ load: p.load, mw: p.mw })),
      zout: item.specs?.zout?.[0]?.value ?? null,
      source: power[0].sources[0].url,
      fromStore: true,
    },
  ];
}

const ORDER = { ok: 0, overkill: 0, tight: 1, insufficient: 2, unknown: 3 };

/**
 * Best result across a source's outputs for a headphone.
 * With an unknown sensitivity unit, the answer stands only if both readings agree.
 */
export function evaluate(item, outputs, opts) {
  const hp = hpModel(item);
  if (!hp || !outputs.length) return { status: "unknown" };
  const runAll = (model) =>
    outputs
      .map((o) => ({ output: o, r: powerCheck(model, o, opts), z: outputImpedanceCheck(model, o) }))
      .filter((x) => x.r.status !== "unknown")
      .sort((a, b) => ORDER[a.r.status] - ORDER[b.r.status] || b.r.peakMargin - a.r.peakMargin)[0];
  if (hp.unitKnown) {
    const best = runAll(hp);
    return best ? { status: best.r.status, ...best } : { status: "unknown" };
  }
  const [asV, asMw] = hp.variants.map(runAll);
  if (!asV || !asMw) return { status: "unknown" };
  const same = group(asV.r.status) === group(asMw.r.status);
  return same
    ? { status: asV.r.status, ...asV, unitAmbiguous: true, alt: asMw }
    : { status: "ambiguous", ...asV, unitAmbiguous: true, alt: asMw };
}

const group = (s) => (s === "overkill" ? "ok" : s);

/** Cheapest new offer per currency, and all offers sorted by price. */
// Rough US dollars per unit, only to put offers in different currencies in
// order. Prices are always shown in the store's own currency.
const USD_PER = { USD: 1, SGD: 0.75, EUR: 1.1, GBP: 1.3, AUD: 0.66, CAD: 0.73, JPY: 0.0067, CNY: 0.14, THB: 0.03, MYR: 0.22, INR: 0.012 };
const approxUsd = (o) => o.price * (USD_PER[o.currency] ?? 1);

export function prices(item) {
  const offers = [...(item.offers ?? [])].filter((o) => o.price != null).sort((a, b) => approxUsd(a) - approxUsd(b));
  const ok = offers.filter((o) => !o.suspect);
  const cheapest = ok.find((o) => o.condition === "new" && o.available) ?? ok.find((o) => o.condition === "new") ?? ok[0];
  return { offers, cheapest };
}

export function displayName(item) {
  return item.brand ? `${item.brand} ${item.model}` : item.model;
}
