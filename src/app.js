import { powerCheck, outputImpedanceCheck, bestConnection, deviceToDac, headphoneSpecs, required, JACKS } from "./calc.js?v=mv5bfzie";
import { loadData, loadPhotos, hpModel, sourceOutputs, evaluate, prices as allPrices, convert, displayName, HEADPHONE_CATS, SOURCE_CATS } from "./data.js?v=mv5bfzie";
import { renderChart } from "./chart.js?v=mv5bfzie";
import { parseFR, normalize, smooth, dbAt, frSvg } from "./fr.js?v=mv5bfzie";
import { makeT } from "./i18n.js?v=mv5bfzie";
import { LEARN, aboutPage, REPO } from "./content.js?v=mv5bfzie";
import { LEGAL } from "./legal.js?v=mv5bfzie";
import { track, stats, trackingOff } from "./analytics.js?v=mv5bfzie";
import * as community from "./community.js?v=mv5bfzie";
import { combos, capPoint, parseCode, encodeCode, decodeCode, landed, summarize } from "./deal.js?v=mv5bfzie";
import { redactImage } from "./redact.js?v=mv5bfzie";
import { renderMd, MD_ACTIONS, applyMd } from "./markdown.js?v=mv5bfzie";
import { TERMS, TERM, GLOSSARY_UPDATED } from "./glossary.js?v=mv5bfzie";
import { chainLinks } from "./chain.js?v=mv5bfzie";
import { fits } from "./dcfit.js?v=mv5bfzie";
import { BOOKMARKLET } from "./bookmarklet.js?v=mv5bfzie";
import { parseBlocks, reviewPost, reviewPostI18n, reviewKey, sourceHost, REVIEW_LABELS } from "./blocks.js?v=mv5bfzie";
import { REGIONS, guessRegion, storeLinks, shipsTo } from "./region.js?v=mv5bfzie";

const LEVELS = { quiet: 70, normal: 80, loud: 90 };
const CREST = 15;
const JACK_LABEL = { "3.5": "3.5 mm", "6.35": "6.35 mm", "4.4": "4.4 mm", "2.5": "2.5 mm", xlr4: "XLR 4-pin" };
const PLUGS = ["3.5", "6.35", "4.4", "xlr4"];
const PLUG_SHORT = { "3.5": "3.5", "6.35": "6.35", "4.4": "4.4", xlr4: "XLR" };

const LANGS = ["th", "en", "ja", "zh"];
const LOCALE = { th: "th-TH", en: "en-GB", ja: "ja-JP", zh: "zh-CN" };
/** Each language in its own script, for "view original (English)". */
const LANG_NAME = { th: "ไทย", en: "English", ja: "日本語", zh: "中文" };
const browserLang = LANGS.find((l) => (navigator.language ?? "").toLowerCase().startsWith(l)) ?? "en";
const state = {
  lang: load("lang", browserLang),
  region: "",
  mode: load("mode", "simple"),
  device: "phone-usb-c",
  src: "",
  amp: "",
  dac: "",
  hp: "",
  plug: "",
  level: "normal",
};
if (!LANGS.includes(state.lang)) state.lang = "en";
state.region = load("region", guessRegion(state.lang));
if (!REGIONS[state.region]) state.region = "other";
let t = makeT(state.lang);
/** Locale for dates and numbers in the current UI language. */
const loc = () => LOCALE[state.lang] ?? "en-GB";
/** Pick the current language from a {th, en, ...} object, falling back to English. */
const L = (o) => o?.[state.lang] ?? o?.en ?? o?.th ?? "";
/** Currency of the reader's region (code calculator, price reports). */
const cur = () => REGIONS[state.region]?.currency ?? "USD";
/** Currency the reader wants store prices converted to (like a shop's currency menu); defaults to the region's. */
state.fxCur = load("fxCur", "");
const viewCur = () => state.fxCur || cur();
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
  return { name: h || "home" };
}
function query() {
  return new URLSearchParams(location.hash.split("?")[1] ?? "");
}
function readHash() {
  const p = query();
  if (route().name === "build") for (const k of ["device", "src", "cart", "dac", "amp", "hp", "plug", "level"]) state[k] = p.get(k) ?? (k === "device" ? state.device : k === "level" ? "normal" : "");
  if (LANGS.includes(p.get("lang"))) state.lang = p.get("lang");
  if (["simple", "detail"].includes(p.get("mode"))) state.mode = p.get("mode");
}
function buildUrl() {
  const p = new URLSearchParams();
  for (const k of ["device", "src", "cart", "dac", "amp", "hp", "plug", "level"]) if (state[k]) p.set(k, state[k]);
  return `#build?${p}`;
}
function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------------------------------------------------------------------------
// Chrome

function bindChrome() {
  document.querySelector("#lang-sel")?.addEventListener("change", (e) => {
    state.lang = e.target.value;
    save("lang", state.lang);
    render();
  });
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
  const langSel = document.querySelector("#lang-sel");
  if (langSel) langSel.value = state.lang;
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
  const date = new Date(db.builtAt).toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" });
  document.querySelector("footer .foot").innerHTML = `${esc(t("updated", { date, stores: Object.keys(db.stores).length, n: fmt(db.items.length, 0) }))}<br>${esc(t("footer"))} · <a href="#about">${esc(t("nav_about"))}</a> · <a href="#terms">${esc(t("lg_terms"))}</a> · <a href="#privacy">${esc(t("lg_privacy"))}</a> · <a href="#contact">${esc(t("lg_contact"))}</a> · <a href="#stats">${esc(t("st_title"))}</a> · <a href="#tools">${esc(t("tl_title"))}</a> · <a href="#fr">${esc(t("fr_title"))}</a> · <a href="${REPO}" target="_blank" rel="noopener">GitHub</a>
    <br><label class="region-pick">${esc(t("rg_label"))} ${regionSelect()}</label>`;
}

function regionSelect() {
  return `<select class="mini-select" data-region>${Object.entries(REGIONS)
    .map(([id, r]) => `<option value="${id}"${id === state.region ? " selected" : ""}>${esc(L(r))} · ${r.currency}</option>`)
    .join("")}</select>`;
}
function fxSelect() {
  const codes = Object.keys(db.fx?.usdPer ?? {}).sort();
  if (!codes.length) return "";
  const v = viewCur();
  return `<label class="small muted fx-pick">${esc(t("fx_show"))} <select class="mini-select" data-fx>${[...new Set([v, ...codes])].map((c) => `<option value="${c}"${c === v ? " selected" : ""}>${c}</option>`).join("")}</select></label>`;
}
document.addEventListener("change", (e) => {
  const el = e.target.closest?.("select[data-fx]");
  if (!el) return;
  state.fxCur = el.value === cur() ? "" : el.value;
  save("fxCur", state.fxCur);
  render();
});
// One listener for every region picker on the page (footer, where-to-buy, code calculator).
document.addEventListener("change", (e) => {
  const el = e.target.closest?.("select[data-region]");
  if (!el || !REGIONS[el.value]) return;
  state.region = el.value;
  save("region", state.region);
  render();
});

/** Brand mark: the Simple Icons logo when one exists, else initials. Identification only. */
function brandMark(brand, size = 40) {
  const logo = db.logos?.[brand];
  if (logo) return `<span class="brand-mark" style="--s:${size}px" title="${esc(brand)}"><svg viewBox="0 0 24 24" role="img" aria-label="${esc(brand)}"><path d="${esc(logo.path)}"/></svg></span>`;
  const initials = String(brand ?? "?")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return `<span class="brand-mark initials" style="--s:${size}px" aria-hidden="true">${esc(initials || "?")}</span>`;
}

/** "DAC", "Headphone amp" or "DAC + amp" for desktop units; the category otherwise. */
/** Small asks where this model's data is missing: back-panel photo, specs from the brand. */
function missingAsks(i) {
  const asks = [];
  const isSource = SOURCE_CATS.has(i.category) || i.category === "speaker";
  if (isSource && !Object.keys(i.ports?.in ?? {}).length && !Object.keys(i.ports?.out ?? {}).length)
    asks.push(`<button type="button" class="pill" data-scroll="ports">📷 ${esc(t("ask_ports"))}</button>`);
  const noPower = isSource && i.category !== "speaker" && !sourceOutputs(i).length;
  const noHp = HEADPHONE_CATS.has(i.category) && !hpModel(i);
  if (noPower || noHp) {
    const what = noPower ? "output power (mW at 16/32/300 Ω), output impedance" : "sensitivity (dB/mW or dB/V, which one) and impedance";
    const msg = `@${i.brand ?? ""} Could you publish the ${what} for the ${displayName(i)}? People are checking whether it suits their setup: ${location.origin}${location.pathname}#item/${i.id}`;
    asks.push(`<a class="pill" href="https://x.com/intent/post?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">✉ ${esc(t("ask_spec"))}</a>`);
  }
  return asks.length ? `<section class="card pad asks"><p class="small">${esc(t("ask_lead"))}</p><div class="row-inline">${asks.join("")}</div></section>` : "";
}

/** DC power: which supplies suit this box, or which boxes this supply suits. */
function powerLine(i) {
  const spec = i.dcIn ?? i.dcOut;
  if (!spec) return "";
  const vtxt = (x) => (x.range ? `${x.range[0]}–${x.range[1]} V` : (x.needs ?? x.outputs).map((p) => `${p.v} V${p.a ? ` ${fmt(p.a, 2)} A` : ""}`).join(" · "));
  // Powered over USB: a barrel-plug supply doesn't apply.
  if (i.dcIn?.usb) return `<p class="small power-line"><b>${esc(t("pw_needs"))}</b> ${esc(vtxt(spec))} · ${esc(t("pw_usb"))} <a href="${esc(spec.url)}" target="_blank" rel="noopener" title="${esc(spec.quote)}">${esc(t("pw_source"))} ↗</a></p>`;
  const others = i.dcIn ? db.items.filter((x) => x.dcOut) : db.items.filter((x) => x.dcIn);
  const matches = others
    .map((x) => ({ x, f: i.dcIn ? fits(x.dcOut, i.dcIn) : fits(i.dcOut, x.dcIn) }))
    .filter((m) => m.f && m.f.status !== "low_current")
    .sort((a, b) => (a.f.status === "ok" ? 0 : 1) - (b.f.status === "ok" ? 0 : 1));
  const list = matches
    .slice(0, 8)
    .map((m) => `<a class="chip" href="#item/${encodeURIComponent(m.x.id)}">${esc(displayName(m.x))} · ${m.f.v} V${m.f.status === "ok" ? " ✓" : " ?"}</a>`)
    .join("");
  return `<div class="small power-line"><p><b>${esc(t(i.dcIn ? "pw_needs" : "pw_gives"))}</b> ${esc(vtxt(spec))} <a href="${esc(spec.url)}" target="_blank" rel="noopener" title="${esc(spec.quote)}">${esc(t("pw_source"))} ↗</a></p>
    ${matches.length ? `<p class="muted">${esc(t(i.dcIn ? "pw_supplies" : "pw_devices", { n: matches.length }))}</p><div class="chips">${list}</div>` : ""}
    <p class="muted">${esc(t("pw_note"))}</p></div>`;
}

