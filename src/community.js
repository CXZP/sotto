// Community layer on Supabase. The site works without it: every function
// degrades to "unavailable" if the client can't load or the network fails.

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=mvrzfzr4";

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

/** The newest review summaries across all models, for the home page. */
export async function latestReviews(limit = 3) {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb.from("report_feed").select("*").eq("kind", "review").order("created_at", { ascending: false }).limit(limit);
  return error ? [] : data ?? [];
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
  let { error } = await sb.from("reports").insert(row);
  // Database without supabase/i18n.sql or dedupe.sql yet: post without those columns.
  if (error && /i18n|dedupe_key/.test(error.message ?? "")) ({ error } = await sb.from("reports").insert({ ...row, i18n: undefined, dedupe_key: undefined }));
  // Database without "loan" yet (supabase/purchase.sql): post as "not stated".
  if (error?.code === "23514" && row.purchase === "loan") ({ error } = await sb.from("reports").insert({ ...row, purchase: "unknown" }));
  // Same reviewer from the same page is already on this model.
  if (error?.code === "23505") return { duplicate: true };
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

export async function pricesFor(itemIds) {
  const sb = await client();
  if (!sb) return { ok: false, rows: [] };
  const { data, error } = await sb.from("price_feed").select("*").in("item_id", itemIds).order("paid_on", { ascending: false }).limit(500);
  if (error) return { ok: false, rows: [] };
  return { ok: true, rows: data };
}

export async function addPrice(row) {
  const sb = await client();
  const { error } = await sb.from("price_reports").insert(row);
  if (error) throw error;
}

/** Port reports for some items: { itemId: [{in, out, features, evidence_url, ...}] }. */
export async function portsFor(itemIds) {
  const ids = [...new Set(itemIds.filter(Boolean))];
  const sb = ids.length ? await client() : null;
  if (!sb) return {};
  const { data, error } = await sb.from("port_feed").select("*").in("item_id", ids).order("created_at", { ascending: false }).limit(500);
  if (error) return {};
  const out = {};
  for (const r of data) (out[r.item_id] ??= []).push({ ...r, in: r.ports_in, out: r.ports_out });
  return out;
}

/** Ask the summariser (Edge Function) for a draft from pasted text. Throws Error(code). */
export async function summarize(payload) {
  const sb = await client();
  if (!sb) throw new Error("offline");
  const { data, error } = await sb.functions.invoke("summarize", { body: payload });
  if (error) {
    let code = "unavailable";
    let detail = "";
    try {
      const body = await error.context?.json();
      code = body?.error ?? code;
      detail = body?.detail ?? "";
    } catch {}
    const e = new Error(code);
    e.detail = detail;
    throw e;
  }
  return data;
}

/** Owner reports for one model, and my own if signed in. */
/** Owner reports for an item (its current id first, then old ids); the summary is the current id's. */
export async function ownersFor(itemIds) {
  const itemId = itemIds[0];
  const sb = await client();
  if (!sb) return { ok: false, rows: [], summary: null };
  const [feed, sum] = await Promise.all([
    sb.from("owner_feed").select("*").in("item_id", itemIds).order("created_at", { ascending: false }).limit(200),
    sb.from("owner_summary").select("*").eq("item_id", itemId).maybeSingle(),
  ]);
  if (feed.error) return { ok: false, rows: [], summary: null };
  return { ok: true, rows: feed.data, summary: sum.data };
}

/** Insert or replace my report for this model (one per person per model). */
export async function saveOwner(row) {
  const sb = await client();
  const { error } = await sb.from("owner_reports").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "item_id,author" });
  if (error) throw error;
}

export async function deleteOwner(id) {
  const sb = await client();
  const { error } = await sb.from("owner_reports").delete().eq("id", id);
  if (error) throw error;
}

export async function addPorts(row) {
  const sb = await client();
  const { error } = await sb.from("port_reports").insert(row);
  if (error) throw error;
}

export async function deletePorts(id) {
  const sb = await client();
  const { error } = await sb.from("port_reports").delete().eq("id", id);
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
export async function listThreads({ sort = "new", category = "", item = "", page = 0, withImages = false } = {}) {
  const sb = await client();
  if (!sb) return { ok: false, rows: [] };
  let q = sb.from("thread_feed").select("*");
  if (Array.isArray(category)) q = q.in("category", category);
  else if (category) q = q.eq("category", category);
  if (item) q = q.contains("item_ids", [item]);
  if (withImages) q = q.neq("images", "{}");
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

export async function updateComment(id, body) {
  const sb = await client();
  const { error } = await sb.from("comments").update({ body, edited_at: new Date().toISOString() }).eq("id", id);
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

// ---------------------------------------------------------------- bookmarks
// Signed out: kept in this browser. Signed in: kept in the account (private),
// and anything saved while signed out moves in on the next load.

const LOCAL_BM = "sotto.bookmarks";
const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_BM) ?? "[]");
  } catch {
    return [];
  }
};
const writeLocal = (rows) => {
  try {
    localStorage.setItem(LOCAL_BM, JSON.stringify(rows));
  } catch {
    /* storage blocked: bookmarks just don't persist */
  }
};

