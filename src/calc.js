// Sotto calculation core.
// Pure functions only: no DOM, no network. Everything here is deterministic
// and covered by tests/calc.test.mjs.

/** Sensitivity in dB SPL per 1 Vrms, from a dB/mW figure and impedance. */
export function dbPerMwToDbPerV(dbPerMw, ohms) {
  // 1 Vrms into Z ohms dissipates 1000/Z mW.
  return dbPerMw + 10 * Math.log10(1000 / ohms);
}

export function dbPerVToDbPerMw(dbPerV, ohms) {
  return dbPerV - 10 * Math.log10(1000 / ohms);
}

/**
 * Pick the value to calculate with: a measured value beats a claimed one.
 * Each entry: { value, kind: "measured" | "claimed", ... }.
 */
export function pickSpec(entries) {
  if (!entries || entries.length === 0) return null;
  return entries.find((e) => e.kind === "measured") ?? entries[0];
}

/** Sensitivity entry normalised to dB/V (needs impedance for dB/mW). */
export function sensitivityDbPerV(entry, ohms) {
  if (!entry) return null;
  if (entry.unit === "dB/V") return entry.value;
  if (entry.unit === "dB/mW") return dbPerMwToDbPerV(entry.value, ohms);
  throw new Error(`Unknown sensitivity unit: ${entry.unit}`);
}

/** Headphone's effective numbers: { ohms, dbPerV, impedanceEntry, sensitivityEntry }. */
export function headphoneSpecs(hp) {
  const impedanceEntry = pickSpec(hp.impedance);
  const ohms = impedanceEntry?.value ?? null;
  // Prefer a measured dB/V; otherwise convert whatever is claimed.
  const sensitivityEntry = pickSpec(hp.sensitivity);
  const dbPerV = ohms ? sensitivityDbPerV(sensitivityEntry, ohms) : null;
  return { ohms, dbPerV, impedanceEntry, sensitivityEntry };
}

/** Voltage, current and power needed for a target SPL. */
export function required(splDb, dbPerV, ohms) {
  const vrms = 10 ** ((splDb - dbPerV) / 20);
  return { vrms, ma: (vrms / ohms) * 1000, mw: ((vrms * vrms) / ohms) * 1000 };
}

/**
 * Estimate the voltage an output can deliver into a load of `ohms`.
 *
 * Data an output may carry:
 *  - power: [{ load, mw }]  rated power per channel at given loads
 *  - vmax:  maximum output voltage (Vrms), e.g. unloaded or measured clip point
 *  - vrules: [{ maxLoad, vrms }] devices that switch voltage by detected load
 *  - zout:  output impedance in ohms
 *
 * Returns { vrms, method } where method says how the number was obtained,
 * so the UI can be honest about interpolation and extrapolation.
 */