function catLabel(i) {
  if (i.speaker) return t(`spk_${i.speaker}`);
  return i.role && i.category === "desktop" ? t(`role_${i.role}`) : t(`cat_${i.category}`);
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
  else if (r.name === "tools") main.innerHTML = toolsPage();
  else if (r.name === "fr") main.innerHTML = frPage();
  else if (LEGAL[r.name]) main.innerHTML = `<article class="prose legal">${L(LEGAL[r.name])}</article>`;
  else if (r.name === "inbox") main.innerHTML = inboxPage();
  else if (r.name === "learn") main.innerHTML = learnPage(r.term);
  else if (r.name === "about") main.innerHTML = `<article class="prose about">${aboutPage(state.lang, sourceSites(), db.stores)}</article>`;
  else if (r.name === "home") main.innerHTML = homePage();
  else if (r.name === "calendar") main.innerHTML = calendarPage();
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
// Home: what Sotto answers, shown with real results computed on the page.

// The setup most people start with: a phone and Apple's USB-C dongle.
const HOME_DONGLE = "apple--c-to-adapter";
const HOME_EXAMPLES = ["moondrop--blessing-3", "sennheiser--hd-600", "hifiman--sundara", "moondrop--cosmo"].map((hp) => ({ device: "phone-usb-c", amp: HOME_DONGLE, hp }));
const exUrl = (e) => `#build?device=${e.device}&amp=${encodeURIComponent(e.amp)}&hp=${encodeURIComponent(findItem(e.hp).id)}`;

/** The builder's verdict and connection cards for one setup, without touching the page state. */
function homeExample({ device, amp, hp: hpId }) {
  const hp = findItem(hpId);
  if (!hp) return { verdict: "", conn: "" };
  const keep = { device: state.device, src: state.src, dac: state.dac, amp: state.amp, hp: state.hp, plug: state.plug, level: state.level };
  Object.assign(state, { device, src: "", dac: "", amp: amp ?? "", hp: hp.id, plug: "", level: "normal" });
  try {
    const src = currentSource();
    const conn = connectionCard(src, hp);
    const ev = src.outputs.length ? evaluate(hp, conn.outputs, { level: LEVELS.normal, crest: CREST }) : { status: hasJack(src.driver) ? "unknown" : "no-output" };
    return { verdict: verdictCard(ev, hp, false, { amp: src.amp, device: src.device }), conn: conn.html };
  } finally {
    Object.assign(state, keep);
  }
}

/** Every headphone whose sensitivity unit is known, checked against the dongle: { n, ok, tight, overkill, insufficient }. */
let dongleTally = null;
function homeDongleTally() {
  if (dongleTally) return dongleTally;
  const d = findItem(HOME_DONGLE);
  const outs = d ? sourceOutputs(d) : [];
  const tally = { n: 0, ok: 0, tight: 0, overkill: 0, insufficient: 0 };
  for (const i of db.items) {
    if (!HEADPHONE_CATS.has(i.category) || !hpModel(i)?.unitKnown) continue;
    const s = evaluate(i, outs, { level: LEVELS.normal, crest: CREST }).status;
    if (s in tally) (tally.n++, tally[s]++);
  }
  return (dongleTally = tally);
}

function homeWaves() {
  // Layered waves drifting sideways; each path is two periods wide so a -50% shift loops seamlessly.
  const wave = (y, a) => `M0 ${y} C 150 ${y - a}, 350 ${y - a}, 500 ${y} S 850 ${y + a}, 1000 ${y} S 1350 ${y - a}, 1500 ${y} S 1850 ${y + a}, 2000 ${y} V 400 H 0 Z`;
  return `<div class="home-waves" aria-hidden="true">${[
    [150, 60, 38],
    [210, 50, 29],
    [270, 45, 23],
    [320, 35, 17],
  ]
    .map(([y, a, s], n) => `<svg viewBox="0 0 2000 400" preserveAspectRatio="none" class="wv wv${n}" style="--s:${s}s"><path d="${wave(y, a)}"/></svg>`)
    .join("")}</div>`;
}

/** The selected headphone on the hero stage: its photo, brand behind it, [ name ], spec chips, and the live result. */
function homeStage(e) {
  const hp = findItem(e.hp);
  const im = imageOf(hp);
  const z = hp.specs?.impedance?.[0];
  const s = hp.specs?.sensitivity?.[0];
  const p = prices(hp).cheapest;
  const short = (k) => hp.sheet?.[k]?.value.length <= 32 && hp.sheet[k].value;
  const chips = [short("driver"), short("freq"), z && `${fmt(z.value, 1)} Ω`, s && `${fmt(s.value, 1)} ${s.unit ?? ""}`.trim(), p && `${t("price_from")} ${money(p.price, p.currency)}`, t("stores", { n: storeCount(hp) })].filter(Boolean);
  const r = homeExample(e);
  return `<div class="stage-brand" aria-hidden="true">${esc(hp.brand)}</div>
    <div class="stage-top">
      ${im ? `<img class="stage-img" src="${esc(sized(im.src, 600))}" alt="${esc(displayName(hp))}" referrerpolicy="no-referrer">` : ""}
      <div class="stage-id">
        <p class="stage-name"><span class="br">[</span> ${esc(hp.model)} <span class="br">]</span></p>
        <p class="small muted">${esc(hp.brand)} · ${esc(catLabel(hp))}</p>
        <div class="stage-chips">${chips.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
      </div>
    </div>
    ${r.verdict}
    <a class="link small" href="${exUrl(e)}">${esc(t("home_open"))}</a>`;
}

/** Right-hand panel of the "what Sotto checks" explorer, built from the same data as the site. */
function homeFeature(key) {
  const e = HOME_EXAMPLES[1];
  if (key === "plug") return homeExample(e).conn;
  if (key === "loud") return homeExample(e).verdict;
  if (key === "amp") {
    const c = homeDongleTally();
    // "Not enough" stays visible at 0: that zero is the point.
    const bar = (k) => (c[k] || k === "insufficient" ? `<div class="tally-row"><span class="st s-${k}">${esc(t(`st_${k}`))}</span><div class="tally-bar"><i class="s-${k}" style="width:${(c[k] / c.n) * 100}%"></i></div><b>${fmt(c[k], 0)}</b></div>` : "");
    return `<div class="card result"><p class="big">${esc(t("home_f_amp_big", { n: fmt(c.n, 0), ok: fmt(c.ok + c.tight + c.overkill, 0) }))}</p>${["ok", "tight", "overkill", "insufficient"].map(bar).join("")}<p class="small muted">${esc(t("home_f_amp_note"))}</p></div>`;
  }
  if (key === "price") {
    const hp = findItem(e.hp);
    const offers = prices(hp).offers.filter((o) => o.condition === "new" && !o.suspect && o.currency === prices(hp).cheapest?.currency);
    const max = Math.max(...offers.map((o) => o.price));
    return `<div class="card result"><h3>${esc(displayName(hp))}</h3>${offers
      .map((o) => `<a class="price-row" href="${esc(o.url)}" target="_blank" rel="noopener"><span>${esc(db.stores[o.store]?.name ?? o.store)}</span><div class="tally-bar"><i style="width:${(o.price / max) * 100}%"></i></div><b>${money(o.price, o.currency)}</b></a>`)
      .join("")}<p class="small muted">${esc(t("home_f_price_note"))}</p></div>`;
  }
  return `<div class="card result" data-feature-reviews><p class="muted">${esc(t("cm_loading"))}</p></div>`;
}

const HOME_FEATURES = ["plug", "loud", "amp", "price", "reviews"];

function homePage() {
  const brands = new Set(db.items.map((i) => i.brand)).size;
  const sourced = db.items.reduce((n, i) => n + Object.values(i.specs ?? {}).reduce((m, v) => m + (Array.isArray(v) ? v.length : 0), 0), 0);
  const stats = [
    [fmt(db.items.length, 0), t("home_st_models")],
    [fmt(Object.keys(db.stores).length, 0), t("home_st_stores")],
    [fmt(brands, 0), t("home_st_brands")],
    [fmt(sourced, 0), t("home_st_sourced")],
  ];
  const popular = db.items
    .filter((i) => HEADPHONE_CATS.has(i.category) && imageOf(i))
    .sort((a, b) => storeCount(b) - storeCount(a))
    .slice(0, 4);
  const ex = HOME_EXAMPLES.filter((e) => findItem(e.hp));
  const dongle = findItem(HOME_DONGLE);
  return `<div class="home">
    <section class="home-hero">${homeWaves()}
      <div class="home-hero-text">
        <p class="home-kicker">${esc(t("home_kicker"))}</p>
        <h1>${t("home_h1").split("\n").map(esc).join("<br>")}</h1>
        <p class="home-sub">${esc(t("home_sub"))}</p>
        <div class="home-cta"><a class="pill primary" href="#build">${esc(t("home_cta_build"))}</a><a class="pill" href="#catalog">${esc(t("home_cta_catalog"))}</a></div>
      </div>
      <div class="home-demo card">
        <p class="small muted home-demo-cap">${esc(t("home_try"))} · ${esc(t("home_ex_chain", { amp: dongle ? displayName(dongle) : "dongle" }))}</p>
        <div class="home-select">
          <div class="home-rail" role="tablist" aria-label="${esc(t("home_try"))}">${ex
            .map((e, n) => {
              const hp = findItem(e.hp);
              const im = imageOf(hp);
              return `<button type="button" class="rail-btn${n ? "" : " on"}" role="tab" aria-selected="${!n}" data-ex="${n}" title="${esc(displayName(hp))}">${im ? `<img src="${esc(sized(im.src, 120))}" alt="" referrerpolicy="no-referrer">` : esc(hp.model.slice(0, 2))}</button>`;
            })
            .join("")}</div>
          <div class="home-stage" data-stage>${ex.length ? homeStage(ex[0]) : ""}</div>
        </div>
      </div>
    </section>
    <section class="home-stats">${stats.map(([n, l]) => `<div><b>${n}</b><span>${esc(l)}</span></div>`).join("")}</section>
    <section class="home-band">
      <p class="home-slash">// ${esc(t("home_f_kicker"))}</p>
      <h2>${esc(t("home_f_h"))}</h2>
      <div class="home-explore">
        <div class="explore-list">${HOME_FEATURES.map(
          (k, n) => `<button type="button" class="explore-item${n ? "" : " on"}" data-feature="${k}" aria-expanded="${!n}"><b>${esc(t(`home_f_${k}`))}</b><span class="small">${esc(t(`home_f_${k}_sub`))}</span></button>`,
        ).join("")}</div>
        <div class="explore-view" data-feature-view>${homeFeature(HOME_FEATURES[0])}</div>
      </div>
    </section>
    <section class="home-band">
      <p class="home-slash">// ${esc(t("home_s2_kicker"))}</p>
      <h2>${esc(t("home_s2_h"))}</h2><p class="home-sub">${esc(t("home_s2_sub"))}</p>
      <div class="home-cta"><a class="pill primary" href="#catalog">${esc(t("home_cta_catalog"))}</a><a class="pill" href="#deal">${esc(t("home_cta_deal"))}</a></div>
      <div class="home-products">${popular
        .map((i) => {
          const im = imageOf(i);
          const p = prices(i).cheapest;
          return `<a class="card home-product" href="#item/${encodeURIComponent(i.id)}"><img src="${esc(sized(im.src, 400))}" alt="" loading="lazy" referrerpolicy="no-referrer"><b>${esc(displayName(i))}</b><span class="muted small">${p ? `${esc(t("price_from"))} ${money(p.price, p.currency)} · ` : ""}${esc(t("stores", { n: storeCount(i) }))}</span></a>`;
        })
        .join("")}</div>
    </section>
    <section class="home-band" data-home-reviews>
      <p class="home-slash">// ${esc(t("home_s3_kicker"))}</p>
      <h2>${esc(t("home_s3_h"))}</h2><p class="home-sub">${esc(t("home_s3_sub"))}</p>
      <div class="home-reviews" data-reviews></div>
    </section>
    <section class="home-band home-not">
      <p class="home-slash">// ${esc(t("home_s4_kicker"))}</p>
      <h2>${esc(t("home_s4_h"))}</h2>
      <div class="home-not-grid">${[1, 2, 3].map((n) => `<div class="card pad"><b>${esc(t(`home_not${n}`))}</b><p class="muted small">${esc(t(`home_not${n}_sub`))}</p></div>`).join("")}</div>
      <div class="home-cta"><a class="pill primary" href="#build">${esc(t("home_cta_build"))}</a><a class="pill" href="#about">${esc(t("nav_about"))}</a></div>
    </section>
  </div>`;
}

function reviewCard(r) {
  const item = findItem(r.item_id);
  const shown = r.i18n?.[state.lang] ?? r;
  const head = (shown.body ?? "").split("\n\n")[0];
  return `<a class="card pad home-review" href="#item/${encodeURIComponent(r.item_id)}">${item ? `<span class="small muted">${esc(displayName(item))}</span>` : ""}<b>${esc(shown.title)}</b><p class="small">${esc(head)}</p></a>`;
}

function wireHome(main) {
  // Hero: picking a headphone on the rail swaps the stage like Endfield's operator change: the old
  // photo is washed in the accent and fades, then the new one arrives washed and clears to colour.
  const stage = main.querySelector("[data-stage]");
  const ex = HOME_EXAMPLES.filter((e) => findItem(e.hp));
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer = 0;
  const enter = () => {
    stage.classList.remove("leaving", "entering");
    void stage.offsetWidth;
    stage.classList.add("entering");
  };
  enter();
  main.querySelectorAll("[data-ex]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.classList.contains("on")) return;
      main.querySelectorAll("[data-ex]").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-selected", String(x === b));
      });
      clearTimeout(timer);
      const swap = () => {
        stage.innerHTML = homeStage(ex[Number(b.dataset.ex)]);
        enter();
      };
      if (calm) return swap();
      stage.classList.remove("entering");
      stage.classList.add("leaving");
      timer = setTimeout(swap, 150);
    }),
  );
  // Explorer: one open item at a time; the panel on the right shows that check on real data.
  const view = main.querySelector("[data-feature-view]");
  let reviews = null;
  const fillReviews = () => {
    const el = view.querySelector("[data-feature-reviews]");
    if (!el || !reviews) return;
    el.outerHTML = reviews.length ? `<div class="explore-reviews">${reviews.slice(0, 2).map(reviewCard).join("")}</div>` : `<div class="card result"><p class="muted">${esc(t("home_s3_empty"))}</p></div>`;
  };
  main.querySelectorAll("[data-feature]").forEach((b) =>
    b.addEventListener("click", () => {
      main.querySelectorAll("[data-feature]").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-expanded", String(x === b));
      });
      view.innerHTML = homeFeature(b.dataset.feature);
      fillReviews();
      view.classList.remove("fade");
      void view.offsetWidth;
      view.classList.add("fade");
    }),
  );
  // Bands brighten and settle into place as they scroll in (once each).
  const bands = main.querySelectorAll(".home-band");
  if (!calm && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { rootMargin: "0px 0px -15% 0px" },
    );
    bands.forEach((b) => (b.classList.add("reveal"), io.observe(b)));
  }
  // Newest review summaries from the community, with the reviewer line and verdict.
  const box = main.querySelector("[data-reviews]");
  community.latestReviews(3).then((rows) => {
    reviews = rows;
    fillReviews();
    if (!box.isConnected) return;
    box.innerHTML = rows.map(reviewCard).join("") || `<p class="muted">${esc(t("home_s3_empty"))} <a href="#build">${esc(t("home_cta_build"))}</a></p>`;
  });
}

// ---------------------------------------------------------------------------
// Build page

function currentSource() {
  const device = db.devices.find((d) => d.id === state.device) ?? db.devices[0];
  const src = state.src ? findItem(state.src) : null;
  const dac = state.dac ? findItem(state.dac) : null;
  const amp = state.amp ? findItem(state.amp) : null;
  // A DAC-only box or a phono stage has no headphone jack, so it never drives the headphones.
  const driver = amp ?? (dac && dac.role !== "dac" && dac.category !== "phono" ? dac : null) ?? (dac ? null : src);
  const outputs = driver ? sourceOutputs(driver) : dac ? [] : device.outputs;
  // The thing before the boxes, on its own (for "would it be loud enough without them").
  const own = src ? sourceOutputs(src) : device.outputs;
  return { device, src, dac, amp: driver && driver !== src ? driver : null, driver, outputs, own, label: driver ? displayName(driver) : L(device.name) };
}

/** Links between the boxes, as list items for the connection card. */
function chainSteps(reports = {}) {
  const { device, src } = currentSource();
  const dac = state.dac ? findItem(state.dac) : null;
  const amp = state.amp ? findItem(state.amp) : null;
  const st = (x) => (x ? { item: x } : null);
  const source = src ? { item: src } : { device };
  const cart = state.cart ? findItem(state.cart) : null;
  const c = chainLinks({ source, dac: st(dac), amp: st(amp), cart: st(cart) }, reports);
  const name = (stage) => (stage.item ? displayName(stage.item) : L(stage.device.name));
  const portName = (k) => t(`po_${k}`);
  const steps = c.links.map((l) => {
    const a = name(l.from), b = name(l.to);
    const href = l.to.item ? `#item/${encodeURIComponent(l.to.item.id)}` : "#";
    if (l.status === "ok") return `<li>${esc(t("ch_link_ok", { a, b, via: l.via.map(portName).join(" / ") }))}</li>`;
    if (l.status === "adapter" && l.adapter === "lightning-usb") return `<li class="need">${esc(t("c_lightning"))}</li>`;
    if (l.status === "adapter") return `<li class="need">${esc(t("ch_link_cable", { a, b, from: portName(l.via[0]), to: portName(l.via[1]) }))}</li>`;
    if (l.status === "need_dac") return `<li class="danger">${esc(t("ch_link_need_dac", { a, b }))}</li>`;
    if (l.status === "need_phono") return `<li class="danger">${esc(t("ch_link_need_phono", { a, b }))} <a href="#learn/phono">?</a></li>`;
    if (l.status === "no") return `<li class="danger">${esc(t("ch_link_no", { a, b, outs: l.outs.map(portName).join(", "), ins: l.ins.map(portName).join(", ") }))}</li>`;
    return `<li class="need">${esc(t(l.kind === "analog" ? "ch_link_unknown_analog" : "ch_link_unknown", { a, b }))} <a href="${href}">${esc(t("ch_check_ports"))}</a></li>`;
  });
  // A console or an old PC may only see the DAC in UAC 1.0 mode.
  const firstBox = dac ?? amp;
  if (!src && firstBox?.features?.uac1) steps.push(`<li class="alt">${esc(t("ch_uac1", { b: displayName(firstBox) }))} <a href="#learn/uac1">?</a></li>`);
  if (c.dacOnlyLast) steps.push(`<li class="danger">${esc(t(dac.category === "phono" ? "ch_phono_last" : "ch_dac_only", { b: displayName(dac) }))}</li>`);
  if (c.preampLast) steps.push(`<li class="danger">${esc(t("ch_preamp_last", { b: displayName(amp) }))}</li>`);
  if (c.vinylAlone) steps.push(`<li class="danger">${esc(t("ch_vinyl_alone", { a: displayName(src) }))} <a href="#learn/phono">?</a></li>`);
  if (c.cart?.status === "need_mc") steps.push(`<li class="danger">${esc(t("ch_cart_need_mc", { a: displayName(cart) }))} <a href="#learn/phono">?</a></li>`);
  if (c.cart?.status === "check") steps.push(`<li class="need">${esc(t("ch_cart_check", { a: displayName(cart) }))}</li>`);
  if (c.cart?.status === "ok" && cart) steps.push(`<li>${esc(t("ch_cart_ok", { a: displayName(cart), kind: t(`cart_${cart.cart}`) }))}</li>`);
  return steps;
}

function buildPage() {
  const { device, src } = currentSource();
  const amp = state.amp ? findItem(state.amp) : null;
  const hp = state.hp ? findItem(state.hp) : null;
  const dac = state.dac ? findItem(state.dac) : null;
  const cart = state.cart ? findItem(state.cart) : null;
  const vinyl = src?.category === "turntable";
  const needsDac = amp?.role === "amp" && !src;
  const lv = LEVELS[state.level] ?? LEVELS.normal;
  return `<div class="builder">
    <section class="slots card">
      ${slotRow(
        t("slot_device"),
        src
          ? pickedOrButton("src", src)
          : `<div class="select"><select id="device">${db.devices
              .map((d) => `<option value="${d.id}"${d.id === device.id ? " selected" : ""}>${esc(L(d.name))}</option>`)
              .join("")}</select></div> <button class="link small" data-pick="src">${esc(t("src_pick"))}</button>`,
      )}
      ${vinyl ? slotRow(t("slot_cart"), pickedOrButton("cart", cart), cart ? (cart.cart ? t(`cart_${cart.cart}`) : "") : t("slot_cart_opt")) : ""}
      ${vinyl ? slotRow(t("slot_phono"), pickedOrButton("dac", dac), dac ? "" : src.features?.phono_pre ? t("slot_phono_builtin") : t("slot_phono_hint")) : slotRow(t("slot_dac"), pickedOrButton("dac", dac), needsDac && !dac ? t("slot_dac_hint") : dac ? "" : t("slot_dac_opt"))}
      ${slotRow(t("slot_amp"), pickedOrButton("amp", amp), amp?.role === "amp" ? t("role_note_amp") : "")}
      ${slotRow(t("slot_hp"), pickedOrButton("hp", hp))}
      ${hp ? slotRow(t("plug"), seg("plug", PLUGS.map((j) => [j, PLUG_SHORT[j]]), plugOf(hp)), !state.plug && !hp.stockPlug ? t("plug_guess") : "") : ""}
      ${slotRow(t("level"), seg("level", [["quiet", t("level_quiet")], ["normal", t("level_normal")], ["loud", t("level_loud")]], state.level), t("level_hint", { avg: lv, peak: lv + CREST }))}
      ${buildTotal(amp, hp, dac, src, cart)}
      ${amp || hp ? `<div class="slot"><a class="pill small" href="#discuss/new?cat=dream&items=${[src?.id, dac?.id, amp?.id, hp?.id].filter(Boolean).map(encodeURIComponent).join(",")}">${esc(t("su_save_dream"))}</a> <a class="pill small" href="#discuss/new?cat=setup&items=${[amp?.id, hp?.id].filter(Boolean).map(encodeURIComponent).join(",")}">${esc(t("su_share_setup"))}</a></div>` : ""}
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
    <div class="picked-meta">${esc(specLine(item))}${pr ? ` · ${priceTag(pr.price, pr.currency)}` : ""}</div>
    <div class="picked-actions"><button class="link" data-pick="${slot}">${esc(t("slot_change"))}</button><button class="link" data-clear="${slot}">${esc(t("slot_remove"))}</button></div>
  </div>`;
}

function buildTotal(amp, hp, dac, src, cart = null) {
  const items = [src, cart, dac, amp, hp].filter(Boolean).map((i) => prices(i).cheapest).filter(Boolean);
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
  const ev = src.outputs.length ? evaluate(hp, conn.outputs, { level, crest: CREST }) : { status: hasJack(src.driver) ? "unknown" : "no-output" };
  // With an amp in the chain, "no amp needed" is the wrong message. Say whether the
  // device alone would also have been loud enough, so people don't buy one for loudness.
  let alone = null;
  if (src.amp && src.own?.length) alone = evaluate(hp, src.own, { level, crest: CREST }).status;
  return [verdictCard(ev, hp, detail, { amp: src.amp, device: src.device, src: src.src, alone }), conn.html, reverseCard(hp, level)].join("");
}

// Desktop roles that never drive headphones in Sotto's maths: speaker amps (their
// watts are into 4-8 Ω speakers) and streamers (no amp).
const NOT_HP_ROLES = ["integrated", "poweramp", "streamer"];

/** The box at the end of the chain has a headphone jack (its power may still be unknown). */
function hasJack(driver) {
  if (!driver) return false;
  return !["dac", "preamp", ...NOT_HP_ROLES].includes(driver.role) && !["phono", "turntable", "cartridge", "speaker", "power"].includes(driver.category);
}

