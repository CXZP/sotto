// Real-price maths for marketplace checkouts (Shopee, Lazada, ...). Pure functions.
//
// A marketplace list price is not the price people pay: shops list high, then
// buyers stack a shop code and a platform code. Each code has a percentage (or
// a flat amount), a minimum spend and a cap. The cap decides the real value:
// above cap / pct, a "30%" code is a fixed discount.
//
// Assumed order (shown to the user): shop code first, then the platform code,
// whose minimum spend is checked against the price after the shop code.

/** @typedef {{kind: "shop"|"platform", pct?: number, off?: number, min?: number, cap?: number}} Code */

/** Discount one code gives on `price`, or why it doesn't apply. */
export function applyCode(price, code) {
  const min = code.min ?? 0;
  if (price < min) return { eligible: false, discount: 0, shortfall: round(min - price) };
  let d = code.pct ? (price * code.pct) / 100 : (code.off ?? 0);
  if (code.cap != null && code.pct) d = Math.min(d, code.cap);
  d = Math.min(d, price);
  return { eligible: true, discount: round(d), capped: code.pct != null && code.cap != null && (price * code.pct) / 100 > code.cap };
}

/** Price above which a percentage code stops growing (its cap kicks in). */
export function capPoint(code) {
  if (!code.pct || code.cap == null) return null;
  return round((code.cap * 100) / code.pct);
}

/**
 * Every allowed combination (at most one shop code + one platform code),
 * cheapest first. `price` is what the app shows before codes.
 */
export function combos(price, codes, { shipping = 0 } = {}) {
  const shop = [null, ...codes.filter((c) => c.kind === "shop")];
  const plat = [null, ...codes.filter((c) => c.kind !== "shop")];
  const out = [];
  for (const s of shop)
    for (const p of plat) {
      const a = s ? applyCode(price, s) : null;
      const afterShop = price - (a?.eligible ? a.discount : 0);
      const b = p ? applyCode(afterShop, p) : null;
      const discount = (a?.eligible ? a.discount : 0) + (b?.eligible ? b.discount : 0);
      out.push({
        shop: s,
        platform: p,
        steps: [a, b],
        valid: (!a || a.eligible) && (!b || b.eligible),
        discount: round(discount),
        final: round(price - discount + shipping),
        pct: price ? round((discount / price) * 100, 1) : 0,
      });
    }
  return out.sort((x, y) => Number(y.valid) - Number(x.valid) || x.final - y.final);
}

/** Read a code the way apps print it: "ลด 30% ขั้นต่ำ ฿954 ลดสูงสุด ฿4,000", "15% off min spend 500 capped at 300". */
export function parseCode(text, kind = "platform") {
  const s = String(text).replace(/,/g, "").toLowerCase();
  const num = (re) => {
    const m = s.match(re);
    if (!m) return undefined;
    return Number(m[1]) * (/k/.test(m[2] ?? "") ? 1000 : 1);
  };
  const pct = num(/(\d+(?:\.\d+)?)\s*%/);
  const min = num(/(?:ขั้นต่ำ|ซื้อครบ|min(?:imum)?(?:\s*spend)?|spend)\s*฿?\s*(\d+(?:\.\d+)?)\s*(k)?/);
  const cap = num(/(?:สูงสุด|cap(?:ped)?(?:\s*at)?|max(?:imum)?(?:\s*discount)?|up to)\s*฿?\s*(\d+(?:\.\d+)?)\s*(k)?/);
  // A flat code: "ลด ฿200" / "฿200 off" with no percentage.
  const off = pct ? undefined : num(/(?:ลด|off|discount)?\s*฿\s*(\d+(?:\.\d+)?)\s*(k)?/) ?? num(/ลด\s*(\d+(?:\.\d+)?)\s*(k)?/);
  if (!pct && !off) return null;
  if (pct != null && (pct <= 0 || pct >= 100)) return null;
  return clean({ kind, pct, off, min, cap });
}

/** Short string for URLs: p30-954-4000, sf200-1000- */
export function encodeCode(c) {
  return `${c.kind === "shop" ? "s" : "p"}${c.pct ?? `f${c.off}`}-${c.min ?? ""}-${c.cap ?? ""}`;
}
export function decodeCode(str) {
  const m = String(str).match(/^([sp])(f?)(\d+(?:\.\d+)?)-(\d*(?:\.\d+)?)-(\d*(?:\.\d+)?)$/);
  if (!m) return null;
  const n = (v) => (v === "" ? undefined : Number(v));
  return clean({ kind: m[1] === "s" ? "shop" : "platform", pct: m[2] ? undefined : Number(m[3]), off: m[2] ? Number(m[3]) : undefined, min: n(m[4]), cap: n(m[5]) });
}

/** Price landed in Thailand from a Chinese marketplace. Uses the rate the person types; we never guess it. */
export function landed({ price, shipping = 0, rate, extraPct = 0 }) {
  if (!(price > 0) || !(rate > 0)) return null;
  const base = (price + shipping) * rate;
  return { base: round(base), extra: round((base * extraPct) / 100), total: round(base * (1 + extraPct / 100)) };
}

/**
 * Summary of community price reports, grouped by channel + currency + condition.
 * Ranges, never a single "lowest": the lowest one is the easiest number to get wrong.
 */
export function summarize(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.channel}|${r.currency}|${r.condition ?? "new"}`;
    if (!groups.has(key)) groups.set(key, { channel: r.channel, currency: r.currency, condition: r.condition ?? "new", rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()]
    .map((g) => {
      const amounts = g.rows.map((r) => Number(r.amount)).sort((a, b) => a - b);
      const dates = g.rows.map((r) => r.paid_on).sort();
      return { ...g, n: amounts.length, min: amounts[0], max: amounts.at(-1), median: median(amounts), first: dates[0], last: dates.at(-1) };
    })
    .sort((a, b) => b.n - a.n);
}

export function median(sorted) {
  if (!sorted.length) return null;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : round((sorted[m - 1] + sorted[m]) / 2);
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !Number.isNaN(v)));
