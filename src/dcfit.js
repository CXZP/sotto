// Shared by the catalog build and the site: does a DC supply suit a device?
// Voltage and current only; plug size and polarity are for the reader to check.

/**
 * Does this supply fit this device? "ok" (voltage matches, enough current),
 * "check_current" (voltage matches, current unknown on one side) or null.
 */
export function fits(supply, device) {
  if (!supply || !device) return null;
  if (device.usb) return null;
  // Voltages the supply can give, as {v, a?}; an adjustable range covers any wanted voltage in it.
  const wanted = device.range ? null : device.needs;
  const outs = supply.range
    ? wanted
      ? wanted.filter((n) => n.v >= supply.range[0] && n.v <= supply.range[1]).map((n) => ({ v: n.v }))
      : device.range[0] <= supply.range[1] && supply.range[0] <= device.range[1] ? [{ v: Math.max(device.range[0], supply.range[0]) }] : []
    : supply.outputs;
  const rank = { ok: 3, check_current: 2, low_current: 1 };
  let best = null;
  for (const o of outs) {
    const need = device.range ? (o.v >= device.range[0] && o.v <= device.range[1] ? { v: o.v } : null) : device.needs.find((n) => n.v === o.v);
    if (!need) continue;
    const status = o.a && need.a ? (o.a >= need.a ? "ok" : "low_current") : "check_current";
    const r = { status, v: o.v, ...(o.a ? { a: o.a } : {}), ...(need.a ? { need: need.a } : {}) };
    if (!best || rank[status] > rank[best.status]) best = r;
  }
  return best;
}
