// Community layer on Supabase. The site works without it: every function
// degrades to "unavailable" if the client can't load or the network fails.

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=mv2wr92c";

let clientPromise;
const RETURN_KEY = "sotto.returnHash";

/** Lazily load supabase-js from the CDN (pinned) so the catalog never waits on it. */
export function client() {
  clientPromise ??= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm")
    .then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, {
        // PKCE puts ?code= in the query string, which leaves our #hash router alone.
        auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
      }),
    )
    .catch(() => null);
  return clientPromise;
}

/** After a magic-link redirect, go back to the page the person started from. */
export async function finishSignIn() {
  if (!new URLSearchParams(location.search).has("code")) return;
  const sb = await client();
  await sb?.auth.getSession(); // exchanges the code
  let back = "";
  try {
    back = localStorage.getItem(RETURN_KEY) ?? "";
    localStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
  history.replaceState(null, "", `${location.pathname}${back}`);
}

// getSession() waits on a storage lock; in some browsers that wait can stall.
// Reading must never hang the page, so give up after a few seconds.
export async function session() {
  const sb = await client();
  if (!sb) return null;
  const timeout = new Promise((r) => setTimeout(() => r({ data: { session: null } }), 4000));
  const { data } = await Promise.race([sb.auth.getSession(), timeout]);
  return data.session ?? null;
}

export async function signIn(email) {
  const sb = await client();
  if (!sb) throw new Error("unavailable");
  try {
    localStorage.setItem(RETURN_KEY, location.hash);
  } catch {
    /* ignore */
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw error;
}

export async function signOut() {
  const sb = await client();
  await sb?.auth.signOut();
}

export async function myProfile() {
  const sb = await client();
  const s = await session();
  if (!sb || !s) return null;
  const { data } = await sb.from("profiles").select("id, display_name").eq("id", s.user.id).maybeSingle();
  return data;
}

export async function saveProfile(displayName) {
  const sb = await client();
  const s = await session();
  const { error } = await sb.from("profiles").upsert({ id: s.user.id, display_name: displayName });
  if (error) throw error;
}

/** Posts for one or more catalog items, most-confirmed issues first. */
export async function reportsFor(itemIds) {
  const sb = await client();
  if (!sb) return { ok: false, rows: [] };
  const { data, error } = await sb
    .from("report_feed")
    .select("*")
    .in("item_id", itemIds)
    .order("confirms", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, rows: [] };
  return { ok: true, rows: data };
}

export async function myConfirms(reportIds) {
  const sb = await client();
  const s = await session();
  if (!sb || !s || !reportIds.length) return new Set();
  const { data } = await sb.from("confirms").select("report_id").eq("user_id", s.user.id).in("report_id", reportIds);
  return new Set((data ?? []).map((r) => r.report_id));
}

export async function addReport(row) {
  const sb = await client();
  const { error } = await sb.from("reports").insert(row);
  if (error) throw error;
}

export async function deleteReport(id) {
  const sb = await client();
  const { error } = await sb.from("reports").delete().eq("id", id);
  if (error) throw error;
}

export async function setConfirm(reportId, on) {
  const sb = await client();
  const q = on ? sb.from("confirms").insert({ report_id: reportId }) : sb.from("confirms").delete().eq("report_id", reportId).eq("user_id", (await session()).user.id);
  const { error } = await q;
  if (error) throw error;
}

export async function flag(reportId, reason) {
  const sb = await client();
  const { error } = await sb.from("flags").insert({ report_id: reportId, reason });
  if (error) throw error;
}

// ---------------------------------------------------------------- prices people paid

export async function pricesFor(itemId) {
  const sb = await client();
  if (!sb) return { ok: false, rows: [] };
  const { data, error } = await sb.from("price_feed").select("*").eq("item_id", itemId).order("paid_on", { ascending: false }).limit(500);
  if (error) return { ok: false, rows: [] };
  return { ok: true, rows: data };
}

export async function addPrice(row) {
  const sb = await client();
  const { error } = await sb.from("price_reports").insert(row);
  if (error) throw error;
}

export async function deletePrice(id) {
  const sb = await client();
  const { error } = await sb.from("price_reports").delete().eq("id", id);
  if (error) throw error;
}

export async function flagPrice(priceId, reason) {
  const sb = await client();
  const { error } = await sb.from("price_flags").insert({ price_id: priceId, reason });
  if (error) throw error;
}

/** Upload an already re-encoded, redacted screenshot; returns its public https URL. */
export async function uploadEvidence(blob) {
  const sb = await client();
  const s = await session();
  if (!sb || !s) throw new Error("signin");
  const path = `${s.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from("evidence").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return sb.storage.from("evidence").getPublicUrl(path).data.publicUrl;
}
