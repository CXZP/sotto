// "Send to Sotto" bookmarklet. Runs only when the reader clicks it, on the
// page they are already reading (so logins and bot checks were passed by a
// person, not by us). It copies the visible posts, with author, date and
// permalink, as plain text; the reader pastes that into Sotto's form, where
// the summariser keeps only facts quoted from it. Nothing is sent anywhere
// by the bookmarklet itself.
//
// Must stay self-contained: it is serialised with Function#toString.

export function sendToSotto() {
  const MAX = 38000;
  let noPosts = false;
  const clean = (s) => (s || "").replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const out = [`SOURCE: ${location.href}`, `TITLE: ${document.title}`, ""];
  const add = (author, date, link, text) => {
    text = clean(text);
    if (text.length < 20) return;
    out.push(`--- ${author || "?"} · ${date || "?"}${link ? ` · ${link}` : ""}`, text, "");
  };
  const sel = String(window.getSelection ? window.getSelection() : "").trim();
  if (sel.length > 40) add("selection", "", location.href, sel);
  else {
    // XenForo forums (Head-Fi threads, ASR) and XenForo showcase reviews.
    document.querySelectorAll("article.message, .message--post, .message--review").forEach((m) => {
      const body = m.querySelector(".bbWrapper, .message-body, .message-content");
      const time = m.querySelector("time");
      const perm = m.querySelector('a[href*="/post-"], a[href*="/review/"], .message-attribution-main a');
      add(m.getAttribute("data-author") || m.querySelector(".username")?.textContent, time?.getAttribute("datetime") || time?.textContent, perm?.href, body?.innerText);
    });
    // Reddit (new design).
    document.querySelectorAll("shreddit-post, shreddit-comment").forEach((m) => {
      const body = m.querySelector('[slot="text-body"], [slot="comment"]');
      add(m.getAttribute("author"), m.getAttribute("created-timestamp"), m.getAttribute("permalink") ? `https://www.reddit.com${m.getAttribute("permalink")}` : "", body?.innerText);
    });
    // Anything else: the main article text (a product page, a blog review).
    // Also when the posts found cover little of the page: a Head-Fi showcase
    // overview has its spec box styled as a post and its reviews styled
    // differently, so the reviews would otherwise be missed.
    const page = clean((document.querySelector("main, [role=main], .p-body-main") || document.body).innerText);
    const found = out.slice(3).join("\n").length;
    if (out.length <= 3) noPosts = true;
    if (out.length <= 3 || found < page.length * 0.6) add(document.querySelector('meta[name="author"]')?.content || "page", "", location.href, page);
  }
  let text = out.join("\n");
  if (text.length > MAX) text = text.slice(0, MAX) + "\n…";
  const showcase = /head-fi\.org\/showcase\/[^/]+\/?$/.test(location.href);
  const done = () =>
    noPosts
      ? alert(
          `No forum posts or reviews on this page, so the whole page was copied (fine for specs, not for problems).${showcase ? "\nOn Head-Fi, open the Reviews tab and click again." : ""}\nไม่เจอโพสต์หรือรีวิวในหน้านี้ เลยคัดลอกทั้งหน้า (ใช้กับสเปกได้ แต่ไม่ใช่ปัญหาจากผู้ใช้)${showcase ? "\nบน Head-Fi ให้เปิดแท็บ Reviews แล้วกดอีกครั้ง" : ""}`,
        )
      : alert(`Copied ${out.filter((l) => l.startsWith("--- ")).length} post(s) for Sotto.\nOpen the model on Sotto → From users → ✨ → paste.\nคัดลอกแล้ว ไปที่หน้ารุ่นใน Sotto → จากผู้ใช้ → ✨ → วาง`);
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    done();
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

/** javascript: URL for the bookmark. */
export const BOOKMARKLET = `javascript:${encodeURIComponent(`(${sendToSotto.toString()})()`)}`;
