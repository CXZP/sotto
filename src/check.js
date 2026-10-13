// Check queue (#check): a person looks at one box at a time, the real photos
// and the maker's lines on one side, what Sotto shows on the other, and says
// "right" or fixes it. Only a person's check makes an entry "checked"; makers'
// pages, store text, rules and AI only decide the order of the queue.

import { socketsOf, sameSockets, checkState, CHECK_IN, CHECK_OUT, CHECK_JACKS } from "./sockets.js?v=mv5ybg5o";
import { panelSpec, panelSvg, frontSpec, hasFront, PANEL_DEFS } from "./panel.js?v=mv5ybg5o";
import { loadPhotos } from "./data.js?v=mv5ybg5o";
import * as community from "./community.js?v=mv5ybg5o";

const CATS = ["dongle", "desktop", "dap", "cd", "phono", "turntable", "speaker"];
const PORT_NAME = { usb: "USB", coax: "Coaxial", optical: "Optical", aes: "AES/EBU", i2s: "I2S", bt: "Bluetooth", rca: "RCA", xlr: "XLR", line: "Line (3.5/4.4)", phono: "Phono", dc: "DC", spk: "Speaker" };
const JACK_NAME = { "6.35": "6.35 mm", "4.4": "4.4 mm", "3.5": "3.5 mm", "2.5": "2.5 mm", xlr4: "XLR 4-pin" };

let state = null;

/** The page shell; the queue fills in once checks and photos load. */
export function checkPage(ctx) {
  const { t, esc } = ctx;
  return `<div class="check">
    <header class="deal-head"><h1>${esc(t("ck_title"))}</h1><p class="muted">${esc(t("ck_lead"))}</p></header>
    <div id="ck-body"><p class="muted">${esc(t("cm_loading"))}</p></div>
  </div>`;
}

