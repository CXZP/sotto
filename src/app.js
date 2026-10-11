import { powerCheck, outputImpedanceCheck, bestConnection, deviceToDac, headphoneSpecs, required, JACKS } from "./calc.js?v=mv32s2ut";
import { loadData, hpModel, sourceOutputs, evaluate, prices, displayName, HEADPHONE_CATS, SOURCE_CATS } from "./data.js?v=mv32s2ut";
import { renderChart } from "./chart.js?v=mv32s2ut";
import { makeT } from "./i18n.js?v=mv32s2ut";
import { LEARN, aboutPage, REPO } from "./content.js?v=mv32s2ut";
import { LEGAL } from "./legal.js?v=mv32s2ut";
import { track, stats, trackingOff } from "./analytics.js?v=mv32s2ut";
import * as community from "./community.js?v=mv32s2ut";
import { combos, capPoint, parseCode, encodeCode, decodeCode, landed, summarize } from "./deal.js?v=mv32s2ut";
import { redactImage } from "./redact.js?v=mv32s2ut";
import { renderMd, MD_ACTIONS, applyMd } from "./markdown.js?v=mv32s2ut";
import { TERMS, TERM, GLOSSARY_UPDATED } from "./glossary.js?v=mv32s2ut";

const LEVELS = { quiet: 70, normal: 80, loud: 90 };
const CREST = 15;
const JACK_LABEL = { "3.5": "3.5 mm", "6.35": "6.35 mm", "4.4": "4.4 mm", "2.5": "2.5 mm", xlr4: "XLR 4-pin" };
const PLUGS = ["3.5", "6.35", "4.4", "xlr4"];
const PLUG_SHORT = { "3.5": "3.5", "6.35": "6.35", "4.4": "4.4", xlr4: "XLR" };

const state = {
  lang: load("lang", navigator.language?.startsWith("th") ? "th" : "en"),
  mode: load("mode", "simple"),
  device: "phone-usb-c",
  amp: "",
  hp: "",
  plug: "",
  level: "normal",
};
let t = makeT(state.lang);
let db;
let headphones = []; // catalog items we can calculate for
let sources = []; // catalog items with output data
let lastViewKey = "";

function load(key, fallback) {
  try {
    return localStorage.getItem(`sotto.${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(`sotto.${key}`, value);
  } catch {
    /* preferences just don't persist */
  }
}

// ---------------------------------------------------------------------------
// Routing: #build?…  #catalog?…  #item/<id>  #learn  #about

function route() {
  const h = location.hash.slice(1).split("?")[0];
  if (h.startsWith("item/")) return { name: "item", id: decodeURIComponent(h.slice(5)) };
  if (h.startsWith("learn/")) return { name: "learn", term: decodeURIComponent(h.slice(6)) };
  if (h === "discuss/new") return { name: "discuss", sub: "new" };
  if (h.startsWith("discuss/")) return { name: "discuss", sub: "thread", id: h.slice(8) };
  return { name: h || "build" };
}
function query() {
  return new URLSearchParams(location.hash.split("?")[1] ?? "");
}
function readHash() {
  const p = query();
  if (route().name === "build") for (const k of ["device", "amp", "hp", "plug", "level"]) if (p.has(k)) state[k] = p.get(k);
  if (["th", "en"].includes(p.get("lang"))) state.lang = p.get("lang");
  if (["simple", "detail"].includes(p.get("mode"))) state.mode = p.get("mode");
}
function buildUrl() {
  const p = new URLSearchParams();
  for (const k of ["device", "amp", "hp", "plug", "level"]) if (state[k]) p.set(k, state[k]);
  return `#build?${p}`;
}
function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------------------------------------------------------------------------
// Chrome

function bindChrome() {
  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => {
      state.lang = b.dataset.lang;
      save("lang", state.lang);
      render();
    }),
  );
  document.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      state.mode = b.dataset.mode;
      save("mode", state.mode);
      render();
    }),
  );
  const apply = (v) => (v ? (document.documentElement.dataset.theme = v) : delete document.documentElement.dataset.theme);
  apply(load("theme", ""));
  document.getElementById("theme").addEventListener("click", () => {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const next = (document.documentElement.dataset.theme || (dark ? "dark" : "light")) === "dark" ? "light" : "dark";
    apply(next);
    save("theme", next);
  });
}

function renderChrome(r) {
  document.documentElement.lang = state.lang;
  document.querySelector(".tagline").textContent = t("tagline");
  document.querySelector(".hero").hidden = r.name !== "build";
  document.querySelectorAll("nav a").forEach((a) => {
    a.textContent = t(`nav_${a.dataset.route}`);
    a.classList.toggle("active", a.dataset.route === r.name || ((r.name === "item" || r.name === "brands") && a.dataset.route === "catalog"));
  });
  setSeg("[data-lang]", "lang", state.lang);
  const acct = document.getElementById("account-btn");
  if (acct) {
    acct.title = t("ac_title");
    acct.setAttribute("aria-label", t("ac_title"));
    acct.classList.toggle("active", r.name === "account");
  }
  for (const [id, name, key] of [["saved-btn", "saved", "bm_title"], ["inbox-btn", "inbox", "ib_title"]]) {
    const b = document.getElementById(id);
    if (!b) continue;
    b.title = t(key);
    b.setAttribute("aria-label", t(key));
    b.classList.toggle("active", r.name === name);
  }
  setSeg("[data-mode]", "mode", state.mode);
  document.querySelector("[data-mode=simple]").textContent = t("mode_simple");
  document.querySelector("[data-mode=detail]").textContent = t("mode_detail");
  const date = new Date(db.builtAt).toLocaleDateString(state.lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  document.querySelector("footer .foot").innerHTML = `${esc(t("updated", { date, stores: Object.keys(db.stores).length, n: fmt(db.items.length, 0) }))}<br>${esc(t("footer"))} · <a href="#about">${esc(t("nav_about"))}</a> · <a href="#terms">${esc(t("lg_terms"))}</a> · <a href="#privacy">${esc(t("lg_privacy"))}</a> · <a href="#contact">${esc(t("lg_contact"))}</a> · <a href="#stats">${esc(t("st_title"))}</a> · <a href="${REPO}" target="_blank" rel="noopener">GitHub</a>`;
}

function setSeg(selector, key, value) {
  const buttons = [...document.querySelectorAll(selector)];
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[key] === value)));
  buttons[0]?.parentElement.style.setProperty("--i", String(Math.max(buttons.findIndex((b) => b.dataset[key] === value), 0)));
}

function render() {
  t = makeT(state.lang);
  const r = route();
  renderChrome(r);
  const main = document.querySelector("main");
  main.className = `page-${r.name}`;
  if (r.name === "catalog") main.innerHTML = catalogPage();
  else if (r.name === "item") main.innerHTML = itemPage(r.id);
  else if (r.name === "deal") main.innerHTML = dealPage();
  else if (r.name === "brands") main.innerHTML = brandsPage();
  else if (r.name === "chart") main.innerHTML = chartPage();
  else if (r.name === "discuss") main.innerHTML = r.sub === "new" ? newThreadPage() : r.sub === "thread" ? threadPage(r.id) : discussPage();
  else if (r.name === "account") main.innerHTML = accountPage();
  else if (r.name === "saved") main.innerHTML = savedPage();
  else if (r.name === "stats") main.innerHTML = statsPage();
  else if (r.name === "compare") main.innerHTML = comparePage();
  else if (r.name === "gallery") main.innerHTML = galleryPage();
  else if (LEGAL[r.name]) main.innerHTML = `<article class="prose legal">${LEGAL[r.name][state.lang] ?? LEGAL[r.name].en}</article>`;
  else if (r.name === "inbox") main.innerHTML = inboxPage();
  else if (r.name === "learn") main.innerHTML = learnPage(r.term);
  else if (r.name === "about") main.innerHTML = `<article class="prose about">${aboutPage(state.lang, sourceSites(), db.stores)}</article>`;
  else main.innerHTML = buildPage();
  wire(main, r);
  scrollTo({ top: 0 });
  const key = `${r.name}/${r.sub ?? ""}/${r.id ?? r.term ?? ""}`;
  if (key !== lastViewKey) {
    lastViewKey = key;
    track("view", { path: [r.name, r.sub, r.term].filter(Boolean).join("/"), item: r.name === "item" ? r.id : null, lang: state.lang });
  }
}

// ---------------------------------------------------------------------------
// Build page

function currentSource() {
  const device = db.devices.find((d) => d.id === state.device) ?? db.devices[0];
  const amp = state.amp ? findItem(state.amp) : null;
  const outputs = amp ? sourceOutputs(amp) : device.outputs;
  return { device, amp, outputs, label: amp ? displayName(amp) : device.name[state.lang] };
}

function buildPage() {
  const { device, amp } = currentSource();
  const hp = state.hp ? findItem(state.hp) : null;
  const lv = LEVELS[state.level] ?? LEVELS.normal;
  return `<div class="builder">
    <section class="slots card">
      ${slotRow(t("slot_device"), `<div class="select"><select id="device">${db.devices
        .map((d) => `<option value="${d.id}"${d.id === device.id ? " selected" : ""}>${esc(d.name[state.lang])}</option>`)
        .join("")}</select></div>`)}
      ${slotRow(t("slot_amp"), pickedOrButton("amp", amp))}
      ${slotRow(t("slot_hp"), pickedOrButton("hp", hp))}
      ${hp ? slotRow(t("plug"), seg("plug", PLUGS.map((j) => [j, PLUG_SHORT[j]]), plugOf(hp)), !state.plug && !hp.stockPlug ? t("plug_guess") : "") : ""}
      ${slotRow(t("level"), seg("level", [["quiet", t("level_quiet")], ["normal", t("level_normal")], ["loud", t("level_loud")]], state.level), t("level_hint", { avg: lv, peak: lv + CREST }))}
      ${buildTotal(amp, hp)}
      ${amp || hp ? `<div class="slot"><a class="pill small" href="#discuss/new?cat=dream&items=${[amp?.id, hp?.id].filter(Boolean).map(encodeURIComponent).join(",")}">${esc(t("su_save_dream"))}</a> <a class="pill small" href="#discuss/new?cat=setup&items=${[amp?.id, hp?.id].filter(Boolean).map(encodeURIComponent).join(",")}">${esc(t("su_share_setup"))}</a></div>` : ""}
    </section>
    <section class="results"><div id="warn-banner"></div>${hp ? buildResults(hp) : `<div class="card empty"><p>${esc(t("empty"))}</p><button class="pill primary" data-pick="hp">${esc(t("slot_pick"))} ${esc(t("slot_hp"))}</button></div>`}
      <div class="card chart-card" id="chart"></div>
    </section>
  </div>`;
}

function slotRow(label, control, hint = "") {
  return `<div class="slot"><div class="slot-label">${esc(label)}</div><div class="slot-control">${control}${hint ? `<p class="hint">${esc(hint)}</p>` : ""}</div></div>`;
}

