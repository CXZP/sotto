// How the boxes in a setup connect: source → (DAC or phono stage) → (amp) → headphones.
// Pure functions; ports come from store spec lines and user reports.
// "unknown" means nobody has stated the port, never that it is missing.

export const DIGITAL = ["usb", "coax", "optical", "aes", "bt"];
export const ANALOG = ["rca", "xlr", "line", "phono"];

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
  // A turntable's own output is phono level; one with a built-in phono stage
  // also gives line level on RCA.
  if (i.category === "turntable") {
    p.out.add("phono");
    if (i.features?.phono_pre) p.out.add("rca");
  }
  if (i.category === "phono") {
    p.in.add("phono");
    if (![...p.out].some((x) => ANALOG.includes(x) && x !== "phono")) p.out.add("rca");
  }
  return { ...p, known: p.in.size + p.out.size > 0 };
}

/**
 * The link between two stages.
 * kind "digital" (to a DAC) or "analog" (to an amp or phono stage).
 * status: ok | adapter | unknown | no | need_dac | need_phono
 */
export function link(from, to, kind) {
  if (!from || !to) return null;
  const set = kind === "digital" ? DIGITAL : ANALOG;
  const outs = set.filter((x) => from.out.has(x));
  const ins = set.filter((x) => to.in.has(x));
  const common = outs.filter((x) => ins.includes(x));
  if (common.length) return { status: from.adapter ? "adapter" : "ok", via: common, adapter: from.adapter ?? null };
  if (kind === "analog") {
    // Phono level is a few millivolts with the RIAA curve still on it: a line
    // input can't use it, no cable fixes that.
    if (outs.length && outs.every((x) => x === "phono")) return { status: "need_phono", via: [] };
    const lineOuts = outs.filter((x) => x !== "phono");
    const lineIns = ins.filter((x) => x !== "phono");
    // "Line out" without the connector named, or RCA on one side and XLR on the other:
    // these connect with the right cable, so it's a check, not a no.
    if ((lineOuts.includes("line") && lineIns.length) || (lineIns.includes("line") && lineOuts.length)) return { status: "unknown", via: [...new Set([...lineOuts, ...lineIns])].filter((x) => x !== "line") };
    if (lineOuts.length && lineIns.length) return { status: "adapter", via: [lineOuts[0], lineIns[0]], adapter: `${lineOuts[0]}-${lineIns[0]}` };
  }
  if (!outs.length || !ins.length) return { status: "unknown", via: [] };
  return { status: "no", via: [], outs, ins };
}

/**
 * Does the phono stage suit the cartridge? MC cartridges give a tenth of the
 * voltage of MM ones, so an MM-only stage needs a step-up transformer (SUT).
 * status: ok | need_mc | check
 */
export function cartridgeFit(cart, stage) {
  if (!cart?.cart || !stage) return null;
  if (cart.cart !== "mc") return { status: "ok" };
  const ins = stage.phonoIn ?? null;
  if (!ins) return { status: "check" };
  return ins.includes("mc") ? { status: "ok" } : { status: "need_mc" };
}

/**
 * The whole chain. stages: {source, dac?, amp?, cart?}; each stage is {device} or {item}.
 * Returns the links in order and which stage drives the headphones.
 */
export function chainLinks({ source, dac, amp, cart }, reports = {}) {
  const P = (s) => portsOf(s, s?.item ? reports[s.item.id] : null);
  const links = [];
  const sourceIsDevice = !!source?.device;
  const vinyl = source?.item?.category === "turntable";
  const ampOnly = amp?.item?.role === "amp" || amp?.item?.role === "preamp";
  const phonoBox = dac?.item?.category === "phono";
  const dacIsDacOnly = dac?.item?.role === "dac" || phonoBox;
  if (dac) {
    // A phono stage takes the turntable's analog signal; a DAC takes digital.
    links.push({ from: source, to: dac, kind: phonoBox ? "analog" : "digital", ...link(P(source), P(dac), phonoBox ? "analog" : "digital") });
    // A DAC's (or phono stage's) output is analog, so whatever follows it takes a line input.
    if (amp) links.push({ from: dac, to: amp, kind: "analog", ...link(P(dac), P(amp), "analog") });
  } else if (amp) {
    if (ampOnly || vinyl) {
      // An amp-only box needs an analog signal: a phone can't feed it, a CD player or DAP line out can.
      links.push({ from: source, to: amp, kind: "analog", ...(sourceIsDevice ? { status: "need_dac", via: [] } : link(P(source), P(amp), "analog")) });
    } else links.push({ from: source, to: amp, kind: "digital", ...link(P(source), P(amp), "digital") });
  }
  const driver = amp ?? (dac && !dacIsDacOnly ? dac : null) ?? (dac ? null : source);
  // Where the cartridge's signal is amplified: the phono stage, else an amp with a phono input.
  const phonoStage = phonoBox ? dac.item : amp?.item && P(amp)?.in.has("phono") ? amp.item : null;
  return {
    links,
    driver,
    dacOnlyLast: !!dac && dacIsDacOnly && !amp,
    // A line preamp has no headphone output.
    preampLast: amp?.item?.role === "preamp",
    // A turntable on its own can't drive headphones.
    vinylAlone: vinyl && !dac && !amp,
    cart: vinyl && cart?.item ? cartridgeFit(cart.item, phonoStage) : null,
  };
}