function connectionCard({ outputs, driver }, hp) {
  const links = `<ol class="chain" id="chain-links">${chainSteps().join("")}</ol>`;
  const steps = [];
  if (!outputs.length) {
    // A headphone amp with no stated power is "can't tell", not "no jack".
    if (hasJack(driver)) steps.push(`<li class="need">${esc(t("c_no_power", { a: displayName(driver) }))} <a href="#item/${encodeURIComponent(driver.id)}">${esc(t("ch_check_ports"))}</a></li>`);
    else steps.push(`<li class="danger">${esc(t("v_no_output"))}</li>`);
    return { html: card(t("c_title"), `${links}<ol class="chain">${steps.join("")}</ol>`), outputs: [] };
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
  return { html: card(t("c_title"), `${links}<ol class="chain">${steps.join("")}</ol>`), outputs: usable };
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
    sub = [sub, t(["ok", "overkill"].includes(chain.alone) ? "v_alone_ok" : "v_alone_no", { device: chain.src ? displayName(chain.src) : L(chain.device.name), amp: displayName(chain.amp) })].filter(Boolean).join(" · ");
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
        <span class="muted">${esc(catLabel(s))}${s.curated ? ` · ${esc(t("it_checked"))}` : ""}${
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
      labels: { harder: t("chart_harder"), easier: t("chart_easier"), zoomIn: t("zoom_in"), zoomOut: t("zoom_out"), zoomReset: t("zoom_reset"), zoomHint: t("zoom_hint"), x: t("chart_x"), y: t("chart_y"), need: t("chart_need"), aria: t("chart_aria"), ok: t("st_ok"), overkill: t("st_overkill"), tight: t("st_tight"), insufficient: t("st_insufficient"), ambiguous: t("st_ambiguous") },
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
      <div class="small"><span class="badge ${tone}" aria-hidden="true"></span> ${esc(t(`st_${p.status}`))} · ${esc(t("chart_need"))} ${esc(vfmt(p.v))} @ ${esc(fmt(p.z, 1))} Ω${pr ? ` · ${priceTag(pr.price, pr.currency)}` : ""}</div></div>
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
  const label = src ? displayName(src) : L(dev.name);
  const cat = p.get("cat") ?? "all";
  const level = p.get("level") ?? state.level;
  const link = (over) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(over)) v === null ? n.delete(k) : n.set(k, v);
    return `#chart?${n}`;
  };
  const options = [
    ...db.devices.map((d) => `<option value="dev:${esc(d.id)}"${!src && d.id === dev?.id ? " selected" : ""}>${esc(L(d.name))}</option>`),
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
  drawChart(main.querySelector("#chart"), outputs, src ? displayName(src) : L(dev.name), null, {
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
  const isSrcSlot = slot === "src";
  // The box between source and amp: a DAC, or a phono stage after a turntable.
  const forDac = (i) => i.role === "dac" || i.role === "dacamp" || i.category === "phono";
  const usable = new Set(isSrcSlot ? db.items.filter((i) => ["dap", "cd", "turntable"].includes(i.category) || i.role === "streamer" || (i.category === "desktop" && (i.features?.roon || i.features?.upnp))).map((i) => i.id) : slot === "dac" ? db.items.filter(forDac).map((i) => i.id) : slot === "cart" ? db.items.filter((i) => i.category === "cartridge" && i.cart).map((i) => i.id) : (slot === "hp" ? headphones : sources).map((i) => i.id));
  const pool = db.items.filter((i) => (isSrcSlot ? usable.has(i.id) : slot === "dac" ? forDac(i) : slot === "cart" ? i.category === "cartridge" : cats.has(i.category) && (slot !== "amp" || !["dac", ...NOT_HP_ROLES].includes(i.role))));
  // Type chips inside the picker, so a long list can be narrowed in one tap.
  const kindsBySlot = {
    hp: [["iem", t("cat_iem")], ["headphone", t("cat_headphone")]],
    amp: [["dongle", t("cat_dongle")], ["portable", t("cat_portable")], ["dacamp", t("role_dacamp")], ["amp", t("role_amp")], ["preamp", t("role_preamp")], ["dap", t("cat_dap")]],
    dac: [["dac", t("role_dac")], ["dacamp", t("role_dacamp")], ["phono", t("cat_phono")]],
    src: [["dap", t("cat_dap")], ["cd", t("cat_cd")], ["turntable", t("cat_turntable")], ["streamer", t("pk_streamer")]],
    cart: [["mm", t("cart_mm")], ["mc", t("cart_mc")], ["homc", t("cart_homc")]],
  };
  const kinds = [["", t("role_all")], ...(kindsBySlot[slot] ?? [])];
  const kindOf = (i) => [i.category, i.role, i.cart].filter(Boolean);
  let kind = "";
  const priceOf = (i) => usdOf(prices(i).cheapest);
  const dlg = document.createElement("div");
  dlg.className = "modal";
  dlg.innerHTML = `<div class="sheet card" role="dialog" aria-modal="true" aria-label="${esc(t(`picker_title_${slot}`))}">
    <div class="sheet-head"><h2>${esc(t(`picker_title_${slot}`))}</h2><button class="icon-btn" data-close aria-label="${esc(t("close"))}">✕</button></div>
    <input class="search" type="search" placeholder="${esc(t("search"))}" autofocus>
    <div class="pick-tools"><div class="chips pick-kinds">${kinds.map(([k, label], n) => `<button type="button" class="chip${n ? "" : " on"}" data-kind="${k}">${esc(label)}</button>`).join("")}</div>
      <select class="mini-select" data-sort aria-label="${esc(t("sort_label"))}">${["popular", "price", "price-desc"].map((v) => `<option value="${v}">${esc(t(`sort_${v}`))}</option>`).join("")}</select>
      <label class="check small"><input type="checkbox" checked> ${esc(t("picker_only_specs"))}</label></div>
    <ul class="pick-list"></ul><p class="small muted">${esc(t("add_model_hint"))} <a href="${REPO}/issues/new?template=add-model.yml" target="_blank" rel="noopener">${esc(t("add_model"))} ↗</a></p></div>`;
  document.body.append(dlg);
  const input = dlg.querySelector("input.search");
  const only = dlg.querySelector(".check input");
  const sortSel = dlg.querySelector("[data-sort]");
  const list = dlg.querySelector(".pick-list");
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const res = pool
      // Typing a name shows every match, even ones we can't calculate (marked as such).
      .filter((i) => (q ? matches(i, q) : !only.checked || usable.has(i.id)) && (!kind || kindOf(i).includes(kind)))
      .sort((a, b) =>
        sortSel.value === "price"
          ? priceOf(a) - priceOf(b)
          : sortSel.value === "price-desc"
            ? (priceOf(b) === Infinity ? -1 : priceOf(b)) - (priceOf(a) === Infinity ? -1 : priceOf(a))
            : Number(usable.has(b.id)) - Number(usable.has(a.id)) || Number(!!b.curated) - Number(!!a.curated) || storeCount(b) - storeCount(a),
      )
      .slice(0, 80);
    list.innerHTML = res
      .map((i) => {
        const p = prices(i).cheapest;
        const im = imageOf(i);
        return `<li><button data-id="${esc(i.id)}">${im ? `<img class="pt-img" src="${esc(sized(im.src, 96))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="pt-img"></span>`}<span class="pn">${esc(displayName(i))}</span><span class="pm">${esc(catLabel(i))} · ${esc(specLine(i) || "—")}${usable.has(i.id) ? "" : ` · <span class="tag">${esc(t("pk_no_calc"))}</span>`}</span><span class="pp">${p ? money(p.price, p.currency) : ""}</span></button></li>`;
      })
      .join("");
  };
  const close = () => dlg.remove();
  input.addEventListener("input", draw);
  only.addEventListener("change", draw);
  sortSel.addEventListener("change", draw);
  dlg.querySelectorAll("[data-kind]").forEach((b) =>
    b.addEventListener("click", () => {
      kind = b.dataset.kind;
      dlg.querySelectorAll("[data-kind]").forEach((x) => x.classList.toggle("on", x === b));
      draw();
    }),
  );
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) close();
    const b = e.target.closest("button[data-id]");
    if (b) {
      state[slot] = b.dataset.id;
      for (const other of ["src", "dac", "amp"]) if (other !== slot && state[other] === state[slot]) state[other] = "";
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
  const role = cat === "desktop" ? p.get("role") ?? "" : "";
  const bt = p.get("bt") === "1";
  const cats = ["all", "iem", "headphone", "wireless", "dongle", "portable", "desktop", "dap", "cd", "turntable", "phono", "cartridge", "speaker", "power"];
  const res = db.items.filter(
    (i) =>
      (cat === "all" || i.category === cat) &&
      (!role || i.role === role) &&
      (!bt || isBtReceiver(i)) &&
      (!brand || i.brand === brand) &&
      (!mat || i.materials?.[mat] || i.styles?.[mat]) &&
      (!q || matches(i, q)) &&
      (!specsOnly || hpModel(i) || sourceOutputs(i).length) &&
      (!stockOnly || i.offers.some((o) => o.available)),
  );
  const sort = p.get("sort") ?? "popular";
  const view = p.get("view") ?? "grid";
  const priceOf = (i) => usdOf(prices(i).cheapest);
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
        <div class="muted small">${esc(catLabel(i))}${specLine(i) ? ` · ${esc(specLine(i))}` : ""}</div>
        <div class="tile-price">${pr ? priceTag(pr.price, pr.currency) : "—"}</div></div></a>`;
    })
    .join("")}</div>`;
  return `<div class="catalog">
    <div class="filters">
      <div class="filter-top">
        <input class="search" type="search" id="cq" placeholder="${esc(t("search"))}" value="${esc(p.get("q") ?? "")}">
        <select class="mini-select" id="cbrand" aria-label="${esc(t("brand"))}"><option value="">${esc(t("brand_all"))}</option>${brandOptions(cat, brand)}</select>
        <select class="mini-select" data-param="sort" aria-label="${esc(t("sort_label"))}">${["popular", "price", "price-desc"].map((v) => `<option value="${v}"${v === sort ? " selected" : ""}>${esc(t(`sort_${v}`))}</option>`).join("")}</select>
        <div class="seg-links">${["grid", "table"].map((v) => `<a class="${v === view ? "on" : ""}" href="${link({ view: v })}">${esc(t(`view_${v}`))}</a>`).join("")}</div>
      </div>
      <div class="chips">${cats.map((c) => `<a class="chip${c === cat ? " on" : ""}" href="${link({ cat: c, n: null, role: null })}">${esc(t(`cat_${c}`))}</a>`).join("")}</div>
      ${cat === "dongle" ? `<div class="chips sub-chips"><a class="chip${bt ? "" : " on"}" href="${link({ bt: null, n: null })}">${esc(t("role_all"))}</a><a class="chip${bt ? " on" : ""}" href="${link({ bt: "1", n: null })}">${esc(t("bt_chip"))}</a></div>` : ""}
      ${cat === "desktop" ? `<div class="chips sub-chips">${["", "dacamp", "dac", "amp", "preamp", "streamer", "integrated", "poweramp"].map((r) => `<a class="chip${r === role ? " on" : ""}" href="${link({ role: r || null, n: null })}">${esc(t(r ? `role_${r}` : "role_all"))}</a>`).join("")}<span class="muted small" title="${esc(t("role_help"))}">ⓘ</span></div>` : ""}
      <div class="filter-more">
        <label class="check small"><input type="checkbox" data-toggle="specs"${specsOnly ? " checked" : ""}> ${esc(t("only_specs"))}</label>
        <label class="check small"><input type="checkbox" data-toggle="stock"${stockOnly ? " checked" : ""}> ${esc(t("only_stock"))}</label>
        <select class="mini-select" data-param="mat" aria-label="${esc(t("mat_label"))}"><option value="">${esc(t("mat_label"))} ${esc(t("cat_all"))}</option>${["resin", "wood", "metal", "ceramic", "carbon", "glass", "clear"].map((m) => `<option value="${m}"${m === mat ? " selected" : ""}>${esc(t(`mat_${m}`))}</option>`).join("")}</select>
        <span class="muted small filter-count">${esc(t("n_results", { n: fmt(res.length, 0) }))} · <a href="${REPO}/issues/new?template=add-model.yml" target="_blank" rel="noopener">${esc(t("add_model"))}</a> · <a href="#brands">${esc(t("brands_all"))}</a> · <a href="https://buildhifi.com/parts" target="_blank" rel="noopener">${esc(t("speakers"))}</a></span>
      </div>
    </div>
    ${view === "grid" ? grid : `<div class="table-wrap card"><table class="cat-table">
      <thead><tr><th>${esc(t("col_product"))}</th><th>${esc(t("col_imp"))}</th><th>${esc(t("col_sens"))} / ${esc(t("col_power"))}</th><th>${esc(t("col_price"))}</th><th>${esc(t("col_stores"))}</th></tr></thead>
      <tbody>${shown
        .map((i) => {
          const pr = prices(i);
          const stores = new Set(i.offers.map((o) => o.store)).size;
          const im = imageOf(i);
          return `<tr><td class="with-thumb">${im ? `<img class="thumb" src="${esc(sized(im.src, 96))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="thumb"></span>`}<div><a href="#item/${encodeURIComponent(i.id)}" class="strong">${esc(displayName(i))}</a><div class="muted small">${esc(catLabel(i))}${i.curated ? ` · ${esc(t("it_checked"))}` : ""}</div></div></td>
          <td>${i.specs?.impedance ? `${fmt(i.specs.impedance[0].value, 1)} Ω` : "—"}</td>
          <td>${sensOrPower(i)}</td>
          <td>${pr.cheapest ? priceTag(pr.cheapest.price, pr.cheapest.currency) : "—"}</td>
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
    const cats = [...new Set(items.map((i) => catLabel(i)))].slice(0, 3).join(" · ");
    html += `<a class="brand-tile card" href="#catalog?brand=${encodeURIComponent(b)}"><div class="brand-pics">${pics.map((im) => `<img src="${esc(sized(im.src, 160))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`).join("")}</div>
      <div class="brand-body">${brandMark(b, 32)}<b>${esc(b)}</b><span class="muted small">${esc(t("n_results", { n: items.length }))} · ${esc(cats)}</span></div></a>`;
  }
  if (current) html += "</div>";
  return `<div class="brands"><header class="deal-head"><h1>${esc(t("brands_all"))}</h1><p class="muted small">${esc(t("brands_note"))}</p></header>
    <nav class="az">${letters.map((L) => `<a href="#brands" data-jump="brand-${L}">${L}</a>`).join("")}</nav>${html}<p class="muted small">${esc(t("logo_note"))}</p></div>`;
}

/** Material / look tags, each with the store sentence it came from. */
// Bluetooth receivers (FiiO BTR, ear-hooks, iFi GO blu): a phone sends them
// audio over Bluetooth and they drive wired earphones, so the codec matters
// as much as for wireless earphones. Many people use them with both.
const BT_RX = /\b(bluetooth|btr\d+\w*|ear[- ]?hooks?|ldac|aptx|wireless)\b/i;
function isBtReceiver(i) {
  return ["dongle", "portable"].includes(i.category) && i.offers.some((o) => BT_RX.test(o.title));
}

function looksLine(i) {
  const tags = [...Object.entries(i.materials ?? {}), ...Object.entries(i.styles ?? {})];
  if (!tags.length) return "";
  return `<p class="looks">${tags
    .map(([k, e]) => `<a class="chip small-chip" href="#catalog?mat=${k}" title="${esc(`${t("mat_from")}: “${e.quote}”`)}">${esc(t(`mat_${k}`))}</a>`)
    .join("")}</p>`;
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
  // An id merged into another or renamed when the catalog was rebuilt.
  if (db.aliases?.[id]) return db.byId.get(db.aliases[id]) ?? null;
  const norm = (k) => {
    const [b, m = ""] = k.split("--");
    return `${b}--${m.split("-").map((w) => ({ ii: "2", iii: "3", iv: "4" })[w] ?? w).join("")}`;
  };
  const want = norm(id);
  return db.items.find((x) => norm(x.id) === want) ?? null;
}

/** The item's id and its old ids: posts and reports filed under an old id still belong to it. */
function idsOf(i) {
  return [i.id, ...(db.aliasesTo?.get(i.id) ?? [])];
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
  const notes = (i.notes ?? []).map((n) => `<li>${esc(L(n))} ${n.source ? srcLink(n.source) : ""}</li>`).join("");
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
      ${im ? `<div class="item-media"><div class="item-img"><button type="button" class="img-open" aria-label="${esc(t("img_zoom"))}"><img src="${esc(sized(im.src, 720))}" alt="${esc(name)}" referrerpolicy="no-referrer"></button><a class="img-credit" href="${esc(im.url)}" target="_blank" rel="noopener">${esc(t("img_from", { store: db.stores[im.store]?.name ?? im.store }))}</a></div><div class="item-thumbs" id="item-thumbs"></div></div>` : ""}
      <div class="item-title"><p class="muted item-kicker">${i.brand ? `${brandMark(i.brand, 24)} <a href="#catalog?brand=${encodeURIComponent(i.brand)}">${esc(i.brand)}</a> · ` : ""}${esc(catLabel(i))}${i.curated ? ` · ${esc(t("it_checked"))}` : ""}${i.drivers ? ` · ${esc(i.drivers)}` : ""}</p>
      <h1>${esc(displayName(i))}</h1>
      ${looksLine(i)}
      ${i.addedFrom ? `<p class="small muted">${esc(t("added_from"))} <a href="${esc(i.addedFrom)}" target="_blank" rel="noopener">${esc(new URL(i.addedFrom).hostname)} ↗</a></p>` : ""}
      ${powerLine(i)}
      ${i.cart ? `<p class="small role-note">${esc(t(`cart_${i.cart}`))} · ${esc(t(i.cart === "mc" ? "cart_note_mc" : "cart_note_mm"))} <a href="#learn/phono">?</a></p>` : ""}
      ${i.phonoIn ? `<p class="small role-note">${esc(t("phono_takes", { kinds: i.phonoIn.split("+").map((k) => t(`cart_${k}`)).join(" + ") }))}</p>` : ""}
      ${["preamp", "streamer", ...NOT_HP_ROLES].includes(i.role) ? `<p class="small role-note">${esc(t(`role_note_${i.role}`))}</p>` : ""}
      ${i.category === "wireless" ? `<p class="small role-note">${esc(t("wl_note"))} <a href="#learn/bluetooth">${esc(t("wl_codecs"))}</a> · <a href="#catalog?cat=dongle&bt=1">${esc(t("wl_keep_wired"))}</a></p>` : ""}
      ${isBtReceiver(i) ? `<p class="small role-note">${esc(t("bt_note"))} <a href="#learn/bluetooth">${esc(t("wl_codecs"))}</a></p>` : ""}
      ${i.category === "speaker" ? `<p class="small role-note">${esc(t(i.speaker === "passive" ? "spk_note_passive" : "spk_note_active"))} <a href="https://buildhifi.com/parts" target="_blank" rel="noopener">BuildHifi ↗</a></p>` : ""}
      ${i.role === "dac" || i.role === "amp" ? `<p class="small role-note">${esc(t(`role_note_${i.role}`))} <a href="#catalog?cat=desktop&role=${i.role === "dac" ? "amp" : "dac"}">${esc(t(`role_find_${i.role}`))}</a></p>` : ""}
      ${pr.cheapest ? `<p class="price-big">${esc(t("price_from"))} ${priceTag(pr.cheapest.price, pr.cheapest.currency)} <span class="muted">· ${esc(t("stores", { n: new Set(i.offers.map((o) => o.store)).size }))}</span> <a class="price-deal" href="#deal?item=${encodeURIComponent(i.id)}">${esc(t("it_deal"))} →</a></p>` : ""}
      <div class="item-actions">${(isHp || isSrc || ["turntable", "phono", "cartridge"].includes(i.category)) && !["integrated", "poweramp"].includes(i.role) ? `<button class="pill primary" data-use="${esc(i.id)}" data-slot="${isHp ? "hp" : i.role === "dac" || i.category === "phono" ? "dac" : i.category === "cartridge" ? "cart" : ["dap", "cd", "turntable"].includes(i.category) || i.role === "streamer" ? "src" : "amp"}">${esc(t("it_add_build"))}</button>` : ""}${bmButton("item", i.id)}<button type="button" class="pill" data-copy="${esc(`${location.origin}${location.pathname.replace(/[^/]*$/, "")}p/${i.id}/`)}">${esc(t("ds_share"))}</button><a class="pill" href="#compare?ids=${encodeURIComponent(i.id)}">${esc(t("cmp_btn"))}</a></div>
      <details class="item-more"><summary>${esc(t("sq_more"))}</summary>
      <p class="issue-search small">${esc(t("sq_label"))} ${searchLinks(i).map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a>`).join(" · ")}</p>
      <p class="issue-search small">${esc(t("it_issue_search"))} ${issueLinks.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`).join(" · ")}</p>
      <p class="issue-search small"><a href="${report}" target="_blank" rel="noopener">${esc(t("it_report"))} ↗</a></p></details></div>
    </header>
    <div class="item-grid">
      <section class="card pad"><h3>${esc(t("it_specs"))}</h3>${specRows || powerRows || i.sheet ? specRows + powerRows + sheetRows(i) : `<p class="muted">${esc(t("it_no_specs"))}</p>`}${notes ? `<ul class="notes">${notes}</ul>` : ""}</section>
      <section class="card pad"><div class="card-head"><h3>${esc(t("it_offers"))}</h3>${fxSelect()}</div><p class="muted small">${esc(t("pr_feed_note"))}</p>${offersTable(pr.offers)}</section>
    </div>
    ${missingAsks(i)}
    ${isSrc ? `<section class="card pad ports" id="ports"></section>` : ""}
    ${isHp ? `<section class="card pad fr-links" id="fr-links"></section>` : ""}
    ${i.category !== "power" ? `<section class="card pad owners" id="owners"></section>` : ""}
    <section class="card pad paid" id="paid"></section>
    ${channelsCard(i)}
    <section class="card pad community" id="community"></section>
    <section class="card pad item-threads" id="item-threads"></section>
    ${isHp && hpModel(i) ? `<div id="item-rev"></div>` : ""}
    ${isSrc && outs.length ? `<div class="card chart-card" id="chart"></div>` : ""}
  </article>`;
}

// Extra store photos (ports, box, accessories) under the main image. They stay
// on the store's CDN; the credit and link point at the store page they came from.
// Who has measured this model: direct links into each squig.link graph site
// (built weekly from the sites' own model index, names only; scripts/build-squig.mjs).
let squigIndex;
async function renderFrLinks(el, i) {
  if (!el) return;
  squigIndex ??= fetch("data/squig.json?v=mv5bfzie").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const links = (await squigIndex)[i.id] ?? [];
  if (!el.isConnected) return;
  const n = displayName(i);
  el.innerHTML = `<h2 class="section-h">${esc(t("frl_title"))}</h2>
    ${links.length ? `<p class="muted small">${esc(t("frl_lead", { n: links.length }))}</p><ul class="fr-site-list">${links.map((l) => `<li><a href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.s)} ↗</a>${l.t ? ` <span class="muted small">${esc(l.t)}</span>` : ""}${l.v ? ` <span class="muted small" title="${esc(t("frl_variant"))}">· ${esc(l.v)}${l.n > 1 ? ` +${l.n - 1}` : ""}</span>` : ""}</li>`).join("")}</ul>` : `<p class="muted small">${esc(t("frl_none"))}</p>`}
    <p class="small"><a href="https://www.google.com/search?q=${encodeURIComponent(`${n} site:squig.link`)}" target="_blank" rel="noopener">${esc(t("frl_search"))} ↗</a> · <a href="#fr?item=${encodeURIComponent(i.id)}">${esc(t("fr_item_btn"))}</a></p>
    <p class="muted small">${esc(t("frl_note"))}</p>`;
}

async function wireThumbs(main, i) {
  const box = main.querySelector("#item-thumbs");
  const big = main.querySelector(".item-img");
  if (!big) return;
  const img = big.querySelector("img");
  const first = imageOf(i);
  // The main photo opens a lightbox; the credit pill is the link to the store.
  let gallery = { src: [first.src], url: first.url, store: first.store };
  big.querySelector(".img-open").addEventListener("click", () => {
    const at = Math.max(0, gallery.src.findIndex((s) => img.src.startsWith(s)));
    openLightbox(gallery, at, displayName(i));
  });
  const set = (await loadPhotos())[i.id];
  if (!box || !box.isConnected || !set || set.src.length < 2) return;
  gallery = set;
  box.innerHTML = set.src
    .map((src, n) => `<button type="button" data-src="${esc(src)}" aria-label="${n + 1} / ${set.src.length}"><img src="${esc(sized(src, 120))}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`)
    .join("");
  const store = db.stores[set.store]?.name ?? set.store;
  const show = (btn) => {
    box.querySelectorAll("button").forEach((b) => b.toggleAttribute("aria-current", b === btn));
    img.classList.add("swap");
    const next = new Image();
    next.referrerPolicy = "no-referrer";
    next.src = sized(btn.dataset.src, 720);
    const done = () => {
      img.src = next.src;
      img.classList.remove("swap");
    };
    next.decode().then(done, done);
    const credit = big.querySelector(".img-credit");
    credit.href = set.url;
    credit.textContent = t("img_from", { store });
  };
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-src]");
    if (btn) show(btn);
  });
}

/**
 * Full-size photo viewer. Click or double-tap toggles 2.5× zoom at that point,
 * dragging pans, arrows / swipe change photo, Esc or the backdrop closes.
 * Photos stay on the store's CDN; the credit links back to the store page.
 */
function openLightbox(set, start, name) {
  let n = start;
  let zoom = 1, x = 0, y = 0;
  const store = db.stores[set.store]?.name ?? set.store;
  const many = set.src.length > 1;
  const dlg = document.createElement("div");
  dlg.className = "lightbox";
  dlg.setAttribute("role", "dialog");
  dlg.setAttribute("aria-modal", "true");
  dlg.setAttribute("aria-label", name);
  dlg.innerHTML = `<div class="lb-stage"><img alt="${esc(name)}" referrerpolicy="no-referrer" draggable="false"></div>
    <button type="button" class="lb-close icon-btn" aria-label="${esc(t("close"))}">✕</button>
    ${many ? `<button type="button" class="lb-nav prev icon-btn" aria-label="←"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="lb-nav next icon-btn" aria-label="→"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ""}
    <div class="lb-bar"><span class="lb-count"></span><span class="muted small">${esc(t("img_zoom_hint"))}</span><a href="${esc(set.url)}" target="_blank" rel="noopener">${esc(t("img_from", { store }))}</a></div>`;
  const pic = dlg.querySelector("img");
  const stage = dlg.querySelector(".lb-stage");
  const apply = () => {
    pic.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    dlg.classList.toggle("zoomed", zoom > 1);
  };
  const show = (k) => {
    n = (k + set.src.length) % set.src.length;
    zoom = 1; x = 0; y = 0;
    apply();
    pic.classList.add("swap");
    const next = new Image();
    next.referrerPolicy = "no-referrer";
    next.src = sized(set.src[n], 1600);
    const done = () => {
      pic.src = next.src;
      pic.classList.remove("swap");
    };
    next.decode().then(done, done);
    dlg.querySelector(".lb-count").textContent = many ? `${n + 1} / ${set.src.length}` : "";
  };
  const close = () => {
    document.removeEventListener("keydown", onKey);
    dlg.classList.add("closing");
    setTimeout(() => dlg.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (many && e.key === "ArrowRight") show(n + 1);
    if (many && e.key === "ArrowLeft") show(n - 1);
  };
  document.addEventListener("keydown", onKey);
  dlg.querySelector(".lb-close").addEventListener("click", close);
  dlg.querySelector(".prev")?.addEventListener("click", () => show(n - 1));
  dlg.querySelector(".next")?.addEventListener("click", () => show(n + 1));
  stage.addEventListener("click", (e) => {
    if (e.target !== pic) return close();
  });
  // Pointer: a tap toggles zoom at the tapped point; a drag pans when zoomed,
  // or swipes to the next photo when not.
  let down = null;
  pic.addEventListener("pointerdown", (e) => {
    down = { px: e.clientX, py: e.clientY, x, y, moved: false };
    pic.setPointerCapture(e.pointerId);
  });
  pic.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - down.px, dy = e.clientY - down.py;
    if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
    if (zoom > 1) {
      x = down.x + dx;
      y = down.y + dy;
      apply();
    }
  });
  pic.addEventListener("pointerup", (e) => {
    if (!down) return;
    const dx = e.clientX - down.px;
    if (!down.moved) {
      if (zoom > 1) {
        zoom = 1; x = 0; y = 0;
      } else {
        // Zoom towards the tapped point.
        const r = pic.getBoundingClientRect();
        zoom = 2.5;
        x = (r.left + r.width / 2 - e.clientX) * (zoom - 1);
        y = (r.top + r.height / 2 - e.clientY) * (zoom - 1);
      }
      apply();
    } else if (zoom === 1 && many && Math.abs(dx) > 60) show(dx < 0 ? n + 1 : n - 1);
    down = null;
  });
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoom = Math.min(5, Math.max(1, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    if (zoom === 1) x = y = 0;
    apply();
  }, { passive: false });
  document.body.append(dlg);
  show(start);
  dlg.querySelector(".lb-close").focus();
}

// Release calendar. Pre-orders are bars from when the store opened the page to
// the date the store wrote; new listings are grouped by month. Every date comes
// from a store page (scripts/lib/dates.js) and links back to it.
const CAL_CATS = ["iem", "headphone", "wireless", "dongle", "desktop", "dap", "speaker"];
const DAY = 864e5;
function calendarPage() {
  const cat = query().get("cat") ?? "";
  const now = Date.now();
  const items = db.items.filter((i) => !cat || i.category === cat);
  const pre = [];
  const undated = [];
  for (const i of items) {
    const offers = i.offers.filter((o) => o.preorder);
    if (!offers.length) continue;
    const dated = offers.filter((o) => o.preorder.until && Date.parse(o.preorder.until) > now - 7 * DAY).sort((a, b) => a.preorder.until.localeCompare(b.preorder.until));
    if (dated.length) pre.push({ i, o: dated[0] });
    else if (offers.every((o) => !o.preorder.until)) undated.push({ i, o: offers[0] });
  }
  pre.sort((a, b) => a.o.preorder.until.localeCompare(b.o.preorder.until));
  const fresh = items
    .filter((i) => i.listedAt && Date.parse(i.listedAt) > now - 92 * DAY && !i.offers.some((o) => o.preorder))
    .sort((a, b) => b.listedAt.localeCompare(a.listedAt));
  const chips = `<div class="chips"><a class="chip${!cat ? " on" : ""}" href="#calendar">${esc(t("cat_all"))}</a>${CAL_CATS.map((c) => `<a class="chip${c === cat ? " on" : ""}" href="#calendar?cat=${c}">${esc(t(`cat_${c}`))}</a>`).join("")}</div>`;
  const head = `<header class="deal-head"><h1>${esc(t("nav_calendar"))}</h1><p class="muted">${esc(t("cal_lead"))}</p></header>`;
  if (!db.items.some((i) => i.listedAt || i.offers.some((o) => o.preorder)))
    return `<div class="calendar">${head}<p class="note">${esc(t("cal_empty"))}</p></div>`;
  return `<div class="calendar">${head}${chips}
    <section class="card pad"><h2>${esc(t("cal_pre"))}</h2>${pre.length ? calTimeline(pre, now) : `<p class="muted">${esc(t("cal_none"))}</p>`}
      ${undated.length ? `<h3>${esc(t("cal_pre_nodate"))}</h3><div class="cal-grid">${undated.map(({ i, o }) => calCard(i, o.preorder.quote, o)).join("")}</div>` : ""}</section>
    <section class="card pad"><h2>${esc(t("cal_new"))}</h2>${fresh.length ? calMonths(fresh) : `<p class="muted">${esc(t("cal_none"))}</p>`}</section>
    <p class="muted small">${esc(t("cal_note"))}</p></div>`;
}

function calTimeline(rows, now) {
  const start = now - 28 * DAY;
  const last = Math.max(...rows.map(({ o }) => Date.parse(o.preorder.until)));
  const end = Math.min(Math.max(last + 14 * DAY, now + 60 * DAY), now + 200 * DAY);
  const pct = (x) => Math.min(Math.max(((x - start) / (end - start)) * 100, 0), 100);
  const ticks = [];
  for (const d = new Date(start); d.getTime() < end; d.setUTCMonth(d.getUTCMonth() + 1, 1)) {
    const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    if (first >= start) ticks.push(`<span style="--l:${pct(first).toFixed(2)}%">${esc(new Date(first).toLocaleDateString(loc(), { month: "short" }))}</span>`);
  }
  const bars = rows
    .map(({ i, o }, n) => {
      const to = Date.parse(o.preorder.until);
      const from = o.listedAt ? Math.min(Date.parse(o.listedAt), to) : now;
      const l = pct(from);
      const w = Math.max(pct(to) - l, 2);
      const im = imageOf(i);
      return `<li class="cal-row" style="--d:${Math.min(n, 12)}">
        <a class="cal-name" href="#item/${encodeURIComponent(i.id)}">${im ? `<img src="${esc(sized(im.src, 96))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="cal-ph"></span>`}<span><b>${esc(displayName(i))}</b><small>${esc(db.stores[o.store]?.name ?? o.store)} · ${priceTag(o.price, o.currency)}</small></span></a>
        <div class="cal-track"><a class="cal-bar${to > now ? "" : " past"}${to > now + 200 * DAY ? " cut" : ""}${w < 40 ? (l + w > 65 ? " out left" : " out") : ""}" href="${esc(o.url)}" target="_blank" rel="noopener" title="${esc(o.preorder.quote)}" style="--l:${l.toFixed(2)}%;--w:${w.toFixed(2)}%"><span>${esc(t("cal_pre_until", { date: day(o.preorder.until) }))}</span></a></div></li>`;
    })
    .join("");
  return `<div class="cal" style="--t:${pct(now).toFixed(2)}%"><div class="cal-scale"><span></span><div class="cal-axis"><span class="cal-today">${esc(t("cal_today"))}</span>${ticks.join("")}</div></div><ol class="cal-rows">${bars}</ol></div>`;
}

function calMonths(list) {
  const byMonth = new Map();
  for (const i of list) {
    const k = i.listedAt.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), i]);
  }
  return [...byMonth]
    .map(([k, xs]) => {
      const label = new Date(`${k}-01T00:00:00Z`).toLocaleDateString(loc(), { month: "long", year: "numeric" });
      const shown = xs.slice(0, 36);
      return `<h3>${esc(label)} <span class="muted small">· ${fmt(xs.length, 0)}</span></h3><div class="cal-grid">${shown.map((i) => calCard(i, `${catLabel(i)} · ${day(i.listedAt)}`)).join("")}</div>${xs.length > shown.length ? `<p class="muted small">+${fmt(xs.length - shown.length, 0)}</p>` : ""}`;
    })
    .join("");
}

function calCard(i, sub, offer) {
  const im = imageOf(i);
  const pr = prices(i).cheapest;
  return `<a class="cal-card" href="${offer ? esc(offer.url) : `#item/${encodeURIComponent(i.id)}`}"${offer ? ` target="_blank" rel="noopener"` : ""}>${im ? `<img src="${esc(sized(im.src, 160))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="cal-ph"></span>`}<span><b>${esc(displayName(i))}</b><small>${esc(sub)}${pr ? ` · ${priceTag(pr.price, pr.currency)}` : ""}</small></span></a>`;
}

// Spec-sheet lines as the store wrote them, each linked to that store's page.
const SHEET_KEYS = ["driver", "freq", "thd", "snr", "dr", "crosstalk", "dac", "ampchip", "pcm", "dsd", "bt", "codec", "battery", "connector", "plug", "cable", "weight"];
function sheetRows(i) {
  if (!i.sheet) return "";
  const rows = SHEET_KEYS.filter((k) => i.sheet[k]).map((k) => {
    const e = i.sheet[k];
    const o = i.offers.find((x) => x.store === e.store);
    return `<div><dt>${esc(t(`sh_${k}`))}</dt><dd>${esc(e.value)}${o ? ` <a class="small" href="${esc(o.url)}" target="_blank" rel="noopener" title="${esc(db.stores[e.store]?.name ?? e.store)}">${esc(db.stores[e.store]?.host ?? e.store)} ↗</a>` : ""}</dd></div>`;
  });
  return rows.length ? `<dl class="sheet">${rows.join("")}</dl>` : "";
}

/**
 * Offers and the "from" price for this reader: a store whose own shipping zones
 * leave out the reader's region doesn't set the headline (e-earphone's yen
 * price is no use in Bangkok). Every offer is still listed.
 */
function prices(item) {
  const all = allPrices(item);
  // Match-only stores (e-earphone) list used units for buyers in their own country.
  const home = REGIONS[state.region]?.iso ?? [];
  const reach = all.offers.filter((o) => !o.suspect && shipsTo(db.stores[o.store], state.region) !== false && !(MATCH_ONLY_STORES.has(o.store) && !home.includes(db.stores[o.store]?.country ?? "JP")));
  const cheapest = reach.find((o) => o.condition === "new" && o.available) ?? reach.find((o) => o.condition === "new") ?? all.cheapest;
  return { offers: all.offers, cheapest };
}
/** A price in US dollars, only to sort items listed in different currencies. */
const usdOf = (o) => (o ? convert(o.price, o.currency, "USD") ?? o.price : Infinity);

/** "Ships to Thailand" / "Doesn't ship to Thailand" from the store's own shipping zones. */
const MATCH_ONLY_STORES = new Set(["eearphone"]);
function shipTag(storeId) {
  const ok = shipsTo(db.stores[storeId], state.region);
  if (ok == null) return "";
  return `<br><small class="ship ${ok ? "yes" : "no"}">${esc(t(ok ? "ship_yes" : "ship_no", { where: L(REGIONS[state.region]) }))}</small>`;
}

function offersTable(offers) {
  if (!offers.length) return `<p class="muted">—</p>`;
  return `<ul class="offers">${offers
    .map(
      (o) => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener" class="strong">${esc(db.stores[o.store]?.name ?? o.store)}</a>
      <span class="muted small">${esc(o.title)}${o.condition !== "new" ? ` · ${esc(t("cond_used"))}` : ""}${o.seenAt ? ` · ${esc(t("pr_seen", { date: day(o.seenAt) }))}` : ""}${o.preorder ? ` <span class="tag warn" title="${esc(o.preorder.quote)}">${esc(o.preorder.until ? t("cal_pre_until", { date: day(o.preorder.until) }) : t("cal_pre"))}</span>` : ""}</span>
      <span class="price">${priceTag(o.price, o.currency)}${o.suspect ? ` <span class="tag warn">${esc(t("suspect"))}</span>` : ""}</span><span class="stock ${o.available ? "in" : "out"}">${esc(t(o.available ? "in_stock" : "out_stock"))}${shipTag(o.store)}</span></li>`,
    )
    .join("")}</ul>`;
}

// ---------------------------------------------------------------------------
// Event wiring after each render

function wire(main, r) {
  if (r.name === "home") return wireHome(main);
  if (r.name === "fr") return wireFr(main);
  if (r.name === "build") {
    // Ports users confirmed from back-panel photos can turn "not stated" into a match.
    const ids = [state.src, state.dac, state.amp].filter(Boolean).map((id) => findItem(id)?.id);
    if (ids.length)
      community.portsFor(ids).then((reports) => {
        const el = main.querySelector("#chain-links");
        if (el && Object.keys(reports).length) el.innerHTML = chainSteps(reports).join("");
      });
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
    if (i) wireThumbs(main, i);
    if (i && HEADPHONE_CATS.has(i.category)) renderFrLinks(main.querySelector("#fr-links"), i);
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
    if (i) watchSection(main.querySelector("#community"), async () => {
      const { ok, rows } = await community.reportsFor(idsOf(i));
      return ok ? rows.map((r) => `${r.id}:${r.confirms}`).sort().join() : null;
    }, () => renderCommunity(main.querySelector("#community"), i));
    if (i) renderPaid(main.querySelector("#paid"), i);
    if (i) renderPorts(main.querySelector("#ports"), i);
    // "Photo the back panel": jump to the ports card and open its form.
    main.querySelector("[data-scroll=ports]")?.addEventListener("click", () => {
      const el = main.querySelector("#ports");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      const d = el?.querySelector(".port-add");
      if (d) d.open = true;
    });
    if (i) renderOwners(main.querySelector("#owners"), i);
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
    // Dropdowns and checkboxes rewrite one query param each.
    main.querySelectorAll("select[data-param]").forEach((el) =>
      el.addEventListener("change", () => {
        const p = query();
        el.value ? p.set(el.dataset.param, el.value) : p.delete(el.dataset.param);
        p.delete("n");
        go(`#catalog?${p}`);
      }),
    );
    main.querySelectorAll("input[data-toggle]").forEach((el) =>
      el.addEventListener("change", () => {
        const p = query();
        el.checked ? p.set(el.dataset.toggle, "1") : p.delete(el.dataset.toggle);
        p.delete("n");
        go(`#catalog?${p}`);
      }),
    );
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

const POSTS_PAGE = 10;
/** Labels inside a review post (pros, cons, verdict, unit…) in the current language. */
const reviewLabels = () => ({ ...REVIEW_LABELS.en, ...REVIEW_LABELS[state.lang] });

/** Kind/source chips, order and "show more" for the posts list. Moves and hides the articles, so their buttons keep working. */
function wirePostFilters(el) {
  const list = el.querySelector("[data-posts]");
  if (!list) return;
  const more = list.querySelector("[data-more]");
  const arts = [...list.querySelectorAll("article.post")];
  const f = { kind: "", src: "", sort: "top", n: POSTS_PAGE };
  const draw = () => {
    const key = f.sort === "new" ? (a) => -a.dataset.t : (a) => Number(a.dataset.o);
    arts.sort((a, b) => key(a) - key(b)).forEach((a) => list.insertBefore(a, more));
    let match = 0;
    for (const a of arts) {
      const ok = (!f.kind || a.dataset.kind === f.kind) && (!f.src || a.dataset.src === f.src);
      if (ok) match++;
      a.hidden = !ok || match > f.n;
    }
    more.hidden = match <= f.n;
    more.textContent = t("cm_more_posts", { n: match - f.n });
  };
  el.querySelectorAll("[data-f]").forEach((b) =>
    b.addEventListener("click", () => {
      f[b.dataset.f] = b.dataset.v;
      f.n = POSTS_PAGE;
      el.querySelectorAll(`[data-f="${b.dataset.f}"]`).forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      draw();
    }),
  );
  el.querySelector("[data-sort]")?.addEventListener("change", (e) => {
    f.sort = e.target.value;
    draw();
  });
  more.addEventListener("click", () => {
    f.n += POSTS_PAGE;
    draw();
  });
  draw();
}

async function renderCommunity(el, item) {
  if (!el) return;
  el.innerHTML = `<h3>${esc(t("cm_title"))}</h3><p class="muted small">${esc(t("cm_loading"))}</p>`;
  const { ok, rows } = await community.reportsFor(idsOf(item));
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
  const order = { issue: 0, review: 1, owner: 2, correction: 3 };
  rows.sort((a, b) => order[a.kind] - order[b.kind] || b.confirms - a.confirms);

  // A post written in several languages shows the viewer's one.
  const shown = (r) => r.i18n?.[state.lang] ?? r;
  // The version in the review's own language (e.g. English for Head-Fi) stays one click away.
  const original = (r) => r.i18n?.[r.i18n?._src] ?? null;
  const translated = (r) => original(r) && r.i18n._src !== state.lang && original(r).body !== shown(r).body;
  // Review summaries show their first line (rating · reviewer · date); pros and cons open on click.
  const bodyHtml = (r, body) => {
    if (!body) return "";
    const [head, ...rest] = body.split("\n\n");
    if (r.kind !== "review" || !rest.length) return `<p class="post-body">${esc(body)}</p>`;
    return `<p class="post-body">${esc(head)}</p><details class="post-more"><summary class="small">${esc(t("cm_details"))}</summary>${rest.map(section).join("")}</details>`;
  };
  // "Pros\n- point — “quote”\n- …" → a heading and a list, the quote on its own line.
  const section = (block) => {
    const [label, ...lines] = block.split("\n");
    const items = lines.filter((l) => l.startsWith("- "));
    if (!items.length) return `<p class="post-body">${esc(block)}</p>`;
    const li = (l) => {
      const s = l.slice(2);
      const at = s.indexOf(" — “");
      return at < 0 ? `<li>${esc(s)}</li>` : `<li>${esc(s.slice(0, at))}<span class="post-quote">${esc(s.slice(at + 3))}</span></li>`;
    };
    return `<div class="post-sec"><b>${esc(label)}</b><ul>${items.map(li).join("")}</ul></div>`;
  };
  const post = (r, n) => `<article class="post k-${r.kind}" data-kind="${r.kind}" data-src="${esc(sourceHost(r.evidence_url))}" data-t="${Date.parse(r.created_at) || 0}" data-o="${n}">
    <div class="post-head"><span class="tag ${r.kind === "issue" ? "warn" : ""}">${esc(t(`cm_kind_${r.kind}`))}</span>
      ${["bought", "free_sample", "loan"].includes(r.purchase) ? `<span class="tag${r.purchase === "bought" ? "" : " warn"}">${esc(t(`cm_${r.purchase}`))}</span>` : ""}
      ${r.kind === "issue" && r.issue_state ? `<span class="tag${r.issue_state === "fixed" ? " ok" : r.issue_state === "open" ? " warn" : ""}">${esc(r.issue_state === "fixed" && r.fixed_in ? t("is_fixed_in", { v: r.fixed_in }) : t(`is_${r.issue_state}`))}</span>` : ""}
      <span class="muted small">${r.kind === "review" ? `${esc(t("rv_summarised_by"))} ` : ""}${r.author ? esc(r.author_name || t("cm_user")) : `${esc(t("cm_maintainer"))} <a href="#compiled">${esc(t("cm_how"))}</a>`} · ${new Date(r.created_at).toLocaleDateString(loc())}</span></div>
    <div class="post-text">
      <p class="post-title">${esc(shown(r).title)}</p>
      ${bodyHtml(r, shown(r).body)}
    </div>
    ${translated(r) ? `<div class="post-text" hidden lang="${esc(r.i18n._src)}">
      <p class="post-title">${esc(original(r).title)}</p>
      ${bodyHtml(r, original(r).body)}
    </div>` : ""}
    ${r.quote ? `<blockquote class="post-source-quote small">“${esc(r.quote)}”</blockquote>` : ""}
    ${r.evidence_url ? `<p class="small">${esc(t("cm_evidence"))}: ${srcLink(r.evidence_url)}${r.checked_on ? ` <span class="muted">· ${esc(t("cm_checked", { date: new Date(r.checked_on).toLocaleDateString(loc()) }))}</span>` : ""}</p>` : ""}
    <div class="post-actions">
      <button class="pill small${mine.has(r.id) ? " on" : ""}" data-confirm="${r.id}" ${s ? "" : "disabled"} aria-pressed="${mine.has(r.id)}">${esc(t("cm_metoo"))} · ${r.confirms}</button>
      ${translated(r) ? `<button class="link small" data-orig="${esc(LANG_NAME[r.i18n._src])}" aria-pressed="false">${esc(t("cm_original", { lang: LANG_NAME[r.i18n._src] }))}</button>` : ""}
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
      <div class="seg" role="group" style="--n:4;--i:0" data-kind-seg>
        ${["issue", "review", "owner", "correction"].map((k, n) => `<button type="button" data-kind="${k}" aria-pressed="${n === 0}">${esc(t(`cm_kind_${k}`))}</button>`).join("")}
      </div>
      <input type="hidden" name="kind" value="issue">
      ${botBox("issue")}
      <input class="search" name="title" required minlength="5" maxlength="140" placeholder="${esc(t("cm_ph_title"))}">
      <textarea class="search" name="body" maxlength="2000" rows="3" placeholder="${esc(t("cm_ph_body"))}"></textarea>
      <div class="cm-evidence">
        <input class="search" name="evidence_url" type="url" pattern="https://.+" placeholder="${esc(t("cm_ph_evidence"))}" required>
        <label class="cm-unit small muted">${esc(t("cm_unit"))}<select name="purchase" class="mini-select">
          <option value="bought">${esc(t("cm_bought"))}</option><option value="free_sample">${esc(t("cm_free_sample"))}</option><option value="loan">${esc(t("cm_loan"))}</option><option value="unknown">${esc(t("cm_unknown"))}</option>
        </select></label>
      </div>
      <div class="cm-send"><button class="pill primary">${esc(t("cm_post"))}</button><span class="muted small">${esc(t("cm_as", { name: profile.display_name }))} · <button type="button" class="link small" data-signout>${esc(t("cm_signout"))}</button></span></div>
      <p class="muted small">${esc(t("cm_rules"))}</p>
    </form>`;
  }

  // Filters appear once there is enough to filter: by kind, by source site, and the order.
  const count = (f) => rows.filter(f).length;
  const kinds = ["issue", "review", "owner", "correction"].filter((k) => count((r) => r.kind === k));
  const hosts = [...new Set(rows.map((r) => sourceHost(r.evidence_url)).filter(Boolean))].sort((a, b) => count((r) => sourceHost(r.evidence_url) === b) - count((r) => sourceHost(r.evidence_url) === a));
  const chip = (f, v, label) => `<button type="button" class="pill small${v ? "" : " on"}" data-f="${f}" data-v="${esc(v)}" aria-pressed="${!v}">${esc(label)}</button>`;
  // Where the posts come from is always shown, so a reader can stick to one site.
  const filters =
    rows.length > 1
      ? `<div class="post-filters">
      ${kinds.length > 1 ? `<div class="row-inline">${chip("kind", "", t("cm_f_all"))}${kinds.map((k) => chip("kind", k, `${t(`cm_kind_${k}`)} · ${count((r) => r.kind === k)}`)).join("")}</div>` : ""}
      ${hosts.length ? `<div class="row-inline"><span class="small muted">${esc(t("cm_from_site"))}</span>${chip("src", "", t("cm_f_all_sources"))}${hosts.map((h) => chip("src", h, `${h} · ${count((r) => sourceHost(r.evidence_url) === h)}`)).join("")}</div>` : ""}
      ${rows.length > 2 ? `<label class="small muted">${esc(t("cm_sort"))} <select class="mini-select" data-sort><option value="top">${esc(t("cm_sort_top"))}</option><option value="new">${esc(t("cm_sort_new"))}</option></select></label>` : ""}
    </div>`
      : "";
  el.innerHTML = `<h3>${esc(t("cm_title"))}</h3><p class="muted small">${esc(t("cm_disclaimer"))}</p>
    ${filters}
    ${rows.length ? `<div data-posts>${rows.map(post).join("")}<button type="button" class="pill small" data-more hidden></button></div>` : `<p class="muted">${esc(t("cm_empty"))}</p>`}
    <div class="composer">${composer}<p class="small status" role="status"></p></div>`;

  const status = el.querySelector(".status");
  const fail = (e) => (status.textContent = /rate_limit/.test(e?.message) ? t("cm_rate") : `${t("cm_error")} ${e?.message ?? ""}`);
  const again = () => renderCommunity(el, item);
  wirePostFilters(el);
  const postForm = el.querySelector('[data-form="post"]');
  let postI18n = null;
  let postKey = null;
  const setKind = (k) => el.querySelector(`[data-kind-seg] [data-kind="${k}"]`)?.click();
  if (postForm)
    wireBot(postForm, item, (d, link) => {
      if (d.block) {
        const b = d.block;
        const asReview = b.pros.length || b.cons.length;
        setKind(asReview ? "review" : "issue");
        const post = asReview ? reviewPost(b, reviewLabels(), state.lang) : { title: b.problems[0]?.point ?? b.summary, body: b.problems.map((p) => `- ${p.point} — “${p.quote}”`).join("\n") };
        postForm.title.value = post.title;
        postForm.body.value = post.body;
        // Other languages go with the post only while the text is left as drafted.
        postI18n = asReview ? reviewPostI18n(b) : null;
        postKey = asReview ? reviewKey(b.source || link, b.reviewer) : null;
        if (b.unit) postForm.purchase.value = b.unit.how;
        if (postI18n) postI18n[state.lang] = post;
        postForm.evidence_url.value = b.source || link;
        return;
      }
      if (d.title) postForm.title.value = d.title;
      if (d.body) postForm.body.value = d.body;
      if (link) postForm.evidence_url.value = link;
    });
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
  el.querySelectorAll("[data-orig]").forEach((b) =>
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      const [tr, orig] = b.closest("article").querySelectorAll(".post-text");
      tr.hidden = on;
      orig.hidden = !on;
      b.setAttribute("aria-pressed", String(on));
      b.textContent = t(on ? "cm_translated" : "cm_original", { lang: b.dataset.orig });
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
      seg.dataset.touched = "1";
      // Evidence is mandatory only for issues.
      form.evidence_url.required = b.dataset.kind === "issue" || b.dataset.kind === "review";
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
      if (f.dataset.form === "post") {
        const title = f.title.value.trim();
        const body = f.body.value.trim();
        const drafted = postI18n?.[state.lang];
        const unedited = drafted && f.kind.value === "review" && drafted.title.trim() === title && drafted.body.trim() === body;
        const res = await community.addReport({
          item_id: item.id,
          kind: f.kind.value,
          title,
          body,
          evidence_url: f.evidence_url.value.trim() || null,
          purchase: f.purchase.value,
          ...(unedited ? { i18n: postI18n } : {}),
          ...(postKey && f.kind.value === "review" ? { dedupe_key: postKey } : {}),
        });
        if (res?.duplicate) return (status.textContent = t("cm_dup"));
      }
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

const CHANNELS = ["shopee", "lazada", "tiktok", "amazon", "ebay", "store_th", "secondhand_th", "taobao", "tmall", "jd", "xianyu", "aliexpress", "store_intl", "other"];
const CHANNEL_CURRENCY = { taobao: "CNY", tmall: "CNY", jd: "CNY", xianyu: "CNY", store_intl: "USD", aliexpress: "USD" };
const CURRENCIES = ["THB", "CNY", "USD", "EUR", "GBP", "JPY", "KRW", "SGD", "MYR", "PHP", "IDR", "VND", "AUD", "CAD", "TWD", "HKD"];
const EVIDENCE_HOST = "/storage/v1/object/public/evidence/";

function day(iso) {
  return new Date(iso).toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" });
}
function baht(n) {
  return money(n, cur());
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
    `<label class="dfield"><span>${esc(label)}</span><input class="search num" id="${id}" inputmode="decimal" autocomplete="off" value="${num(k)}" placeholder="${esc(hint)}"></label>`;
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
        ${sampleCodesHtml()}
        <div class="row-inline paste"><input class="search" id="d-paste" placeholder="${esc(t("dl_paste_ph"))}">
          <select id="d-kind" class="mini-select" autocomplete="off"><option value="platform">${esc(t("dl_kind_platform"))}</option><option value="shop">${esc(t("dl_kind_shop"))}</option></select>
          <button type="button" class="pill primary" id="d-add">${esc(t("dl_add"))}</button></div>
        <p class="small status" id="d-paste-status" role="status"></p>
      </section>
    </div>
    <section class="card pad" id="d-result" aria-live="polite"></section>
    <section class="card pad"><h3>${esc(t("dl_cn_h"))}</h3><p class="muted small">${esc(t("dl_cn_help"))}</p>
      <div class="deal-fields">
        ${field("d-cp", t("dl_cn_price"), "cp", "699.9")}
        ${field("d-cs", t("dl_cn_ship"), "cs", "0")}
        ${field("d-r", t("dl_cn_rate", { cur: cur() }), "r", t("dl_cn_rate_ph"))}
        ${field("d-x", t("dl_cn_extra"), "x", "0")}
      </div>
      <div id="d-cn"></div>
    </section>
    <p class="muted small">${esc(t("dl_assume"))} <a href="#learn/marketplace-prices">${esc(t("dl_how"))}</a></p>
    <p class="muted small">${esc(t("aff_note"))}</p>
  </div>`;
}

// Codes laid out like the app's voucher picker: a ticket per code, the one
// the best pair uses ticked. The numbers sit under "edit"; readCodes() reads them.
function codesHtml(codes) {
  if (!codes.length) return `<p class="muted small">${esc(t("dl_no_codes"))}</p>`;
  // autocomplete="off": otherwise the browser refills these fields by position
  // after a reload, and a shop code can come back as a platform code.
  const off = 'autocomplete="off"';
  return `<ul class="codes">${codes
    .map(
      (c, n) => `<li class="code-row" data-n="${n}" data-code="${esc(encodeCode(c))}">
      <div class="voucher ${c.kind === "shop" ? "shop" : "platform"}"><div class="voucher-side">${esc(t(c.kind === "shop" ? "tk_shop" : "tk_platform"))}</div>
        <div class="voucher-body"><b>${esc(c.pct ? t("tk_pct", { pct: fmt(c.pct, 0) }) : t("tk_off", { off: baht(c.off) }))}</b><span class="small muted">${esc([c.cap != null && c.pct ? t("tk_cap", { cap: baht(c.cap) }) : null, c.min ? t("tk_min", { min: baht(c.min) }) : null].filter(Boolean).join(" · ") || t("tk_no_terms"))}</span>
          <span class="voucher-actions"><button type="button" class="link small" data-edit="${n}">${esc(t("ds_edit"))}</button> · <button type="button" class="link small" data-rm="${n}">${esc(t("cm_delete"))}</button></span></div>
        <span class="voucher-check" aria-hidden="true"></span></div>
      <div class="code-fields" hidden>
        <label><span>${esc(t("dl_kind"))}</span><select class="mini-select" data-f="kind" ${off}><option value="platform"${c.kind !== "shop" ? " selected" : ""}>${esc(t("tk_platform"))}</option><option value="shop"${c.kind === "shop" ? " selected" : ""}>${esc(t("tk_shop"))}</option></select></label>
        <label><span>${esc(t("dl_off_l"))}</span><span class="code-val"><input class="search num" data-f="val" inputmode="decimal" value="${c.pct ?? c.off ?? ""}" ${off}><select class="mini-select" data-f="unit" ${off}><option value="pct"${c.pct != null ? " selected" : ""}>%</option><option value="off"${c.pct == null ? " selected" : ""}>฿</option></select></span></label>
        <label><span>${esc(t("dl_min_l", { cur: cur() }))}</span><input class="search num" data-f="min" inputmode="decimal" value="${c.min ?? ""}" ${off}></label>
        <label><span>${esc(t("dl_cap_l", { cur: cur() }))}</span><input class="search num" data-f="cap" inputmode="decimal" value="${c.cap ?? ""}" ${off}></label>
      </div></li>`,
    )
    .join("")}</ul>`;
}

// Tiers seen in the app on 12 Oct 2026, to try the maths without typing. Not
// live codes: the app decides which ones each account gets.
const SAMPLE_CODES = [
  { kind: "platform", pct: 30, min: 7915, cap: 4000 },
  { kind: "platform", pct: 25, min: 6000, cap: 6000 },
  { kind: "platform", pct: 25, min: 1000, cap: 2500 },
  { kind: "platform", pct: 15, min: 199, cap: 1999 },
  { kind: "shop", pct: 20 },
];
function sampleCodesHtml() {
  return `<details class="sample-codes"><summary>${esc(t("dl_samples"))}</summary><p class="small muted">${esc(t("dl_samples_note"))}</p><div class="vouchers">${SAMPLE_CODES.map(
    (c) => `<div class="voucher ${c.kind === "shop" ? "shop" : "platform"}"><div class="voucher-side">${esc(t(c.kind === "shop" ? "tk_shop" : "tk_platform"))}</div><div class="voucher-body"><b>${esc(t("tk_pct", { pct: c.pct }))}</b><span class="small muted">${esc([c.cap ? t("tk_cap", { cap: baht(c.cap) }) : null, c.min ? t("tk_min", { min: baht(c.min) }) : null].filter(Boolean).join(" · ") || t("tk_no_terms"))}</span></div><button type="button" class="pill small collect" data-collect="${esc(encodeCode(c))}">${esc(t("dl_collect"))}</button></div>`,
  ).join("")}</div></details>`;
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
        const code = Object.fromEntries(Object.entries(c).filter(([, x]) => x !== undefined));
        row.dataset.code = encodeCode(code); // the tick follows edits
        return code;
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
    const price = val($("#d-p"));
    const best = price ? combos(price, codes, { shipping: val($("#d-s")) ?? 0 })[0] : null;
    const chosen = new Set([best?.shop, best?.platform].filter(Boolean).map(encodeCode));
    main.querySelectorAll(".code-row").forEach((row) => row.classList.toggle("chosen", chosen.has(row.dataset.code)));
    const held = new Set(codes.map(encodeCode));
    main.querySelectorAll("[data-collect]").forEach((b) => {
      const got = held.has(b.dataset.collect);
      b.disabled = got;
      b.textContent = t(got ? "dl_collected" : "dl_collect");
    });
    const cn = landed({ price: val($("#d-cp")), shipping: val($("#d-cs")) ?? 0, rate: val($("#d-r")), extraPct: val($("#d-x")) ?? 0 });
    $("#d-cn").innerHTML = cn
      ? `<p class="deal-big">${baht(cn.total)}</p><p class="muted small">${esc(t("dl_cn_math", { base: baht(cn.base), extra: baht(cn.extra) }))}</p><p class="small">${esc(t("dl_cn_warn"))}</p>`
      : `<p class="muted small">${esc(t("dl_cn_empty", { cur: cur() }))}</p>`;
  };
  const redraw = (codes) => {
    $("#d-codes").innerHTML = codesHtml(codes);
    bindRows();
    update();
  };
  const bindRows = () => {
    main.querySelectorAll(".code-row input, .code-row select").forEach((el) => el.addEventListener("input", update));
    main.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const f = b.closest(".code-row").querySelector(".code-fields");
        f.hidden = !f.hidden;
      }),
    );
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
    const have = readCodes();
    if (have.some((x) => encodeCode(x) === encodeCode(c))) {
      status.textContent = t("dl_have");
      return;
    }
    redraw([...have, c]);
  };
  $("#d-add").addEventListener("click", add);
  main.querySelectorAll("[data-collect]").forEach((b) =>
    b.addEventListener("click", () => {
      const have = readCodes();
      if (have.some((x) => encodeCode(x) === b.dataset.collect)) return;
      if (!$("#d-p").value.trim()) $("#d-p").value = "16490";
      redraw([...have, decodeCode(b.dataset.collect)]);
    }),
  );
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
    community.pricesFor(findItem(id) ? idsOf(findItem(id)) : [id]).then(({ ok, rows }) => {
      if (!ok || !slot.isConnected) return;
      const th = summarize(rows.filter((r) => r.currency === cur() && !CHANNEL_CURRENCY[r.channel]));
      slot.innerHTML = th.length
        ? th.map((g) => esc(t("dl_paid_ref", { channel: t(`ch_${g.channel}`), min: baht(g.min), max: baht(g.max), n: g.n }))).join("<br>")
        : `<span class="muted">${esc(t("dl_paid_none"))}</span>`;
    });
}

// The best pair laid out like the order summary in the Shopee/Lazada apps
// (people read those every day): codes as voucher tickets, then the lines.
function receiptHtml(price, shipping, best) {
  const [a, b] = best.steps;
  const line = (label, v, cls = "") => `<div class="rc-line ${cls}"><span>${esc(label)}</span><span>${v}</span></div>`;
  return `<div class="receipt">
    ${line(t("rc_items"), baht(price))}
    ${shipping ? line(t("rc_ship"), baht(shipping)) : ""}
    ${b?.eligible && b.discount ? line(t("rc_platform"), `−${baht(b.discount)}`, "off") : ""}
    ${a?.eligible && a.discount ? line(t("rc_shop"), `−${baht(a.discount)}`, "off") : ""}
    ${line(t("rc_total"), `<b>${baht(best.final)}</b>`, "total")}
    <p class="small muted">${esc(t("rc_note"))}</p>
  </div>`;
}

function dealResult(price, anchor, shipping, codes) {
  if (!price) return `<h3>${esc(t("dl_result_h"))}</h3><p class="muted">${esc(t("dl_need_price"))}</p>`;
  const all = combos(price, codes, { shipping });
  const best = all[0];
  const used = [best.shop, best.platform].filter(Boolean);
  const rows = all.filter((c) => c.shop || c.platform);
  const capNotes = codes
    .filter((c, n) => capPoint(c) && codes.findIndex((x) => encodeCode(x) === encodeCode(c)) === n)
    .map((c) => {
      const at = capPoint(c);
      const real = Math.min(c.pct, (c.cap / price) * 100);
      return `<li>${esc(codeLabel(c))}: ${esc(t("dl_cap_note", { at: baht(at), cap: baht(c.cap) }))}${price > at ? ` <span class="tag warn">${esc(t("dl_cap_hit", { pct: fmt(real, 1) }))}</span>` : ""}</li>`;
    })
    .join("");
  return `<h3>${esc(t("dl_result_h"))}</h3>
    ${receiptHtml(price, shipping, best)}
    <div class="pay-bar"><span>${esc(t("rc_total"))} <b>${baht(best.final)}</b></span><span class="small">${esc(t("rc_saved", { off: baht(best.discount), pct: fmt(best.pct, 0) }))}</span></div>
    ${anchor && anchor > price ? `<p class="muted small">${esc(t("dl_anchor_note", { anchor: baht(anchor), pct: fmt(((anchor - (best.final - shipping)) / anchor) * 100, 0) }))}</p>` : ""}
    ${
      rows.length
        ? `<details class="deal-all"><summary>${esc(t("dl_all_pairs", { n: rows.length }))}</summary><div class="table-wrap"><table class="deal-table"><thead><tr><th>${esc(t("dl_kind_shop"))}</th><th>${esc(t("dl_kind_platform"))}</th><th>${esc(t("dl_col_off"))}</th><th>${esc(t("dl_col_final"))}</th></tr></thead><tbody>${rows
            .map((c) => {
              const short = c.steps.find((s) => s && !s.eligible);
              return `<tr class="${c === best ? "best" : ""}${c.valid ? "" : " invalid"}"><td>${c.shop ? esc(codeLabel(c.shop)) : "—"}</td><td>${c.platform ? esc(codeLabel(c.platform)) : "—"}</td>
              <td>${c.valid ? `${baht(c.discount)} <span class="muted small">(${fmt(c.pct, 1)}%)</span>` : `<span class="small">${esc(t("dl_short", { v: baht(short.shortfall) }))}</span>`}</td><td>${c.valid ? baht(c.final) : "—"}</td></tr>`;
            })
            .join("")}</tbody></table></div></details>`
        : ""
    }
    ${capNotes ? `<ul class="small cap-notes">${capNotes}</ul>` : ""}`;
}

function channelsCard(i) {
  const name = displayName(i);
  const zh = db.zhNames?.[(i.brand ?? "").toLowerCase()];
  const cnQuery = zh ? `${zh} ${i.model}` : name;
  const q = encodeURIComponent;
  const reg = REGIONS[state.region] ?? REGIONS.other;
  const th = storeLinks(state.region, name);
  // Stores Sotto tracks in other countries that ship here (their own shipping
  // zones), as search links: many readers order from abroad.
  const local = new Set(th.map(([l]) => l.toLowerCase()));
  const shippers = Object.entries(db.stores)
    .filter(([id, s]) => s.products > 0 && !MATCH_ONLY_STORES.has(id) && shipsTo(s, state.region) && !(reg.iso ?? []).includes(s.country) && !local.has(String(s.name).toLowerCase()))
    .map(([, s]) => [s.name, `https://${s.host}/search?q=${q(name)}`]);
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
      <div><h4>${esc(t("ch_th", { region: L(reg) }))}</h4><p class="small"><label>${esc(t("rg_label"))} ${regionSelect()}</label></p><p class="muted small">${esc(t(reg.codes ? "ch_th_note" : "ch_local_note"))}</p>
        <div class="row-inline">${links(th)}${reg.codes ? `<a class="pill primary" href="#deal?item=${q(i.id)}">${esc(t("it_deal"))}</a>` : ""}</div>
        ${shippers.length ? `<p class="small muted">${esc(t("ship_from_abroad", { where: L(reg) }))}</p><div class="row-inline">${links(shippers)}</div>` : ""}</div>
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

// ---------------------------------------------------------------------------
// Contributor tools (#tools): the "Send to Sotto" bookmarklet and the Gemini skill.

// ---------------------------------------------------------------------------
// Frequency response from the reader's own files. Parsed and drawn in this
// browser; nothing is uploaded, and Sotto keeps no one's measurements.
const FR_COLORS = ["#E8862E", "#3B82F6", "#10B981", "#A855F7", "#EF4444", "#14B8A6"];
const FR_KEY = "sotto.fr";
// Reference curves: links to where they are published, never copies. Each
// opens on a squig.link graph with tilt/bass/treble at 0, ready for its ⬇ button.
const FR_TARGETS = [
  ["fr_tg_df", ["Δ 5128 DF", "Δ ISO 11904-1 DF", "Δ JM-1 DF", "Δ Headphones.com (IEM) DF"]],
  ["fr_tg_comp", ["711 to 5128", "711 to 5128 (DD Bass)", "IEF Comp"]],
  ["fr_tg_pref", ["Harman IE 2019", "Harman IE 2017", "IEF Neutral 2023"]],
];
const squigTarget = (name) => `https://squig.link/lab/aquaphobic/?share=${encodeURIComponent(`${name.trim()} Target`.replace(/ /g, "_")).replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}&bass=0&tilt=0&treble=0&ear=0`;
function frLoad() {
  try {
    return JSON.parse(localStorage.getItem(FR_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function frSave(list) {
  try {
    localStorage.setItem(FR_KEY, JSON.stringify(list));
  } catch {
    /* private window: the graph still works for this visit */
  }
}

function frPage() {
  return `<div class="fr-page">
    <header class="deal-head"><h1>${esc(t("fr_title"))}</h1><p class="muted">${esc(t("fr_lead"))}</p></header>
    <label class="fr-drop card" id="fr-drop" tabindex="0">
      <input type="file" id="fr-file" accept=".txt,.csv,.frd,text/plain,text/csv" multiple hidden>
      <b>${esc(t("fr_drop"))}</b><span class="muted small">${esc(t("fr_formats"))}</span>
    </label>
    <p class="small status" id="fr-msg" role="status"></p>
    <section class="card pad fr-card">
      <div class="fr-tools">
        <div class="select"><select id="fr-smooth" aria-label="${esc(t("fr_smooth"))}">${[[0, t("fr_smooth_none")], [12, "1/12 oct"], [6, "1/6 oct"], [3, "1/3 oct"]].map(([v, l]) => `<option value="${v}"${v === 6 ? " selected" : ""}>${esc(t("fr_smooth"))}: ${esc(l)}</option>`).join("")}</select></div>
        <label class="small"><input type="checkbox" id="fr-delta"> ${esc(t("fr_delta"))}</label>
        <span class="small muted fr-read" id="fr-read"></span>
      </div>
      <div class="fr-host" id="fr-host"></div>
      <ul class="fr-legend" id="fr-legend"></ul>
    </section>
    <p class="muted small">${esc(t("fr_private"))}</p>
    <section class="card pad fr-targets"><h3>${esc(t("fr_tg_h"))}</h3><p class="small">${esc(t("fr_tg_how"))}</p>
      ${FR_TARGETS.map(([k, names]) => `<p class="small"><b>${esc(t(k))}</b></p><div class="chips">${names.map((n) => `<a class="chip" href="${esc(squigTarget(n))}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join("")}</div>`).join("")}
      <p class="muted small">${esc(t("fr_tg_note"))}</p></section>
    <section class="card pad"><h3>${esc(t("fr_where_h"))}</h3><ul class="small">
      <li>${esc(t("fr_where_rew"))} <a href="https://www.roomeqwizard.com/" target="_blank" rel="noopener">REW ↗</a></li>
      <li>${esc(t("fr_where_autoeq"))} <a href="https://github.com/jaakkopasanen/AutoEq" target="_blank" rel="noopener">AutoEq ↗</a></li>
      <li>${esc(t("fr_where_squig"))} <a href="https://squig.link/" target="_blank" rel="noopener">squig.link ↗</a></li>
    </ul><p class="muted small">${esc(t("fr_where_rule"))}</p></section>
  </div>`;
}

function wireFr(main) {
  let list = frLoad();
  const host = main.querySelector("#fr-host");
  const legend = main.querySelector("#fr-legend");
  const msg = main.querySelector("#fr-msg");
  const draw = () => {
    const frac = Number(main.querySelector("#fr-smooth").value);
    const shown = list.filter((x) => !x.off);
    // The reference (★) is drawn dashed; "difference" subtracts it from every line.
    const ref = shown.find((x) => x.ref) ?? null;
    const delta = main.querySelector("#fr-delta").checked && shown.length > 1;
    const baseItem = ref ?? shown[0];
    const base = delta ? smooth(normalize(baseItem.points), frac) : null;
    const traces = shown.map((x) => {
      let pts = smooth(normalize(x.points), frac);
      if (base) pts = pts.map((p, i) => ({ f: p.f, db: p.db - base[i].db }));
      return { label: x.label, color: x.ref ? "#9CA3AF" : x.color, points: pts, dashed: x === baseItem && (delta || !!x.ref) };
    });
    const g = frSvg(traces, { delta: !!base });
    host.innerHTML = list.length ? g.svg : `<p class="muted fr-empty">${esc(t("fr_empty"))}</p>`;
    legend.innerHTML = list
      .map(
        (x, i) => `<li${x.off ? ' class="off"' : ""}><button type="button" class="fr-swatch" data-toggle="${i}" style="--c:${x.color}" aria-pressed="${!x.off}" aria-label="${esc(t("fr_toggle"))}"></button>
        <button type="button" class="fr-ref${x.ref ? " on" : ""}" data-ref="${i}" aria-pressed="${!!x.ref}" title="${esc(t("fr_ref"))}">★</button>
        <input class="fr-name" data-name="${i}" value="${esc(x.label)}" aria-label="${esc(t("fr_name"))}"><span class="muted small">${esc(x.file)}</span>
        <button type="button" class="link small" data-del="${i}">${esc(t("fr_remove"))}</button></li>`,
      )
      .join("");
    const svg = host.querySelector("svg");
    if (!svg) return;
    const hover = svg.querySelector(".fr-hover");
    const read = main.querySelector("#fr-read");
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * g.box.W;
      if (x < g.box.PAD.l || x > g.box.W - g.box.PAD.r) return;
      const f = g.fOfX(x);
      hover.hidden = false;
      hover.querySelector("line").setAttribute("x1", x);
      hover.querySelector("line").setAttribute("x2", x);
      read.textContent = `${f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${Math.round(f)} Hz`} · ${traces.map((tr) => `${tr.label}: ${dbAt(tr.points, f) >= 0 ? "+" : ""}${dbAt(tr.points, f).toFixed(1)} dB`).join(" · ")}`;
    });
    svg.addEventListener("pointerleave", () => {
      hover.hidden = true;
      read.textContent = "";
    });
  };
  const addFiles = async (files) => {
    const notes = [];
    for (const file of files) {
      if (file.size > 2e6) {
        notes.push(t("fr_too_big", { file: file.name }));
        continue;
      }
      const points = parseFR(await file.text());
      if (points.length < 10) {
        notes.push(t("fr_bad", { file: file.name }));
        continue;
      }
      const used = new Set(list.map((x) => x.color));
      // Always the file name: naming it after the page could label the wrong model.
      const label = file.name.replace(/\.(txt|csv|frd)$/i, "").replace(/[_]+/g, " ");
      // A file named like a target becomes the reference when there is none yet.
      const isTarget = /target|\bdf\b|11904|5128|harman|neutral|comp/i.test(file.name) && !list.some((x) => x.ref);
      list.push({ label, file: file.name, color: FR_COLORS.find((c) => !used.has(c)) ?? FR_COLORS[list.length % FR_COLORS.length], points, ...(isTarget ? { ref: true } : {}) });
      notes.push(t("fr_added", { file: file.name, n: points.length }));
    }
    list = list.slice(-FR_COLORS.length);
    frSave(list);
    msg.textContent = notes.join(" · ");
    draw();
  };
  const drop = main.querySelector("#fr-drop");
  main.querySelector("#fr-file").addEventListener("change", (e) => addFiles([...e.target.files]));
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") main.querySelector("#fr-file").click();
  });
  // Drop anywhere on the page, not only on the box.
  const over = (e) => {
    e.preventDefault();
    drop.classList.add("over");
  };
  main.addEventListener("dragover", over);
  main.addEventListener("dragleave", (e) => {
    if (!main.contains(e.relatedTarget)) drop.classList.remove("over");
  });
  main.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    addFiles([...(e.dataTransfer?.files ?? [])]);
  });
  main.querySelector("#fr-smooth").addEventListener("change", draw);
  main.querySelector("#fr-delta").addEventListener("change", draw);
  legend.addEventListener("click", (e) => {
    const tog = e.target.closest("[data-toggle]");
    const del = e.target.closest("[data-del]");
    const ref = e.target.closest("[data-ref]");
    if (ref) {
      const k = Number(ref.dataset.ref);
      const was = !!list[k].ref;
      list.forEach((x) => delete x.ref);
      if (!was) list[k].ref = true;
    } else if (tog) list[tog.dataset.toggle].off = !list[tog.dataset.toggle].off;
    else if (del) list.splice(Number(del.dataset.del), 1);
    else return;
    frSave(list);
    draw();
  });
  legend.addEventListener("change", (e) => {
    const inp = e.target.closest("[data-name]");
    if (!inp) return;
    list[inp.dataset.name].label = inp.value.slice(0, 60) || list[inp.dataset.name].file;
    frSave(list);
    draw();
  });
  draw();
}

function toolsPage() {
  return `<div class="discuss narrow"><header class="deal-head"><h1>${esc(t("tl_title"))}</h1><p class="muted">${esc(t("tl_lead"))}</p></header>
    <section class="card pad"><h3>${esc(t("tl_bm_h"))}</h3>
      <p>${esc(t("tl_bm_what"))}</p>
      <p><a class="pill primary bookmarklet" href="${esc(BOOKMARKLET)}" onclick="event.preventDefault(); alert(this.dataset.msg)" data-msg="${esc(t("tl_bm_drag"))}">↗ ${esc(t("tl_bm_name"))}</a></p>
      <ol class="small"><li>${esc(t("tl_bm_1"))}</li><li>${esc(t("tl_bm_2"))}</li><li>${esc(t("tl_bm_3"))}</li></ol>
      <p class="muted small">${esc(t("tl_bm_rules"))}</p>
      <p class="small"><a href="${REPO}/blob/main/src/bookmarklet.js?v=mv5bfzie" target="_blank" rel="noopener">${esc(t("tl_bm_code"))} ↗</a></p></section>
    <section class="card pad"><h3>${esc(t("fr_title"))}</h3><p>${esc(t("fr_lead"))}</p><p><a class="pill" href="#fr">${esc(t("fr_open"))}</a></p></section>
    <section class="card pad"><h3>${esc(t("tl_gm_h"))}</h3><p>${esc(t("tl_gm_what"))}</p>
      <p class="small"><a href="${REPO}/blob/main/docs/gemini-skill.md" target="_blank" rel="noopener">docs/gemini-skill.md ↗</a></p>
      <p class="muted small">${esc(t("tl_gm_rules"))}</p></section>
  </div>`;
}

// ---------------------------------------------------------------------------
// Summariser box: paste text from a forum post or product page, get a draft
// for the form. The person checks and edits it; nothing posts by itself.

function botBox(mode) {
  return `<details class="bot-box" data-bot="${mode}"><summary>${esc(t("bot_open"))}</summary>
    <p class="small muted">${esc(t("bot_help"))} <a href="#tools">${esc(t("bot_tools_link"))} →</a></p>
    <input class="search" name="bot_link" type="url" placeholder="${esc(t("bot_link_ph"))}">
    <textarea class="search" name="bot_text" rows="5" maxlength="120000" placeholder="${esc(t("bot_text_ph"))}"></textarea>
    <div class="row-inline"><button type="button" class="pill" data-bot-run>${esc(t("bot_run"))}</button><span class="small status" data-bot-status></span></div>
    <div class="bot-quotes small" hidden></div></details>`;
}

/** Several reviews found: one draft per reviewer, all ticked, posted with one click. */
function showManyReviews(box, item, blocks, link) {
  let list = box.querySelector(".bot-many");
  if (!list) {
    list = document.createElement("div");
    list.className = "bot-many";
    box.append(list);
  }
  const labels = reviewLabels();
  const posts = blocks.map((b) => {
    const post = reviewPost(b, labels, state.lang);
    const i18n = reviewPostI18n(b);
    if (i18n) i18n[state.lang] = post;
    return { ...post, i18n, key: reviewKey(b.source || link, b.reviewer), purchase: b.unit?.how ?? "unknown", problems: b.problems };
  });
  list.innerHTML = `${posts
    .map(
      (p, n) => `<label class="bot-draft"><input type="checkbox" data-n="${n}" checked>
        <div><b>${esc(p.title)}</b><pre class="small">${esc(p.body)}</pre></div></label>`,
    )
    .join("")}
    <div class="row-inline"><button type="button" class="pill primary" data-post-all>${esc(t("bot_post_all"))}</button><span class="small status" data-all-status></span></div>
    <p class="muted small">${esc(t("bot_many_check"))}</p>`;
  list.querySelector("[data-post-all]").addEventListener("click", async (ev) => {
    const st = list.querySelector("[data-all-status]");
    const chosen = [...list.querySelectorAll("input[data-n]:checked")].map((x) => posts[Number(x.dataset.n)]);
    if (!chosen.length) return;
    ev.target.disabled = true;
    let done = 0;
    let dup = 0;
    try {
      for (const p of chosen) {
        const res = await community.addReport({ item_id: item.id, kind: "review", title: p.title, body: p.body, evidence_url: link || null, purchase: p.purchase, ...(p.i18n ? { i18n: p.i18n } : {}), ...(p.key ? { dedupe_key: p.key } : {}) });
        if (res?.duplicate) dup++;
        else done++;
        st.textContent = t("bot_posted_n", { n: done + dup, of: chosen.length });
      }
      // Say how many were already there before reloading.
      if (dup) {
        st.textContent = t("bot_posted_dup", { n: done, d: dup });
        await new Promise((r) => setTimeout(r, 2500));
      }
      location.reload();
    } catch (e) {
      st.textContent = `${t("cm_error")} ${e.message ?? e} (${done}/${chosen.length})`;
      ev.target.disabled = false;
    }
  });
}

function wireBot(root, item, apply) {
  const box = root.querySelector("[data-bot]");
  if (!box) return;
  const st = box.querySelector("[data-bot-status]");
  box.querySelector("[data-bot-run]").addEventListener("click", async () => {
    const text = box.querySelector('[name="bot_text"]').value.trim();
    const linkEl = box.querySelector('[name="bot_link"]');
    if (!linkEl.value.trim()) linkEl.value = text.match(/^SOURCE: (https:\/\/\S+)/m)?.[1] ?? "";
    const link = linkEl.value.trim();
    // A block from the Gemini skill (docs/gemini-skill.md) fills the form directly.
    const blocks = parseBlocks(text);
    if (blocks.length) {
      const b = blocks[0];
      const quotes = [...b.pros, ...b.cons, ...b.problems].map((p) => p.quote);
      const qEl = box.querySelector(".bot-quotes");
      qEl.hidden = !quotes.length;
      qEl.innerHTML = `<b>${esc(t("bot_quotes"))}</b><ul>${quotes.map((q) => `<li>“${esc(q)}”</li>`).join("")}</ul>`;
      apply({ block: b, in: b.ports_in.map((port) => ({ port })), out: b.ports_out.map((port) => ({ port })), features: b.features.map((feature) => ({ feature })) }, b.source || link);
      st.textContent = blocks.length > 1 ? t("bot_block_many", { n: blocks.length }) : t("bot_block_done");
      return;
    }
    if (text.length < 40) return (st.textContent = t("bot_err_too_short"));
    st.textContent = t("bot_working");
    try {
      // On the report form, the "review summary" tab asks for pros/cons rather than a problem.
      const kind = root.querySelector('[name="kind"]')?.value;
      // "Review summary" asks for pros/cons; "correction" reads specs from a maker's page.
      // The report box reads reviews unless "problem" or "correction" was picked on purpose.
      const picked = root.querySelector("[data-kind-seg]")?.dataset.touched === "1";
      const mode = box.dataset.bot !== "issue" ? box.dataset.bot : kind === "correction" ? "model" : kind === "review" || !picked ? "review" : "issue";
      const { draft } = await community.summarize({ mode, text, link, lang: state.lang, item: item ? displayName(item) : undefined });
      if (mode === "model") {
        const facts = draft.facts ?? [];
        if (!facts.length) throw new Error("no_support");
        const qEl = box.querySelector(".bot-quotes");
        qEl.hidden = false;
        qEl.innerHTML = `<b>${esc(t("bot_quotes"))}</b><ul>${facts.map((f) => `<li>“${esc(f.quote)}”</li>`).join("")}</ul>`;
        apply({ title: t("bot_spec_title", { name: item ? displayName(item) : draft.model ?? "" }), body: facts.map((f) => `- ${f.label}: ${f.value} — “${f.quote}”`).join("\n").slice(0, 2000) }, link);
        st.textContent = t("bot_done");
        return;
      }
      if (mode === "review") {
        const blocks = (draft.reviews ?? []).map((r) => ({ product: item ? displayName(item) : "", source: link, reviewer: r.reviewer, date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "", rating: r.rating, summary: r.summary, summary_i18n: r.summary_i18n, verdict: r.verdict, unit: r.unit, source_lang: draft.lang, pros: r.pros, cons: r.cons, problems: r.problems, ports_in: [], ports_out: [], features: [] }));
        if (blocks.length === 1) {
          const quotes = [...blocks[0].pros, ...blocks[0].cons, ...blocks[0].problems].map((p) => p.quote);
          const qEl = box.querySelector(".bot-quotes");
          qEl.hidden = !quotes.length;
          qEl.innerHTML = `<b>${esc(t("bot_quotes"))}</b><ul>${quotes.map((q) => `<li>“${esc(q)}”</li>`).join("")}</ul>`;
          apply({ block: blocks[0] }, link);
          st.textContent = t("bot_done");
        } else {
          showManyReviews(box, item, blocks, link);
          st.textContent = t("bot_many_found", { n: blocks.length });
        }
        return;
      }
      const quotes = draft.quotes ?? [...(draft.in ?? []), ...(draft.out ?? []), ...(draft.features ?? []), ...(draft.facts ?? [])].map((x) => x.quote);
      const qEl = box.querySelector(".bot-quotes");
      qEl.hidden = !quotes.length;
      qEl.innerHTML = `<b>${esc(t("bot_quotes"))}</b><ul>${quotes.map((q) => `<li>“${esc(q)}”</li>`).join("")}</ul>`;
      apply(draft, link);
      st.textContent = t("bot_done");
    } catch (e) {
      const code = e.message;
      const msg = t(`bot_err_${code}`) === `bot_err_${code}` ? `${t("bot_err_unavailable")} (${code})` : t(`bot_err_${code}`);
      st.textContent = e.detail ? `${msg} · ${e.detail}` : msg;
    }
  });
}

// ---------------------------------------------------------------------------
// Ports (item page): what plugs in and out, from store lines and from users
// who checked the back panel with a photo. Not listed ≠ not there.

const PORT_KEYS = ["usb", "coax", "optical", "aes", "bt", "rca", "xlr", "line"];
const FEATURE_KEYS = ["uac1", "nos", "asio", "roon", "airplay", "spotify", "tidal", "upnp", "chromecast"];
// Glossary page for each switch or protocol.
const FEATURE_TERM = { uac1: "uac1", nos: "nos", asio: "wasapi", roon: "streaming", airplay: "streaming", spotify: "streaming", tidal: "streaming", upnp: "streaming", chromecast: "streaming" };

function rearSearch(i) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${displayName(i)} rear panel`)}`;
}

async function renderPorts(el, item) {
  if (!el) return;
  const head = `<h3>${esc(t("po_title"))}</h3><p class="muted small">${esc(t("po_lead"))}</p>`;
  el.innerHTML = `${head}<p class="muted small">${esc(t("cm_loading"))}</p>`;
  const reports = Object.values(await community.portsFor(idsOf(item))).flat();
  const s = await community.session();
  const profile = s ? await community.myProfile() : null;
  if (!el.isConnected) return;

  const users = (dir, k) => reports.filter((r) => (dir === "f" ? r.features : r[dir])?.includes(k));
  const chip = (dir, k) => {
    const store = dir === "f" ? item.features?.[k] : item.ports?.[dir]?.[k];
    const u = users(dir, k);
    if (!store && !u.length) return "";
    const label = dir === "f" ? t(`po_f_${k}`) : t(`po_${k}`);
    const bits = [];
    if (store) bits.push(`<a href="${esc(store.url)}" target="_blank" rel="noopener" title="${esc(store.quote)}">${esc(t("po_store"))}</a>`);
    if (u.length) bits.push(`<a href="${esc(u[0].evidence_url)}" target="_blank" rel="noopener">${esc(t("po_users", { n: u.length }))}</a>`);
    const learn = dir === "f" ? ` <a href="#learn/${FEATURE_TERM[k]}" title="${esc(t("nav_learn"))}">?</a>` : "";
    return `<span class="port-chip">${esc(label)}${learn} <span class="muted small">${bits.join(" · ")}</span></span>`;
  };
  const row = (dir, title) => {
    const chips = (dir === "f" ? FEATURE_KEYS : PORT_KEYS).map((k) => chip(dir, k)).filter(Boolean).join("");
    return `<div class="port-row"><b class="small">${esc(title)}</b><div>${chips || `<span class="muted small">${esc(t("po_none"))}</span>`}</div></div>`;
  };
  const box = (name, keys, prefix) =>
    `<fieldset><legend class="small">${esc(t(name))}</legend>${keys.map((k) => `<label class="check small"><input type="checkbox" name="${prefix}" value="${k}"> ${esc(t(prefix === "f" ? `po_f_${k}` : `po_${k}`))}</label>`).join("")}</fieldset>`;
  const form = !s
    ? `<p class="small muted">${esc(t("po_signin"))}</p>`
    : !profile?.display_name
      ? `<p class="small muted">${esc(t("pr_need_name"))}</p>`
      : `<details class="port-add"><summary class="pill">${esc(t("po_add"))}</summary>
        <form data-form="ports" class="port-form">
          <p class="small muted">${esc(t("po_add_help"))} <a href="${esc(rearSearch(item))}" target="_blank" rel="noopener">${esc(t("sq_rear"))} ↗</a></p>
          ${botBox("ports")}
          ${box("po_in", PORT_KEYS, "in")}${box("po_out", PORT_KEYS.filter((k) => k !== "bt"), "out")}${box("po_switches", FEATURE_KEYS, "f")}
          <div class="row-inline"><label class="pill"><input type="file" name="shot" accept="image/*" hidden>${esc(t("po_pick"))}</label><span class="muted small" data-shot-state></span></div>
          <input class="search" name="ev_link" type="url" pattern="https://.+" placeholder="${esc(t("po_or_link"))}">
          <input class="search" name="note" maxlength="300" placeholder="${esc(t("po_note_ph"))}">
          <button class="pill primary">${esc(t("ds_send"))}</button><p class="small status" role="status"></p>
        </form></details>`;
  el.innerHTML = `${head}${row("in", t("po_in"))}${row("out", t("po_out"))}${row("f", t("po_switches"))}
    <p class="small"><a href="${esc(rearSearch(item))}" target="_blank" rel="noopener">${esc(t("po_check_photos"))} ↗</a></p>${form}`;

  const f = el.querySelector('[data-form="ports"]');
  if (!f) return;
  const status = f.querySelector(".status");
  let shot = null;
  let botLink = "";
  wireBot(f, item, (d, link) => {
    const tick = (name, list, field) => list?.forEach((x) => { const cb = f.querySelector(`input[name="${name}"][value="${x[field]}"]`); if (cb) cb.checked = true; });
    tick("in", d.in, "port");
    tick("out", d.out, "port");
    tick("f", d.features, "feature");
    botLink = link;
  });
  f.shot.addEventListener("change", async () => {
    const file = f.shot.files[0];
    f.shot.value = "";
    if (!file) return;
    shot = await redactImage(file, t);
    f.querySelector("[data-shot-state]").textContent = shot ? t("pr_shot_ready", { kb: Math.round(shot.size / 1024) }) : "";
  });
  f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const vals = (n) => [...f.querySelectorAll(`input[name="${n}"]:checked`)].map((x) => x.value);
    const row = { item_id: item.id, ports_in: vals("in"), ports_out: vals("out"), features: vals("f"), note: f.note.value.trim() };
    if (!row.ports_in.length && !row.ports_out.length && !row.features.length) return (status.textContent = t("po_need_one"));
    const linkEvidence = (botLink || f.ev_link?.value || "").trim();
    if (!shot && !/^https:\/\/\S+$/.test(linkEvidence)) return (status.textContent = t("po_need_photo"));
    try {
      status.textContent = t("cm_loading");
      row.evidence_url = shot ? await community.uploadEvidence(shot) : linkEvidence;
      await community.addPorts(row);
      renderPorts(el, item);
    } catch (e) {
      status.textContent = e.message ?? String(e);
    }
  });
}

// ---------------------------------------------------------------------------
// "I own this" (item page): short owner reports, shown as counts with n.

const ANNOYANCES = ["heat", "app", "buttons", "gain", "cable", "driver", "connection", "battery", "noise", "size"];

async function renderOwners(el, item) {
  if (!el) return;
  const head = `<h3>${esc(t("ow_title"))}</h3><p class="muted small">${esc(t("ow_lead"))}</p>`;
  el.innerHTML = `${head}<p class="muted small">${esc(t("cm_loading"))}</p>`;
  const { ok, rows, summary } = await community.ownersFor(idsOf(item));
  const s = await community.session();
  const profile = s ? await community.myProfile() : null;
  if (!el.isConnected) return;
  if (!ok) {
    el.innerHTML = `${head}<p class="muted">${esc(t("cm_offline"))}</p>`;
    return;
  }
  const mine = s ? rows.find((r) => r.author === s.user.id) : null;
  const n = summary?.n ?? 0;
  const bar = (k, v, tone) => `<div class="ow-stat"><span>${esc(t(k))}</span><b class="${tone}">${v} / ${n}</b></div>`;
  const counts = {};
  for (const r of rows) for (const a of r.annoyances ?? []) counts[a] = (counts[a] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sumHtml = n
    ? `<div class="ow-sum">
        ${n < 5 ? `<p class="small warn-text">${esc(t("ow_few", { n }))}</p>` : ""}
        <div class="ow-stats">
          ${bar("ow_qc_ok", summary.qc_ok, "good")}${bar("ow_qc_faulty", summary.qc_faulty, summary.qc_faulty ? "bad" : "")}
          ${bar("ow_failed", summary.failed, summary.failed ? "bad" : "")}${bar("ow_again_yes", summary.again_yes, "good")}
          <div class="ow-stat"><span>${esc(t("ow_ease"))}</span><b>${summary.ease_avg} / 5</b></div>
          <div class="ow-stat"><span>${esc(t("ow_months"))}</span><b>${summary.months_avg}</b></div>
        </div>
        ${top.length ? `<p class="small">${esc(t("ow_top_annoy"))} ${top.map(([k, c]) => `<span class="tag">${esc(t(`ow_a_${k}`))} · ${c}</span>`).join(" ")}</p>` : ""}
      </div>`
    : `<p class="muted">${esc(t("ow_none"))}</p>`;
  const notes = rows.filter((r) => r.note || r.failure).slice(0, 20);
  const notesHtml = notes.length
    ? `<details class="ow-notes"><summary class="small">${esc(t("ow_read_notes", { n: notes.length }))}</summary><ul>${notes
        .map(
          (r) => `<li><span class="muted small">${esc(r.author_name || t("cm_user"))} · ${esc(t("ow_owned_for", { m: r.months_owned }))} · ${esc(t(`ow_again_${r.buy_again}`))}</span>
            ${r.failed ? `<p class="small bad">${esc(t("ow_failed_after", { m: r.failed_after ?? "?" }))}${r.failure ? `: ${esc(r.failure)}` : ""}</p>` : ""}
            ${r.note ? `<p>${esc(r.note)}</p>` : ""}</li>`,
        )
        .join("")}</ul></details>`
    : "";
  const radio = (name, vals, cur) => vals.map((v) => `<label class="check small"><input type="radio" name="${name}" value="${v}"${cur === v ? " checked" : ""} required> ${esc(t(`ow_${name}_${v}`))}</label>`).join("");
  const form = !s
    ? `<p class="small muted">${esc(t("ow_signin"))}</p>`
    : !profile?.display_name
      ? `<p class="small muted">${esc(t("pr_need_name"))}</p>`
      : `<details class="ow-add"${mine ? "" : ""}><summary class="pill">${esc(t(mine ? "ow_edit" : "ow_add"))}</summary>
        <form data-form="owner" class="ow-form">
          <label class="dfield"><span>${esc(t("ow_q_months"))}</span><input class="search num" name="months" type="number" min="0" max="240" required value="${mine?.months_owned ?? ""}"></label>
          <fieldset><legend class="small">${esc(t("ow_q_qc"))}</legend>${radio("qc", ["ok", "cosmetic", "faulty"], mine?.qc)}</fieldset>
          <fieldset><legend class="small">${esc(t("ow_q_failed"))}</legend>
            <label class="check small"><input type="checkbox" name="failed"${mine?.failed ? " checked" : ""}> ${esc(t("ow_q_failed_yes"))}</label>
            <label class="small">${esc(t("ow_q_failed_after"))} <input class="search num mini" name="failed_after" type="number" min="0" max="240" value="${mine?.failed_after ?? ""}"></label>
            <input class="search" name="failure" maxlength="200" placeholder="${esc(t("ow_q_failure_ph"))}" value="${esc(mine?.failure ?? "")}"></fieldset>
          <fieldset><legend class="small">${esc(t("ow_q_ease"))}</legend>${[1, 2, 3, 4, 5].map((v) => `<label class="check small"><input type="radio" name="ease" value="${v}"${mine?.ease === v ? " checked" : ""} required> ${v}</label>`).join("")}<span class="muted small">${esc(t("ow_ease_scale"))}</span></fieldset>
          <fieldset><legend class="small">${esc(t("ow_q_annoy"))}</legend>${ANNOYANCES.map((a) => `<label class="check small"><input type="checkbox" name="annoy" value="${a}"${mine?.annoyances?.includes(a) ? " checked" : ""}> ${esc(t(`ow_a_${a}`))}</label>`).join("")}</fieldset>
          <fieldset><legend class="small">${esc(t("ow_q_again"))}</legend>${radio("again", ["yes", "maybe", "no"], mine?.buy_again)}</fieldset>
          <textarea class="search" name="note" rows="3" maxlength="500" placeholder="${esc(t("ow_note_ph"))}">${esc(mine?.note ?? "")}</textarea>
          <div class="row-inline"><button class="pill primary">${esc(t(mine ? "cm_save" : "ds_send"))}</button>${mine ? `<button type="button" class="link small" data-ow-del="${mine.id}">${esc(t("cm_delete"))}</button>` : ""}</div>
          <p class="small status" role="status"></p>
        </form></details>`;
  el.innerHTML = `${head}${sumHtml}${notesHtml}${form}`;

  const f = el.querySelector('[data-form="owner"]');
  if (!f) return;
  const status = f.querySelector(".status");
  f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    try {
      status.textContent = t("cm_loading");
      await community.saveOwner({
        item_id: item.id,
        months_owned: Number(fd.get("months")),
        qc: fd.get("qc"),
        failed: !!fd.get("failed"),
        failed_after: fd.get("failed_after") === "" || !fd.get("failed") ? null : Number(fd.get("failed_after")),
        failure: fd.get("failed") ? String(fd.get("failure") ?? "").trim() : "",
        ease: Number(fd.get("ease")),
        annoyances: fd.getAll("annoy"),
        buy_again: fd.get("again"),
        note: String(fd.get("note") ?? "").trim(),
      });
      renderOwners(el, item);
    } catch (e) {
      status.textContent = `${t("cm_error")} ${e.message ?? e}`;
    }
  });
  f.querySelector("[data-ow-del]")?.addEventListener("click", async (ev) => {
    if (!confirm(t("ow_del_confirm"))) return;
    await community.deleteOwner(Number(ev.target.dataset.owDel));
    renderOwners(el, item);
  });
}

