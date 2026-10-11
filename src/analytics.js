// Cookieless, anonymous usage counting (see supabase/analytics.sql).
// One small POST per page view, store click or script error. Nothing is
// stored in the browser. Skipped entirely when the browser asks not to be
// tracked (Do Not Track or Global Privacy Control) and on localhost.

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=mv44px94";

const off =
  navigator.doNotTrack === "1" ||
  window.doNotTrack === "1" ||
  navigator.globalPrivacyControl === true ||
  /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);

const device = /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
// Only the referring site's domain, and only when it's another site.
const refHost = (() => {
  try {
    const h = new URL(document.referrer).hostname.replace(/^www\./, "");
    return h && h !== location.hostname ? h : null;
  } catch {
    return null;
  }
})();

let errors = 0;

export function track(kind, data = {}) {
  if (off) return;
  if (kind === "error" && ++errors > 5) return;
  const body = {
    p_kind: kind,
    p_path: data.path ?? null,
    p_item: data.item ?? null,
    p_ref: kind === "view" ? refHost : null,
    p_lang: data.lang ?? null,
    p_device: device,
    p_store: data.store ?? null,
    p_message: data.message ? String(data.message).slice(0, 300) : null,
  };
  fetch(`${SUPABASE_URL}/rest/v1/rpc/track`, {
    method: "POST",
    keepalive: true,
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export const trackingOff = off;

/** Public aggregates for the #stats page. */
export async function stats() {
  const get = (view, q = "") =>
    fetch(`${SUPABASE_URL}/rest/v1/${view}?select=*${q}`, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const [daily, items, pages, refs, stores, devices] = await Promise.all([
    get("stats_daily"),
    get("stats_items"),
    get("stats_pages"),
    get("stats_refs"),
    get("stats_stores"),
    get("stats_devices"),
  ]);
  return { daily, items, pages, refs, stores, devices };
}