function pickedOrButton(slot, item) {
  if (!item) return `<button class="pill" data-pick="${slot}">+ ${esc(t("slot_pick"))}</button>${slot === "amp" ? ` <span class="muted small">${esc(t("slot_none"))}</span>` : ""}`;
  const pr = prices(item).cheapest;
  const im = imageOf(item);
  return `<div class="picked">
    ${im ? `<img class="picked-img" src="${esc(sized(im.src, 160))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
    <a href="#item/${encodeURIComponent(item.id)}" class="picked-name">${esc(displayName(item))}</a>
    <div class="picked-meta">${esc(specLine(item))}${pr ? ` · ${money(pr.price, pr.currency)}` : ""}</div>
    <div class="picked-actions"><button class="link" data-pick="${slot}">${esc(t("slot_change"))}</button><button class="link" data-clear="${slot}">${esc(t("slot_remove"))}</button></div>
  </div>`;
}

function buildTotal(amp, hp) {
  const items = [amp, hp].filter(Boolean).map((i) => prices(i).cheapest).filter(Boolean);
  if (!items.length) return "";
  const cur = new Set(items.map((o) => o.currency));
  const sum = items.reduce((s, o) => s + o.price, 0);
  return `<div class="slot total-row"><div class="slot-label">${esc(t("total"))}</div><div class="slot-control"><b>${
    cur.size === 1 ? money(sum, items[0].currency) : esc(t("mixed_currency"))
  }</b></div></div>`;
}

function plugOf(hp) {
  return state.plug || hp.stockPlug || (hp.category === "headphone" ? "6.35" : "3.5");
}

function buildResults(hp) {
  const src = currentSource();
  const level = LEVELS[state.level] ?? LEVELS.normal;
  const detail = state.mode === "detail";
  const conn = connectionCard(src, hp);
  const ev = src.outputs.length ? evaluate(hp, conn.outputs, { level, crest: CREST }) : { status: "no-output" };
  // With an amp in the chain, "no amp needed" is the wrong message. Say whether the
  // device alone would also have been loud enough, so people don't buy one for loudness.
  let alone = null;
  if (src.amp && src.device.outputs?.length) alone = evaluate(hp, src.device.outputs, { level, crest: CREST }).status;
  return [verdictCard(ev, hp, detail, { amp: src.amp, device: src.device, alone }), conn.html, reverseCard(hp, level)].join("");
}

function connectionCard({ device, amp, outputs }, hp) {
  const steps = [];
  if (amp) {
    const link = deviceToDac(device, amp);
    steps.push(link.status === "adapter" ? `<li class="need">${esc(t("c_lightning"))}</li>` : `<li>${esc(t("c_usb", { amp: displayName(amp) }))}</li>`);
  }
  if (!outputs.length) {
    steps.push(`<li class="danger">${esc(t("v_no_output"))}</li>`);
    return { html: card(t("c_title"), `<ol class="chain">${steps.join("")}</ol>`), outputs: [] };
  }
  const plug = plugOf(hp);
  let usable = outputs;
  if (outputs.every((o) => o.jack)) {
    const best = bestConnection(plug, outputs);
    usable = [best.output];
    if (best.status === "direct") steps.push(`<li>${esc(t("c_jack", { jack: JACK_LABEL[best.output.jack] }))}</li>`);
    else {
      const [from, to] = best.adapter.split("-").map((s) => JACK_LABEL[s.slice(0, -1)]);
      steps.push(`<li class="${best.status === "danger" ? "danger" : "need"}">${esc(t("c_adapter", { from, to }))} <span class="why">— ${esc(t(`note_${best.note.replaceAll("-", "_")}`))}</span></li>`);
    }
    const bal = outputs.find((o) => JACKS[o.jack]?.balanced);
    if (bal && !JACKS[plug]?.balanced && hp.cable?.detachable !== false) steps.push(`<li class="alt">${esc(t("cable_swap", { jack: JACK_LABEL[bal.jack] }))}</li>`);
  } else {
    steps.push(`<li class="need">${esc(t("c_jack_unknown"))}</li>`);
  }
  return { html: card(t("c_title"), `<ol class="chain">${steps.join("")}</ol>`), outputs: usable };
}

const VERDICT = {
  ok: ["good", "v_ok"],
  // Works, but a sensitive IEM on a powerful amp is a hearing and driver risk.
  overkill: ["warn", "v_overkill", "v_overkill_sub"],
  tight: ["warn", "v_tight"],
  insufficient: ["bad", "v_insufficient"],
  ambiguous: ["warn", "v_ambiguous"],
  unknown: ["muted", "v_unknown"],
  "no-output": ["bad", "v_no_output"],
};

function verdictCard(ev, hp, detail, chain = {}) {
  let [tone, key, subKey] = VERDICT[ev.status] ?? VERDICT.unknown;
  if (ev.status === "ok" && chain.amp) key = "v_ok_amp";
  let sub = subKey ? t(subKey) : "";
  if (chain.amp && chain.alone && ["ok", "overkill", "tight"].includes(ev.status))
    sub = [sub, t(["ok", "overkill"].includes(chain.alone) ? "v_alone_ok" : "v_alone_no", { device: chain.device.name[state.lang], amp: displayName(chain.amp) })].filter(Boolean).join(" · ");
  if (ev.status === "ambiguous") sub = t("v_ambiguous_sub", { a: t(VERDICT[ev.r.status][1]), b: t(VERDICT[ev.alt.r.status][1]) });
  else if (ev.unitAmbiguous) sub = t("v_unit_note");
  let body = `<div class="verdict"><span class="badge ${tone}" aria-hidden="true"></span><div><p class="big">${esc(t(key))}</p>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div></div>`;
  if (ev.r) body += meter(ev.r);
  if (ev.z && (ev.z.status === "warn" || ev.z.status === "warn-strong"))
    body += `<p class="note warn">${esc(t("zout_warn", { ratio: fmt(ev.z.ratio, 1), multi: ev.z.status === "warn-strong" ? t("zout_multi") : "" }))}</p>`;
  if (detail && ev.r) body += mathBlock(ev, hp);
  return `<div class="card result ${tone}">${body}</div>`;
}

function meter(r) {
  const lo = 60;
  const hi = 130;
  const pos = (v) => `${((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100}%`;
  return `<div class="meter" role="img" aria-label="${esc(t("max_spl", { spl: fmt(r.maxSpl, 0) }))}">
    <div class="meter-fill" style="width:${pos(r.maxSpl)}"></div>
    <span class="tick" style="left:${pos(r.level)}"><b>${r.level}</b></span>
    <span class="tick peak" style="left:${pos(r.level + r.crest)}"><b>${r.level + r.crest}</b></span>
  </div><p class="meter-cap">${esc(t("max_spl", { spl: fmt(r.maxSpl, 0) }))}</p>`;
}

function mathBlock(ev, hp) {
  const r = ev.r;
  const z = hp.specs.impedance[0];
  const s = hp.specs.sensitivity[0];
  return `<dl class="detail">
    <dt>Impedance</dt><dd>${fmt(z.value, 1)} Ω ${tag(z)} ${quoteLinks(z)}</dd>
    <dt>Sensitivity</dt><dd>${fmt(s.value, 1)} ${s.unit ?? "dB (?)"} → ${fmt(r.dbPerV, 1)} dB/V ${tag(s)} ${quoteLinks(s)}</dd>
    <dt>${state.lang === "th" ? "ต้องใช้ (เฉลี่ย/พีค)" : "Needed (avg/peak)"}</dt><dd>${vfmt(r.avg.vrms)} · ${fmt(r.avg.mw, 3)} mW<br>${vfmt(r.peak.vrms)} · ${fmt(r.peak.ma, 1)} mA · ${fmt(r.peak.mw, 2)} mW</dd>
    <dt>${state.lang === "th" ? "จ่ายได้" : "Available"}</dt><dd>${vfmt(r.available.vrms)} <span class="muted">(${esc(r.available.method)})</span> ${ev.output.source ? srcLink(ev.output.source) : ""}</dd>
    <dt>Headroom</dt><dd>${r.peakMargin >= 0 ? "+" : ""}${fmt(r.peakMargin, 1)} dB</dd>
  </dl><p class="formula small">V = 10^((SPL − S)/20) · S in dB/V · dB/V = dB/mW + 10·log₁₀(1000/Z)</p>`;
}

function reverseCard(hp, level) {
  const rows = sources
    .map((s) => ({ s, ev: evaluate(hp, sourceOutputs(s), { level, crest: CREST }), p: prices(s).cheapest }))
    .filter((x) => x.ev.status !== "unknown")
    .sort((a, b) => rankStatus(a.ev.status) - rankStatus(b.ev.status) || (a.p?.price ?? 1e9) - (b.p?.price ?? 1e9));
  if (!rows.length) return "";
  const shown = rows.slice(0, 12);
  return card(
    t("rev_hp_title", { hp: displayName(hp) }),
    `<p class="sub">${esc(t("rev_hp_sub"))}</p><ul class="rev">${shown
      .map(
        ({ s, ev, p }) => `<li><span class="st s-${ev.status}">${esc(t(`st_${ev.status}`))}</span>
        <button class="link strong" data-set-amp="${esc(s.id)}">${esc(displayName(s))}</button>
        <span class="muted">${esc(t(`cat_${s.category}`))}${s.curated ? ` · ${esc(t("it_checked"))}` : ""}${
          ev.r?.available?.method === "extrapolated" ? ` · <span class="tag" title="">${esc(t("est"))}</span>` : ""
        }</span>
        <span class="price">${p ? money(p.price, p.currency) : ""}</span></li>`,
      )
      .join("")}</ul>${rows.length > 12 ? `<p class="hint">+${rows.length - 12}</p>` : ""}`,
  );
}

function mergeCurves(outputs, srcLabel) {
  const seen = new Map();
  for (const o of outputs) {
    const key = JSON.stringify([o.power, o.voltage, o.vmax, o.vrules]);
    const label = o.jack ? JACK_LABEL[o.jack] : srcLabel;
    const c = seen.get(key);
    if (c) c.label += ` / ${label}`;
    else seen.set(key, { output: o, label, dashed: !!JACKS[o.jack]?.balanced });
  }
  return [...seen.values()];
}

const rankStatus = (s) => ({ ok: 0, overkill: 1, tight: 2, ambiguous: 3, insufficient: 4 })[s] ?? 5;
const statusKey = (s) => (s === "overkill" ? "ok" : s);

/**
 * Voltage chart for one source. Clicking a dot opens a card under the chart
 * (it never navigates away). `opts.big` is the full-page version with filters.
 */
function drawChart(el, outputs, srcLabel, highlightId, opts = {}) {
  if (!el) return;
  const level = LEVELS[opts.level ?? state.level] ?? LEVELS.normal;
  const peak = level + CREST;
  const counts = { ok: 0, overkill: 0, tight: 0, insufficient: 0 };
  const points = [];
  const keep = opts.filter ?? (() => true);
  for (const h of headphones) {
    if (!keep(h)) continue;
    const m = hpModel(h);
    if (!m.unitKnown) continue; // position would be a guess; listed, not plotted
    const { ohms, dbPerV } = headphoneSpecs(m);
    const ev = evaluate(h, outputs, { level, crest: CREST });
    const st = ev.status === "overkill" ? "overkill" : statusKey(ev.status);
    if (counts[st] !== undefined) counts[st]++;
    points.push({ id: h.id, label: displayName(h), z: ohms, v: required(peak, dbPerV, ohms).vrms, status: st, highlight: h.id === highlightId });
  }
  const bigLink = opts.big || !opts.srcParam ? "" : `<a class="pill small" href="#chart?${opts.srcParam}&level=${state.level}">${esc(t("chart_big"))} ↗</a>`;
  el.innerHTML = `<div class="chart-head"><h3>${esc(t("chart_title"))}</h3>${bigLink}</div>
    <details class="howto"${state.mode === "simple" ? " open" : ""}><summary>${esc(t("chart_howto"))}</summary><ol class="small">
      <li>${esc(t("chart_h1"))}</li><li>${esc(t("chart_h2"))}</li><li>${esc(t("chart_h3", { src: srcLabel }))}</li><li>${esc(t("chart_h4"))}</li></ol></details>
    <div class="chart-host${opts.big ? " big" : ""}"></div>
    <p class="hint">${esc(t("chart_count", { n: points.length, ok: counts.ok, over: counts.overkill, tight: counts.tight, bad: counts.insufficient }))}</p>
    <div class="chart-pick" aria-live="polite">${highlightId ? "" : `<p class="muted small">${esc(t("chart_pick_hint"))}</p>`}</div>`;
  const pickBox = el.querySelector(".chart-pick");
  const draw = (hl) =>
    renderChart(el.querySelector(".chart-host"), {
      curves: mergeCurves(outputs, srcLabel),
      points: points.map((p) => ({ ...p, highlight: p.id === hl })),
      peak,
      crest: CREST,
      size: opts.big ? { w: 1100, h: 640 } : undefined,
      labels: { harder: t("chart_harder"), easier: t("chart_easier"), x: t("chart_x"), y: t("chart_y"), need: t("chart_need"), aria: t("chart_aria"), ok: t("st_ok"), overkill: t("st_overkill"), tight: t("st_tight"), insufficient: t("st_insufficient"), ambiguous: t("st_ambiguous") },
      fmt: { z: (z) => `${fmt(z, 1)} Ω`, v: vfmt },
      onPick: (id) => {
        draw(id);
        showPick(id);
      },
    });
  const showPick = (id) => {
    const h = db.byId.get(id);
    const p = points.find((x) => x.id === id);
    if (!h || !p) return;
    const im = imageOf(h);
    const pr = prices(h).cheapest;
    const tone = { ok: "good", overkill: "warn", tight: "warn", insufficient: "bad" }[p.status] ?? "muted";
    pickBox.innerHTML = `<div class="pick-card with-thumb">${im ? `<img class="thumb" src="${esc(sized(im.src, 120))}" alt="" referrerpolicy="no-referrer">` : ""}
      <div class="grow"><b>${esc(displayName(h))}</b>
      <div class="small"><span class="badge ${tone}" aria-hidden="true"></span> ${esc(t(`st_${p.status}`))} · ${esc(t("chart_need"))} ${esc(vfmt(p.v))} @ ${esc(fmt(p.z, 1))} Ω${pr ? ` · ${money(pr.price, pr.currency)}` : ""}</div></div>
      <div class="row-inline"><a class="pill" href="#item/${encodeURIComponent(id)}">${esc(t("chart_open"))}</a>${opts.onUse ? `<button type="button" class="pill primary" data-pick-use>${esc(t("it_add_build"))}</button>` : ""}</div></div>`;
    pickBox.querySelector("[data-pick-use]")?.addEventListener("click", () => opts.onUse(id));
  };
  draw(highlightId);
  if (highlightId) showPick(highlightId);
}

/** #chart?src=<item id>|dev=<device id>&level=&cat=&max=  Full-page chart with filters. */
function chartPage() {
  const p = query();
  const src = p.get("src") ? db.byId.get(p.get("src")) : null;
  const dev = db.devices.find((d) => d.id === p.get("dev")) ?? (src ? null : db.devices[0]);
  const label = src ? displayName(src) : dev.name[state.lang];
  const cat = p.get("cat") ?? "all";
  const level = p.get("level") ?? state.level;
  const link = (over) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(over)) v === null ? n.delete(k) : n.set(k, v);
    return `#chart?${n}`;
  };
  const options = [
    ...db.devices.map((d) => `<option value="dev:${esc(d.id)}"${!src && d.id === dev?.id ? " selected" : ""}>${esc(d.name[state.lang])}</option>`),
    ...[...sources].sort((a, b) => displayName(a).localeCompare(displayName(b))).map((s) => `<option value="src:${esc(s.id)}"${src?.id === s.id ? " selected" : ""}>${esc(displayName(s))}</option>`),
  ].join("");
  return `<div class="chart-page">
    <header class="deal-head"><h1>${esc(t("chart_page_title", { src: label }))}</h1></header>
    <div class="filters">
      <select class="mini-select" id="chart-src" aria-label="${esc(t("slot_amp"))}">${options}</select>
      <div class="chips">${["quiet", "normal", "loud"].map((l) => `<a class="chip${l === level ? " on" : ""}" href="${link({ level: l })}">${esc(t(`level_${l}`))}</a>`).join("")}</div>
      <div class="chips">${["all", "iem", "headphone"].map((c) => `<a class="chip${c === cat ? " on" : ""}" href="${link({ cat: c })}">${esc(t(`cat_${c}`))}</a>`).join("")}</div>
      <label class="check">${esc(t("chart_max"))} <input class="search num" id="chart-max" inputmode="decimal" style="max-width:110px" value="${esc(p.get("max") ?? "")}" placeholder="USD"></label>
    </div>
    <div class="card chart-card" id="chart"></div>
  </div>`;
}

function wireChartPage(main) {
  const p = query();
  const src = p.get("src") ? db.byId.get(p.get("src")) : null;
  const dev = db.devices.find((d) => d.id === p.get("dev")) ?? db.devices[0];
  const outputs = src ? sourceOutputs(src) : dev.outputs;
  const cat = p.get("cat") ?? "all";
  const max = Number(p.get("max")) || Infinity;
  drawChart(main.querySelector("#chart"), outputs, src ? displayName(src) : dev.name[state.lang], null, {
    big: true,
    level: p.get("level") ?? state.level,
    filter: (h) => (cat === "all" || h.category === cat) && (max === Infinity || (prices(h).cheapest?.price ?? Infinity) <= max),
    onUse: (id) => {
      state.hp = id;
      state.plug = "";
      if (src) state.amp = src.id;
      else {
        state.amp = "";
        state.device = dev.id;
      }
      go(buildUrl());
    },
  });
  main.querySelector("#chart-src").addEventListener("change", (e) => {
    const [kind, id] = e.target.value.split(/:(.*)/);
    const n = query();
    n.delete("src");
    n.delete("dev");
    n.set(kind, id);
    go(`#chart?${n}`);
  });
  const maxIn = main.querySelector("#chart-max");
  maxIn.addEventListener("change", () => {
    const n = query();
    maxIn.value ? n.set("max", maxIn.value) : n.delete("max");
    go(`#chart?${n}`);
  });
}

// ---------------------------------------------------------------------------
// Picker (modal)

function openPicker(slot) {
  const cats = slot === "hp" ? HEADPHONE_CATS : SOURCE_CATS;
  const usable = new Set((slot === "hp" ? headphones : sources).map((i) => i.id));
  const pool = db.items.filter((i) => cats.has(i.category));
  const dlg = document.createElement("div");
  dlg.className = "modal";
  dlg.innerHTML = `<div class="sheet card" role="dialog" aria-modal="true" aria-label="${esc(t(`picker_title_${slot}`))}">
    <div class="sheet-head"><h2>${esc(t(`picker_title_${slot}`))}</h2><button class="icon-btn" data-close aria-label="${esc(t("close"))}">✕</button></div>
    <input class="search" type="search" placeholder="${esc(t("search"))}" autofocus>
    <label class="check"><input type="checkbox" checked> ${esc(t("picker_only_specs"))}</label>
    <ul class="pick-list"></ul></div>`;
  document.body.append(dlg);
  const input = dlg.querySelector("input.search");
  const only = dlg.querySelector(".check input");
  const list = dlg.querySelector(".pick-list");
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const res = pool
      .filter((i) => (!only.checked || usable.has(i.id)) && (!q || matches(i, q)))
      .sort((a, b) => Number(usable.has(b.id)) - Number(usable.has(a.id)) || Number(!!b.curated) - Number(!!a.curated) || b.offers.length - a.offers.length)
      .slice(0, 80);
    list.innerHTML = res
      .map((i) => {
        const p = prices(i).cheapest;
        const im = imageOf(i);
        return `<li><button data-id="${esc(i.id)}">${im ? `<img class="pt-img" src="${esc(sized(im.src, 96))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="pt-img"></span>`}<span class="pn">${esc(displayName(i))}</span><span class="pm">${esc(t(`cat_${i.category}`))} · ${esc(specLine(i) || "—")}</span><span class="pp">${p ? money(p.price, p.currency) : ""}</span></button></li>`;
      })
      .join("");
  };
  const close = () => dlg.remove();
  input.addEventListener("input", draw);
  only.addEventListener("change", draw);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) close();
    const b = e.target.closest("button[data-id]");
    if (b) {
      state[slot] = b.dataset.id;
      if (slot === "hp") state.plug = "";
      close();
      go(buildUrl());
    }
  });
  dlg.addEventListener("keydown", (e) => e.key === "Escape" && close());
  draw();
  input.focus();
}

// ---------------------------------------------------------------------------
// Catalog page