let bmCache = null;

/** All bookmarks as [{kind, target, created_at}], newest first. */
export async function bookmarks() {
  if (bmCache) return bmCache;
  const s = await session();
  if (!s) return (bmCache = readLocal());
  const sb = await client();
  const local = readLocal();
  if (local.length) {
    await sb.from("bookmarks").upsert(local.map(({ kind, target }) => ({ kind, target, user_id: s.user.id })), { ignoreDuplicates: true });
    writeLocal([]);
  }
  const { data } = await sb.from("bookmarks").select("kind, target, created_at").order("created_at", { ascending: false });
  return (bmCache = data ?? []);
}

export async function isBookmarked(kind, target) {
  return (await bookmarks()).some((b) => b.kind === kind && b.target === String(target));
}

export async function setBookmark(kind, target, on) {
  target = String(target);
  const s = await session();
  const list = await bookmarks();
  if (!s) {
    const next = list.filter((b) => !(b.kind === kind && b.target === target));
    if (on) next.unshift({ kind, target, created_at: new Date().toISOString() });
    writeLocal(next);
    bmCache = next;
    return;
  }
  const sb = await client();
  const { error } = on
    ? await sb.from("bookmarks").upsert({ kind, target, user_id: s.user.id }, { ignoreDuplicates: true })
    : await sb.from("bookmarks").delete().eq("kind", kind).eq("target", target);
  if (error) throw error;
  bmCache = null;
}

/** Thread titles for saved thread ids. */
export async function threadsByIds(ids) {
  const sb = await client();
  if (!sb || !ids.length) return [];
  const { data } = await sb.from("thread_feed").select("id, title, category, score, comment_count, created_at, images").in("id", ids.map(Number));
  return data ?? [];
}

// ---------------------------------------------------------------- follow + inbox
// Following = a bookmarked thread. "New" is counted against the comment count
// seen on the last visit (kept in this browser). The inbox lists replies to
// your threads and comments; read state is a timestamp in this browser.

const SEEN = "sotto.seen";
const INBOX_READ = "sotto.inboxRead";
const getJson = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null") ?? d;
  } catch {
    return d;
  }
};
const setJson = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};
export const seenCount = (threadId) => getJson(SEEN, {})[threadId];
export function markSeen(threadId, count) {
  const m = getJson(SEEN, {});
  m[threadId] = count;
  setJson(SEEN, m);
}

/** Replies to the signed-in person's threads and comments, newest first. */
export async function inbox() {
  const sb = await client();
  const s = await session();
  if (!sb || !s) return null;
  const me = s.user.id;
  const [mt, mc] = await Promise.all([
    sb.from("threads").select("id, title").eq("author", me).limit(500),
    sb.from("comments").select("id, thread_id").eq("author", me).limit(1000),
  ]);
  const threadIds = (mt.data ?? []).map((r) => r.id);
  const commentIds = (mc.data ?? []).map((r) => r.id);
  const ors = [];
  if (threadIds.length) ors.push(`thread_id.in.(${threadIds.join(",")})`);
  if (commentIds.length) ors.push(`parent_id.in.(${commentIds.join(",")})`);
  if (!ors.length) return { rows: [], unread: 0 };
  const { data } = await sb.from("comment_feed").select("id, thread_id, parent_id, author, author_name, body, created_at").or(ors.join(",")).neq("author", me).order("created_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  const titles = new Map((mt.data ?? []).map((r) => [r.id, r.title]));
  const missing = [...new Set(rows.map((r) => r.thread_id).filter((id) => !titles.has(id)))];
  if (missing.length) for (const r of (await sb.from("thread_feed").select("id, title").in("id", missing)).data ?? []) titles.set(r.id, r.title);
  const readAt = getJson(INBOX_READ, 0);
  return {
    rows: rows.map((r) => ({ ...r, thread_title: titles.get(r.thread_id) ?? "", toMyThread: threadIds.includes(r.thread_id) && !r.parent_id, unread: new Date(r.created_at).getTime() > readAt })),
    unread: rows.filter((r) => new Date(r.created_at).getTime() > readAt).length,
  };
}
export const markInboxRead = () => setJson(INBOX_READ, Date.now());

// ---------------------------------------------------------------- brands

let myBrandCache;
/** The verified brand of the signed-in person, or null. */
export async function myBrand() {
  if (myBrandCache !== undefined) return myBrandCache;
  const sb = await client();
  const s = await session();
  if (!sb || !s) return (myBrandCache = null);
  const { data } = await sb.from("brand_reps").select("brand, title").eq("user_id", s.user.id).maybeSingle();
  return (myBrandCache = data ?? null);
}

export async function responsesFor(reportIds) {
  const sb = await client();
  if (!sb || !reportIds.length) return [];
  const { data } = await sb.from("response_feed").select("*").in("report_id", reportIds).order("created_at");
  return data ?? [];
}

export async function addResponse(row) {
  const sb = await client();
  const { error } = await sb.from("report_responses").insert(row);
  if (error) throw error;
}

export async function deleteResponse(id) {
  const sb = await client();
  const { error } = await sb.from("report_responses").delete().eq("id", id);
  if (error) throw error;
}
