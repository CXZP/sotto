// Sotto summariser: turns text a signed-in person pasted (from a Head-Fi post,
// a maker's page, a review) into a draft for one of Sotto's forms. The person
// reviews and edits the draft before posting; nothing is saved here.
//
// Rules the code enforces, not only the prompt:
// - Never fetches the link. Head-Fi and similar sites block bots; the person
//   pastes what they read, and the link is kept as evidence.
// - Every fact must come with a quote that appears in the pasted text, or it
//   is dropped (same rule as the catalog's spec extractor).
// - 20 drafts per person per day.
//
// Deploy: Supabase dashboard → Edge Functions → New function "summarize",
// paste this file; then Secrets → ANTHROPIC_API_KEY. Run supabase/bot.sql first.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MODEL = "claude-haiku-5-5";
const DAILY = 20;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PORTS = ["usb", "coax", "optical", "aes", "bt", "rca", "xlr", "line"];
const FEATURES = ["uac1", "nos", "asio", "roon", "airplay", "spotify", "tidal", "upnp", "chromecast"];

const SCHEMAS: Record<string, string> = {
  issue: `{"title": string (max 140 chars, a neutral one-line summary of the problem), "body": string (max 600 chars, what owners report, in plain words, no exaggeration, say how many people if the text says), "quotes": string[] (1-4 short verbatim sentences from the text that support it)}`,
  ports: `{"in": [{"port": one of ${JSON.stringify(PORTS)}, "quote": verbatim text}], "out": [same], "features": [{"feature": one of ${JSON.stringify(FEATURES)}, "quote": verbatim text}]}`,
  model: `{"brand": string, "model": string, "kind": one of ["iem","headphone","dongle","dac","amp","dacamp","dap","cd","speaker","power"], "facts": [{"label": string, "value": string, "quote": verbatim text}]}`,
};

const SYSTEM = `You turn text that a user pasted from an audio forum or product page into a draft for a community database.
Only use facts stated in the pasted text. Never add knowledge of your own, never guess specs, never judge sound quality.
Every quote must be copied exactly from the pasted text (same words, same order).
If the text doesn't support a field, leave it out or use an empty list.
Write title and body in the requested language. Reply with JSON only, no prose.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  // Who is asking (must be signed in).
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: "signin" }, 401);

  let body: { mode?: string; text?: string; link?: string; lang?: string; item?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const mode = body.mode ?? "";
  const text = String(body.text ?? "").slice(0, 12000);
  if (!SCHEMAS[mode]) return json({ error: "mode" }, 400);
  if (text.trim().length < 40) return json({ error: "too_short" }, 400);
  const lang = body.lang === "th" ? "Thai" : body.lang === "ja" ? "Japanese" : body.lang === "zh" ? "Simplified Chinese" : "English";

  // Daily limit per person.
  const admin = createClient(url, service);
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from("bot_usage").select("id", { count: "exact", head: true }).eq("user_id", who.user.id).gte("created_at", since);
  if ((count ?? 0) >= DAILY) return json({ error: "rate_limit" }, 429);
  await admin.from("bot_usage").insert({ user_id: who.user.id, mode });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Language for title/body: ${lang}.\nProduct (if known): ${body.item ?? "unknown"}.\nReturn JSON matching: ${SCHEMAS[mode]}\n\n<pasted_text>\n${text}\n</pasted_text>`,
        },
      ],
    }),
  });
  if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
  const out = await res.json();
  const raw = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  let draft: Record<string, unknown>;
  try {
    draft = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    return json({ error: "unreadable" }, 502);
  }

  // Keep only facts whose quote really is in the pasted text.
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const hay = norm(text);
  const inText = (q: unknown) => typeof q === "string" && q.length >= 3 && hay.includes(norm(q));
  if (mode === "issue") {
    const quotes = (draft.quotes as unknown[] ?? []).filter(inText);
    if (!quotes.length) return json({ error: "no_support" }, 422);
    draft = { title: String(draft.title ?? "").slice(0, 140), body: String(draft.body ?? "").slice(0, 600), quotes };
  } else if (mode === "ports") {
    const keep = (list: unknown, field: string, allowed: string[]) =>
      (Array.isArray(list) ? list : []).filter((x) => allowed.includes(x?.[field]) && inText(x?.quote));
    draft = { in: keep(draft.in, "port", PORTS), out: keep(draft.out, "port", PORTS), features: keep(draft.features, "feature", FEATURES) };
  } else {
    draft = { ...draft, facts: (Array.isArray(draft.facts) ? draft.facts : []).filter((f) => inText(f?.quote)) };
  }
  return json({ draft, link: body.link ?? null });
});