function catalogPage() {
  const p = query();
  const q = (p.get("q") ?? "").toLowerCase();
  const cat = p.get("cat") ?? "all";
  const specsOnly = p.get("specs") === "1";
  const stockOnly = p.get("stock") === "1";
  const limit = Number(p.get("n") ?? 60);
  const brand = p.get("brand") ?? "";
  const mat = p.get("mat") ?? "";
  const cats = ["all", "iem", "headphone", "dongle", "desktop", "dap"];
  const res = db.items.filter(
    (i) =>
      (cat === "all" || i.category === cat) &&
      (!brand || i.brand === brand) &&
      (!mat || i.materials?.[mat] || i.styles?.[mat]) &&
      (!q || matches(i, q)) &&
      (!specsOnly || hpModel(i) || sourceOutputs(i).length) &&
      (!stockOnly || i.offers.some((o) => o.available)),
  );
  const sort = p.get("sort") ?? "popular";
  const view = p.get("view") ?? "grid";
  const priceOf = (i) => prices(i).cheapest?.price ?? Infinity;
  if (sort === "price") res.sort((a, b) => priceOf(a) - priceOf(b));
  else if (sort === "price-desc") res.sort((a, b) => (priceOf(b) === Infinity ? -1 : priceOf(b)) - (priceOf(a) === Infinity ? -1 : priceOf(a)));
  // "Most stocked": how many of the tracked stores carry it. We have no sales or
  // view data, so we don't call this "popular".
  else res.sort((a, b) => storeCount(b) - storeCount(a) || priceOf(a) - priceOf(b));
  const link = (over) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(over)) v === null ? n.delete(k) : n.set(k, v);
    return `#catalog?${n}`;
  };
  const shown = res.slice(0, limit);
  const grid = `<div class="grid">${shown
    .map((i) => {
      const pr = prices(i).cheapest;
      const im = imageOf(i);
      return `<a class="tile card" href="#item/${encodeURIComponent(i.id)}">
        <div class="tile-img">${im ? `<img src="${esc(sized(im.src, 480))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}</div>
        <div class="tile-body"><div class="tile-name">${esc(displayName(i))}</div>
        <div class="muted small">${esc(t(`cat_${i.category}`))}${specLine(i) ? ` · ${esc(specLine(i))}` : ""}</div>
        <div class="tile-price">${pr ? money(pr.price, pr.currency) : "—"}</div></div></a>`;
    })
    .join("")}</div>`;
  return `<div class="catalog">
    <div class="filters">
      <input class="search" type="search" id="cq" placeholder="${esc(t("search"))}" value="${esc(p.get("q") ?? "")}">
      <select class="mini-select" id="cbrand" aria-label="${esc(t("brand"))}"><option value="">${esc(t("brand_all"))}</option>${brandOptions(cat, brand)}</select>
      <div class="chips">${cats.map((c) => `<a class="chip${c === cat ? " on" : ""}" href="${link({ cat: c, n: null })}">${esc(t(`cat_${c}`))}</a>`).join("")}</div>
      <div class="chips">
        <a class="chip${specsOnly ? " on" : ""}" href="${link({ specs: specsOnly ? null : "1", n: null })}">${esc(t("only_specs"))}</a>
        <a class="chip${stockOnly ? " on" : ""}" href="${link({ stock: stockOnly ? null : "1", n: null })}">${esc(t("only_stock"))}</a>
      </div>
      <div class="chips">${["popular", "price", "price-desc"].map((s) => `<a class="chip${s === sort ? " on" : ""}" href="${link({ sort: s, n: null })}">${esc(t(`sort_${s}`))}</a>`).join("")}</div>
      <div class="chips">${["grid", "table"].map((v) => `<a class="chip${v === view ? " on" : ""}" href="${link({ view: v })}">${esc(t(`view_${v}`))}</a>`).join("")}</div>
      <div class="chips"><span class="muted small">${esc(t("mat_label"))}</span>${["", "resin", "wood", "metal", "ceramic", "carbon", "glass", "clear"].map((m) => `<a class="chip${m === mat ? " on" : ""}" href="${link({ mat: m || null, n: null })}">${esc(t(m ? `mat_${m}` : "cat_all"))}</a>`).join("")}</div>
      <a class="chip" href="#brands">${esc(t("brands_all"))}</a>
      <a class="chip ext-chip" href="https://buildhifi.com/parts" target="_blank" rel="noopener">${esc(t("speakers"))}</a>
      <span class="muted small">${esc(t("n_results", { n: fmt(res.length, 0) }))}</span>
    </div>
    ${view === "grid" ? grid : `<div class="table-wrap card"><table class="cat-table">
      <thead><tr><th>${esc(t("col_product"))}</th><th>${esc(t("col_imp"))}</th><th>${esc(t("col_sens"))} / ${esc(t("col_power"))}</th><th>${esc(t("col_price"))}</th><th>${esc(t("col_stores"))}</th></tr></thead>
      <tbody>${shown
        .map((i) => {
          const pr = prices(i);
          const stores = new Set(i.offers.map((o) => o.store)).size;
          const im = imageOf(i);
          return `<tr><td class="with-thumb">${im ? `<img class="thumb" src="${esc(sized(im.src, 96))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="thumb"></span>`}<div><a href="#item/${encodeURIComponent(i.id)}" class="strong">${esc(displayName(i))}</a><div class="muted small">${esc(t(`cat_${i.category}`))}${i.curated ? ` · ${esc(t("it_checked"))}` : ""}</div></div></td>
          <td>${i.specs?.impedance ? `${fmt(i.specs.impedance[0].value, 1)} Ω` : "—"}</td>
          <td>${sensOrPower(i)}</td>
          <td>${pr.cheapest ? money(pr.cheapest.price, pr.cheapest.currency) : "—"}</td>
          <td>${stores || "—"}</td></tr>`;
        })
        .join("")}</tbody></table></div>`}
    ${res.length > limit ? `<div class="more"><a class="pill" href="${link({ n: limit + 120 })}">${esc(t("more"))}</a></div>` : ""}
  </div>`;
}

const storeCount = (i) => new Set(i.offers.map((o) => o.store)).size;

/** Brands in the current category, A–Z, with counts. */
function brandOptions(cat, selected) {
  const count = new Map();
  for (const i of db.items) if (i.brand && (cat === "all" || i.category === cat)) count.set(i.brand, (count.get(i.brand) ?? 0) + 1);
  if (selected && !count.has(selected)) count.set(selected, 0);
  return [...count]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
    .map(([b, n]) => `<option value="${esc(b)}"${b === selected ? " selected" : ""}>${esc(b)} (${n})</option>`)
    .join("");
}

/** Every brand A–Z, each shown with photos of its most-stocked models (no logos: see i18n brands_note). */
function brandsPage() {
  const by = new Map();
  for (const i of db.items) if (i.brand) (by.get(i.brand) ?? by.set(i.brand, []).get(i.brand)).push(i);
  const brands = [...by].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
  const letter = (b) => (/^[a-z]/i.test(b) ? b[0].toUpperCase() : "#");
  const letters = [...new Set(brands.map(([b]) => letter(b)))];
  let html = "";
  let current = "";
  for (const [b, items] of brands) {
    const L = letter(b);
    if (L !== current) {
      if (current) html += "</div>";
      html += `<h2 class="brand-letter" id="brand-${L}">${L}</h2><div class="brand-grid">`;
      current = L;
    }
    const pics = [...items].sort((x, y) => storeCount(y) - storeCount(x)).map(imageOf).filter(Boolean).slice(0, 3);
    const cats = [...new Set(items.map((i) => t(`cat_${i.category}`)))].slice(0, 3).join(" · ");
    html += `<a class="brand-tile card" href="#catalog?brand=${encodeURIComponent(b)}"><div class="brand-pics">${pics.map((im) => `<img src="${esc(sized(im.src, 160))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`).join("")}</div>
      <div class="brand-body"><b>${esc(b)}</b><span class="muted small">${esc(t("n_results", { n: items.length }))} · ${esc(cats)}</span></div></a>`;
  }
  if (current) html += "</div>";
  return `<div class="brands"><header class="deal-head"><h1>${esc(t("brands_all"))}</h1><p class="muted small">${esc(t("brands_note"))}</p></header>
    <nav class="az">${letters.map((L) => `<a href="#brands" data-jump="brand-${L}">${L}</a>`).join("")}</nav>${html}</div>`;
}

/** Material / look tags, each with the store sentence it came from. */
function looksLine(i) {
  const tags = [...Object.entries(i.materials ?? {}), ...Object.entries(i.styles ?? {})];
  if (!tags.length) return "";
  return `<p class="looks">${tags
    .map(([k, e]) => `<a class="chip small-chip" href="#catalog?mat=${k}" title="${esc(`${t("mat_from")}: “${e.quote}”`)}">${esc(t(`mat_${k}`))}</a>`)
    .join("")} <span class="muted small">${esc(t("mat_note"))}</span></p>`;
}

function sensOrPower(i) {
  const s = i.specs?.sensitivity?.[0];
  if (s && HEADPHONE_CATS.has(i.category)) return `${fmt(s.value, 1)} ${s.unit ?? `dB <span class="tag">${esc(t("unit_unknown"))}</span>`}`;
  const out = sourceOutputs(i)[0];
  const at32 = out?.power?.find((p) => p.load === 32) ?? out?.power?.[0];
  return at32 ? `${fmt(at32.mw, 0)} mW @ ${at32.load} Ω` : "—";
}

// ---------------------------------------------------------------------------
// Item page

// ---------------------------------------------------------------------------
// Search: every word typed must appear somewhere in brand + model, in any
// order, ignoring spaces, hyphens and case; roman numerals match digits.
// "reference crinear", "chu2", "chu ii" and "dx5ii" all work.

const ROMAN = { ii: "2", iii: "3", iv: "4" };
const normWords = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9ก-๙]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w);
const searchText = new WeakMap();
function haystack(i) {
  let h = searchText.get(i);
  if (!h) {
    const words = normWords(`${i.brand ?? ""} ${i.model}`);
    h = `${words.join(" ")} ${words.join("")}`;
    searchText.set(i, h);
  }
  return h;
}
function matches(i, q) {
  const h = haystack(i);
  return normWords(q).every((w) => h.includes(w));
}
/** Lower is better: name starts with the query, then shorter names. */
function searchRank(i, q) {
  const h = haystack(i);
  const first = normWords(q).join(" ");
  return (h.startsWith(first) || normWords(i.model).join(" ").startsWith(first) ? 0 : 1000) + h.length;
}

/** Old links keep working after catalog ids change: match on brand + hyphen-free model, roman numerals as digits. */
function findItem(id) {
  if (db.byId.has(id)) return db.byId.get(id);
  const norm = (k) => {
    const [b, m = ""] = k.split("--");
    return `${b}--${m.split("-").map((w) => ({ ii: "2", iii: "3", iv: "4" })[w] ?? w).join("")}`;
  };
  const want = norm(id);
  return db.items.find((x) => norm(x.id) === want) ?? null;
}

function itemPage(id) {
  const i = findItem(id);
  if (!i) return `<div class="card empty"><p>${esc(t("it_not_found"))}</p></div>`;
  const isHp = HEADPHONE_CATS.has(i.category);
  const isSrc = SOURCE_CATS.has(i.category);
  const pr = prices(i);
  const report = `${REPO}/issues/new?title=${encodeURIComponent(`Data: ${displayName(i)}`)}&body=${encodeURIComponent(`Item: ${i.id}\nWhat's wrong:\nCorrect value + source link:\n`)}`;
  const specRows = ["impedance", "sensitivity", "zout"]
    .filter((f) => i.specs?.[f])
    .map((f) => {
      const list = i.specs[f];
      const conflict = new Set(list.map((e) => `${e.value}${e.unit ?? ""}`)).size > 1;
      return `<div class="spec"><div class="spec-name">${esc(f === "zout" ? "Output impedance" : f[0].toUpperCase() + f.slice(1))}${conflict ? ` <span class="tag warn">${esc(t("it_conflict"))}</span>` : ""}</div>
        <ul>${list.map((e) => `<li><b>${fmt(e.value, 2)} ${f === "sensitivity" ? e.unit ?? `dB <span class="tag">${esc(t("unit_unknown"))}</span>` : "Ω"}</b> ${tag(e)} ${quoteLinks(e, true)}</li>`).join("")}</ul></div>`;
    })
    .join("");
  const outs = isSrc ? sourceOutputs(i) : [];
  const powerRows = outs.length
    ? `<div class="spec"><div class="spec-name">${esc(t("it_power_title"))}</div><ul>${outs
        .map((o) => `<li><b>${o.jack ? JACK_LABEL[o.jack] : "—"}</b> ${(o.power ?? []).map((p) => `${fmt(p.mw, 0)} mW @ ${p.load} Ω`).join(" · ")}${(o.voltage ?? []).map((p) => `${p.vrms} V @ ${p.load} Ω`).join(" · ")}${o.vmax ? ` · max ${o.vmax} Vrms` : ""}${o.vrules ? o.vrules.map((r) => ` · ${r.vrms} V (<${r.maxLoad} Ω)`).join("") : ""} ${srcLink(o.source)}</li>`)
        .join("")}</ul></div>`
    : "";
  const notes = (i.notes ?? []).map((n) => `<li>${esc(n[state.lang])} ${n.source ? srcLink(n.source) : ""}</li>`).join("");
  const im = imageOf(i);
  const name = displayName(i);
  const issueQuery = `"${name}" (issue OR problem OR broken OR dead OR defect OR short)`;
  const issueLinks = [
    ["Reddit", `https://www.reddit.com/search/?q=${encodeURIComponent(issueQuery)}`],
    ["Head-Fi", `https://www.google.com/search?q=${encodeURIComponent(`site:head-fi.org ${issueQuery}`)}`],
    ["ASR", `https://www.google.com/search?q=${encodeURIComponent(`site:audiosciencereview.com ${issueQuery}`)}`],
  ];
  return `<article class="item">
    <header class="item-head${im ? " has-img" : ""}">
      ${im ? `<a class="item-img" href="${esc(im.url)}" target="_blank" rel="noopener"><img src="${esc(sized(im.src, 720))}" alt="${esc(name)}" referrerpolicy="no-referrer"><span class="img-credit">${esc(t("img_from", { store: db.stores[im.store]?.name ?? im.store }))}</span></a>` : ""}
      <div class="item-title"><p class="muted">${i.brand ? `<a href="#catalog?brand=${encodeURIComponent(i.brand)}">${esc(i.brand)}</a> · ` : ""}${esc(t(`cat_${i.category}`))}${i.curated ? ` · ${esc(t("it_checked"))}` : ""}${i.drivers ? ` · ${esc(i.drivers)}` : ""}</p>
      <h1>${esc(displayName(i))}</h1>
      ${looksLine(i)}
      ${pr.cheapest ? `<p class="price-big">${esc(t("price_from"))} ${money(pr.cheapest.price, pr.cheapest.currency)} <span class="muted">· ${esc(t("stores", { n: new Set(i.offers.map((o) => o.store)).size }))}</span></p>` : ""}
      <div class="item-actions">${isHp || isSrc ? `<button class="pill primary" data-use="${esc(i.id)}" data-slot="${isHp ? "hp" : "amp"}">${esc(t("it_add_build"))}</button>` : ""}${bmButton("item", i.id)}<button type="button" class="pill" data-copy="${esc(`${location.origin}${location.pathname.replace(/[^/]*$/, "")}p/${i.id}/`)}">${esc(t("ds_share"))}</button><a class="pill" href="#compare?ids=${encodeURIComponent(i.id)}">${esc(t("cmp_btn"))}</a><a class="pill" href="#deal?item=${encodeURIComponent(i.id)}">${esc(t("it_deal"))}</a><a class="pill" href="${report}" target="_blank" rel="noopener">${esc(t("it_report"))}</a></div>
      <p class="issue-search small">${esc(t("sq_label"))} ${searchLinks(i).map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a>`).join(" · ")}</p>
      <p class="issue-search small">${esc(t("it_issue_search"))} ${issueLinks.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`).join(" · ")}</p></div>
    </header>
    <div class="item-grid">
      <section class="card pad"><h3>${esc(t("it_specs"))}</h3>${specRows || powerRows ? specRows + powerRows : `<p class="muted">${esc(t("it_no_specs"))}</p>`}${notes ? `<ul class="notes">${notes}</ul>` : ""}</section>
      <section class="card pad"><h3>${esc(t("it_offers"))}</h3><p class="muted small">${esc(t("pr_feed_note"))}</p>${offersTable(pr.offers)}</section>
    </div>
    <section class="card pad paid" id="paid"></section>
    ${channelsCard(i)}
    <section class="card pad community" id="community"></section>
    <section class="card pad item-threads" id="item-threads"></section>
    ${isHp && hpModel(i) ? `<div id="item-rev"></div>` : ""}
    ${isSrc && outs.length ? `<div class="card chart-card" id="chart"></div>` : ""}
  </article>`;
}

function offersTable(offers) {
  if (!offers.length) return `<p class="muted">—</p>`;
  return `<ul class="offers">${offers
    .map(
      (o) => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener" class="strong">${esc(db.stores[o.store]?.name ?? o.store)}</a>
      <span class="muted small">${esc(o.title)}${o.condition !== "new" ? ` · ${esc(t("cond_used"))}` : ""}${o.seenAt ? ` · ${esc(t("pr_seen", { date: day(o.seenAt) }))}` : ""}</span>
      <span class="price">${money(o.price, o.currency)}${o.suspect ? ` <span class="tag warn">${esc(t("suspect"))}</span>` : ""}</span><span class="stock ${o.available ? "in" : "out"}">${esc(t(o.available ? "in_stock" : "out_stock"))}</span></li>`,
    )
    .join("")}</ul>`;
}

// ---------------------------------------------------------------------------
// Event wiring after each render

function wire(main, r) {
  if (r.name === "build") {
    main.querySelector("#device")?.addEventListener("change", (e) => {
      state.device = e.target.value;
      go(buildUrl());
    });
    const src = currentSource();
    if (src.outputs.length)
      drawChart(main.querySelector("#chart"), src.outputs, src.label, state.hp, {
        srcParam: src.amp ? `src=${encodeURIComponent(src.amp.id)}` : `dev=${encodeURIComponent(src.device.id)}`,
        onUse: (id) => {
          state.hp = id;
          state.plug = "";
          go(buildUrl());
        },
      });
    else main.querySelector("#chart").remove();
    warnBanner(main.querySelector("#warn-banner"), [state.amp, state.hp].filter(Boolean));
  }
  if (r.name === "item") {
    const i = findItem(r.id);
    if (i && SOURCE_CATS.has(i.category) && sourceOutputs(i).length)
      drawChart(main.querySelector("#chart"), sourceOutputs(i), displayName(i), null, {
        srcParam: `src=${encodeURIComponent(i.id)}`,
        onUse: (id) => {
          state.amp = i.id;
          state.hp = id;
          state.plug = "";
          go(buildUrl());
        },
      });
    const rev = main.querySelector("#item-rev");
    if (rev) rev.outerHTML = reverseCard(i, LEVELS.normal);
    if (i) renderCommunity(main.querySelector("#community"), i);
    if (i) renderPaid(main.querySelector("#paid"), i);
    if (i) renderItemThreads(main.querySelector("#item-threads"), i);
    main.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => navigator.clipboard?.writeText(b.dataset.copy).then(() => (b.textContent = t("copied")))));
  }
  if (r.name === "deal") wireDeal(main);
  if (r.name === "chart") wireChartPage(main);
  if (r.name === "discuss") (r.sub === "new" ? wireNewThread : r.sub === "thread" ? wireThread : wireDiscuss)(main);
  if (r.name === "account") wireAccount(main);
  if (r.name === "saved") wireSaved(main);
  if (r.name === "stats") wireStats(main);
  if (r.name === "compare") wireCompare(main);
  if (r.name === "gallery") wireGallery(main);
  if (r.name === "inbox") wireInbox(main);
  if (r.name === "item") wireBookmarks(main);
  main.querySelectorAll("[data-jump]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: "smooth" });
    }),
  );
  if (r.name === "learn") wireTool(main.querySelector("[data-tool]"));
  if (r.name === "catalog") {
    main.querySelector("#cbrand")?.addEventListener("change", (e) => {
      const p = query();
      e.target.value ? p.set("brand", e.target.value) : p.delete("brand");
      p.delete("n");
      go(`#catalog?${p}`);
    });
    const input = main.querySelector("#cq");
    let timer;
    input?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const p = query();
        input.value ? p.set("q", input.value) : p.delete("q");
        p.delete("n");
        history.replaceState(null, "", `#catalog?${p}`);
        const pos = input.selectionStart;
        render();
        const again = document.querySelector("#cq");
        again.focus();
        again.setSelectionRange(pos, pos);
      }, 180);
    });
  }
  main.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => openPicker(b.dataset.pick)));
  main.querySelectorAll("[data-clear]").forEach((b) =>
    b.addEventListener("click", () => {
      state[b.dataset.clear] = "";
      go(buildUrl());
    }),
  );
  main.querySelectorAll(".seg button").forEach((b) =>
    b.addEventListener("click", () => {
      state[b.dataset.name] = b.dataset.value;
      go(buildUrl());
    }),
  );
  main.querySelectorAll("[data-set-amp]").forEach((b) =>
    b.addEventListener("click", () => {
      state.amp = b.dataset.setAmp;
      if (route().name === "item") state.hp = route().id;
      go(buildUrl());
    }),
  );
  main.querySelectorAll("[data-use]").forEach((b) =>
    b.addEventListener("click", () => {
      state[b.dataset.slot] = b.dataset.use;
      if (b.dataset.slot === "hp") state.plug = "";
      go(buildUrl());
    }),
  );
}

// ---------------------------------------------------------------------------
// Community (Supabase). Everything here is optional: if it can't load, the
// rest of the page is unaffected.

async function warnBanner(el, ids) {
  if (!el || !ids.length) return;
  const { ok, rows } = await community.reportsFor(ids);
  if (!ok) return;
  const issues = rows.filter((r) => r.kind === "issue");
  if (!issues.length || !el.isConnected) return;
  const byItem = ids
    .map((id) => ({ id, n: issues.filter((r) => r.item_id === id).length, item: db.byId.get(id) }))
    .filter((x) => x.n && x.item);
  el.innerHTML = `<div class="card banner warn"><span class="badge warn" aria-hidden="true"></span><div>
    <p class="big">${esc(t("cm_banner"))}</p>
    <ul>${byItem.map((x) => `<li><a href="#item/${encodeURIComponent(x.id)}">${esc(displayName(x.item))}</a> — ${esc(t("cm_banner_n", { n: x.n }))}</li>`).join("")}</ul>
  </div></div>`;
}

