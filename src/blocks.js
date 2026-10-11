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

const line = (p) => `- ${p.point} — “${p.quote}”`;

/** The review-summary post for one block: {title, body} (body ≤ 2000 chars). */
export function reviewPost(b, labels = { pros: "ข้อดี", cons: "ข้อเสีย", by: "รีวิวโดย" }) {
  // Credit the person who wrote the review, always, with where it was published.
  let host = "";
  try {
    host = b.source ? new URL(b.source).hostname.replace(/^www./, "") : "";
  } catch {}
  const credit = `${labels.by} ${b.reviewer || labels.unknown || "?"}${host ? ` (${host})` : ""}`;
  const head = [b.rating && `★ ${b.rating}`, credit, b.date].filter(Boolean).join(" · ");
  const parts = [head];
  if (b.pros.length) parts.push(`${labels.pros}\n${b.pros.map(line).join("\n")}`);
  if (b.cons.length) parts.push(`${labels.cons}\n${b.cons.map(line).join("\n")}`);
  let body = parts.filter(Boolean).join("\n\n");
  if (body.length > 2000) body = body.slice(0, 1990).replace(/\n[^\n]*$/, "") + "\n…";
  const title = (b.summary || `${labels.by} ${b.reviewer || "?"}`).slice(0, 140).padEnd(5, ".");
  return { title, body };
}

/** One issue post per problem the review describes. */
export function problemPosts(b) {
  return b.problems.map((p) => ({ title: p.point.slice(0, 140).padEnd(5, "."), body: `“${p.quote}”${b.reviewer ? ` — ${b.reviewer}` : ""}` }));
}
