// Community layer on Supabase. The site works without it: every function
// degrades to "unavailable" if the client can't load or the network fails.

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=mv2zwjjh";

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

/** Upload an already re-encoded image to a public bucket ("evidence" or "media"); returns its https URL. */
export async function uploadEvidence(blob, bucket = "evidence") {
  const sb = await client();
  const s = await session();
  if (!sb || !s) throw new Error("signin");
  const path = `${s.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------- discussions

const PAGE = 30;

/** Threads, newest activity or top score first; optionally only those linked to an item. */
export async function listThreads({ sort = "new", category = "", item = "", page = 0 } = {}) {
  const sb = await client();
  if (!sb) return { ok: false, rows: [] };
  let q = sb.from("thread_feed").select("*");
  if (category) q = q.eq("category", category);
  if (item) q = q.contains("item_ids", [item]);
  q = sort === "top" ? q.order("score", { ascending: false }).order("created_at", { ascending: false }) : q.order("last_activity", { ascending: false });
  const { data, error } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
  if (error) return { ok: false, rows: [] };
  return { ok: true, rows: data, more: data.length === PAGE };
}

export async function getThread(id) {
  const sb = await client();
  if (!sb) return { ok: false };
  const [t, c] = await Promise.all([
    sb.from("thread_feed").select("*").eq("id", id).maybeSingle(),
    sb.from("comment_feed").select("*").eq("thread_id", id).order("created_at").limit(1000),
  ]);
  if (t.error || c.error) return { ok: false };
  return { ok: true, thread: t.data, comments: c.data };
}

export async function addThread(row) {
  const sb = await client();
  const { data, error } = await sb.from("threads").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function updateThread(id, patch) {
  const sb = await client();
  const { error } = await sb.from("threads").update({ ...patch, edited_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteThread(id) {
  const sb = await client();
  const { error } = await sb.from("threads").delete().eq("id", id);
  if (error) throw error;
}

export async function addComment(row) {
  const sb = await client();
  const { error } = await sb.from("comments").insert(row);
  if (error) throw error;
}

export async function deleteComment(id) {
  const sb = await client();
  const { error } = await sb.from("comments").delete().eq("id", id);
  if (error) throw error;
}

/** kind: "thread" | "comment"; value: 1, -1, or 0 to clear. */
export async function vote(kind, id, value) {
  const sb = await client();
  const s = await session();
  const table = kind === "thread" ? "thread_votes" : "comment_votes";
  const col = kind === "thread" ? "thread_id" : "comment_id";
  const { error } = value
    ? await sb.from(table).upsert({ [col]: id, user_id: s.user.id, value })
    : await sb.from(table).delete().eq(col, id).eq("user_id", s.user.id);
  if (error) throw error;
}

export async function myVotes(kind, ids) {
  const sb = await client();
  const s = await session();
  if (!sb || !s || !ids.length) return new Map();
  const table = kind === "thread" ? "thread_votes" : "comment_votes";
  const col = kind === "thread" ? "thread_id" : "comment_id";
  const { data } = await sb.from(table).select(`${col}, value`).eq("user_id", s.user.id).in(col, ids);
  return new Map((data ?? []).map((r) => [r[col], r.value]));
}

export async function flagDiscuss(kind, id, reason) {
  const sb = await client();
  const { error } = await sb.from("discuss_flags").insert({ kind, target_id: id, reason });
  if (error) throw error;
}

// ---------------------------------------------------------------- account

/** Everything the signed-in person has posted, for the account page. */
export async function myActivity() {
  const sb = await client();
  const s = await session();
  if (!sb || !s) return null;
  const me = s.user.id;
  const [threads, comments, reports, prices] = await Promise.all([
    sb.from("thread_feed").select("id, title, category, score, comment_count, created_at").eq("author", me).order("created_at", { ascending: false }).limit(100),
    sb.from("comment_feed").select("id, thread_id, body, score, created_at").eq("author", me).order("created_at", { ascending: false }).limit(100),
    sb.from("report_feed").select("id, item_id, kind, title, confirms, created_at").eq("author", me).order("created_at", { ascending: false }).limit(100),
    sb.from("price_feed").select("id, item_id, channel, amount, currency, paid_on").eq("author", me).order("created_at", { ascending: false }).limit(100),
  ]);
  return {
    email: s.user.email,
    since: s.user.created_at,
    threads: threads.data ?? [],
    comments: comments.data ?? [],
    reports: reports.data ?? [],
    prices: prices.data ?? [],
  };
}

export async function deleteAccount() {
  const sb = await client();
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw error;
  await sb.auth.signOut();
}

/** Sign in from any page, then come back to `back` (a #hash). */
export async function signInTo(email, back) {
  const sb = await client();
  if (!sb) throw new Error("unavailable");
  try {
    localStorage.setItem(RETURN_KEY, back);
  } catch {
    /* ignore */
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw error;
}

export const uploadMedia = (blob) => uploadEvidence(blob, "media");