async function renderCommunity(el, item) {
  if (!el) return;
  el.innerHTML = `<h3>${esc(t("cm_title"))}</h3><p class="muted small">${esc(t("cm_loading"))}</p>`;
  const { ok, rows } = await community.reportsFor([item.id]);
  if (!el.isConnected) return;
  if (!ok) {
    el.innerHTML = `<h3>${esc(t("cm_title"))}</h3><p class="muted">${esc(t("cm_offline"))}</p>`;
    return;
  }
  const s = await community.session();
  if (!el.isConnected) return;
  const profile = s ? await community.myProfile() : null;
  const mine = s ? await community.myConfirms(rows.map((r) => r.id)) : new Set();
  const responses = await community.responsesFor(rows.filter((r) => r.kind === "issue").map((r) => r.id));
  const rep = s ? await community.myBrand() : null;
  const canRespond = rep && item.brand && rep.brand.toLowerCase() === item.brand.toLowerCase();
  const order = { issue: 0, owner: 1, correction: 2 };
  rows.sort((a, b) => order[a.kind] - order[b.kind] || b.confirms - a.confirms);

  const post = (r) => `<article class="post k-${r.kind}">
    <div class="post-head"><span class="tag ${r.kind === "issue" ? "warn" : ""}">${esc(t(`cm_kind_${r.kind}`))}</span>
      ${r.purchase === "free_sample" ? `<span class="tag">${esc(t("cm_free_sample"))}</span>` : r.purchase === "bought" ? `<span class="tag">${esc(t("cm_bought"))}</span>` : ""}
      <span class="muted small">${esc(r.author ? r.author_name || t("cm_user") : t("cm_maintainer"))} · ${new Date(r.created_at).toLocaleDateString(state.lang === "th" ? "th-TH" : "en-GB")}</span></div>
    <p class="post-title">${esc(r.title)}</p>
    ${r.body ? `<p class="post-body">${esc(r.body)}</p>` : ""}
    ${r.evidence_url ? `<p class="small">${esc(t("cm_evidence"))}: ${srcLink(r.evidence_url)}</p>` : ""}
    <div class="post-actions">
      <button class="pill small${mine.has(r.id) ? " on" : ""}" data-confirm="${r.id}" ${s ? "" : "disabled"} aria-pressed="${mine.has(r.id)}">${esc(t("cm_metoo"))} · ${r.confirms}</button>
      ${s && r.author !== s.user.id ? `<button class="link small" data-flag="${r.id}">${esc(t("cm_flag"))}</button>` : ""}
      ${s && r.author === s.user.id ? `<button class="link small" data-del="${r.id}">${esc(t("cm_delete"))}</button>` : ""}
      ${canRespond && r.kind === "issue" ? `<button class="link small" data-respond="${r.id}">${esc(t("br_respond"))}</button>` : ""}
    </div>
    ${responses
      .filter((x) => x.report_id === r.id)
      .map(
        (x) => `<div class="brand-response"><div class="small"><span class="brand-badge">✓ ${esc(x.brand)}</span> <b>${esc(x.author_name || x.brand)}</b>${x.author_title ? ` · ${esc(x.author_title)}` : ""} · ${esc(ago(x.created_at))}</div><div class="md">${renderMd(x.body)}</div>${s && x.author === s.user.id ? `<button class="link small" data-del-resp="${x.id}">${esc(t("cm_delete"))}</button>` : ""}</div>`,
      )
      .join("")}
    <div class="respond-slot"></div></article>`;

  let composer;
  if (!s) {
    composer = `<form class="cm-form" data-form="signin"><p class="small">${esc(t("cm_signin_why"))}</p>
      <div class="row-inline"><input class="search" type="email" name="email" required placeholder="you@example.com"><button class="pill primary">${esc(t("cm_signin"))}</button></div></form>`;
  } else if (!profile) {
    composer = `<form class="cm-form" data-form="profile"><p class="small">${esc(t("cm_name_why"))}</p>
      <div class="row-inline"><input class="search" name="name" required minlength="2" maxlength="40" placeholder="${esc(t("cm_name"))}"><button class="pill primary">${esc(t("cm_save"))}</button></div></form>`;
  } else {
    composer = `<form class="cm-form" data-form="post">
      <div class="seg" role="group" style="--n:3;--i:0" data-kind-seg>
        ${["issue", "owner", "correction"].map((k, n) => `<button type="button" data-kind="${k}" aria-pressed="${n === 0}">${esc(t(`cm_kind_${k}`))}</button>`).join("")}
      </div>
      <input type="hidden" name="kind" value="issue">
      <input class="search" name="title" required minlength="5" maxlength="140" placeholder="${esc(t("cm_ph_title"))}">
      <textarea class="search" name="body" maxlength="2000" rows="3" placeholder="${esc(t("cm_ph_body"))}"></textarea>
      <input class="search" name="evidence_url" type="url" pattern="https://.+" placeholder="${esc(t("cm_ph_evidence"))}" required>
      <label class="check"><select name="purchase" class="mini-select">
        <option value="bought">${esc(t("cm_bought"))}</option><option value="free_sample">${esc(t("cm_free_sample"))}</option><option value="unknown">${esc(t("cm_unknown"))}</option>
      </select></label>
      <p class="muted small">${esc(t("cm_rules"))}</p>
      <div class="row-inline"><button class="pill primary">${esc(t("cm_post"))}</button><span class="muted small">${esc(t("cm_as", { name: profile.display_name }))}</span><button type="button" class="link small" data-signout>${esc(t("cm_signout"))}</button></div>
    </form>`;
  }

  el.innerHTML = `<h3>${esc(t("cm_title"))}</h3><p class="muted small">${esc(t("cm_disclaimer"))}</p>
    ${rows.length ? rows.map(post).join("") : `<p class="muted">${esc(t("cm_empty"))}</p>`}
    <div class="composer">${composer}<p class="small status" role="status"></p></div>`;

  const status = el.querySelector(".status");
  const fail = (e) => (status.textContent = /rate_limit/.test(e?.message) ? t("cm_rate") : `${t("cm_error")} ${e?.message ?? ""}`);
  const again = () => renderCommunity(el, item);
  el.querySelectorAll("[data-respond]").forEach((b) =>
    b.addEventListener("click", () => {
      const slot = b.closest("article").querySelector(".respond-slot");
      if (slot.innerHTML) return (slot.innerHTML = "");
      slot.innerHTML = `<form class="cm-form"><p class="small">${esc(t("br_respond_hint", { brand: rep.brand }))}</p>${mdEditor("body", 3, "", 5000)}<div class="row-inline"><button class="pill primary small">${esc(t("ds_send"))}</button></div><p class="small status"></p></form>`;
      wireMd(slot);
      slot.querySelector("form").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        try {
          await community.addResponse({ report_id: Number(b.dataset.respond), brand: rep.brand, body: ev.target.body.value.trim() });
          again();
        } catch (e) {
          ev.target.querySelector(".status").textContent = `${t("cm_error")} ${e.message}`;
        }
      });
    }),
  );
  el.querySelectorAll("[data-del-resp]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(t("cm_delete_q"))) return;
      try {
        await community.deleteResponse(Number(b.dataset.delResp));
        again();
      } catch (e) {
        fail(e);
      }
    }),
  );

  el.querySelectorAll("[data-confirm]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await community.setConfirm(Number(b.dataset.confirm), b.getAttribute("aria-pressed") !== "true");
        again();
      } catch (e) {
        fail(e);
      }
    }),
  );
  el.querySelectorAll("[data-flag]").forEach((b) =>
    b.addEventListener("click", async () => {
      const reason = prompt(t("cm_flag_reason"));
      if (!reason) return;
      try {
        await community.flag(Number(b.dataset.flag), reason);
        status.textContent = t("cm_flagged");
      } catch (e) {
        fail(e);
      }
    }),
  );
  el.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(t("cm_delete_q"))) return;
      try {
        await community.deleteReport(Number(b.dataset.del));
        again();
      } catch (e) {
        fail(e);
      }
    }),
  );
  el.querySelector("[data-signout]")?.addEventListener("click", async () => {
    await community.signOut();
    again();
  });
  const seg = el.querySelector("[data-kind-seg]");
  seg?.querySelectorAll("button").forEach((b, n) =>
    b.addEventListener("click", () => {
      seg.style.setProperty("--i", String(n));
      seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const form = el.querySelector('[data-form="post"]');
      form.kind.value = b.dataset.kind;
      // Evidence is mandatory only for issues.
      form.evidence_url.required = b.dataset.kind === "issue";
    }),
  );
  el.querySelector(".cm-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    status.textContent = "";
    try {
      if (f.dataset.form === "signin") {
        await community.signIn(f.email.value.trim());
        status.textContent = t("cm_check_email");
        return;
      }
      if (f.dataset.form === "profile") await community.saveProfile(f.name.value.trim());
      if (f.dataset.form === "post")
        await community.addReport({
          item_id: item.id,
          kind: f.kind.value,
          title: f.title.value.trim(),
          body: f.body.value.trim(),
          evidence_url: f.evidence_url.value.trim() || null,
          purchase: f.purchase.value,
        });
      again();
    } catch (e) {
      fail(e);
    }
  });
}

// ---------------------------------------------------------------------------
// Real price: code calculator (#deal), where-to-buy channels, prices people paid.
// No marketplace is scraped. Store feeds are labelled as feeds; marketplace
// prices come from people, with a screenshot or link, shown as ranges.

const CHANNELS = ["shopee", "lazada", "tiktok", "store_th", "secondhand_th", "taobao", "tmall", "jd", "xianyu", "aliexpress", "store_intl", "other"];
const CHANNEL_CURRENCY = { taobao: "CNY", tmall: "CNY", jd: "CNY", xianyu: "CNY", store_intl: "USD", aliexpress: "USD" };
const CURRENCIES = ["THB", "CNY", "USD", "EUR", "JPY", "SGD", "MYR"];
const EVIDENCE_HOST = "/storage/v1/object/public/evidence/";

function day(iso) {
  return new Date(iso).toLocaleDateString(state.lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function baht(n) {
  return money(n, "THB");
}
function codeLabel(c) {
  return [c.pct ? `${fmt(c.pct, 2)}%` : baht(c.off), c.min ? t("dl_min", { v: baht(c.min) }) : "", c.cap != null && c.pct ? t("dl_cap", { v: baht(c.cap) }) : ""].filter(Boolean).join(" · ");
}

function dealPage() {
  const p = query();
  const item = p.get("item") ? db.byId.get(p.get("item")) : null;
  const codes = (p.get("c") ?? "").split(",").map(decodeCode).filter(Boolean);
  const num = (k) => esc(p.get(k) ?? "");
  const im = item ? imageOf(item) : null;
  const feed = item ? prices(item).cheapest : null;
  const field = (id, label, k, hint = "") =>
    `<label class="dfield"><span>${esc(label)}</span><input class="search num" id="${id}" inputmode="decimal" value="${num(k)}" placeholder="${esc(hint)}"></label>`;
  return `<div class="deal">
    <header class="deal-head"><h1>${esc(t("dl_title"))}</h1><p class="muted">${esc(t("dl_lead"))}</p></header>
    ${
      item
        ? `<div class="card pad deal-item with-thumb">${im ? `<img class="thumb" src="${esc(sized(im.src, 96))}" alt="" referrerpolicy="no-referrer">` : ""}
          <div><a class="strong" href="#item/${encodeURIComponent(item.id)}">${esc(displayName(item))}</a>
          <div class="muted small">${feed ? esc(t("dl_feed_ref", { price: money(feed.price, feed.currency), store: db.stores[feed.store]?.name ?? feed.store })) : ""}</div>
          <div class="small" id="deal-paid"></div></div></div>`
        : ""
    }
    <div class="deal-grid">
      <section class="card pad deal-prices"><h3>${esc(t("dl_price_h"))}</h3>
        ${field("d-p", t("dl_price"), "p", "1790")}
        ${field("d-a", t("dl_anchor"), "a", t("optional"))}
        ${field("d-s", t("dl_ship"), "s", "0")}
      </section>
      <section class="card pad"><h3>${esc(t("dl_codes_h"))}</h3><p class="muted small">${esc(t("dl_codes_help"))}</p>
        <div id="d-codes">${codesHtml(codes)}</div>
        <div class="row-inline paste"><input class="search" id="d-paste" placeholder="${esc(t("dl_paste_ph"))}">
          <select id="d-kind" class="mini-select"><option value="platform">${esc(t("dl_kind_platform"))}</option><option value="shop">${esc(t("dl_kind_shop"))}</option></select>
          <button type="button" class="pill primary" id="d-add">${esc(t("dl_add"))}</button></div>
        <p class="small status" id="d-paste-status" role="status"></p>
      </section>
    </div>
    <section class="card pad" id="d-result" aria-live="polite"></section>
    <section class="card pad"><h3>${esc(t("dl_cn_h"))}</h3><p class="muted small">${esc(t("dl_cn_help"))}</p>
      <div class="deal-fields">
        ${field("d-cp", t("dl_cn_price"), "cp", "699.9")}
        ${field("d-cs", t("dl_cn_ship"), "cs", "0")}
        ${field("d-r", t("dl_cn_rate"), "r", t("dl_cn_rate_ph"))}
        ${field("d-x", t("dl_cn_extra"), "x", "0")}
      </div>
      <div id="d-cn"></div>
    </section>
    <p class="muted small">${esc(t("dl_assume"))}</p>
    <p class="muted small">${esc(t("aff_note"))}</p>
  </div>`;
}

function codesHtml(codes) {
  if (!codes.length) return `<p class="muted small">${esc(t("dl_no_codes"))}</p>`;
  return `<ul class="codes">${codes
    .map(
      (c, n) => `<li class="code-row" data-n="${n}">
      <select class="mini-select" data-f="kind"><option value="platform"${c.kind !== "shop" ? " selected" : ""}>${esc(t("dl_kind_platform"))}</option><option value="shop"${c.kind === "shop" ? " selected" : ""}>${esc(t("dl_kind_shop"))}</option></select>
      <label class="code-val"><input class="search num" data-f="val" inputmode="decimal" value="${c.pct ?? c.off ?? ""}"><select class="mini-select" data-f="unit"><option value="pct"${c.pct != null ? " selected" : ""}>%</option><option value="off"${c.pct == null ? " selected" : ""}>฿</option></select></label>
      <label><span class="small muted">${esc(t("dl_min_l"))}</span><input class="search num" data-f="min" inputmode="decimal" value="${c.min ?? ""}"></label>
      <label><span class="small muted">${esc(t("dl_cap_l"))}</span><input class="search num" data-f="cap" inputmode="decimal" value="${c.cap ?? ""}"></label>
      <button type="button" class="link small" data-rm="${n}">${esc(t("cm_delete"))}</button></li>`,
    )
    .join("")}</ul>`;
}

function wireDeal(main) {
  const $ = (s) => main.querySelector(s);
  const val = (el) => {
    const v = Number(String(el?.value ?? "").replace(/[,฿¥\s]/g, ""));
    return el?.value.trim() && Number.isFinite(v) ? v : null;
  };
  const readCodes = () =>
    [...main.querySelectorAll(".code-row")]
      .map((row) => {
        const f = (k) => row.querySelector(`[data-f="${k}"]`);
        const v = val(f("val"));
        if (v == null || v <= 0) return null;
        const c = { kind: f("kind").value, min: val(f("min")) ?? undefined, cap: val(f("cap")) ?? undefined };
        if (f("unit").value === "pct") {
          if (v >= 100) return null;
          c.pct = v;
        } else {
          c.off = v;
          delete c.cap;
        }
        return Object.fromEntries(Object.entries(c).filter(([, x]) => x !== undefined));
      })
      .filter(Boolean);

  const update = () => {
    const codes = readCodes();
    const p = query();
    const set = (k, v) => (v == null || v === "" ? p.delete(k) : p.set(k, v));
    set("p", val($("#d-p")));
    set("a", val($("#d-a")));
    set("s", val($("#d-s")));
    set("c", codes.map(encodeCode).join(","));
    for (const k of ["cp", "cs", "r", "x"]) set(k, val($(`#d-${k}`)));
    history.replaceState(null, "", `#deal?${p}`);
    $("#d-result").innerHTML = dealResult(val($("#d-p")), val($("#d-a")), val($("#d-s")) ?? 0, codes);
    const cn = landed({ price: val($("#d-cp")), shipping: val($("#d-cs")) ?? 0, rate: val($("#d-r")), extraPct: val($("#d-x")) ?? 0 });
    $("#d-cn").innerHTML = cn
      ? `<p class="deal-big">${baht(cn.total)}</p><p class="muted small">${esc(t("dl_cn_math", { base: baht(cn.base), extra: baht(cn.extra) }))}</p><p class="small">${esc(t("dl_cn_warn"))}</p>`
      : `<p class="muted small">${esc(t("dl_cn_empty"))}</p>`;
  };
  const redraw = (codes) => {
    $("#d-codes").innerHTML = codesHtml(codes);
    bindRows();
    update();
  };
  const bindRows = () => {
    main.querySelectorAll(".code-row input, .code-row select").forEach((el) => el.addEventListener("input", update));
    main.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", () => {
        const codes = readCodes();
        codes.splice(Number(b.dataset.rm), 1);
        redraw(codes);
      }),
    );
  };
  main.querySelectorAll(".deal-prices input, #d-cp, #d-cs, #d-r, #d-x").forEach((el) => el.addEventListener("input", update));
  const add = () => {
    const text = $("#d-paste").value.trim();
    const status = $("#d-paste-status");
    const c = text ? parseCode(text, $("#d-kind").value) : { kind: $("#d-kind").value, pct: 10 };
    if (!c) {
      status.textContent = t("dl_parse_fail");
      return;
    }
    status.textContent = text ? t("dl_parsed", { code: codeLabel(c) }) : "";
    $("#d-paste").value = "";
    redraw([...readCodes(), c]);
  };
  $("#d-add").addEventListener("click", add);
  $("#d-paste").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    add();
  });
  bindRows();
  update();

  const id = query().get("item");
  const slot = $("#deal-paid");
  if (id && slot)
    community.pricesFor(id).then(({ ok, rows }) => {
      if (!ok || !slot.isConnected) return;
      const th = summarize(rows.filter((r) => r.currency === "THB" && ["shopee", "lazada", "tiktok"].includes(r.channel)));
      slot.innerHTML = th.length
        ? th.map((g) => esc(t("dl_paid_ref", { channel: t(`ch_${g.channel}`), min: baht(g.min), max: baht(g.max), n: g.n }))).join("<br>")
        : `<span class="muted">${esc(t("dl_paid_none"))}</span>`;
    });
}

