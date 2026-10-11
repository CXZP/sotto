// "Send to Sotto" bookmarklet. Runs only when the reader clicks it, on the
// page they are already reading (so logins and bot checks were passed by a
// person, not by us). It copies the visible posts, with author, date and
// permalink, as plain text; the reader pastes that into Sotto's form, where
// the summariser keeps only facts quoted from it. Nothing is sent anywhere
// by the bookmarklet itself.
//
// Must stay self-contained: it is serialised with Function#toString.

export function sendToSotto() {
  const MAX = 118000;
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
    // Other review layouts (e.g. Head-Fi showcase "Latest reviews"): any block
    // whose class mentions "review" and that shows a username and a date.
    const taken = new Set();
    document.querySelectorAll('[class*="review" i]').forEach((m) => {
      if ([...taken].some((t) => t.contains(m))) return;
      const user = m.querySelector(".username, [itemprop=author], a[href*='/members/']");
      const time = m.querySelector("time");
      if (!user || !time || m.innerText.length < 200 || m.closest("article.message, .message--post")) return;
      taken.add(m);
      add(user.textContent.trim(), time.getAttribute("datetime") || time.textContent, m.querySelector('a[href*="/review/"]')?.href || location.href, m.innerText);
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
  // Report what was actually copied; the bot splits reviewers itself, so a
  // whole-page copy is fine as long as the reviews were on screen.
  const named = out.filter((l) => l.startsWith("--- ") && !/^--- (\?|page|selection) /.test(l)).length;
  const done = () =>
    alert(
      `Copied ${text.length.toLocaleString()} characters${named ? ` (${named} post(s) with author)` : " (whole page)"} for Sotto.\nOn Sotto: open the model → From users → ✨ → paste → Draft it.\nคัดลอกแล้ว ${text.length.toLocaleString()} ตัวอักษร${named ? ` (${named} โพสต์ พร้อมชื่อคนเขียน)` : " (ทั้งหน้า)"}\nไปที่หน้ารุ่นใน Sotto → จากผู้ใช้ → ✨ → วาง → ร่างให้${noPosts && !named ? "\n(If reviews are missing, scroll so they load, then click again / ถ้ารีวิวไม่มา เลื่อนให้รีวิวโหลดแล้วกดอีกครั้ง)" : ""}`,
    );
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
