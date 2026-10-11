// "Sotto blocks": the JSON a review extractor (the Gemini skill in
// docs/gemini-skill.md, or a person) produces from one review. Shared by the
// site (paste into a form) and scripts/blocks-to-sql.mjs (bulk import).

const PORTS = ["usb", "coax", "optical", "aes", "bt", "rca", "xlr", "line"];
const FEATURES = ["uac1", "nos", "asio", "roon", "airplay", "spotify", "tidal", "upnp", "chromecast"];

/** Every {"sotto": 1, ...} object in a pasted text (fenced or not, one or many). */
export function parseBlocks(text) {
  const out = [];
  const s = String(text ?? "");
  for (let i = s.indexOf("{"); i >= 0; i = s.indexOf("{", i + 1)) {
    // Find the matching closing brace, skipping strings.
    let depth = 0;
    let inStr = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) {
        if (c === "\\") j++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          const o = JSON.parse(s.slice(i, j + 1));
          if (o && o.sotto === 1) {
            out.push(clean(o));
            i = j;
          }
        } catch {}
        break;
      }
    }
  }
  return out;
}

function clean(o) {
  const pts = (list) =>
    (Array.isArray(list) ? list : [])
      .map((p) => ({ point: String(p?.point ?? "").trim().slice(0, 200), quote: String(p?.quote ?? "").trim().slice(0, 400) }))
      // A point without a quote can't be checked, so it doesn't count.
      .filter((p) => p.point && p.quote.length >= 3);
  const pick = (list, allowed) => [...new Set((Array.isArray(list) ? list : []).map(String).filter((x) => allowed.includes(x)))];
  const source = /^https:\/\/\S+$/.test(o.source ?? "") ? o.source : "";
  return {
    product: String(o.product ?? "").trim(),
    source,
    reviewer: String(o.reviewer ?? "").trim().slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(o.date ?? "") ? o.date : "",
    rating: String(o.rating ?? "").trim().slice(0, 20),
    summary: String(o.summary ?? "").trim().slice(0, 140),
    pros: pts(o.pros),
    cons: pts(o.cons),
    problems: pts(o.problems),
    ports_in: pick(o.ports_in, PORTS),
    ports_out: pick(o.ports_out, PORTS),
    features: pick(o.features, FEATURES),
  };
}

/** "head-fi.org", "reddit.com" … for a link; old./www./m. are the same site. "" if not a link. */
export function sourceHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|old|m)\./, "");
  } catch {
    return "";
  }
}

/** Same reviewer on the same page → same key, so one review can't be posted twice. null without a name. */
export function reviewKey(url, reviewer) {
  const who = String(reviewer ?? "").trim().toLowerCase();
  const host = sourceHost(url);
  if (!who || !host) return null;
  const path = new URL(url).pathname.replace(/\/+$/, "");
  return `${host}${path}|${who}`.slice(0, 600);
}

/** Labels inside a review post, per site language. */
export const REVIEW_LABELS = {
  th: { pros: "ข้อดี", cons: "ข้อเสีย", by: "รีวิวโดย", unknown: "ไม่ทราบชื่อ", verdict: "สรุปของผู้รีวิว", unit: "ที่มาของเครื่อง", bought: "ซื้อเอง", free_sample: "ได้ของฟรีจากแบรนด์/ร้าน", loan: "ยืมมารีวิว" },
  en: { pros: "Pros", cons: "Cons", by: "Review by", unknown: "unknown", verdict: "Verdict", unit: "Unit", bought: "bought with own money", free_sample: "free from maker/seller", loan: "loaned for review" },
  ja: { pros: "良い点", cons: "気になる点", by: "レビュー:", unknown: "不明", verdict: "結論", unit: "入手方法", bought: "自費購入", free_sample: "メーカー/販売店から無償提供", loan: "レビュー用に貸与" },
  zh: { pros: "优点", cons: "缺点", by: "评测者", unknown: "未知", verdict: "结论", unit: "设备来源", bought: "自费购买", free_sample: "厂商/商家免费提供", loan: "借测" },
};

/** The review-summary post for one block: {title, body} (body ≤ 2000 chars).
 * With `lang`, points and summary use their translation in that language when the block has one. */
export function reviewPost(b, labels = REVIEW_LABELS.th, lang) {
  const line = (p) => {
    const point = (lang && p.point_i18n?.[lang]) || p.point;
    const quotes = (p.quotes?.length ? p.quotes : [p.quote]).map((q) => `“${q}”`).join(" ");
    // A point that only repeats its quote ("Detailed — “Detailed”") shows the quote alone.
    const same = point.trim().toLowerCase().replace(/[.!]$/, "") === String(p.quote).trim().toLowerCase().replace(/[.!]$/, "");
    return same ? `- ${quotes}` : `- ${point} — ${quotes}`;
  };
  const summary = (lang && b.summary_i18n?.[lang]) || b.summary;
  // Credit the person who wrote the review, always, with where it was published.
  const host = sourceHost(b.source);
  const credit = `${labels.by} ${b.reviewer || labels.unknown || "?"}${host ? ` (${host})` : ""}`;
  const head = [b.rating && `★ ${b.rating}`, credit, b.date].filter(Boolean).join(" · ");
  const top = [head];
  if (b.verdict) top.push(`${labels.verdict || "Verdict"}: ${line(b.verdict).slice(2)}`);
  // Who paid for the unit, in the reviewer's words: readers weigh a free sample differently.
  if (b.unit) top.push(`${labels.unit || "Unit"}: ${labels[b.unit.how] || b.unit.how} — “${b.unit.quote}”`);
  const parts = [top.join("\n")];
  if (b.pros.length) parts.push(`${labels.pros}\n${b.pros.map(line).join("\n")}`);
  if (b.cons.length) parts.push(`${labels.cons}\n${b.cons.map(line).join("\n")}`);
  let body = parts.filter(Boolean).join("\n\n");
  if (body.length > 2000) body = body.slice(0, 1990).replace(/\n[^\n]*$/, "") + "\n…";
  const title = (summary || `${labels.by} ${b.reviewer || "?"}`).slice(0, 140).padEnd(5, ".");
  return { title, body };
}

/** The post in every language the block was translated into: {th: {title, body}, ...}, or null if none. */
export function reviewPostI18n(b) {
  const langs = Object.keys(REVIEW_LABELS).filter((l) => b.summary_i18n?.[l]);
  if (!langs.length) return null;
  const out = Object.fromEntries(langs.map((l) => [l, reviewPost(b, REVIEW_LABELS[l], l)]));
  // The language the review itself was written in: "view original" shows that version.
  if (REVIEW_LABELS[b.source_lang]) out._src = b.source_lang;
  return out;
}

/** One issue post per problem the review describes. */
export function problemPosts(b) {
  return b.problems.map((p) => ({ title: p.point.slice(0, 140).padEnd(5, "."), body: `“${p.quote}”${b.reviewer ? ` — ${b.reviewer}` : ""}` }));
}