function dealResult(price, anchor, shipping, codes) {
  if (!price) return `<h3>${esc(t("dl_result_h"))}</h3><p class="muted">${esc(t("dl_need_price"))}</p>`;
  const all = combos(price, codes, { shipping });
  const best = all[0];
  const used = [best.shop, best.platform].filter(Boolean);
  const rows = all.filter((c) => c.shop || c.platform);
  const capNotes = codes
    .filter((c) => capPoint(c))
    .map((c) => {
      const at = capPoint(c);
      const real = Math.min(c.pct, (c.cap / price) * 100);
      return `<li>${esc(codeLabel(c))}: ${esc(t("dl_cap_note", { at: baht(at), cap: baht(c.cap) }))}${price > at ? ` <span class="tag warn">${esc(t("dl_cap_hit", { pct: fmt(real, 1) }))}</span>` : ""}</li>`;
    })
    .join("");
  return `<h3>${esc(t("dl_result_h"))}</h3>
    <p class="deal-big">${baht(best.final)}</p>
    <p>${used.length ? esc(t("dl_best_uses", { codes: used.map(codeLabel).join(" + ") })) : esc(t("dl_best_none"))}</p>
    <p class="muted">${esc(t("dl_saved", { off: baht(best.discount), pct: fmt(best.pct, 1) }))}${shipping ? ` · ${esc(t("dl_incl_ship", { ship: baht(shipping) }))}` : ""}</p>
    ${anchor && anchor > price ? `<p class="muted small">${esc(t("dl_anchor_note", { anchor: baht(anchor), pct: fmt(((anchor - (best.final - shipping)) / anchor) * 100, 0) }))}</p>` : ""}
    ${
      rows.length
        ? `<div class="table-wrap"><table class="deal-table"><thead><tr><th>${esc(t("dl_kind_shop"))}</th><th>${esc(t("dl_kind_platform"))}</th><th>${esc(t("dl_col_off"))}</th><th>${esc(t("dl_col_final"))}</th></tr></thead><tbody>${rows
            .map((c) => {
              const short = c.steps.find((s) => s && !s.eligible);
              return `<tr class="${c === best ? "best" : ""}${c.valid ? "" : " invalid"}"><td>${c.shop ? esc(codeLabel(c.shop)) : "—"}</td><td>${c.platform ? esc(codeLabel(c.platform)) : "—"}</td>
              <td>${c.valid ? `${baht(c.discount)} <span class="muted small">(${fmt(c.pct, 1)}%)</span>` : `<span class="small">${esc(t("dl_short", { v: baht(short.shortfall) }))}</span>`}</td><td>${c.valid ? baht(c.final) : "—"}</td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : ""
    }
    ${capNotes ? `<ul class="small cap-notes">${capNotes}</ul>` : ""}`;
}

function channelsCard(i) {
  const name = displayName(i);
  const zh = db.zhNames?.[(i.brand ?? "").toLowerCase()];
  const cnQuery = zh ? `${zh} ${i.model}` : name;
  const q = encodeURIComponent;
  const th = [
    ["Shopee", `https://shopee.co.th/search?keyword=${q(name)}`],
    ["Lazada", `https://www.lazada.co.th/catalog/?q=${q(name)}`],
  ];
  // Only Taobao has been tried by a person so far; the others are marked untested.
  const flagship = zh ? `${zh}官方旗舰店` : null;
  const cn = [
    ["Taobao 淘宝", `https://s.taobao.com/search?q=${q(cnQuery)}`],
    ...(flagship ? [[`Taobao: ${flagship}`, `https://s.taobao.com/search?q=${q(flagship)}`]] : []),
  ];
  const cnUntested = [
    ["Tmall 天猫", `https://list.tmall.com/search_product.htm?q=${q(cnQuery)}`],
    ["JD 京东", `https://search.jd.com/Search?keyword=${q(cnQuery)}`],
    ["闲鱼 Xianyu", `https://www.goofish.com/search?q=${q(cnQuery)}`],
  ];
  const links = (l) => l.map(([label, url]) => `<a class="pill" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`).join("");
  return `<section class="card pad channels"><h3>${esc(t("ch_title"))}</h3>
    <div class="ch-grid">
      <div><h4>${esc(t("ch_th"))}</h4><p class="muted small">${esc(t("ch_th_note"))}</p>
        <div class="row-inline">${links(th)}<a class="pill primary" href="#deal?item=${q(i.id)}">${esc(t("it_deal"))}</a></div></div>
      <div><h4>${esc(t("ch_cn"))}</h4><p class="muted small">${esc(t("ch_cn_note"))}</p>
        <p class="small">${esc(t("ch_cn_query"))} <code>${esc(cnQuery)}</code> <button type="button" class="link small" data-copy="${esc(cnQuery)}">${esc(t("copy"))}</button>${zh ? "" : ` <span class="muted">· ${esc(t("ch_cn_no_zh"))}</span>`}</p>
        <p class="small warn-text">${esc(t("ch_cn_login"))}</p>
        <div class="row-inline">${links(cn)}</div>
        <p class="small muted">${esc(t("ch_cn_untested"))}</p>
        <div class="row-inline untested">${links(cnUntested)}</div>
        <ul class="small muted ch-tips"><li>${esc(t("ch_cn_tip1"))}</li><li>${esc(t("ch_cn_tip2"))}</li><li>${esc(t("ch_cn_tip3"))}</li></ul></div>
    </div>
    <p class="muted small">${esc(t("aff_note"))}</p></section>`;
}

async function renderPaid(el, item) {
  if (!el) return;
  const head = `<h3>${esc(t("pr_title"))}</h3><p class="muted small">${esc(t("pr_disclaimer"))}</p>`;
  el.innerHTML = `${head}<p class="muted small">${esc(t("cm_loading"))}</p>`;
  const { ok, rows } = await community.pricesFor(item.id);
  if (!el.isConnected) return;
  if (!ok) {
    el.innerHTML = `${head}<p class="muted">${esc(t("cm_offline"))}</p>`;
    return;
  }
  const s = await community.session();
  const profile = s ? await community.myProfile() : null;
  if (!el.isConnected) return;

  const groups = summarize(rows);
  const groupHtml = (g) => {
    const span = g.max - g.min || 1;
    return `<div class="pr-group">
      <div class="pr-group-head"><b>${esc(t(`ch_${g.channel}`))}</b> <span class="muted small">${esc(g.currency)}${g.condition !== "new" ? ` · ${esc(t(`pr_cond_${g.condition}`))}` : ""} · ${esc(t("pr_n", { n: g.n }))} · ${esc(g.first === g.last ? day(g.first) : `${day(g.first)} – ${day(g.last)}`)}</span></div>
      <div class="pr-range"><span>${money(g.min, g.currency)}</span><div class="strip">${g.rows
        .map((r) => `<i style="left:${g.n > 1 ? ((r.amount - g.min) / span) * 100 : 50}%" title="${esc(`${money(r.amount, r.currency)} · ${day(r.paid_on)}${r.campaign ? ` · ${r.campaign}` : ""}`)}"></i>`)
        .join("")}</div><span>${money(g.max, g.currency)}</span></div>
      ${g.n > 2 ? `<p class="muted small">${esc(t("pr_median", { v: money(g.median, g.currency) }))}</p>` : ""}</div>`;
  };
  const rowHtml = (r) => {
    const own = s && r.author === s.user.id;
    const evidence = r.evidence_url.includes(EVIDENCE_HOST)
      ? `<a class="ev-thumb" href="${esc(r.evidence_url)}" target="_blank" rel="noopener"><img src="${esc(r.evidence_url)}" alt="${esc(t("pr_evidence"))}" loading="lazy"></a>`
      : `<span class="ev-link">${srcLink(r.evidence_url)}</span>`;
    return `<li class="pr-row">${evidence}<div>
      <div><b>${money(r.amount, r.currency)}</b> · ${esc(t(`ch_${r.channel}`))} · ${esc(day(r.paid_on))}
        ${r.campaign ? `<span class="tag">${esc(r.campaign)}</span>` : ""}${r.includes_shipping ? ` <span class="tag">${esc(t("pr_ship_incl"))}</span>` : ""}${r.condition !== "new" ? ` <span class="tag">${esc(t(`pr_cond_${r.condition}`))}</span>` : ""}</div>
      ${r.note ? `<div class="small">${esc(r.note)}</div>` : ""}
      <div class="muted small">${esc(r.author_name || t("cm_user"))}${s && !own ? ` · <button class="link small" data-pflag="${r.id}">${esc(t("cm_flag"))}</button>` : ""}${own ? ` · <button class="link small" data-pdel="${r.id}">${esc(t("cm_delete"))}</button>` : ""}</div>
    </div></li>`;
  };

  let composer;
  if (!s || !profile) composer = `<p class="small muted">${esc(t(s ? "pr_need_name" : "pr_signin"))} <button type="button" class="link small" data-goto-cm>${esc(t("pr_goto_cm"))}</button></p>`;
  else
    composer = `<details class="pr-compose"><summary class="pill">${esc(t("pr_add"))}</summary>
    <form class="cm-form" data-form="price">
      <div class="deal-fields">
        <label class="dfield"><span>${esc(t("pr_channel"))}</span><select class="mini-select" name="channel">${CHANNELS.map((c) => `<option value="${c}">${esc(t(`ch_${c}`))}</option>`).join("")}</select></label>
        <label class="dfield"><span>${esc(t("pr_amount"))}</span><input class="search num" name="amount" inputmode="decimal" required></label>
        <label class="dfield"><span>${esc(t("pr_currency"))}</span><select class="mini-select" name="currency">${CURRENCIES.map((c) => `<option>${c}</option>`).join("")}</select></label>
        <label class="dfield"><span>${esc(t("pr_date"))}</span><input class="search" type="date" name="paid_on" required value="${new Date().toISOString().slice(0, 10)}"></label>
        <label class="dfield"><span>${esc(t("pr_condition"))}</span><select class="mini-select" name="condition">${["new", "open_box", "used"].map((c) => `<option value="${c}">${esc(t(`pr_cond_${c}`))}</option>`).join("")}</select></label>
        <label class="check"><input type="checkbox" name="includes_shipping"> ${esc(t("pr_ship_incl"))}</label>
      </div>
      <input class="search" name="campaign" maxlength="60" placeholder="${esc(t("pr_campaign_ph"))}">
      <input class="search" name="note" maxlength="300" placeholder="${esc(t("pr_note_ph"))}">
      <p class="small"><b>${esc(t("pr_evidence"))}</b> — ${esc(t("pr_evidence_help"))}</p>
      <div class="row-inline"><label class="pill"><input type="file" name="shot" accept="image/*" hidden>${esc(t("pr_pick_shot"))}</label><span class="muted small" data-shot-state></span></div>
      <input class="search" name="evidence_url" type="url" pattern="https://.+" placeholder="${esc(t("pr_or_link"))}">
      <p class="muted small">${esc(t("pr_privacy"))}</p>
      <div class="row-inline"><button class="pill primary">${esc(t("cm_post"))}</button><span class="muted small">${esc(t("cm_as", { name: profile.display_name }))}</span></div>
    </form></details>`;

  el.innerHTML = `${head}
    ${groups.length ? `<div class="pr-groups">${groups.map(groupHtml).join("")}</div><ul class="pr-rows">${rows.slice(0, 30).map(rowHtml).join("")}</ul>` : `<p class="muted">${esc(t("pr_empty"))}</p>`}
    <div class="composer">${composer}<p class="small status" role="status"></p></div>`;

  const status = el.querySelector(".status");
  const fail = (e) => (status.textContent = /rate_limit/.test(e?.message) ? t("cm_rate") : `${t("cm_error")} ${e?.message ?? ""}`);
  const again = () => renderPaid(el, item);
  el.querySelector("[data-goto-cm]")?.addEventListener("click", () => document.getElementById("community")?.scrollIntoView({ behavior: "smooth" }));
  el.querySelectorAll("[data-pdel]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(t("cm_delete_q"))) return;
      try {
        await community.deletePrice(Number(b.dataset.pdel));
        again();
      } catch (e) {
        fail(e);
      }
    }),
  );
  el.querySelectorAll("[data-pflag]").forEach((b) =>
    b.addEventListener("click", async () => {
      const reason = prompt(t("cm_flag_reason"));
      if (!reason) return;
      try {
        await community.flagPrice(Number(b.dataset.pflag), reason);
        status.textContent = t("cm_flagged");
      } catch (e) {
        fail(e);
      }
    }),
  );

  const form = el.querySelector('[data-form="price"]');
  if (!form) return;
  let shot = null;
  form.channel.addEventListener("change", () => (form.currency.value = CHANNEL_CURRENCY[form.channel.value] ?? "THB"));
  form.shot.addEventListener("change", async () => {
    const file = form.shot.files[0];
    form.shot.value = "";
    if (!file) return;
    shot = await redactImage(file, t);
    form.querySelector("[data-shot-state]").textContent = shot ? t("pr_shot_ready", { kb: Math.round(shot.size / 1024) }) : "";
  });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    status.textContent = "";
    const amount = Number(form.amount.value.replace(/[,฿¥$\s]/g, ""));
    if (!(amount > 0)) return fail({ message: t("pr_bad_amount") });
    if (!shot && !form.evidence_url.value.trim()) return fail({ message: t("pr_need_evidence") });
    try {
      status.textContent = t("cm_loading");
      const evidence_url = shot ? await community.uploadEvidence(shot) : form.evidence_url.value.trim();
      await community.addPrice({
        item_id: item.id,
        channel: form.channel.value,
        amount,
        currency: form.currency.value,
        includes_shipping: form.includes_shipping.checked,
        condition: form.condition.value,
        paid_on: form.paid_on.value,
        campaign: form.campaign.value.trim(),
        note: form.note.value.trim(),
        evidence_url,
      });
      again();
    } catch (e) {
      fail(e);
    }
  });
}

// ---------------------------------------------------------------------------
// Learn: glossary index, one page per term, small calculators.

function learnPage(termId) {
  const L = state.lang;
  if (termId) {
    const term = TERM.get(termId);
    if (!term) return `<div class="card empty"><p>${esc(t("it_not_found"))}</p></div>`;
    const c = term[L] ?? term.en;
    return `<article class="term">
      <p class="small"><a href="#learn">← ${esc(t("lr_back"))}</a></p>
      <h1>${esc(c.title)}</h1>
      <p class="muted small">${esc(t("lr_updated", { date: day(GLOSSARY_UPDATED) }))}</p>
      <div class="card pad prose term-body">${c.body}</div>
      ${term.tool ? `<section class="card pad tool" data-tool="${term.tool}">${toolHtml(term.tool)}</section>` : ""}
      ${
        term.related.length
          ? `<section class="card pad"><h3>${esc(t("lr_related"))}</h3><div class="row-inline">${term.related
              .filter((id) => TERM.has(id))
              .map((id) => `<a class="pill" href="#learn/${id}">${esc((TERM.get(id)[L] ?? TERM.get(id).en).title)}</a>`)
              .join("")}</div></section>`
          : ""
      }
      ${term.refs.length ? `<section class="card pad"><h3>${esc(t("lr_refs"))}</h3><ul class="small">${term.refs.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)} ↗</a></li>`).join("")}</ul></section>` : ""}
      <p class="muted small">${esc(t("lr_fix"))} <a href="${REPO}/blob/main/src/glossary.js?v=mv32s2ut" target="_blank" rel="noopener">src/glossary.js ↗</a></p>
    </article>`;
  }
  return `<div class="learn">
    <header class="deal-head"><h1>${esc(t("nav_learn"))}</h1><p class="muted">${esc(t("lr_lead"))}</p></header>
    <section class="card pad"><h3>${esc(t("lr_glossary"))}</h3>
      <div class="gloss-grid">${TERMS.map((term) => {
        const c = term[L] ?? term.en;
        return `<a class="gloss" href="#learn/${term.id}"><b>${esc(c.title)}</b><span class="muted small">${esc(c.short)}</span>${term.tool ? `<span class="tag">${esc(t("lr_has_tool"))}</span>` : ""}</a>`;
      }).join("")}</div>
    </section>
    <section class="card pad"><h3>${esc(t("lr_guide"))}</h3><article class="prose">${LEARN[L]}</article></section>
  </div>`;
}

function toolHtml(kind) {
  const f = (name, label, value, unit = "") =>
    `<label class="dfield"><span>${esc(label)}</span><span class="tool-in"><input class="search num" name="${name}" inputmode="decimal" value="${value}">${unit ? `<span class="muted small">${esc(unit)}</span>` : ""}</span></label>`;
  const head = `<h3>${esc(t(`tool_${kind}`))}</h3>`;
  const out = `<div class="tool-out" aria-live="polite"></div>`;
  if (kind === "sens")
    return `${head}<div class="deal-fields">${f("s", t("tool_sens_value"), 110)}<label class="dfield"><span>${esc(t("tool_unit"))}</span><select class="mini-select" name="u"><option>dB/mW</option><option>dB/V</option></select></label>${f("z", t("tool_z"), 32, "Ω")}</div>${out}`;
  if (kind === "spl")
    return `${head}<div class="deal-fields">${f("s", t("tool_sens_v"), 110, "dB/V")}${f("z", t("tool_z"), 32, "Ω")}${f("l", t("tool_target"), 95, "dB SPL")}</div>${out}`;
  if (kind === "zout") return `${head}<div class="deal-fields">${f("z", t("tool_z"), 16, "Ω")}${f("o", t("tool_zout"), 1, "Ω")}</div>${out}`;
  if (kind === "hiss") return `${head}<div class="deal-fields">${f("n", t("tool_noise"), 5, "µV")}${f("s", t("tool_sens_v"), 120, "dB/V")}</div>${out}`;
  if (kind === "dose") return `${head}<div class="deal-fields">${f("l", t("tool_level"), 85, "dB")}</div>${out}`;
  return "";
}

function wireTool(el) {
  if (!el) return;
  const kind = el.dataset.tool;
  const v = (n) => Number(el.querySelector(`[name="${n}"]`)?.value);
  const out = el.querySelector(".tool-out");
  const show = () => {
    let html = "";
    if (kind === "sens") {
      const s = v("s");
      const z = v("z");
      const u = el.querySelector('[name="u"]').value;
      if (s && z > 0) {
        const other = u === "dB/mW" ? s + 10 * Math.log10(1000 / z) : s - 10 * Math.log10(1000 / z);
        html = `<p class="deal-big">${fmt(other, 1)} ${u === "dB/mW" ? "dB/V" : "dB/mW"}</p><p class="muted small"><code>${u === "dB/mW" ? `${s} + 10·log10(1000/${z})` : `${s} − 10·log10(1000/${z})`}</code></p>`;
      }
    } else if (kind === "spl") {
      const s = v("s");
      const z = v("z");
      const l = v("l");
      if (s && z > 0 && l) {
        const V = 10 ** ((l - s) / 20);
        html = `<p class="deal-big">${vfmt(V)}</p><p class="muted">${esc(t("tool_spl_out", { mw: fmt((V * V * 1000) / z, V * V * 1000 / z < 1 ? 3 : 1), ma: fmt((V / z) * 1000, 1) }))}</p><p class="muted small"><code>V = 10^((${l} − ${s}) / 20)</code></p>`;
      }
    } else if (kind === "zout") {
      const z = v("z");
      const o = v("o");
      if (z > 0 && o >= 0) {
        const ratio = o ? z / o : Infinity;
        const ok = ratio >= 8;
        html = `<p class="deal-big">${ratio === Infinity ? "∞" : fmt(ratio, 1)} : 1</p><p class="${ok ? "" : "warn-text"}">${esc(t(ok ? "tool_zout_ok" : "tool_zout_warn", { max: fmt(z / 8, 2) }))}</p>`;
      }
    } else if (kind === "hiss") {
      const n = v("n");
      const s = v("s");
      if (n > 0 && s) {
        const spl = s + 20 * Math.log10(n * 1e-6);
        html = `<p class="deal-big">${fmt(spl, 0)} dB SPL</p><p class="muted">${esc(t(spl < 15 ? "tool_hiss_low" : spl < 25 ? "tool_hiss_mid" : "tool_hiss_high"))}</p><p class="muted small"><code>${s} + 20·log10(${n} µV)</code></p>`;
      }
    } else if (kind === "dose") {
      const l = v("l");
      if (l) {
        const h = 40 / 2 ** ((l - 80) / 3);
        html = `<p class="deal-big">${h >= 1 ? `${fmt(h, 1)} ${t("tool_hours")}` : `${fmt(h * 60, 0)} ${t("tool_minutes")}`}</p><p class="muted">${esc(t("tool_dose_out"))}</p><p class="muted small"><code>40 h ÷ 2^((${l} − 80) / 3)</code></p>`;
      }
    }
    out.innerHTML = html || `<p class="muted small">${esc(t("tool_fill"))}</p>`;
  };
  el.querySelectorAll("input, select").forEach((i) => i.addEventListener("input", show));
  show();
}

// ---------------------------------------------------------------------------
// Discussions (#discuss, #discuss/new, #discuss/<id>) and account (#account).
// Pages render a shell synchronously; data fills in after Supabase answers.

const CATEGORIES = ["question", "setup", "dream", "deal", "issue", "news", "general"];

/** Photo picker: each image goes through the redactor (re-encode, optional black boxes). */
function photoPickerHtml(max) {
  return `<div class="photos" data-max="${max}"><div class="photo-list"></div>
    <div class="row-inline"><label class="pill small"><input type="file" accept="image/*" multiple hidden>${esc(t("ph_add", { max }))}</label><span class="muted small ph-state"></span></div></div>`;
}
function wirePhotos(root) {
  const box = root.querySelector(".photos");
  const state_ = { blobs: [] };
  if (!box) return state_;
  const max = Number(box.dataset.max);
  const list = box.querySelector(".photo-list");
  const draw = () => {
    list.innerHTML = state_.blobs
      .map((b, n) => `<figure class="ph"><img src="${URL.createObjectURL(b)}" alt=""><button type="button" data-rm-ph="${n}" aria-label="${esc(t("cm_delete"))}">✕</button></figure>`)
      .join("");
    list.querySelectorAll("[data-rm-ph]").forEach((b) =>
      b.addEventListener("click", () => {
        state_.blobs.splice(Number(b.dataset.rmPh), 1);
        draw();
      }),
    );
  };
  const input = box.querySelector("input[type=file]");
  input.addEventListener("change", async () => {
    const files = [...input.files];
    input.value = "";
    for (const f of files) {
      if (state_.blobs.length >= max) break;
      const blob = await redactImage(f, t);
      if (blob) state_.blobs.push(blob);
      draw();
    }
    box.querySelector(".ph-state").textContent = state_.blobs.length ? t("ph_ready", { n: state_.blobs.length }) : "";
  });
  state_.upload = async (status) => {
    const urls = [];
    for (const [n, b] of state_.blobs.entries()) {
      if (status) status.textContent = t("ph_uploading", { n: n + 1, of: state_.blobs.length });
      urls.push(await community.uploadMedia(b));
    }
    return urls;
  };
  return state_;
}
function gallery(images, cls = "") {
  if (!images?.length) return "";
  return `<div class="gallery ${cls}${images.length === 1 ? " one" : ""}">${images.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join("")}</div>`;
}

/** Post text → safe HTML (Markdown subset, see markdown.js). */
const richText = (text) => renderMd(text);

/** Textarea with a formatting toolbar and a preview toggle. */
function mdEditor(name, rows, placeholder, max, value = "") {
  return `<div class="md-editor">
    <div class="md-bar" role="toolbar">${Object.entries(MD_ACTIONS)
      .map(([k, a]) => `<button type="button" data-md="${k}" title="${esc(t(`md_${k}`))}" aria-label="${esc(t(`md_${k}`))}">${esc(a.label)}</button>`)
      .join("")}<span class="grow"></span><button type="button" data-md-preview>${esc(t("md_preview"))}</button></div>
    <textarea class="search" name="${name}" rows="${rows}" maxlength="${max}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    <div class="md md-preview" hidden></div>
    <p class="muted small md-help">${esc(t("md_help"))}</p></div>`;
}
function wireMd(root) {
  root.querySelectorAll(".md-editor").forEach((ed) => {
    if (ed.dataset.wired) return;
    ed.dataset.wired = "1";
    const ta = ed.querySelector("textarea");
    const pv = ed.querySelector(".md-preview");
    const pbtn = ed.querySelector("[data-md-preview]");
    ed.querySelectorAll("[data-md]").forEach((b) => b.addEventListener("click", () => applyMd(ta, b.dataset.md)));
    ta.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = { b: "bold", i: "italic", k: "link" }[e.key.toLowerCase()];
      if (!k) return;
      e.preventDefault();
      applyMd(ta, k);
    });
    pbtn.addEventListener("click", () => {
      const show = pv.hidden;
      pv.hidden = !show;
      ta.hidden = show;
      pv.innerHTML = renderMd(ta.value) || `<p class="muted">${esc(t("md_empty"))}</p>`;
      pbtn.textContent = t(show ? "md_edit" : "md_preview");
      pbtn.setAttribute("aria-pressed", String(show));
    });
  });
}

function ago(iso) {
  // Device clocks drift: anything under a minute, including slightly in the future, is "just now".
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  const rtf = new Intl.RelativeTimeFormat(state.lang === "th" ? "th" : "en", { numeric: "auto" });
  if (s < 60) return t("just_now");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), "day");
  return day(iso);
}

const authorName = (r) => (r.author ? r.author_name || t("cm_user") : t("ds_deleted"));
/** Name plus a verified-brand badge when the author is a brand representative. */
const authorHtml = (r) => `${esc(authorName(r))}${r.author_brand ? ` <span class="brand-badge" title="${esc(t("br_verified_hint"))}">✓ ${esc(r.author_brand)}</span>` : ""}`;

function voteBox(kind, id, score, mine, signedIn, row = false) {
  return `<div class="vote${row ? " row" : ""}" data-kind="${kind}" data-id="${id}">
    <button type="button" data-v="1" aria-label="${esc(t("ds_up"))}" aria-pressed="${mine === 1}" ${signedIn ? "" : "disabled"}>▲</button>
    <span class="score">${score}</span>
    <button type="button" data-v="-1" aria-label="${esc(t("ds_down"))}" aria-pressed="${mine === -1}" ${signedIn ? "" : "disabled"}>▼</button></div>`;
}

function wireVotes(el, onDone) {
  el.querySelectorAll(".vote button").forEach((b) =>
    b.addEventListener("click", async () => {
      const box = b.closest(".vote");
      const v = Number(b.dataset.v);
      const now = b.getAttribute("aria-pressed") === "true";
      try {
        await community.vote(box.dataset.kind, Number(box.dataset.id), now ? 0 : v);
        onDone();
      } catch (e) {
        alert(`${t("cm_error")} ${e.message}`);
      }
    }),
  );
}

/** Sign-in / set-name block used by account and discussion pages. */
function authBlock(s, profile, back) {
  if (!s)
    return `<form class="cm-form" data-form="signin"><p class="small">${esc(t("ds_signin_why"))}</p>
      <div class="row-inline"><input class="search" type="email" name="email" required placeholder="you@example.com"><button class="pill primary">${esc(t("cm_signin"))}</button></div>
      <p class="small status" role="status"></p></form>`;
  if (!profile)
    return `<form class="cm-form" data-form="profile"><p class="small">${esc(t("cm_name_why"))}</p>
      <div class="row-inline"><input class="search" name="name" required minlength="2" maxlength="40" placeholder="${esc(t("cm_name"))}"><button class="pill primary">${esc(t("cm_save"))}</button></div>
      <p class="small status" role="status"></p></form>`;
  return "";
}

function wireAuth(el, back, again) {
  el.querySelector('[data-form="signin"]')?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const st = ev.target.querySelector(".status");
    try {
      await community.signInTo(ev.target.email.value.trim(), back);
      st.textContent = t("cm_check_email");
    } catch (e) {
      st.textContent = `${t("cm_error")} ${e.message}`;
    }
  });
  el.querySelector('[data-form="profile"]')?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await community.saveProfile(ev.target.name.value.trim());
      again();
    } catch (e) {
      ev.target.querySelector(".status").textContent = `${t("cm_error")} ${e.message}`;
    }
  });
}

function itemChips(ids) {
  return (ids ?? [])
    .map((id) => findItem(id))
    .filter(Boolean)
    .map((i) => `<a class="chip item-chip" href="#item/${encodeURIComponent(i.id)}">${esc(displayName(i))}</a>`)
    .join("");
}

// ---- list

function discussPage() {
  const p = query();
  const cat = p.get("cat") ?? "";
  const sort = p.get("sort") ?? "new";
  const link = (over) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(over)) v === null || v === "" ? n.delete(k) : n.set(k, v);
    return `#discuss?${n}`;
  };
  return `<div class="discuss">
    <header class="deal-head row-between"><div><h1>${esc(t("nav_discuss"))}</h1><p class="muted">${esc(t("ds_lead"))}</p></div>
      <a class="pill primary" href="#discuss/new">${esc(t("ds_new"))}</a></header>
    <div class="filters">
      <div class="chips"><a class="chip${!cat ? " on" : ""}" href="${link({ cat: null })}">${esc(t("cat_all"))}</a>${CATEGORIES.map((c) => `<a class="chip${c === cat ? " on" : ""}" href="${link({ cat: c })}">${esc(t(`dc_${c}`))}</a>`).join("")}</div>
      <div class="chips">${["new", "top"].map((s) => `<a class="chip${s === sort ? " on" : ""}" href="${link({ sort: s })}">${esc(t(`ds_sort_${s}`))}</a>`).join("")}</div>
    </div>
    <div id="threads" class="card"><p class="muted pad">${esc(t("cm_loading"))}</p></div>
  </div>`;
}

