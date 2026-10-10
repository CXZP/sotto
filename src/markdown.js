// A small, safe Markdown subset for posts (Reddit-like). Pure function.
//
// Safety: the text is HTML-escaped FIRST; formatting only ever adds a fixed
// set of tags. Links must be https:// and get rel="nofollow ugc noopener".
// Nothing the user types can become an attribute other than a checked URL.
//
// Supported:
//   **bold**  *italic* / _italic_  ~~strike~~  `code`  ||spoiler||
//   [text](https://…)  bare https://… links
//   # / ## / ### headings  > quotes  - / * / 1. lists  ``` code blocks  --- rule

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const link = (href, text) => `<a href="${href}" target="_blank" rel="nofollow ugc noopener">${text}</a>`;
const shortUrl = (u) => (u.length > 60 ? `${u.slice(0, 57)}…` : u);

/** Inline formatting on already-escaped text. */
function inline(s) {
  const codes = [];
  // Protect inline code first so nothing inside it is formatted.
  s = s.replace(/`([^`\n]+)`/g, (_, c) => `\u0000${codes.push(`<code>${c}</code>`) - 1}\u0000`);
  const links = [];
  const keep = (html) => `\u0001${links.push(html) - 1}\u0001`;
  // [text](https://url) — the URL is escaped text; quotes were escaped so it can't break out.
  // A URL in escaped text ends at whitespace, "<", or an escaped quote / angle bracket.
  s = s.replace(/\[([^\]\n]{1,200})\]\((https:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s)<])+)\)/g, (_, text, href) => keep(link(href, text)));
  s = s.replace(/https:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<])+/g, (u) => {
    const tail = u.match(/[.,;:!?)\]]+$/)?.[0] ?? "";
    const href = u.slice(0, u.length - tail.length);
    return keep(link(href, shortUrl(href))) + tail;
  });
  s = s
    .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~(?=\S)([^\n]*?\S)~~/g, "<del>$1</del>")
    .replace(/\|\|(?=\S)([^\n]*?\S)\|\|/g, '<span class="spoiler" tabindex="0">$1</span>');
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => links[i]);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}

export function renderMd(text) {
  const lines = esc(String(text ?? "").replace(/\r\n?/g, "\n")).split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // ``` code block
    if (/^```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${body.join("\n")}</code></pre>`);
      continue;
    }
    // heading (escaped '#' stays '#')
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const level = h[1].length + 2; // # → h3, ## → h4, ### → h5: never bigger than the page title
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }
    // > quote ('>' was escaped to &gt;)
    if (/^&gt;\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) body.push(lines[i++].replace(/^&gt;\s?/, ""));
      out.push(`<blockquote>${renderEscapedParagraphs(body)}</blockquote>`);
      continue;
    }
    // lists
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(re, ""))}</li>`);
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    // paragraph: consecutive plain lines, single newlines kept as <br>
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|&gt;|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}$)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    out.push(`<p>${para.map(inline).join("<br>")}</p>`);
  }
  return out.join("");
}

// Quote bodies are already escaped; render them as paragraphs without re-escaping.
function renderEscapedParagraphs(lines) {
  return lines
    .join("\n")
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.split("\n").map(inline).join("<br>")}</p>`)
    .join("");
}

/** Toolbar actions: wrap the selection or prefix the selected lines. */
export const MD_ACTIONS = {
  bold: { wrap: ["**", "**"], label: "B" },
  italic: { wrap: ["*", "*"], label: "I" },
  strike: { wrap: ["~~", "~~"], label: "S" },
  code: { wrap: ["`", "`"], label: "</>" },
  spoiler: { wrap: ["||", "||"], label: "▒" },
  link: { wrap: ["[", "](https://)"], label: "🔗" },
  quote: { prefix: "> ", label: "❝" },
  list: { prefix: "- ", label: "•" },
  olist: { prefix: "1. ", label: "1." },
  heading: { prefix: "## ", label: "H" },
};

/** Apply a toolbar action to a textarea in place. */
export function applyMd(ta, name) {
  const a = MD_ACTIONS[name];
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  if (a.wrap) {
    const sel = v.slice(s, e) || "";
    ta.value = v.slice(0, s) + a.wrap[0] + sel + a.wrap[1] + v.slice(e);
    const caret = s + a.wrap[0].length;
    ta.setSelectionRange(caret, caret + sel.length);
  } else {
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    const block = v.slice(lineStart, e);
    const done = block
      .split("\n")
      .map((l) => a.prefix + l)
      .join("\n");
    ta.value = v.slice(0, lineStart) + done + v.slice(e);
    ta.setSelectionRange(lineStart + done.length, lineStart + done.length);
  }
  ta.focus();
  ta.dispatchEvent(new Event("input"));
}