export async function wireCheck(main, ctx) {
  const { t, esc, db } = ctx;
  const body = main.querySelector("#ck-body");
  const [checks, isChecker, session, audit] = await Promise.all([
    community.allChecks(),
    community.amChecker(),
    community.session(),
    fetch("data/audit.json?v=mv5ybg5o").then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  if (!body.isConnected) return;
  const flagged = new Map();
  for (const [name, r] of Object.entries(audit?.rules ?? {})) if (r.severity === "error") for (const id of r.ids) flagged.set(id, name);
  state = { checks, isChecker, flagged, cat: "", brand: "", q: "", skipped: new Set() };
  if (!session) {
    body.innerHTML = `<p class="note">${esc(t("ck_signin"))} <a href="#account">${esc(t("ac_title"))} →</a></p>`;
    return;
  }
  if (!isChecker) {
    body.innerHTML = `<p class="note">${esc(t("ck_not_checker"))}</p><pre class="small">insert into public.checkers (user_id) select id from auth.users where email = '${esc(session.user?.email ?? "you@example.com")}';</pre>`;
    return;
  }
  render(body, ctx);
}

/** Why this box is in the queue, and its place in it. */
function reason(item, ctx) {
  const st = checkState(item, state.checks);
  if (st?.state === "changed") return { rank: 0, why: ctx.t("ck_why_changed") };
  if (state.flagged.has(item.id)) return { rank: 1, why: `${ctx.t("ck_why_rule")}: ${state.flagged.get(item.id)}` };
  const maker = Object.values({ ...item.ports?.in, ...item.ports?.out }).some((v) => v?.url && !ctx.isStoreUrl(v.url));
  return maker ? { rank: 2, why: ctx.t("ck_why_maker") } : { rank: 3, why: ctx.t("ck_why_store") };
}

function queue(ctx) {
  const done = (i) => ["checked", "fixed"].includes(checkState(i, state.checks)?.state);
  return ctx.db.items
    .filter((i) => CATS.includes(i.category) && (i.ports || i.jacks || i.outputs?.length))
    .filter((i) => !state.cat || i.category === state.cat)
    .filter((i) => !state.brand || i.brand === state.brand)
    .filter((i) => !state.q || `${i.brand} ${i.model}`.toLowerCase().includes(state.q.toLowerCase()))
    .filter((i) => !done(i) && !state.skipped.has(i.id))
    .map((i) => ({ i, ...reason(i, ctx) }))
    .sort((a, b) => a.rank - b.rank || b.i.offers.length - a.i.offers.length || a.i.id.localeCompare(b.i.id));
}

function render(body, ctx) {
  const { t, esc, db } = ctx;
  const q = queue(ctx);
  const total = db.items.filter((i) => CATS.includes(i.category) && (i.ports || i.jacks || i.outputs?.length));
  const checked = total.filter((i) => ["checked", "fixed"].includes(checkState(i, state.checks)?.state)).length;
  const brands = [...new Set(total.map((i) => i.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  body.innerHTML = `<div class="filters">
      <p class="small"><b>${esc(t("ck_progress", { done: checked, total: total.length }))}</b> · ${esc(t("ck_left", { n: q.length }))}</p>
      <div class="chips"><button class="chip${!state.cat ? " on" : ""}" data-cat="">${esc(t("cat_all"))}</button>${CATS.map((c) => `<button class="chip${state.cat === c ? " on" : ""}" data-cat="${c}">${esc(t(`cat_${c}`))}</button>`).join("")}</div>
      <div class="row-inline"><select class="mini-select" data-brand><option value="">${esc(t("ck_all_brands"))}</option>${brands.map((b) => `<option${b === state.brand ? " selected" : ""}>${esc(b)}</option>`).join("")}</select>
      <input class="search" data-q placeholder="${esc(t("ck_search"))}" value="${esc(state.q)}"></div>
    </div>
    <div id="ck-card">${q.length ? "" : `<p class="note">${esc(t("ck_empty"))}</p>`}</div>`;
  body.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => ((state.cat = b.dataset.cat), render(body, ctx))));
  body.querySelector("[data-brand]").addEventListener("change", (e) => ((state.brand = e.target.value), render(body, ctx)));
  const qi = body.querySelector("[data-q]");
  qi.addEventListener("change", () => ((state.q = qi.value.trim()), render(body, ctx)));
  if (q.length) card(body.querySelector("#ck-card"), q[0], ctx, () => render(body, ctx));
}

function drawing(item) {
  const node = { item };
  const rear = panelSpec(node);
  const parts = [rear];
  if (hasFront(node)) parts.push(frontSpec(node));
  return parts
    .map((s) => `<svg class="ck-svg" viewBox="0 0 ${s.w} ${s.h}" font-family="Inter, system-ui, sans-serif">${PANEL_DEFS}${panelSvg(s, "")}</svg>`)
    .join("");
}

async function card(el, { i: item, why }, ctx, next) {
  const { t, esc } = ctx;
  const shown = socketsOf(item);
  const set = (await loadPhotos())[item.id];
  const photos = [...new Set([...(set?.src ?? []), ...item.offers.map((o) => o.image).filter(Boolean), ...(item.image?.src ? [item.image.src] : [])])];
  const srcLines = [];
  for (const dir of ["in", "out"])
    for (const [k, v] of Object.entries(item.ports?.[dir] ?? {}))
      if (v?.url) srcLines.push(`<li><b>${dir === "in" ? "IN" : "OUT"} ${esc(PORT_NAME[k] ?? k)}</b> “${esc(v.quote ?? "")}” <a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(new URL(v.url).hostname.replace(/^www\./, ""))} ↗</a></li>`);
  const pages = [...new Set([item.addedFrom, ...item.offers.map((o) => o.url)].filter(Boolean))].slice(0, 6);
  const num = (dir, k) => `<label class="ck-n"><span>${esc(PORT_NAME[k])}</span><input type="number" min="0" max="8" name="${dir}:${k}" value="${shown[dir][k] ?? 0}"></label>`;
  el.innerHTML = `<article class="card pad ck-card">
    <p class="muted small">${esc(why)}</p>
    <h2><a href="#item/${encodeURIComponent(item.id)}">${esc(ctx.displayName(item))}</a> <span class="muted small">${esc(item.brand ?? "")} · ${esc(t(`cat_${item.category}`))}</span></h2>
    <div class="ck-grid">
      <section><h3>${esc(t("ck_real"))}</h3>
        ${photos.length ? `<a class="ck-main" href="${esc(photos[0])}" target="_blank" rel="noopener"><img src="${esc(photos[0])}" alt="" referrerpolicy="no-referrer"></a>
        <div class="ck-thumbs">${photos.map((p, n) => `<button type="button" data-src="${esc(p)}"${n ? "" : ' aria-current="true"'}><img src="${esc(ctx.sized(p, 120))}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join("")}</div>` : `<p class="muted">${esc(t("ck_no_photo"))}</p>`}
        <p class="small"><a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${ctx.displayName(item)} rear panel`)}" target="_blank" rel="noopener">${esc(t("sq_rear"))} ↗</a> · <a href="https://www.google.com/search?q=${encodeURIComponent(`${ctx.displayName(item)} user manual pdf`)}" target="_blank" rel="noopener">${esc(t("ck_manual"))} ↗</a>
        ${pages.map((u) => ` · <a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname.replace(/^www\./, ""))} ↗</a>`).join("")}</p>
        ${srcLines.length ? `<details><summary class="small">${esc(t("ck_lines", { n: srcLines.length }))}</summary><ul class="small ck-lines">${srcLines.join("")}</ul></details>` : ""}
      </section>
      <section><h3>${esc(t("ck_ours"))}</h3><div class="ck-draw">${drawing(item)}</div>
        <form class="ck-form">
          <fieldset><legend class="small">${esc(t("po_in"))}</legend>${CHECK_IN.map((k) => num("in", k)).join("")}</fieldset>
          <fieldset><legend class="small">${esc(t("po_out"))}</legend>${CHECK_OUT.map((k) => num("out", k)).join("")}</fieldset>
          <fieldset><legend class="small">${esc(t("po_jacks"))}${shown.jacksStated ? "" : ` · <span class="tag warn">${esc(t("ck_jacks_guess"))}</span>`}</legend>${CHECK_JACKS.map((j) => `<label class="check small"><input type="checkbox" name="jack" value="${j}"${shown.jacks.includes(j) ? " checked" : ""}> ${esc(JACK_NAME[j])}</label>`).join("")}</fieldset>
          <input class="search" name="evidence" type="url" pattern="https://.+" placeholder="${esc(t("ck_evidence"))}" value="${esc(photos[0] ?? "")}">
          <input class="search" name="note" maxlength="500" placeholder="${esc(t("ck_note"))}">
          <div class="row-inline">
            <button type="button" class="pill primary" data-ok>✓ ${esc(t("ck_ok"))}</button>
            <button type="button" class="pill" data-fix disabled>${esc(t("ck_fix"))}</button>
            <button type="button" class="pill" data-skip>${esc(t("ck_skip"))}</button>
          </div>
          <p class="small status" role="status"></p>
        </form>
      </section>
    </div>
  </article>`;

  const main = el.querySelector(".ck-main");
  el.querySelectorAll(".ck-thumbs button").forEach((b) =>
    b.addEventListener("click", () => {
      el.querySelectorAll(".ck-thumbs button").forEach((x) => x.toggleAttribute("aria-current", x === b));
      main.href = b.dataset.src;
      main.querySelector("img").src = b.dataset.src;
    }),
  );
  const f = el.querySelector(".ck-form");
  const status = f.querySelector(".status");
  const read = () => {
    const out = { in: {}, out: {}, jacks: [] };
    for (const inp of f.querySelectorAll('input[type="number"]')) {
      const [dir, k] = inp.name.split(":");
      const n = Math.max(0, Math.min(8, Number(inp.value) || 0));
      if (n) out[dir][k] = n;
    }
    out.jacks = [...f.querySelectorAll('input[name="jack"]:checked')].map((x) => x.value);
    return out;
  };
  // Redraw from the form, so the person sees the box they are describing.
  const redraw = () => {
    const d = read();
    const changed = !sameSockets(d, shown);
    f.querySelector("[data-fix]").disabled = !changed;
    // "Right as shown" means what was shown, not an edited form.
    f.querySelector("[data-ok]").disabled = changed;
    const side = (o) => Object.fromEntries(Object.entries(o).map(([k, n]) => [k, { n }]));
    const preview = { ...item, ports: { in: side(d.in), out: side(d.out) }, jacks: d.jacks, dcIn: d.in.dc ? { ...(item.dcIn ?? { needs: [] }), usb: false, barrel: true } : item.dcIn?.usb ? item.dcIn : undefined };
    el.querySelector(".ck-draw").innerHTML = drawing(preview);
  };
  f.addEventListener("input", redraw);
  const save = async (verdict) => {
    const d = read();
    const row = { item_id: item.id, field: "sockets", verdict, shown, data: verdict === "fixed" ? d : null, evidence_url: f.evidence.value.trim() || null, note: f.note.value.trim() || null };
    if (row.evidence_url && !/^https:\/\//.test(row.evidence_url)) return (status.textContent = t("ck_evidence"));
    status.textContent = t("ck_sending");
    try {
      const saved = await community.addCheck(row);
      state.checks.push(saved);
      next();
    } catch (e) {
      status.textContent = `${t("ck_failed")} (${e.message})`;
    }
  };
  f.querySelector("[data-ok]").addEventListener("click", () => save("ok"));
  f.querySelector("[data-fix]").addEventListener("click", () => save("fixed"));
  f.querySelector("[data-skip]").addEventListener("click", () => (state.skipped.add(item.id), next()));
}