function threadRow(r, mine, signedIn) {
  const items = itemChips(r.item_ids);
  return `<article class="thread-row">
    ${voteBox("thread", r.id, r.score, mine, signedIn)}
    <div class="thread-main">
      <a class="thread-title" href="#discuss/${r.id}">${esc(r.title)}</a>
      <div class="muted small"><span class="tag">${esc(t(`dc_${r.category}`))}</span> ${authorHtml(r)} · ${esc(ago(r.created_at))} · <a href="#discuss/${r.id}">${esc(t("ds_n_comments", { n: r.comment_count }))}</a></div>
      ${items ? `<div class="chips small-chips">${items}</div>` : ""}
    </div>${r.images?.length ? `<a class="row-thumb" href="#discuss/${r.id}"><img src="${esc(r.images[0])}" alt="" loading="lazy">${r.images.length > 1 ? `<span>+${r.images.length - 1}</span>` : ""}</a>` : ""}</article>`;
}

async function wireDiscuss(main) {
  const box = main.querySelector("#threads");
  const p = query();
  const load = async () => {
    const { ok, rows } = await community.listThreads({ sort: p.get("sort") ?? "new", category: p.get("cat") ?? "" });
    if (!box.isConnected) return;
    if (!ok) {
      box.innerHTML = `<p class="muted pad">${esc(t("cm_offline"))}</p>`;
      return;
    }
    const s = await community.session();
    const mine = s ? await community.myVotes("thread", rows.map((r) => r.id)) : new Map();
    box.innerHTML = rows.length ? rows.map((r) => threadRow(r, mine.get(r.id), !!s)).join("") : `<p class="muted pad">${esc(t("ds_empty"))}</p>`;
    wireVotes(box, load);
  };
  load();
}

// ---- new thread

function newThreadPage() {
  const pre = query().get("item");
  return `<div class="discuss narrow">
    <p class="small"><a href="#discuss">← ${esc(t("nav_discuss"))}</a></p>
    <h1>${esc(t("ds_new"))}</h1>
    <div id="new-thread" class="card pad" data-pre="${esc(pre ?? "")}"><p class="muted">${esc(t("cm_loading"))}</p></div>
  </div>`;
}

async function wireNewThread(main) {
  const el = main.querySelector("#new-thread");
  const s = await community.session();
  const profile = s ? await community.myProfile() : null;
  if (!el.isConnected) return;
  if (!s || !profile) {
    el.innerHTML = authBlock(s, profile, location.hash);
    wireAuth(el, location.hash, () => wireNewThread(main));
    return;
  }
  const qp = query();
  const preIds = [el.dataset.pre, ...(qp.get("items") ?? "").split(",")].filter(Boolean).map(findItem).filter(Boolean).map((i) => i.id);
  const picked = new Set(preIds.slice(0, 5));
  const preCat = CATEGORIES.includes(qp.get("cat")) ? qp.get("cat") : "";
  el.innerHTML = `<form class="cm-form" data-form="thread">
    <label class="dfield"><span>${esc(t("ds_category"))}</span><select class="mini-select" name="category">${CATEGORIES.map((c) => `<option value="${c}"${c === preCat ? " selected" : ""}>${esc(t(`dc_${c}`))}</option>`).join("")}</select></label>
    <input class="search" name="title" required minlength="5" maxlength="160" placeholder="${esc(t("ds_title_ph"))}">
    ${mdEditor("body", 8, t("ds_body_ph"), 10000)}
    ${photoPickerHtml(8)}
    <div><span class="small muted">${esc(t("ds_items"))}</span>
      <div class="chips" id="picked"></div>
      <input class="search" id="item-q" placeholder="${esc(t("ds_items_ph"))}" autocomplete="off">
      <div class="suggest" id="suggest"></div></div>
    <p class="muted small">${esc(t("ds_rules"))}</p>
    <div class="row-inline"><button class="pill primary">${esc(t("cm_post"))}</button><span class="muted small">${esc(t("cm_as", { name: profile.display_name }))}</span></div>
    <p class="small status" role="status"></p></form>`;
  const pickedEl = el.querySelector("#picked");
  const drawPicked = () => {
    pickedEl.innerHTML = [...picked]
      .map((id) => `<button type="button" class="chip on" data-unpick="${esc(id)}">${esc(displayName(db.byId.get(id)))} ✕</button>`)
      .join("");
    pickedEl.querySelectorAll("[data-unpick]").forEach((b) =>
      b.addEventListener("click", () => {
        picked.delete(b.dataset.unpick);
        drawPicked();
      }),
    );
  };
  drawPicked();
  const qIn = el.querySelector("#item-q");
  const sug = el.querySelector("#suggest");
  qIn.addEventListener("input", () => {
    const q = qIn.value.trim().toLowerCase();
    const hits = q.length < 2 ? [] : db.items.filter((i) => matches(i, q)).sort((a, b) => searchRank(a, q) - searchRank(b, q)).slice(0, 8);
    sug.innerHTML = hits.map((i) => `<button type="button" data-pick-item="${esc(i.id)}">${esc(displayName(i))} <span class="muted small">${esc(t(`cat_${i.category}`))}</span></button>`).join("");
    sug.querySelectorAll("[data-pick-item]").forEach((b) =>
      b.addEventListener("click", () => {
        if (picked.size < 5) picked.add(b.dataset.pickItem);
        qIn.value = "";
        sug.innerHTML = "";
        drawPicked();
      }),
    );
  });
  const photos = wirePhotos(el);
  wireMd(el);
  el.querySelector("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const st = f.querySelector(".status");
    try {
      const images = await photos.upload(st);
      const id = await community.addThread({ category: f.category.value, title: f.title.value.trim(), body: f.body.value.trim(), item_ids: [...picked], images });
      go(`#discuss/${id}`);
    } catch (e) {
      st.textContent = /rate_limit/.test(e.message) ? t("cm_rate") : `${t("cm_error")} ${e.message}`;
    }
  });
}

// ---- editing (own posts only; RLS enforces it server-side too)

function editThread(article, th, done) {
  const kept = [...(th.images ?? [])];
  article.innerHTML = `<form class="cm-form" data-form="edit-thread">
    <label class="dfield"><span>${esc(t("ds_category"))}</span><select class="mini-select" name="category">${CATEGORIES.map((c) => `<option value="${c}"${c === th.category ? " selected" : ""}>${esc(t(`dc_${c}`))}</option>`).join("")}</select></label>
    <input class="search" name="title" required minlength="5" maxlength="160" value="${esc(th.title)}">
    ${mdEditor("body", 8, t("ds_body_ph"), 10000, th.body)}
    <div class="photo-list kept"></div>
    ${photoPickerHtml(8)}
    <div class="row-inline"><button class="pill primary">${esc(t("cm_save"))}</button><button type="button" class="pill" data-cancel>${esc(t("rd_cancel"))}</button></div>
    <p class="small status" role="status"></p></form>`;
  const keptEl = article.querySelector(".kept");
  const drawKept = () => {
    keptEl.innerHTML = kept.map((u, n) => `<figure class="ph"><img src="${esc(u)}" alt=""><button type="button" data-unkeep="${n}" aria-label="${esc(t("cm_delete"))}">✕</button></figure>`).join("");
    keptEl.querySelectorAll("[data-unkeep]").forEach((x) =>
      x.addEventListener("click", () => {
        kept.splice(Number(x.dataset.unkeep), 1);
        drawKept();
      }),
    );
  };
  drawKept();
  const photos = wirePhotos(article);
  wireMd(article);
  const form = article.querySelector("form");
  form.querySelector("[data-cancel]").addEventListener("click", done);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const st = form.querySelector(".status");
    if (kept.length + photos.blobs.length > 8) {
      st.textContent = t("ph_too_many", { max: 8 });
      return;
    }
    try {
      const added = await photos.upload(st);
      await community.updateThread(th.id, { category: form.category.value, title: form.title.value.trim(), body: form.body.value.trim(), images: [...kept, ...added] });
      done();
    } catch (e) {
      st.textContent = `${t("cm_error")} ${e.message}`;
    }
  });
}

function editComment(main, c, done) {
  if (!main || !c) return;
  const bodyEl = main.querySelector(".comment-body");
  const box = document.createElement("form");
  box.className = "cm-form";
  box.innerHTML = `${mdEditor("body", 3, "", 5000, c.body)}<div class="row-inline"><button class="pill primary small">${esc(t("cm_save"))}</button><button type="button" class="pill small" data-cancel>${esc(t("rd_cancel"))}</button></div><p class="small status"></p>`;
  (bodyEl ?? main.querySelector(".post-actions")).before(box);
  bodyEl?.remove();
  main.querySelector(".post-actions").hidden = true;
  wireMd(box);
  box.querySelector("textarea").focus();
  box.querySelector("[data-cancel]").addEventListener("click", done);
  box.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const body = box.body.value.trim();
    if (!body && !c.images?.length) {
      box.querySelector(".status").textContent = t("ph_need_text");
      return;
    }
    try {
      await community.updateComment(c.id, body);
      done();
    } catch (e) {
      box.querySelector(".status").textContent = `${t("cm_error")} ${e.message}`;
    }
  });
}

// ---- thread sidebar: products in the thread, then threads about the same products

function asideProducts(ids, category) {
  const items = (ids ?? []).map((id) => findItem(id)).filter(Boolean);
  if (!items.length) return "";
  const extra = category === "setup" || category === "dream" ? setupSummary(items) : "";
  return `<section class="card pad"><h3>${esc(t("ds_in_thread"))}</h3>${items
    .map((i) => {
      const im = imageOf(i);
      const pr = prices(i).cheapest;
      return `<a class="aside-item" href="#item/${encodeURIComponent(i.id)}">${im ? `<img src="${esc(sized(im.src, 160))}" alt="" referrerpolicy="no-referrer">` : "<span></span>"}<div><b>${esc(displayName(i))}</b><div class="muted small">${esc(t(`cat_${i.category}`))}${pr ? ` · ${money(pr.price, pr.currency)}` : ""}</div></div></a>`;
    })
    .join("")}${extra}</section>`;
}

/** Total price per currency, and whether the setup's source drives each headphone. */
function setupSummary(items) {
  const sums = new Map();
  for (const i of items) {
    const p = prices(i).cheapest;
    if (p) sums.set(p.currency, (sums.get(p.currency) ?? 0) + p.price);
  }
  const src = items.find((i) => SOURCE_CATS.has(i.category) && sourceOutputs(i).length);
  const hps = items.filter((i) => HEADPHONE_CATS.has(i.category) && hpModel(i));
  const checks = src
    ? hps.map((h) => {
        const ev = evaluate(h, sourceOutputs(src), { level: LEVELS.normal, crest: CREST });
        const [tone, key] = VERDICT[ev.status] ?? VERDICT.unknown;
        return `<li><span class="st-dot ${tone}"></span>${esc(displayName(src))} → ${esc(displayName(h))}: ${esc(t(key))}</li>`;
      })
    : [];
  const build = src && hps[0] ? `#build?amp=${encodeURIComponent(src.id)}&hp=${encodeURIComponent(hps[0].id)}` : null;
  return `<div class="setup-sum">${sums.size ? `<p><b>${esc(t("su_total"))}</b> ${[...sums].map(([c, v]) => money(v, c)).join(" + ")} <span class="muted small">${esc(t("su_total_note"))}</span></p>` : ""}
    ${checks.length ? `<ul class="setup-checks small">${checks.join("")}</ul>` : ""}${build ? `<a class="pill small" href="${build}">${esc(t("su_open_build"))}</a>` : ""}</div>`;
}

async function fillRelated(el, th) {
  if (!el) return;
  const lists = await Promise.all([
    ...(th.item_ids ?? []).slice(0, 3).map((item) => community.listThreads({ item, sort: "top" })),
    community.listThreads({ category: th.category, sort: "top" }),
  ]);
  if (!el.isConnected) return;
  const seen = new Set([th.id]);
  const rows = [];
  for (const l of lists) for (const r of l.rows ?? []) if (!seen.has(r.id)) seen.add(r.id) && rows.push(r);
  el.innerHTML = rows.length
    ? rows
        .slice(0, 8)
        .map(
          (r) => `<a class="related-row" href="#discuss/${r.id}"><div><span class="muted small">${esc(t(`dc_${r.category}`))} · ${esc(ago(r.created_at))}</span><b>${esc(r.title)}</b><span class="muted small">▲ ${r.score} · ${esc(t("ds_n_comments", { n: r.comment_count }))}</span></div>${r.images?.[0] ? `<img src="${esc(r.images[0])}" alt="" loading="lazy">` : ""}</a>`,
        )
        .join("")
    : `<p class="muted small">${esc(t("ds_no_related"))}</p>`;
}

// ---- one thread

function threadPage(id) {
  return `<div class="discuss"><div id="thread" data-id="${esc(id)}"><p class="muted">${esc(t("cm_loading"))}</p></div></div>`;
}

