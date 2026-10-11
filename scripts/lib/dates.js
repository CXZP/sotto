// Release and pre-order dates from a store listing.
//
// listedAt: when the store published the product page (Shopify published_at).
// The earliest one across stores is the closest public stand-in for a release date.
//
// preorder: stores write the status into a variant or the title, e.g.
// "MM3A (PRE-ORDER TILL OCT. 10TH.)" or "English (Pre order status until March 10th. 2027)".
// The text is kept as the quote so a reader can check it on the store page.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const PRE = /\bpre[\s-]?(order|sale)\b|\bpresale\b/i;

/** First date in the text as YYYY-MM-DD. A date without a year is the next one on or after (seen - 60 days). */
export function parseDate(text, seenAt) {
  const iso = text.match(/\b(20\d\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return ymd(+iso[1], +iso[2], +iso[3]);
  const m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b\.?(?:,?\s*(20\d\d)\b)?/i);
  const d = m ?? text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s*(20\d\d)\b)?/i);
  if (!d) return null;
  const [mon, dd] = m ? [d[1], d[2]] : [d[2], d[1]];
  const month = MONTHS.indexOf(mon.toLowerCase()) + 1;
  if (d[3]) return ymd(+d[3], month, +dd);
  const seen = new Date(seenAt ?? Date.now());
  let year = seen.getUTCFullYear();
  if (Date.UTC(year, month - 1, +dd) < seen.getTime() - 60 * 864e5) year++;
  return ymd(year, month, +dd);
}

function ymd(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** { until, quote } when the listing says pre-order, else null. until is null when no date is given. */
export function preorder(p, seenAt) {
  const texts = [...p.variants.map((v) => v.title), p.title];
  const quote = texts.find((t) => t && PRE.test(t));
  if (!quote) return null;
  return { until: parseDate(quote, seenAt), quote };
}

export function listedAt(p) {
  const at = p.publishedAt ?? p.createdAt;
  return at ? at.slice(0, 10) : null;
}