async function renderPaid(el, item) {
  if (!el) return;
  const head = `<h3>${esc(t("pr_title"))}</h3><p class="muted small">${esc(t("pr_disclaimer"))}</p>`;
  el.innerHTML = `${head}<p class="muted small">${esc(t("cm_loading"))}</p>`;
  const { ok, rows } = await community.pricesFor(idsOf(item));
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
  form.channel.addEventListener("change", () => (form.currency.value = CHANNEL_CURRENCY[form.channel.value] ?? cur()));
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
  if (termId) {
    const term = TERM.get(termId);
    if (!term) return `<div class="card empty"><p>${esc(t("it_not_found"))}</p></div>`;
    const c = L(term);
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
              .map((id) => `<a class="pill" href="#learn/${id}">${esc(L(TERM.get(id)).title)}</a>`)
              .join("")}</div></section>`
          : ""
      }
      ${term.refs.length ? `<section class="card pad"><h3>${esc(t("lr_refs"))}</h3><ul class="small">${term.refs.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)} ↗</a></li>`).join("")}</ul></section>` : ""}
      <p class="muted small">${esc(t("lr_fix"))} <a href="${REPO}/blob/main/src/glossary.js?v=mv5bfzie" target="_blank" rel="noopener">src/glossary.js ↗</a></p>
    </article>`;
  }
  return `<div class="learn">
    <header class="deal-head"><h1>${esc(t("nav_learn"))}</h1><p class="muted">${esc(t("lr_lead"))}</p></header>
    <section class="card pad"><h3>${esc(t("lr_glossary"))}</h3>
      <div class="gloss-grid">${TERMS.map((term) => {
        const c = L(term);
        return `<a class="gloss" href="#learn/${term.id}"><b>${esc(c.title)}</b><span class="muted small">${esc(c.short)}</span>${term.tool ? `<span class="tag">${esc(t("lr_has_tool"))}</span>` : ""}</a>`;
      }).join("")}</div>
    </section>
    <section class="card pad"><h3>${esc(t("lr_guide"))}</h3><article class="prose wide learn-guide">${L(LEARN)}</article></section>
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
  const rtf = new Intl.RelativeTimeFormat(state.lang, { numeric: "auto" });
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
    sug.innerHTML = hits.map((i) => `<button type="button" data-pick-item="${esc(i.id)}">${esc(displayName(i))} <span class="muted small">${esc(catLabel(i))}</span></button>`).join("");
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
      return `<a class="aside-item" href="#item/${encodeURIComponent(i.id)}">${im ? `<img src="${esc(sized(im.src, 160))}" alt="" referrerpolicy="no-referrer">` : "<span></span>"}<div><b>${esc(displayName(i))}</b><div class="muted small">${esc(catLabel(i))}${pr ? ` · ${priceTag(pr.price, pr.currency)}` : ""}</div></div></a>`;
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
  watchSection(el, async () => {
    const res = await community.getThread(id);
    return res.ok ? `${res.thread?.id}:${res.comments.map((c) => c.id).join()}` : null;
  }, load);
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
  const panels = {
    threads: list(a.threads, (r) => `<li><a href="#discuss/${r.id}">${esc(r.title)}</a> <span class="muted small">· ${esc(t(`dc_${r.category}`))} · ▲ ${r.score} · ${esc(t("ds_n_comments", { n: r.comment_count }))} · ${esc(ago(r.created_at))}</span></li>`),
    comments: list(a.comments, (r) => `<li><a href="#discuss/${r.thread_id}">${esc(r.body.slice(0, 120))}${r.body.length > 120 ? "…" : ""}</a> <span class="muted small">· ▲ ${r.score} · ${esc(ago(r.created_at))}</span></li>`),
    reports: list(a.reports, (r) => `<li>${itemLink(r.item_id)}: ${esc(r.title)} <span class="muted small">· ${esc(t(`cm_kind_${r.kind}`))} · ${esc(t("cm_metoo"))} ${r.confirms} · ${esc(ago(r.created_at))}</span></li>`),
    prices: list(a.prices, (r) => `<li>${itemLink(r.item_id)}: ${money(r.amount, r.currency)} <span class="muted small">· ${esc(t(`ch_${r.channel}`))} · ${esc(day(r.paid_on))}</span></li>`),
  };
  // Only tabs with something in them; the first non-empty one opens.
  const tabs = [
    ["threads", t("ac_threads"), a.threads.length],
    ["comments", t("ac_comments"), a.comments.length],
    ["reports", t("ac_reports"), a.reports.length],
    ["prices", t("ac_prices"), a.prices.length],
  ].filter(([, , n]) => n);
  const total = tabs.length;
  const firstTab = tabs[0]?.[0];
  el.innerHTML = `
    <section class="card pad"><h3>${esc(t("ac_profile"))}</h3>
      <form class="cm-form" data-form="rename"><label class="dfield"><span>${esc(t("cm_name"))}</span>
        <div class="row-inline"><input class="search" name="name" required minlength="2" maxlength="40" value="${esc(profile.display_name)}"><button class="pill primary">${esc(t("cm_save"))}</button></div></label>
        <p class="muted small">${esc(t("ac_email", { email: a.email }))} · ${esc(t("ac_since", { date: day(a.since) }))}</p><p class="small status" role="status"></p></form>
      <div class="row-inline"><button type="button" class="pill" data-signout>${esc(t("cm_signout"))}</button></div>
    </section>
    <section class="card pad"><h3>${esc(t("ac_activity"))}</h3>
      ${
        total
          ? `<div class="seg-links act-tabs">${tabs.map(([k, label, n]) => `<a href="#account" data-tab="${k}" class="${k === firstTab ? "on" : ""}">${esc(label)} · ${n}</a>`).join("")}</div>
            ${tabs.map(([k]) => `<div data-panel="${k}"${k === firstTab ? "" : " hidden"}>${panels[k]}</div>`).join("")}`
          : `<p class="muted">${esc(t("ac_empty"))}</p><div class="row-inline"><a class="pill" href="#discuss/new">${esc(t("ac_start_thread"))}</a><a class="pill" href="#catalog">${esc(t("ac_start_report"))}</a></div>`
      }
    </section>
    <details class="card pad danger-zone"><summary class="small muted">${esc(t("ac_delete_h"))}</summary><p class="small">${esc(t("ac_delete_what"))}</p>
      <div class="row-inline"><button type="button" class="pill" data-delete-account>${esc(t("ac_delete"))}</button></div><p class="small status" role="status"></p></details>`;
  el.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", (ev) => {
      ev.preventDefault();
      el.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
      el.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
    }),
  );
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
    const st = ev.target.closest(".danger-zone").querySelector(".status");
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
            <div class="tile-body"><div class="tile-name">${esc(displayName(i))}</div><div class="muted small">${esc(catLabel(i))}</div><div class="tile-price">${pr ? priceTag(pr.price, pr.currency) : "—"}</div></div></a>`;
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
    ...(REGIONS[state.region]?.local ?? []).map(([label, pattern]) => [label, g(pattern.replace("{n}", n))]),
    ...(state.region !== "th" && state.lang === "th" ? [["ดีไหม", g(`${n} ดีไหม`)], ["Pantip", g(`${n} site:pantip.com`)]] : []),
    ...(state.lang === "zh" ? [["怎么样", g(`${n} 怎么样`)], ["什么值得买", g(`${n} site:smzdm.com`)]] : []),
    ["Reddit", g(`${n} site:reddit.com`)],
    ["Head-Fi", g(`${n} site:head-fi.org`)],
    // Measurements: many reviewers each run a squig.link graph site; search finds which ones have this model.
    ...(HEADPHONE_CATS.has(i.category) ? [[t("sq_squig"), g(`${n} site:squig.link`)]] : []),
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
    sug.innerHTML = hits.map((i) => `<button type="button" data-add="${esc(i.id)}">${esc(displayName(i))} <span class="muted small">${esc(catLabel(i))}</span></button>`).join("");
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
  const cheapest = Math.min(...items.map((i) => usdOf(prices(i).cheapest)));
  const rows = [
    row(t("cmp_type"), (i) => esc(catLabel(i))),
    row(t("col_price"), (i) => {
      const p = prices(i).cheapest;
      return p ? `<b class="${usdOf(p) === cheapest ? "best" : ""}">${priceTag(p.price, p.currency)}</b> <span class="muted small">· ${esc(t("stores", { n: new Set(i.offers.map((o) => o.store)).size }))}</span>` : null;
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
// Stores whose first photo is a product shot on a plain background come first;
// big hi-fi shops often lead with a room or lifestyle photo.
const PHOTO_LAST = new Set(["a2a", "audioadvice", "moon", "hifiheadphones", "headphonezone", "zeppelin", "kitsune"]);
function imageOf(i) {
  const offers = (i.offers ?? []).filter((x) => x.image && !x.suspect);
  const o = offers.find((x) => !PHOTO_LAST.has(x.store)) ?? offers[0];
  if (o) return { src: o.image, url: o.url, store: o.store };
  // Hand-checked models no tracked store sells: the maker's own photo.
  return i.image ? { src: i.image.src, url: i.image.page, store: i.image.site } : null;
}
/** Shopify CDN resizes on request; other hosts ignore the parameter. */
function sized(src, w) {
  return /cdn\.shopify\.com|\/cdn\/shop\//.test(src) ? `${src}${src.includes("?") ? "&" : "?"}width=${w}` : src;
}
function specLine(i) {
  const z = i.specs?.impedance?.[0];
  const s = i.specs?.sensitivity?.[0];
  if (HEADPHONE_CATS.has(i.category)) return [z && `${fmt(z.value, 1)} Ω`, s && `${fmt(s.value, 1)} ${s.unit ?? t("unit_dB_unknown")}`].filter(Boolean).join(" · ");
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
/** A store price in its own currency, then about how much that is in the reader's currency. */
function priceTag(n, currency) {
  const to = viewCur();
  const c = currency || "USD";
  const conv = c === to ? null : convert(n, c, to);
  return `${money(n, c)}${conv == null ? "" : ` <span class="fx" title="${esc(t("fx_note", { date: db.fx?.date ?? "" }))}">≈ ${money(conv, to)}</span>`}`;
}
// Auto-refresh, like GitHub's: every deploy (new prices or fixes) changes the
// ?v= stamp in index.html. Check it every few minutes and when the tab comes
// back. A tab nobody is looking at, with nothing typed in it, just reloads;
// otherwise a bar offers the reload, so no one loses what they typed.
const BUILD = new URL(import.meta.url).searchParams.get("v");
function watchForUpdates() {
  if (!BUILD) return;
  let newer = false;
  const typed = () => [...document.querySelectorAll("input, textarea")].some((el) => el.type !== "checkbox" && el.type !== "radio" && el.value !== el.defaultValue);
  const act = () => {
    if (!newer) return;
    if (document.hidden && !typed()) return location.reload();
    if (document.getElementById("update-bar")) return;
    const bar = document.createElement("div");
    bar.id = "update-bar";
    bar.setAttribute("role", "status");
    bar.innerHTML = `<span>${esc(t("upd_msg"))}</span><button type="button" class="pill primary">${esc(t("upd_btn"))}</button><button type="button" class="link" aria-label="${esc(t("upd_close"))}">×</button>`;
    bar.querySelector(".primary").addEventListener("click", () => location.reload());
    bar.querySelector(".link").addEventListener("click", () => bar.remove());
    document.body.append(bar);
  };
  const check = async () => {
    if (newer) return act();
    try {
      const html = await (await fetch(`index.html?check=${Date.now()}`, { cache: "no-store" })).text();
      const live = html.match(/src\/app\.js\?v=(\w+)/)?.[1];
      if (live && live !== BUILD) newer = true;
    } catch {
      /* offline: try again later */
    }
    act();
  };
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
}
// New posts and comments while a page stays open: check every 90 seconds and
// when the tab comes back. A section nobody is typing in refreshes itself;
// one with a draft or an open form gets a "new posts" button instead.
function watchSection(el, signature, rerender) {
  if (!el) return;
  let last;
  const busy = () =>
    el.contains(document.activeElement) && document.activeElement !== document.body ||
    [...el.querySelectorAll("input, textarea")].some((x) => x.type !== "checkbox" && x.type !== "radio" && x.value !== x.defaultValue);
  const tick = async () => {
    if (!el.isConnected) return stop();
    if (document.hidden) return;
    const sig = await signature().catch(() => null);
    if (sig == null || !el.isConnected) return;
    if (last === undefined) return void (last = sig);
    if (sig === last) return;
    last = sig;
    if (!busy()) return rerender();
    if (el.querySelector(".new-posts")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pill new-posts";
    b.textContent = t("cm_new_posts");
    b.addEventListener("click", rerender);
    el.prepend(b);
  };
  const onVis = () => !document.hidden && tick();
  const timer = setInterval(tick, 90 * 1000);
  document.addEventListener("visibilitychange", onVis);
  function stop() {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  }
  setTimeout(tick, 5000); // remember what the page showed
}
function money(n, currency) {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat(loc(), { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${fmt(n, 0)} ${currency ?? ""}`;
  }
}
function fmt(n, d) {
  return Number(n).toLocaleString(loc(), { maximumFractionDigits: d });
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
watchForUpdates();
addEventListener("hashchange", () => {
  readHash();
  render();
});