async function wireThread(main) {
  const el = main.querySelector("#thread");
  const id = Number(el.dataset.id);
  const load = async () => {
    const res = await community.getThread(id);
    if (!el.isConnected) return;
    if (!res.ok) {
      el.innerHTML = `<p class="muted">${esc(t("cm_offline"))}</p>`;
      return;
    }
    if (!res.thread) {
      el.innerHTML = `<p class="muted">${esc(t("ds_gone"))}</p>`;
      return;
    }
    const s = await community.session();
    const profile = s ? await community.myProfile() : null;
    const [tv, cv] = s ? await Promise.all([community.myVotes("thread", [id]), community.myVotes("comment", res.comments.map((c) => c.id))]) : [new Map(), new Map()];
    const th = res.thread;
    const kids = new Map();
    for (const c of res.comments) {
      const k = c.parent_id ?? 0;
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(c);
    }
    const canPost = !!(s && profile);
    const own = (r) => s && r.author === s.user.id;
    const actions = (kind, r) =>
      `${canPost && kind === "comment" ? `<button type="button" class="link small" data-reply="${r.id}">${esc(t("ds_reply"))}</button>` : ""}${
        s && !own(r) ? `<button type="button" class="link small" data-dflag="${kind}:${r.id}">${esc(t("cm_flag"))}</button>` : ""
      }${own(r) ? `<button type="button" class="link small" data-dedit="${kind}:${r.id}">${esc(t("ds_edit"))}</button><button type="button" class="link small" data-ddel="${kind}:${r.id}">${esc(t("cm_delete"))}</button>` : ""}`;
    const countKids = (id) => (kids.get(id) ?? []).reduce((n, k) => n + 1 + countKids(k.id), 0);
    const tree = (parent, depth) =>
      (kids.get(parent) ?? [])
        .sort((a, b) => b.score - a.score || new Date(a.created_at) - new Date(b.created_at))
        .map(
          (c) => `<div class="comment${depth >= 5 ? " flat" : ""}" id="c${c.id}">
          <div class="comment-main"><div class="comment-head muted small"><button type="button" class="collapse" aria-expanded="true" aria-label="${esc(t("ds_collapse"))}">⊖</button><b class="${c.author === th.author && c.author ? "op" : ""}">${authorHtml(c)}</b> · ${esc(ago(c.created_at))}${c.edited_at ? ` · ${esc(t("ds_edited"))}` : ""}<span class="collapsed-note" hidden> · ${esc(t("ds_collapsed", { n: 1 + countKids(c.id) }))}</span></div>
          <div class="comment-rest">
          ${c.body ? `<div class="comment-body md">${richText(c.body)}</div>` : ""}
          ${gallery(c.images, "small")}
          <div class="post-actions">${voteBox("comment", c.id, c.score, cv.get(c.id), !!s, true)}${actions("comment", c)}</div>
          <div class="reply-slot"></div>
          ${kids.has(c.id) ? `<div class="children">${tree(c.id, depth + 1)}</div>` : ""}</div></div></div>`,
        )
        .join("");
    el.innerHTML = `<div class="thread-layout"><div class="thread-col"><article class="thread card pad">
        <p class="muted small thread-meta"><a class="back" href="#discuss" aria-label="${esc(t("nav_discuss"))}">←</a><span class="tag">${esc(t(`dc_${th.category}`))}</span> ${authorHtml(th)} · ${esc(ago(th.created_at))}${th.edited_at ? ` · ${esc(t("ds_edited"))}` : ""}</p>
        <h1 class="thread-h1">${esc(th.title)}</h1>
        ${th.body ? `<div class="thread-body md">${richText(th.body)}</div>` : ""}
        ${gallery(th.images)}
        ${th.item_ids?.length ? `<div class="chips">${itemChips(th.item_ids)}</div>` : ""}
        <div class="post-actions bar">${voteBox("thread", th.id, th.score, tv.get(th.id), !!s, true)}<a class="pill small" href="#comments">💬 ${res.comments.length}</a>${bmButton("thread", th.id)}<button type="button" class="pill small" data-share>${esc(t("ds_share"))}</button>${actions("thread", th)}</div>
      </article>
      <section class="card pad" id="comments">
        <h3>${esc(t("ds_n_comments", { n: res.comments.length }))}</h3>
        ${canPost ? `<form class="cm-form" data-form="comment">${mdEditor("body", 3, t("ds_comment_ph"), 5000)}${photoPickerHtml(4)}<div class="row-inline"><button class="pill primary">${esc(t("ds_send"))}</button><span class="muted small">${esc(t("cm_as", { name: profile.display_name }))}</span></div><p class="small status" role="status"></p></form>` : authBlock(s, profile, location.hash)}
        <div class="comments">${tree(0, 0) || `<p class="muted">${esc(t("ds_no_comments"))}</p>`}</div>
      </section></div>
      <aside class="thread-aside">${asideProducts(th.item_ids, th.category)}<section class="card pad related"><h3>${esc(t("ds_related"))}</h3><div class="related-list"><p class="muted small">${esc(t("cm_loading"))}</p></div></section></aside></div>`;
    fillRelated(el.querySelector(".related-list"), th);
    el.querySelectorAll(".collapse").forEach((b) =>
      b.addEventListener("click", () => {
        const c = b.closest(".comment");
        const open = b.getAttribute("aria-expanded") === "true";
        b.setAttribute("aria-expanded", String(!open));
        b.textContent = open ? "⊕" : "⊖";
        c.querySelector(".comment-rest").hidden = open;
        c.querySelector(".collapsed-note").hidden = !open;
      }),
    );
    el.querySelector("[data-share]")?.addEventListener("click", (ev) => {
      navigator.clipboard?.writeText(location.href).then(() => (ev.target.textContent = t("copied")));
    });
    wireAuth(el, location.hash, load);
    wireVotes(el, load);
    wireBookmarks(el);
    community.markSeen(th.id, res.comments.length);
    const post = async (body, parent_id, st, photos) => {
      if (!body && !photos?.blobs.length) {
        st.textContent = t("ph_need_text");
        return;
      }
      try {
        const images = photos ? await photos.upload(st) : [];
        await community.addComment({ thread_id: id, parent_id, body, images });
        load();
      } catch (e) {
        st.textContent = /rate_limit/.test(e.message) ? t("cm_rate") : `${t("cm_error")} ${e.message}`;
      }
    };
    wireMd(el);
    const mainForm = el.querySelector('[data-form="comment"]');
    const mainPhotos = mainForm ? wirePhotos(mainForm) : null;
    mainForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      post(ev.target.body.value.trim(), null, ev.target.querySelector(".status"), mainPhotos);
    });
    el.querySelectorAll("[data-reply]").forEach((b) =>
      b.addEventListener("click", () => {
        const slot = b.closest(".comment-main").querySelector(".reply-slot");
        if (slot.innerHTML) {
          slot.innerHTML = "";
          return;
        }
        slot.innerHTML = `<form class="cm-form">${mdEditor("body", 2, "", 5000)}${photoPickerHtml(4)}<div class="row-inline"><button class="pill primary small">${esc(t("ds_send"))}</button></div><p class="small status"></p></form>`;
        slot.querySelector("textarea").focus();
        const replyPhotos = wirePhotos(slot);
        wireMd(slot);
        slot.querySelector("form").addEventListener("submit", (ev) => {
          ev.preventDefault();
          post(ev.target.body.value.trim(), Number(b.dataset.reply), ev.target.querySelector(".status"), replyPhotos);
        });
      }),
    );
    el.querySelectorAll("[data-dflag]").forEach((b) =>
      b.addEventListener("click", async () => {
        const [kind, tid] = b.dataset.dflag.split(":");
        const reason = prompt(t("cm_flag_reason"));
        if (!reason) return;
        try {
          await community.flagDiscuss(kind, Number(tid), reason);
          b.textContent = t("cm_flagged");
        } catch (e) {
          alert(`${t("cm_error")} ${e.message}`);
        }
      }),
    );
    el.querySelectorAll("[data-dedit]").forEach((b) =>
      b.addEventListener("click", () => {
        const [kind, tid] = b.dataset.dedit.split(":");
        if (kind === "thread") editThread(el.querySelector("article.thread"), th, load);
        else editComment(b.closest(".comment-main"), res.comments.find((c) => c.id === Number(tid)), load);
      }),
    );
    el.querySelectorAll("[data-ddel]").forEach((b) =>
      b.addEventListener("click", async () => {
        const [kind, tid] = b.dataset.ddel.split(":");
        if (!confirm(t("cm_delete_q"))) return;
        try {
          if (kind === "thread") {
            await community.deleteThread(Number(tid));
            go("#discuss");
          } else {
            await community.deleteComment(Number(tid));
            load();
          }
        } catch (e) {
          alert(`${t("cm_error")} ${e.message}`);
        }
      }),
    );
  };
  load();
}

/** Threads linked to one item, on its page. */
async function renderItemThreads(el, item) {
  if (!el) return;
  const { ok, rows } = await community.listThreads({ item: item.id });
  if (!el.isConnected) return;
  el.innerHTML = `<div class="row-between"><h3>${esc(t("ds_item_title"))}</h3><a class="pill small" href="#discuss/new?item=${encodeURIComponent(item.id)}">${esc(t("ds_new_about"))}</a></div>
    ${!ok ? `<p class="muted">${esc(t("cm_offline"))}</p>` : rows.length ? rows.slice(0, 8).map((r) => threadRow(r, undefined, false)).join("") : `<p class="muted">${esc(t("ds_item_empty"))}</p>`}`;
}

// ---- account

function accountPage() {
  return `<div class="discuss narrow"><h1>${esc(t("ac_title"))}</h1><div id="account"><p class="muted">${esc(t("cm_loading"))}</p></div></div>`;
}

async function wireAccount(main) {
  const el = main.querySelector("#account");
  const s = await community.session();
  const profile = s ? await community.myProfile() : null;
  if (!el.isConnected) return;
  if (!s || !profile) {
    el.innerHTML = `<div class="card pad">${authBlock(s, profile, "#account")}</div>`;
    wireAuth(el, "#account", () => wireAccount(main));
    return;
  }
  const a = await community.myActivity();
  if (!el.isConnected) return;
  const list = (rows, row) => (rows.length ? `<ul class="act">${rows.map(row).join("")}</ul>` : `<p class="muted small">${esc(t("ac_none"))}</p>`);
  const itemLink = (id) => {
    const i = findItem(id);
    return `<a href="#item/${encodeURIComponent(id)}">${esc(i ? displayName(i) : id)}</a>`;
  };
  el.innerHTML = `
    <section class="card pad"><h3>${esc(t("ac_profile"))}</h3>
      <form class="cm-form" data-form="rename"><label class="dfield"><span>${esc(t("cm_name"))}</span>
        <div class="row-inline"><input class="search" name="name" required minlength="2" maxlength="40" value="${esc(profile.display_name)}"><button class="pill primary">${esc(t("cm_save"))}</button></div></label>
        <p class="muted small">${esc(t("ac_email", { email: a.email }))} · ${esc(t("ac_since", { date: day(a.since) }))}</p><p class="small status" role="status"></p></form>
      <div class="row-inline"><button type="button" class="pill" data-signout>${esc(t("cm_signout"))}</button></div>
    </section>
    <section class="card pad"><h3>${esc(t("ac_threads"))} (${a.threads.length})</h3>${list(a.threads, (r) => `<li><a href="#discuss/${r.id}">${esc(r.title)}</a> <span class="muted small">· ${esc(t(`dc_${r.category}`))} · ▲ ${r.score} · ${esc(t("ds_n_comments", { n: r.comment_count }))} · ${esc(ago(r.created_at))}</span></li>`)}</section>
    <section class="card pad"><h3>${esc(t("ac_comments"))} (${a.comments.length})</h3>${list(a.comments, (r) => `<li><a href="#discuss/${r.thread_id}">${esc(r.body.slice(0, 120))}${r.body.length > 120 ? "…" : ""}</a> <span class="muted small">· ▲ ${r.score} · ${esc(ago(r.created_at))}</span></li>`)}</section>
    <section class="card pad"><h3>${esc(t("ac_reports"))} (${a.reports.length})</h3>${list(a.reports, (r) => `<li>${itemLink(r.item_id)}: ${esc(r.title)} <span class="muted small">· ${esc(t(`cm_kind_${r.kind}`))} · ${esc(t("cm_metoo"))} ${r.confirms} · ${esc(ago(r.created_at))}</span></li>`)}</section>
    <section class="card pad"><h3>${esc(t("ac_prices"))} (${a.prices.length})</h3>${list(a.prices, (r) => `<li>${itemLink(r.item_id)}: ${money(r.amount, r.currency)} <span class="muted small">· ${esc(t(`ch_${r.channel}`))} · ${esc(day(r.paid_on))}</span></li>`)}</section>
    <section class="card pad danger-zone"><h3>${esc(t("ac_delete_h"))}</h3><p class="small">${esc(t("ac_delete_what"))}</p>
      <div class="row-inline"><button type="button" class="pill" data-delete-account>${esc(t("ac_delete"))}</button></div><p class="small status" role="status"></p></section>`;
  el.querySelector('[data-form="rename"]').addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const st = ev.target.querySelector(".status");
    try {
      await community.saveProfile(ev.target.name.value.trim());
      st.textContent = t("ac_saved");
    } catch (e) {
      st.textContent = `${t("cm_error")} ${e.message}`;
    }
  });
  el.querySelector("[data-signout]").addEventListener("click", async () => {
    await community.signOut();
    wireAccount(main);
  });
  el.querySelector("[data-delete-account]").addEventListener("click", async (ev) => {
    const word = t("ac_delete_word");
    if (prompt(t("ac_delete_confirm", { word })) !== word) return;
    const st = ev.target.closest("section").querySelector(".status");
    try {
      await community.deleteAccount();
      st.textContent = t("ac_deleted");
      setTimeout(() => wireAccount(main), 1200);
    } catch (e) {
      st.textContent = `${t("cm_error")} ${e.message}`;
    }
  });
}

// ---------------------------------------------------------------------------
// Bookmarks (#saved), following threads, inbox (#inbox).

function bmButton(kind, target) {
  return `<button type="button" class="pill bm" data-bm-kind="${kind}" data-bm-target="${esc(target)}" aria-pressed="false">☆ ${esc(t(kind === "thread" ? "bm_follow" : "bm_save"))}</button>`;
}

async function wireBookmarks(root) {
  const btns = [...root.querySelectorAll("[data-bm-kind]")];
  if (!btns.length) return;
  const label = (b, on) => {
    b.setAttribute("aria-pressed", String(on));
    b.textContent = `${on ? "★" : "☆"} ${t(b.dataset.bmKind === "thread" ? (on ? "bm_following" : "bm_follow") : on ? "bm_saved" : "bm_save")}`;
  };
  for (const b of btns) {
    label(b, await community.isBookmarked(b.dataset.bmKind, b.dataset.bmTarget));
    b.addEventListener("click", async () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      label(b, on);
      try {
        await community.setBookmark(b.dataset.bmKind, b.dataset.bmTarget, on);
      } catch (e) {
        label(b, !on);
        alert(`${t("cm_error")} ${e.message}`);
      }
    });
  }
}

function savedPage() {
  return `<div class="discuss"><header class="deal-head"><h1>${esc(t("bm_title"))}</h1><p class="muted">${esc(t("bm_lead"))}</p></header>
    <section class="card pad"><h3>${esc(t("bm_threads"))}</h3><div id="saved-threads"><p class="muted">${esc(t("cm_loading"))}</p></div></section>
    <section class="card pad"><div class="row-between"><h3>${esc(t("bm_items"))}</h3><span class="muted small" id="saved-total"></span></div><div id="saved-items"></div></section>
  </div>`;
}

async function wireSaved(main) {
  const list = await community.bookmarks();
  if (!main.isConnected) return;
  const s = await community.session();
  const items = list.filter((b) => b.kind === "item").map((b) => findItem(b.target)).filter(Boolean);
  const threadIds = list.filter((b) => b.kind === "thread").map((b) => b.target);
  const threads = await community.threadsByIds(threadIds);
  const tEl = main.querySelector("#saved-threads");
  const iEl = main.querySelector("#saved-items");
  if (!tEl) return;
  tEl.innerHTML = threads.length
    ? `<ul class="act">${threads
        .map((r) => {
          const seen = community.seenCount(r.id);
          const fresh = seen == null ? 0 : Math.max(0, r.comment_count - seen);
          return `<li><a href="#discuss/${r.id}">${esc(r.title)}</a> <span class="muted small">· ${esc(t("ds_n_comments", { n: r.comment_count }))}</span>${fresh ? ` <span class="tag new">${esc(t("bm_new", { n: fresh }))}</span>` : ""}</li>`;
        })
        .join("")}</ul>`
    : `<p class="muted small">${esc(t("bm_none_threads"))}</p>`;
  iEl.innerHTML = items.length
    ? `<div class="grid">${items
        .map((i) => {
          const pr = prices(i).cheapest;
          const im = imageOf(i);
          return `<a class="tile card" href="#item/${encodeURIComponent(i.id)}"><div class="tile-img">${im ? `<img src="${esc(sized(im.src, 480))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}</div>
            <div class="tile-body"><div class="tile-name">${esc(displayName(i))}</div><div class="muted small">${esc(t(`cat_${i.category}`))}</div><div class="tile-price">${pr ? money(pr.price, pr.currency) : "—"}</div></div></a>`;
        })
        .join("")}</div>`
    : `<p class="muted small">${esc(t("bm_none_items"))}</p>`;
  // Wishlist total, per currency (store feed prices, before shipping and tax).
  const sums = new Map();
  for (const i of items) {
    const pr = prices(i).cheapest;
    if (pr) sums.set(pr.currency, (sums.get(pr.currency) ?? 0) + pr.price);
  }
  main.querySelector("#saved-total").textContent = sums.size ? t("bm_total", { total: [...sums].map(([c, v]) => money(v, c)).join(" + ") }) : "";
  if (items.length) iEl.insertAdjacentHTML("afterend", `<p class="row-inline"><a class="pill" href="#discuss/new?cat=dream&items=${items.slice(0, 5).map((i) => encodeURIComponent(i.id)).join(",")}">${esc(t("su_from_wishlist"))}</a></p>`);
  if (!s && list.length) tEl.insertAdjacentHTML("beforebegin", `<p class="small warn-text">${esc(t("bm_local"))} <a href="#account">${esc(t("ac_title"))}</a></p>`);
}

function inboxPage() {
  return `<div class="discuss narrow"><h1>${esc(t("ib_title"))}</h1><div id="inbox" class="card"><p class="muted pad">${esc(t("cm_loading"))}</p></div></div>`;
}

async function wireInbox(main) {
  const el = main.querySelector("#inbox");
  const res = await community.inbox();
  if (!el.isConnected) return;
  if (!res) {
    el.innerHTML = `<div class="pad">${authBlock(null, null, "#inbox")}</div>`;
    wireAuth(el, "#inbox", () => wireInbox(main));
    return;
  }
  el.innerHTML = res.rows.length
    ? res.rows
        .map(
          (r) => `<a class="inbox-row${r.unread ? " unread" : ""}" href="#discuss/${r.thread_id}">
          <div class="small"><b>${esc(r.author_name || t("cm_user"))}</b> ${esc(t(r.toMyThread ? "ib_on_thread" : "ib_on_comment"))} <span class="muted">· ${esc(ago(r.created_at))}</span></div>
          <div class="muted small">${esc(r.thread_title)}</div>
          <div class="inbox-body">${esc(r.body.slice(0, 200))}${r.body.length > 200 ? "…" : ""}</div></a>`,
        )
        .join("")
    : `<p class="muted pad">${esc(t("ib_empty"))}</p>`;
  community.markInboxRead();
  updateBell();
}

async function updateBell() {
  const badge = document.querySelector("#inbox-btn .badge-n");
  if (!badge) return;
  const res = await community.inbox().catch(() => null);
  const n = res?.unread ?? 0;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.hidden = !n;
}

// ---------------------------------------------------------------------------
// Public usage statistics (#stats). Aggregates only; see supabase/analytics.sql.

function statsPage() {
  return `<div class="discuss"><header class="deal-head"><h1>${esc(t("st_title"))}</h1><p class="muted">${esc(t("st_lead"))} <a href="#privacy">${esc(t("lg_privacy"))}</a></p>
    ${trackingOff ? `<p class="small muted">${esc(t("st_you_off"))}</p>` : ""}</header><div id="stats"><p class="muted">${esc(t("cm_loading"))}</p></div></div>`;
}

async function wireStats(main) {
  const el = main.querySelector("#stats");
  let d;
  try {
    d = await stats();
  } catch {
    el.innerHTML = `<p class="muted">${esc(t("cm_offline"))}</p>`;
    return;
  }
  if (!el.isConnected) return;
  const last30 = d.daily.slice(-30);
  const sum = (k) => last30.reduce((n, r) => n + r[k], 0);
  const max = Math.max(1, ...last30.map((r) => r.views));
  const table = (title, rows, cols) =>
    `<section class="card pad"><h3>${esc(title)}</h3>${rows.length ? `<table class="stat-table">${rows.map((r) => `<tr>${cols.map((c) => `<td>${c(r)}</td>`).join("")}</tr>`).join("")}</table>` : `<p class="muted small">${esc(t("ac_none"))}</p>`}</section>`;
  const itemName = (id) => {
    const i = findItem(id);
    return `<a href="#item/${encodeURIComponent(id)}">${esc(i ? displayName(i) : id)}</a>`;
  };
  el.innerHTML = `
    <div class="stat-tiles">
      <div class="card pad"><span class="muted small">${esc(t("st_views"))}</span><b>${fmt(sum("views"), 0)}</b></div>
      <div class="card pad"><span class="muted small">${esc(t("st_visitors"))}</span><b>${fmt(sum("visitors"), 0)}</b></div>
      <div class="card pad"><span class="muted small">${esc(t("st_clicks"))}</span><b>${fmt(sum("store_clicks"), 0)}</b></div>
    </div>
    <section class="card pad"><h3>${esc(t("st_daily"))}</h3>
      <div class="bars">${last30.map((r) => `<div class="bar" title="${esc(`${r.day}: ${r.views} ${t("st_views_s")} · ${r.visitors} ${t("st_visitors_s")}`)}"><i style="height:${(r.views / max) * 100}%"></i><i class="v" style="height:${(r.visitors / max) * 100}%"></i></div>`).join("") || `<p class="muted small">${esc(t("ac_none"))}</p>`}</div>
      <p class="muted small"><span class="key"></span> ${esc(t("st_views_s"))} <span class="key v"></span> ${esc(t("st_visitors_s"))}</p></section>
    <div class="stat-grid">
      ${table(t("st_items"), d.items, [(r) => itemName(r.item_id), (r) => fmt(r.views, 0)])}
      ${table(t("st_stores"), d.stores, [(r) => esc(db.stores[r.store]?.name ?? r.store ?? "—"), (r) => fmt(r.clicks, 0)])}
      ${table(t("st_pages"), d.pages, [(r) => esc(r.path ?? "—"), (r) => fmt(r.views, 0)])}
      ${table(t("st_refs"), d.refs, [(r) => esc(r.ref_host), (r) => fmt(r.visitors, 0)])}
      ${table(t("st_devices"), d.devices, [(r) => esc(`${r.device} · ${r.lang}`), (r) => fmt(r.visitors, 0)])}
    </div>
    <p class="muted small">${esc(t("st_method"))}</p>`;
}

// Store clicks (which store, from which product) and script errors.
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href^='https://']");
  if (!a || !db) return;
  const host = new URL(a.href).hostname.replace(/^www\./, "");
  const store = Object.entries(db.stores).find(([, s]) => s.host?.replace(/^www\./, "") === host)?.[0];
  if (store) track("outbound", { store, item: route().name === "item" ? route().id : null, path: route().name });
});
addEventListener("error", (e) => track("error", { path: route().name, message: `${e.message} @ ${(e.filename ?? "").split("/").pop()}:${e.lineno}` }));
addEventListener("unhandledrejection", (e) => track("error", { path: route().name, message: `promise: ${e.reason?.message ?? e.reason}` }));

// ---------------------------------------------------------------------------
// "Search like people search" links, and the X vs Y compare page (#compare).

function searchLinks(i) {
  const n = displayName(i);
  const g = (q, extra = "") => `https://www.google.com/search?q=${encodeURIComponent(q)}${extra}`;
  const isSource = SOURCE_CATS.has(i.category);
  const year = new Date().getFullYear();
  return [
    [`"${n}" vs …`, g(`"${n}" vs`)],
    [t("sq_still_good", { year }), g(`is "${n}" still good ${year}`)],
    [t("sq_review"), g(`"${n}" review`)],
    ["YouTube", `https://www.youtube.com/results?search_query=${encodeURIComponent(`${n} review`)}`],
    [t("sq_good_th"), g(`${n} ดีไหม`)],
    ["Pantip", g(`${n} site:pantip.com`)],
    [isSource ? t("sq_rear") : t("sq_photos"), g(isSource ? `${n} rear panel ports` : `${n} real photos`, "&tbm=isch")],
  ];
}

