// How the boxes in a setup connect: source → (DAC) → (amp) → headphones.
// Pure functions; ports come from store spec lines and user reports.
// "unknown" means nobody has stated the port, never that it is missing.

export const DIGITAL = ["usb", "coax", "optical", "aes", "bt"];
export const ANALOG = ["rca", "xlr", "line"];

/** Virtual sources (phone, computer...) only have USB out to a DAC. */
const DEVICE_OUT = { "usb-c": ["usb"], "usb-a": ["usb"], lightning: ["usb"] };

/** Ports a stage offers or accepts: {in:Set, out:Set, known:boolean}. */
export function portsOf(stage, extra = null) {
  if (!stage) return null;
  if (stage.device) {
    const out = DEVICE_OUT[stage.device.port] ?? [];
    return { in: new Set(), out: new Set(out), known: true, adapter: stage.device.port === "lightning" ? "lightning-usb" : null };
  }
  const i = stage.item;
  const p = { in: new Set(Object.keys(i.ports?.in ?? {})), out: new Set(Object.keys(i.ports?.out ?? {})) };
  for (const r of extra ?? []) {
    for (const x of r.in ?? []) p.in.add(x);
    for (const x of r.out ?? []) p.out.add(x);
  }
  // Facts that hold for the whole category.
  if (i.category === "dongle" || i.input === "usb" || i.input === "usb-c") p.in.add("usb");
  return { ...p, known: p.in.size + p.out.size > 0 };
}

/**
 * The link between two stages.
 * kind "digital" (to a DAC) or "analog" (to an amp-only box).
 * status: ok | adapter | unknown | no | need_dac
 */
export function link(from, to, kind) {
  if (!from || !to) return null;
  const set = kind === "digital" ? DIGITAL : ANALOG;
  const outs = set.filter((x) => from.out.has(x));
  const ins = set.filter((x) => to.in.has(x));
  const common = outs.filter((x) => ins.includes(x));
  if (common.length) return { status: from.adapter ? "adapter" : "ok", via: common, adapter: from.adapter ?? null };
  if (kind === "analog") {
    // "Line out" without the connector named, or RCA on one side and XLR on the other:
    // these connect with the right cable, so it's a check, not a no.
    if ((outs.includes("line") && ins.length) || (ins.includes("line") && outs.length)) return { status: "unknown", via: [...new Set([...outs, ...ins])].filter((x) => x !== "line") };
    if (outs.length && ins.length) return { status: "adapter", via: [outs[0], ins[0]], adapter: `${outs[0]}-${ins[0]}` };
  }
  if (!outs.length || !ins.length) return { status: "unknown", via: [] };
  return { status: "no", via: [], outs, ins };
}

/**
 * The whole chain. stages: {source, dac?, amp?}; each stage is {device} or {item}.
 * Returns the links in order and which stage drives the headphones.
 */
export function chainLinks({ source, dac, amp }, reports = {}) {
  const P = (s) => portsOf(s, s?.item ? reports[s.item.id] : null);
  const links = [];
  const sourceIsDevice = !!source?.device;
  const ampOnly = amp?.item?.role === "amp";
  const dacIsDacOnly = dac?.item?.role === "dac";
  if (dac) {
    links.push({ from: source, to: dac, kind: "digital", ...link(P(source), P(dac), "digital") });
    // A DAC's output is analog, so whatever follows it takes a line input.
    if (amp) links.push({ from: dac, to: amp, kind: "analog", ...link(P(dac), P(amp), "analog") });
  } else if (amp) {
    if (ampOnly) {
      // An amp-only box needs an analog signal: a phone can't feed it, a CD player or DAP line out can.
      links.push({ from: source, to: amp, kind: "analog", ...(sourceIsDevice ? { status: "need_dac", via: [] } : link(P(source), P(amp), "analog")) });
    } else links.push({ from: source, to: amp, kind: "digital", ...link(P(source), P(amp), "digital") });
  }
  const driver = amp ?? (dac && !dacIsDacOnly ? dac : null) ?? (dac ? null : source);
  return { links, driver, dacOnlyLast: !!dac && dacIsDacOnly && !amp };
}