export function availableVrms(output, ohms) {
  if (output.vrules?.length) {
    const rule =
      output.vrules.find((r) => ohms < r.maxLoad) ?? output.vrules[output.vrules.length - 1];
    return { vrms: divider(rule.vrms, output.zout, ohms), method: "vrule" };
  }

  const points = [
    ...(output.power ?? []).map((p) => ({ load: p.load, v: Math.sqrt((p.mw / 1000) * p.load) })),
    ...(output.voltage ?? []).map((p) => ({ load: p.load, v: p.vrms })),
  ].sort((a, b) => a.load - b.load);

  if (points.length === 0) {
    if (output.vmax == null) return { vrms: null, method: "none" };
    return { vrms: divider(output.vmax, output.zout, ohms), method: "vmax" };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const cap = output.vmax ?? Infinity;

  if (ohms <= first.load) {
    // Below the lowest rated load: assume the output is current-limited.
    const current = first.v / first.load;
    return { vrms: Math.min(current * ohms, first.v), method: ohms === first.load ? "rated" : "extrapolated" };
  }
  if (ohms >= last.load) {
    if (ohms === last.load) return { vrms: last.v, method: "rated" };
    // Above the highest rated load: voltage can rise at most until vmax.
    // Without vmax we stay at the last rated voltage (conservative).
    const current = last.v / last.load;
    const v = Number.isFinite(cap) ? Math.max(last.v, Math.min(cap, current * ohms)) : last.v;
    return { vrms: v, method: "extrapolated" };
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (ohms >= a.load && ohms <= b.load) {
      if (ohms === a.load) return { vrms: a.v, method: "rated" };
      if (ohms === b.load) return { vrms: b.v, method: "rated" };
      // Interpolate on log-log axes: V ~ R^k between two rated points.
      const k = Math.log(b.v / a.v) / Math.log(b.load / a.load);
      return { vrms: Math.min(a.v * (ohms / a.load) ** k, cap), method: "interpolated" };
    }
  }
  return { vrms: null, method: "none" };
}

// Voltage across the headphone when the source voltage is an open-circuit figure.
function divider(v, zout, ohms) {
  if (!zout) return v;
  return (v * ohms) / (ohms + zout);
}

export const OVERKILL_SPL = 130;

/** dB difference between what is available and what is needed. */
export function headroomDb(availableV, requiredV) {
  return 20 * Math.log10(availableV / requiredV);
}

/**
 * Full power check.
 * level: average listening level in dB SPL; crest: extra dB for peaks.
 */
export function powerCheck(hp, output, { level = 80, crest = 15 } = {}) {
  const { ohms, dbPerV } = headphoneSpecs(hp);
  if (!ohms || dbPerV == null) return { status: "unknown", reason: "headphone-specs" };

  const avail = availableVrms(output, ohms);
  if (avail.vrms == null) return { status: "unknown", reason: "source-specs" };

  const avg = required(level, dbPerV, ohms);
  const peak = required(level + crest, dbPerV, ohms);
  const peakMargin = headroomDb(avail.vrms, peak.vrms);
  const avgMargin = headroomDb(avail.vrms, avg.vrms);
  const maxSpl = dbPerV + 20 * Math.log10(avail.vrms);

  let status;
  if (avgMargin < 0) status = "insufficient"; // cannot even reach the average level
  else if (peakMargin < 0) status = "tight"; // average fine, loud peaks clip
  // Works, but the chain can get dangerously loud: a volume slip past ~130 dB SPL
  // is painful and can damage hearing or drivers. A big margin alone is not a
  // risk (an HD 600 on a desktop amp is normal); reachable loudness is.
  else if (maxSpl > OVERKILL_SPL) status = "overkill";
  else status = "ok";

  return {
    status,
    ohms,
    dbPerV,
    level,
    crest,
    avg,
    peak,
    available: avail,
    peakMargin,
    avgMargin,
    maxSpl,
  };
}

/** Output impedance check (the "1/8 rule"). */
export function outputImpedanceCheck(hp, output) {
  const { ohms } = headphoneSpecs(hp);
  if (output.zout == null || !ohms) return { status: "unknown" };
  const ratio = ohms / output.zout;
  const multiDriver = hp.driver === "hybrid" || hp.driver === "ba";
  if (ratio >= 8) return { status: "ok", ratio };
  return { status: multiDriver ? "warn-strong" : "warn", ratio };
}

// ---------------------------------------------------------------------------
// Connections

export const JACKS = {
  "3.5": { balanced: false },
  "6.35": { balanced: false },
  "4.4": { balanced: true },
  "2.5": { balanced: true },
  xlr4: { balanced: true },
};

/**
 * What it takes to plug a headphone with plug `plug` into an output jack `jack`.
 * Returns { status: "direct" | "adapter" | "danger" | "no", adapter?, note }.
 */
export function plugInto(plug, jack) {
  if (plug === jack) return { status: "direct" };
  const p = JACKS[plug];
  const j = JACKS[jack];
  if (!p || !j) return { status: "no" };

  if (!p.balanced && !j.balanced) {
    // 3.5 <-> 6.35: passive plug adapter, no electrical change.
    return { status: "adapter", adapter: `${plug}F-${jack}M`, note: "se-size" };
  }
  if (p.balanced && j.balanced) {
    // 4.4 <-> XLR4 <-> 2.5: same four wires, different shell.
    return { status: "adapter", adapter: `${plug}F-${jack}M`, note: "bal-bal" };
  }
  if (p.balanced && !j.balanced) {
    // Balanced cable into a single-ended jack: the adapter joins L- and R- to
    // ground at the plug. The headphone simply runs single-ended. Safe.
    return { status: "adapter", adapter: `${plug}F-${jack}M`, note: "bal-into-se" };
  }
  // Single-ended plug into a balanced jack: the shared ground ties the amp's
  // negative outputs together/to ground. Can damage amps not designed for it.
  return { status: "danger", adapter: `${plug}F-${jack}M`, note: "se-into-bal" };
}

/** Best way to connect a plug to any of an amp's outputs, safest first. */
export function bestConnection(plug, outputs) {
  const rank = { direct: 0, adapter: 1, danger: 2, no: 3 };
  return outputs
    .map((output) => ({ output, ...plugInto(plug, output.jack) }))
    .sort((a, b) => rank[a.status] - rank[b.status] || balancedFirst(a, b))[0];
}

function balancedFirst(a, b) {
  return Number(JACKS[b.output.jack]?.balanced ?? 0) - Number(JACKS[a.output.jack]?.balanced ?? 0);
}

/** What links the playback device to a USB DAC. */
export function deviceToDac(device, dac) {
  if (!dac || dac.kind === "builtin") return { status: "direct" };
  const port = device.port;
  if (port === "usb-c" || port === "usb-a") return { status: "direct", note: `usb-${port}` };
  if (port === "lightning") return { status: "adapter", adapter: "lightning-usb", note: "lightning" };
  return { status: "no" };
}