function comparePage() {
  return `<div class="discuss"><header class="deal-head"><h1>${esc(t("cmp_title"))}</h1><p class="muted">${esc(t("cmp_lead"))}</p></header>
    <div class="card pad"><input class="search" id="cmp-q" placeholder="${esc(t("cmp_add"))}" autocomplete="off"><div class="suggest" id="cmp-suggest"></div></div>
    <div id="cmp"></div></div>`;
}

function compareIds() {
  return (query().get("ids") ?? "").split(",").filter(Boolean).map(findItem).filter(Boolean).slice(0, 4);
}

async function wireCompare(main) {
  const items = compareIds();
  const setIds = (ids) => go(`#compare?ids=${ids.map(encodeURIComponent).join(",")}`);
  const qIn = main.querySelector("#cmp-q");
  const sug = main.querySelector("#cmp-suggest");
  qIn.addEventListener("input", () => {
    const q = qIn.value.trim();
    const hits = q.length < 2 ? [] : db.items.filter((i) => matches(i, q) && !items.includes(i)).sort((a, b) => searchRank(a, q) - searchRank(b, q)).slice(0, 8);
    sug.innerHTML = hits.map((i) => `<button type="button" data-add="${esc(i.id)}">${esc(displayName(i))} <span class="muted small">${esc(t(`cat_${i.category}`))}</span></button>`).join("");
    sug.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => setIds([...items.map((i) => i.id), b.dataset.add].slice(-4))));
  });
  const el = main.querySelector("#cmp");
  if (!items.length) {
    el.innerHTML = `<p class="muted">${esc(t("cmp_empty"))}</p>`;
    return;
  }

  // Facts per item, computed here from the same data and maths as the rest of the site.
  // "On a phone" = Apple's USB-C adapter: hand-checked, cheap, and what most people already have.
  const appleDongle = findItem("apple--c-to-adapter");
  const phoneOutputs = appleDongle ? sourceOutputs(appleDongle) : [];
  const peak = LEVELS.normal + CREST;
  const row = (label, f) => `<tr><th>${esc(label)}</th>${items.map((i) => `<td>${f(i) ?? "—"}</td>`).join("")}</tr>`;
  const spec = (i, k, unit) => {
    const e = i.specs?.[k]?.[0];
    return e ? `${fmt(e.value, 1)} ${unit ?? e.unit ?? `dB <span class="tag">${esc(t("unit_unknown"))}</span>`}` : null;
  };
  const anyHp = items.some((i) => HEADPHONE_CATS.has(i.category));
  const anySrc = items.some((i) => SOURCE_CATS.has(i.category));
  const cheapest = Math.min(...items.map((i) => prices(i).cheapest?.price ?? Infinity));
  const rows = [
    row(t("cmp_type"), (i) => esc(t(`cat_${i.category}`))),
    row(t("col_price"), (i) => {
      const p = prices(i).cheapest;
      return p ? `<b class="${p.price === cheapest ? "best" : ""}">${money(p.price, p.currency)}</b> <span class="muted small">· ${esc(t("stores", { n: new Set(i.offers.map((o) => o.store)).size }))}</span>` : null;
    }),
    row(t("mat_label"), (i) => [...Object.keys(i.materials ?? {}), ...Object.keys(i.styles ?? {})].map((k) => esc(t(`mat_${k}`))).join(", ") || null),
  ];
  if (anyHp) {
    rows.push(row(t("col_imp"), (i) => spec(i, "impedance", "Ω")));
    rows.push(row(t("col_sens"), (i) => spec(i, "sensitivity")));
    rows.push(
      row(t("cmp_need", { peak }), (i) => {
        const m = hpModel(i);
        if (!m || !m.unitKnown) return null;
        const { ohms, dbPerV } = headphoneSpecs(m);
        return esc(vfmt(required(peak, dbPerV, ohms).vrms));
      }),
    );
    rows.push(
      row(t("cmp_phone"), (i) => {
        if (!HEADPHONE_CATS.has(i.category)) return null;
        if (!phoneOutputs.length) return null;
        const ev = evaluate(i, phoneOutputs, { level: LEVELS.normal, crest: CREST });
        const [tone, key] = VERDICT[ev.status] ?? VERDICT.unknown;
        return ev.status === "unknown" ? null : `<span class="st-dot ${tone}"></span>${esc(t(key))}`;
      }),
    );
  }
  if (anySrc) {
    rows.push(
      row(t("cmp_power"), (i) => {
        const o = sourceOutputs(i);
        const p = o.flatMap((x) => x.power ?? []).find((x) => x.load === 32);
        return p ? `${fmt(p.mw, 0)} mW @ 32 Ω` : o[0]?.vmax ? `${o[0].vmax} Vrms` : null;
      }),
    );
    rows.push(row(t("cmp_zout"), (i) => spec(i, "zout", "Ω") ?? (sourceOutputs(i)[0]?.zout != null ? `${sourceOutputs(i)[0].zout} Ω` : null)));
    rows.push(
      row(t("cmp_drives"), (i) => {
        const outs = sourceOutputs(i);
        if (!outs.length) return null;
        const ok = headphones.filter((h) => ["ok", "overkill"].includes(evaluate(h, outs, { level: LEVELS.normal, crest: CREST }).status)).length;
        return esc(t("cmp_drives_n", { n: fmt(ok, 0), of: fmt(headphones.length, 0) }));
      }),
    );
  }
  rows.push(`<tr><th>${esc(t("cmp_reports"))}</th>${items.map((i) => `<td data-reports="${esc(i.id)}">…</td>`).join("")}</tr>`);
  rows.push(`<tr><th>${esc(t("nav_discuss"))}</th>${items.map((i) => `<td data-threads="${esc(i.id)}">…</td>`).join("")}</tr>`);

  const vsQuery = items.map((i) => `"${displayName(i)}"`).join(" vs ");
  el.innerHTML = `<div class="table-wrap card"><table class="cmp-table">
      <thead><tr><th></th>${items
        .map((i) => {
          const im = imageOf(i);
          return `<th><div class="cmp-head">${im ? `<img src="${esc(sized(im.src, 240))}" alt="" referrerpolicy="no-referrer">` : ""}<a href="#item/${encodeURIComponent(i.id)}">${esc(displayName(i))}</a>
          <button type="button" class="link small" data-remove="${esc(i.id)}">${esc(t("cmp_remove"))}</button></div></th>`;
        })
        .join("")}</tr></thead>
      <tbody>${rows.join("")}</tbody></table></div>
    ${
      items.length > 1
        ? `<p class="row-inline"><a class="pill" href="https://www.google.com/search?q=${encodeURIComponent(vsQuery)}" target="_blank" rel="noopener">Google: ${esc(items.map(displayName).join(" vs "))} ↗</a><a class="pill" href="https://www.reddit.com/search/?q=${encodeURIComponent(items.map(displayName).join(" vs "))}" target="_blank" rel="noopener">Reddit ↗</a><a class="pill primary" href="#discuss/new?item=${encodeURIComponent(items[0].id)}">${esc(t("cmp_ask"))}</a></p>`
        : `<p class="muted">${esc(t("cmp_add_more"))}</p>`
    }
    <p class="muted small">${esc(t("cmp_note"))}</p>`;
  el.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => setIds(items.map((i) => i.id).filter((id) => id !== b.dataset.remove))));

  // Community columns load after the table.
  const { ok, rows: reports } = await community.reportsFor(items.map((i) => i.id));
  for (const i of items) {
    const cell = el.querySelector(`[data-reports="${CSS.escape(i.id)}"]`);
    if (!cell) continue;
    const n = ok ? reports.filter((r) => r.item_id === i.id && r.kind === "issue").length : null;
    cell.innerHTML = n == null ? "—" : n ? `<a href="#item/${encodeURIComponent(i.id)}" class="warn-text">${esc(t("cm_banner_n", { n }))}</a>` : `<span class="muted">0</span>`;
  }
  for (const i of items) {
    const cell = el.querySelector(`[data-threads="${CSS.escape(i.id)}"]`);
    if (!cell) continue;
    const res = await community.listThreads({ item: i.id });
    cell.innerHTML = res.ok ? `<a href="#item/${encodeURIComponent(i.id)}">${esc(t("ds_n_threads", { n: res.rows.length }))}</a>` : "—";
  }
}

// ---------------------------------------------------------------------------
// Gallery (#gallery): setups and dream setups with photos, as a grid.

function galleryPage() {
  const p = query();
  const cat = p.get("cat") ?? "";
  const sort = p.get("sort") ?? "new";
  const link = (over) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(over)) v ? n.set(k, v) : n.delete(k);
    return `#gallery?${n}`;
  };
  return `<div class="discuss"><header class="deal-head row-between"><div><h1>${esc(t("ga_title"))}</h1><p class="muted">${esc(t("ga_lead"))}</p></div>
      <div class="row-inline"><a class="pill" href="#discuss/new?cat=dream">${esc(t("su_new_dream"))}</a><a class="pill primary" href="#discuss/new?cat=setup">${esc(t("su_new_setup"))}</a></div></header>
    <div class="filters"><div class="chips">${[["", t("cat_all")], ["setup", t("dc_setup")], ["dream", t("dc_dream")]].map(([c, l]) => `<a class="chip${c === cat ? " on" : ""}" href="${link({ cat: c })}">${esc(l)}</a>`).join("")}</div>
      <div class="chips">${["new", "top"].map((x) => `<a class="chip${x === sort ? " on" : ""}" href="${link({ sort: x })}">${esc(t(`ds_sort_${x}`))}</a>`).join("")}</div></div>
    <div id="gallery" class="gallery-grid"><p class="muted">${esc(t("cm_loading"))}</p></div></div>`;
}

async function wireGallery(main) {
  const p = query();
  const el = main.querySelector("#gallery");
  const cat = p.get("cat");
  const { ok, rows } = await community.listThreads({ category: cat ? cat : ["setup", "dream"], sort: p.get("sort") ?? "new" });
  if (!el.isConnected) return;
  if (!ok) {
    el.innerHTML = `<p class="muted">${esc(t("cm_offline"))}</p>`;
    return;
  }
  el.innerHTML = rows.length
    ? rows
        .map((r) => {
          const items = (r.item_ids ?? []).map(findItem).filter(Boolean);
          const sums = new Map();
          for (const i of items) {
            const pr = prices(i).cheapest;
            if (pr) sums.set(pr.currency, (sums.get(pr.currency) ?? 0) + pr.price);
          }
          // Photo: the poster's own, or the first product's store photo for dream setups without one.
          const own = r.images?.[0];
          const im = own ? null : items.map(imageOf).find(Boolean);
          return `<a class="ga-card card" href="#discuss/${r.id}">
            <div class="ga-img${own ? "" : " product"}">${own ? `<img src="${esc(own)}" alt="" loading="lazy">` : im ? `<img src="${esc(sized(im.src, 480))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<span class="tag">${esc(t(`dc_${r.category}`))}</span></div>
            <div class="ga-body"><b>${esc(r.title)}</b>
            <span class="muted small">${authorHtml(r)} · ▲ ${r.score} · 💬 ${r.comment_count}</span>
            ${items.length ? `<span class="small">${items.slice(0, 3).map((i) => esc(displayName(i))).join(" + ")}${items.length > 3 ? " …" : ""}</span>` : ""}
            ${sums.size ? `<span class="small strong">${[...sums].map(([c, v]) => money(v, c)).join(" + ")}</span>` : ""}</div></a>`;
        })
        .join("")
    : `<p class="muted">${esc(t("ga_empty"))}</p>`;
}

// ---------------------------------------------------------------------------
// Sources page data

function sourceSites() {
  const sites = new Map();
  for (const i of db.items)
    for (const list of Object.values(i.specs ?? {}))
      for (const e of list)
        for (const s of e.sources) {
          const host = new URL(s.url).hostname;
          sites.set(host, (sites.get(host) ?? 0) + 1);
        }
  return [...sites].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Small helpers

function card(title, body) {
  return `<div class="card result"><h3>${esc(title)}</h3>${body}</div>`;
}
function seg(name, items, value) {
  const i = Math.max(items.findIndex(([v]) => v === value), 0);
  return `<div class="seg" role="group" style="--n:${items.length};--i:${i}">${items
    .map(([v, l]) => `<button type="button" data-name="${name}" data-value="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`)
    .join("")}</div>`;
}
/** First store photo for an item: { src, url, store }. Loaded from the store CDN, never copied. */
function imageOf(i) {
  const o = (i.offers ?? []).find((x) => x.image && !x.suspect);
  return o ? { src: o.image, url: o.url, store: o.store } : null;
}
/** Shopify CDN resizes on request; other hosts ignore the parameter. */
function sized(src, w) {
  return /cdn\.shopify\.com|\/cdn\/shop\//.test(src) ? `${src}${src.includes("?") ? "&" : "?"}width=${w}` : src;
}
function specLine(i) {
  const z = i.specs?.impedance?.[0];
  const s = i.specs?.sensitivity?.[0];
  if (HEADPHONE_CATS.has(i.category)) return [z && `${fmt(z.value, 1)} Ω`, s && `${fmt(s.value, 1)} ${s.unit ?? "dB?"}`].filter(Boolean).join(" · ");
  const o = sourceOutputs(i)[0];
  const p = o?.power?.find((x) => x.load === 32) ?? o?.power?.[0];
  return p ? `${fmt(p.mw, 0)} mW @ ${p.load} Ω` : o?.vmax ? `${o.vmax} Vrms` : "";
}
function tag(e) {
  const k = e.kind === "measured" ? "it_measured" : "it_claimed";
  return `<span class="tag ${e.kind}">${esc(t(k))}</span>`;
}
function quoteLinks(e, showQuotes = state.mode === "detail") {
  const srcs = e.sources ?? [];
  return `<span class="srcs">${srcs.map((s) => srcLink(s.url)).join(" ")}</span>${
    showQuotes ? srcs.filter((s) => s.quote).slice(0, 3).map((s) => `<q class="quote">${esc(s.quote)}</q>`).join("") : ""
  }`;
}
function srcLink(url) {
  if (!url) return "";
  const host = new URL(url).hostname.replace(/^www\./, "");
  return `<a class="src" href="${esc(url)}" target="_blank" rel="noopener">${esc(host)}</a>`;
}
function money(n, currency) {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat(state.lang === "th" ? "th-TH" : "en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${fmt(n, 0)} ${currency ?? ""}`;
  }
}
function fmt(n, d) {
  return Number(n).toLocaleString(state.lang === "th" ? "th-TH" : "en-US", { maximumFractionDigits: d });
}
function vfmt(v) {
  return v < 1 ? `${fmt(v * 1000, 1)} mV` : `${fmt(v, 2)} V`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------------------------------------------------------------------------
// Boot (last, so every const above is initialised)

await community.finishSignIn();
db = await loadData();
headphones = db.items.filter((i) => HEADPHONE_CATS.has(i.category) && hpModel(i));
sources = db.items.filter((i) => SOURCE_CATS.has(i.category) && sourceOutputs(i).length);
readHash();
bindChrome();
render();
updateBell();
setInterval(updateBell, 3 * 60 * 1000);
addEventListener("hashchange", () => {
  readHash();
  render();
});
