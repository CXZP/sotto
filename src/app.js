import { powerCheck, outputImpedanceCheck, bestConnection, deviceToDac, headphoneSpecs, required, JACKS } from "./calc.js";
import { loadData, hpModel, sourceOutputs, evaluate, prices, displayName, HEADPHONE_CATS, SOURCE_CATS } from "./data.js";
import { renderChart } from "./chart.js";
import { makeT } from "./i18n.js";
import { LEARN, aboutPage, REPO } from "./content.js";
import * as community from "./community.js";

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
    a.classList.toggle("active", a.dataset.route === r.name || (r.name === "item" && a.dataset.route === "catalog"));
  });
  setSeg("[data-lang]", "lang", state.lang);
  setSeg("[data-mode]", "mode", state.mode);
  document.querySelector("[data-mode=simple]").textContent = t("mode_simple");
  document.querySelector("[data-mode=detail]").textContent = t("mode_detail");
  const date = new Date(db.builtAt).toLocaleDateString(state.lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  document.querySelector("footer .foot").innerHTML = `${esc(t("updated", { date, stores: Object.keys(db.stores).length, n: fmt(db.items.length, 0) }))}<br>${esc(t("footer"))} · <a href="${REPO}" target="_blank" rel="noopener">GitHub</a>`;
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
  else if (r.name === "learn") main.innerHTML = `<article class="prose">${LEARN[state.lang]}</article>`;
  else if (r.name === "about") main.innerHTML = `<article class="prose about">${aboutPage(state.lang, sourceSites(), db.stores)}</article>`;
  else main.innerHTML = buildPage();
  wire(main, r);
  scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------------
// Build page

function currentSource() {
  const device = db.devices.find((d) => d.id === state.device) ?? db.devices[0];
  const amp = state.amp ? db.byId.get(state.amp) : null;
  const outputs = amp ? sourceOutputs(amp) : device.outputs;
  return { device, amp, outputs, label: amp ? displayName(amp) : device.name[state.lang] };
}

function buildPage() {
  const { device, amp } = currentSource();
  const hp = state.hp ? db.byId.get(state.hp) : null;
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
  return `<div class="picked">
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
  return [verdictCard(ev, hp, detail), conn.html, reverseCard(hp, level)].join("");
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

function verdictCard(ev, hp, detail) {
  const [tone, key, subKey] = VERDICT[ev.status] ?? VERDICT.unknown;
  let sub = subKey ? t(subKey) : "";
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

function drawChart(el, outputs, srcLabel, highlightId) {
  const level = LEVELS[state.level] ?? LEVELS.normal;
  const peak = level + CREST;
  const counts = { ok: 0, overkill: 0, tight: 0, insufficient: 0 };
  const points = [];
  for (const h of headphones) {
    const m = hpModel(h);
    if (!m.unitKnown) continue; // position would be a guess; listed, not plotted
    const { ohms, dbPerV } = headphoneSpecs(m);
    const ev = evaluate(h, outputs, { level, crest: CREST });
    const st = ev.status === "overkill" ? "overkill" : statusKey(ev.status);
    if (counts[st] !== undefined) counts[st]++;
    points.push({ id: h.id, label: displayName(h), z: ohms, v: required(peak, dbPerV, ohms).vrms, status: st, highlight: h.id === highlightId });
  }
  el.innerHTML = `<h3>${esc(t("chart_title"))}</h3><p class="sub">${esc(t("chart_sub", { src: srcLabel, peak }))}</p><div class="chart-host"></div>
    <p class="hint">${esc(t("chart_count", { n: points.length, ok: counts.ok, over: counts.overkill, tight: counts.tight, bad: counts.insufficient }))}</p>`;
  renderChart(el.querySelector(".chart-host"), {
    curves: mergeCurves(outputs, srcLabel),
    points,
    labels: { x: t("chart_x"), y: t("chart_y"), need: t("chart_need"), aria: t("chart_aria"), ok: t("st_ok"), overkill: t("st_overkill"), tight: t("st_tight"), insufficient: t("st_insufficient"), ambiguous: t("st_ambiguous") },
    fmt: { z: (z) => `${fmt(z, 1)} Ω`, v: vfmt },
    onPick: (id) => {
      state.hp = id;
      state.plug = "";
      go(buildUrl());
    },
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
      .filter((i) => (!only.checked || usable.has(i.id)) && (!q || `${i.brand} ${i.model}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(usable.has(b.id)) - Number(usable.has(a.id)) || Number(!!b.curated) - Number(!!a.curated) || b.offers.length - a.offers.length)
      .slice(0, 80);
    list.innerHTML = res
      .map((i) => {
        const p = prices(i).cheapest;
        return `<li><button data-id="${esc(i.id)}"><span class="pn">${esc(displayName(i))}</span><span class="pm">${esc(t(`cat_${i.category}`))} · ${esc(specLine(i) || "—")}</span><span class="pp">${p ? money(p.price, p.currency) : ""}</span></button></li>`;
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
  const cats = ["all", "iem", "headphone", "dongle", "desktop", "dap"];
  const res = db.items.filter(
    (i) =>
      (cat === "all" || i.category === cat) &&
      (!q || `${i.brand} ${i.model}`.toLowerCase().includes(q)) &&
      (!specsOnly || hpModel(i) || sourceOutputs(i).length) &&
      (!stockOnly || i.offers.some((o) => o.available)),
  );
  res.sort((a, b) => Number(!!b.curated) - Number(!!a.curated) || b.offers.length - a.offers.length || a.id.localeCompare(b.id));
  const link = (over) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(over)) v === null ? n.delete(k) : n.set(k, v);
    return `#catalog?${n}`;
  };
  return `<div class="catalog">
    <div class="filters">
      <input class="search" type="search" id="cq" placeholder="${esc(t("search"))}" value="${esc(p.get("q") ?? "")}">
      <div class="chips">${cats.map((c) => `<a class="chip${c === cat ? " on" : ""}" href="${link({ cat: c, n: null })}">${esc(t(`cat_${c}`))}</a>`).join("")}</div>
      <div class="chips">
        <a class="chip${specsOnly ? " on" : ""}" href="${link({ specs: specsOnly ? null : "1", n: null })}">${esc(t("only_specs"))}</a>
        <a class="chip${stockOnly ? " on" : ""}" href="${link({ stock: stockOnly ? null : "1", n: null })}">${esc(t("only_stock"))}</a>
      </div>
      <span class="muted small">${esc(t("n_results", { n: fmt(res.length, 0) }))}</span>
    </div>
    <div class="table-wrap card"><table class="cat-table">
      <thead><tr><th>${esc(t("col_product"))}</th><th>${esc(t("col_imp"))}</th><th>${esc(t("col_sens"))} / ${esc(t("col_power"))}</th><th>${esc(t("col_price"))}</th><th>${esc(t("col_stores"))}</th></tr></thead>
      <tbody>${res
        .slice(0, limit)
        .map((i) => {
          const pr = prices(i);
          const stores = new Set(i.offers.map((o) => o.store)).size;
          return `<tr><td><a href="#item/${encodeURIComponent(i.id)}" class="strong">${esc(displayName(i))}</a><div class="muted small">${esc(t(`cat_${i.category}`))}${i.curated ? ` · ${esc(t("it_checked"))}` : ""}</div></td>
          <td>${i.specs?.impedance ? `${fmt(i.specs.impedance[0].value, 1)} Ω` : "—"}</td>
          <td>${sensOrPower(i)}</td>
          <td>${pr.cheapest ? money(pr.cheapest.price, pr.cheapest.currency) : "—"}</td>
          <td>${stores || "—"}</td></tr>`;
        })
        .join("")}</tbody></table></div>
    ${res.length > limit ? `<div class="more"><a class="pill" href="${link({ n: limit + 120 })}">${esc(t("more"))}</a></div>` : ""}
  </div>`;
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

function itemPage(id) {
  const i = db.byId.get(id);
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
  return `<article class="item">
    <header class="item-head">
      <div><p class="muted">${esc(t(`cat_${i.category}`))}${i.curated ? ` · ${esc(t("it_checked"))}` : ""}${i.drivers ? ` · ${esc(i.drivers)}` : ""}</p>
      <h1>${esc(displayName(i))}</h1>
      ${pr.cheapest ? `<p class="price-big">${esc(t("price_from"))} ${money(pr.cheapest.price, pr.cheapest.currency)} <span class="muted">· ${esc(t("stores", { n: new Set(i.offers.map((o) => o.store)).size }))}</span></p>` : ""}</div>
      <div class="item-actions">${isHp || isSrc ? `<button class="pill primary" data-use="${esc(i.id)}" data-slot="${isHp ? "hp" : "amp"}">${esc(t("it_add_build"))}</button>` : ""}<a class="pill" href="https://shopee.co.th/search?keyword=${encodeURIComponent(displayName(i))}" target="_blank" rel="noopener">${esc(t("it_shopee"))}</a><a class="pill" href="${report}" target="_blank" rel="noopener">${esc(t("it_report"))}</a></div>
    </header>
    <div class="item-grid">
      <section class="card pad"><h3>${esc(t("it_specs"))}</h3>${specRows || powerRows ? specRows + powerRows : `<p class="muted">${esc(t("it_no_specs"))}</p>`}${notes ? `<ul class="notes">${notes}</ul>` : ""}</section>
      <section class="card pad"><h3>${esc(t("it_offers"))}</h3>${offersTable(pr.offers)}</section>
    </div>
    <section class="card pad community" id="community"></section>
    ${isHp && hpModel(i) ? `<div id="item-rev"></div>` : ""}
    ${isSrc && outs.length ? `<div class="card chart-card" id="chart"></div>` : ""}
  </article>`;
}

function offersTable(offers) {
  if (!offers.length) return `<p class="muted">—</p>`;
  return `<ul class="offers">${offers
    .map(
      (o) => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener" class="strong">${esc(db.stores[o.store]?.name ?? o.store)}</a>
      <span class="muted small">${esc(o.title)}${o.condition !== "new" ? ` · ${esc(t("cond_used"))}` : ""}</span>
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
    if (src.outputs.length) drawChart(main.querySelector("#chart"), src.outputs, src.label, state.hp);
    else main.querySelector("#chart").remove();
    warnBanner(main.querySelector("#warn-banner"), [state.amp, state.hp].filter(Boolean));
  }
  if (r.name === "item") {
    const i = db.byId.get(r.id);
    if (i && SOURCE_CATS.has(i.category) && sourceOutputs(i).length) drawChart(main.querySelector("#chart"), sourceOutputs(i), displayName(i), null);
    const rev = main.querySelector("#item-rev");
    if (rev) rev.outerHTML = reverseCard(i, LEVELS.normal);
    if (i) renderCommunity(main.querySelector("#community"), i);
  }
  if (r.name === "catalog") {
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
    </div></article>`;

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
addEventListener("hashchange", () => {
  readHash();
  render();
});
