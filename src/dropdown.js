// Dropdowns in Sotto's own style instead of the browser's list: every <select> gets a button
// that shows the chosen option, and a rounded menu that opens under it (Clay's menus: white
// panel, soft shadow, hover rows). The <select> stays in the page, hidden, and still holds the
// value: picking sets it and fires "change", so every existing handler keeps working.
// Touch screens keep the phone's own picker, which is better there.

const LONG = 20; // lists longer than this get a filter box

export function enhanceDropdowns(root = document) {
  if (matchMedia("(pointer: coarse)").matches) return;
  const run = (scope) => scope.querySelectorAll?.("select:not([multiple]):not([data-dd])").forEach(enhance);
  run(root);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches?.("select") ? enhance(n) : run(n))))).observe(root.body ?? root, { childList: true, subtree: true });
}

let open = null; // { sel, btn, menu }

function label(sel) {
  const o = sel.options[sel.selectedIndex];
  return o ? o.textContent : "";
}

function enhance(sel) {
  if (sel.dataset.dd || sel.closest("[data-no-dd]")) return;
  sel.dataset.dd = "1";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `dd-btn ${sel.className}`.trim();
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  const name = sel.getAttribute("aria-label") || sel.labels?.[0]?.textContent?.trim();
  if (name) btn.setAttribute("aria-label", `${name}: ${label(sel)}`);
  btn.innerHTML = `<span class="dd-val"></span>`;
  const sync = () => {
    btn.querySelector(".dd-val").textContent = label(sel);
    btn.disabled = sel.disabled;
  };
  sync();
  sel.classList.add("dd-native");
  sel.tabIndex = -1;
  sel.setAttribute("aria-hidden", "true");
  sel.after(btn);
  sel.addEventListener("change", sync);
  // Code that sets .value directly fires no event: re-read on each open and now and then.
  sel._ddSync = sync;
  btn.addEventListener("pointerenter", sync);
  btn.addEventListener("click", () => (open?.sel === sel ? close() : show(sel, btn)));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show(sel, btn);
    }
  });
}

function show(sel, btn) {
  close();
  sel._ddSync?.();
  const menu = document.createElement("div");
  menu.className = "dd-menu";
  menu.setAttribute("role", "listbox");
  const opts = [...sel.options];
  const long = opts.length > LONG;
  menu.innerHTML = `${long ? `<input class="dd-filter" type="search" autocomplete="off" aria-label="Filter">` : ""}<div class="dd-list">${opts
    .map((o, i) => (o.hidden ? "" : `<div class="dd-opt" role="option" data-i="${i}" aria-selected="${i === sel.selectedIndex}"${o.disabled ? ' aria-disabled="true"' : ""}>${escape(o.textContent)}</div>`))
    .join("")}</div>`;
  document.body.append(menu);
  // Place under the button (or above it when there is no room below), never off screen.
  const r = btn.getBoundingClientRect();
  const width = Math.max(r.width, Math.min(menu.scrollWidth + 4, 360));
  const below = innerHeight - r.bottom - 12;
  const up = below < 220 && r.top > below;
  menu.style.minWidth = `${width}px`;
  menu.style.left = `${Math.min(Math.max(8, r.left), innerWidth - width - 8)}px`;
  menu.style.maxHeight = `${Math.min(420, (up ? r.top : below) - 12)}px`;
  if (up) menu.style.bottom = `${innerHeight - r.top + 6}px`;
  else menu.style.top = `${r.bottom + 6}px`;
  menu.classList.toggle("up", up);
  btn.setAttribute("aria-expanded", "true");
  open = { sel, btn, menu };
  const items = () => [...menu.querySelectorAll(".dd-opt:not([hidden]):not([aria-disabled])")];
  let at = Math.max(0, items().findIndex((x) => x.getAttribute("aria-selected") === "true"));
  const focusAt = (n) => {
    const list = items();
    if (!list.length) return;
    at = (n + list.length) % list.length;
    list.forEach((x, k) => x.classList.toggle("on", k === at));
    list[at].scrollIntoView({ block: "nearest" });
  };
  focusAt(at);
  const pick = (el) => {
    const i = Number(el.dataset.i);
    if (i !== sel.selectedIndex) {
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    sel._ddSync?.();
    close(true);
  };
  menu.addEventListener("pointermove", (e) => {
    const el = e.target.closest(".dd-opt:not([aria-disabled])");
    if (el) focusAt(items().indexOf(el));
  });
  menu.addEventListener("click", (e) => {
    const el = e.target.closest(".dd-opt:not([aria-disabled])");
    if (el) pick(el);
  });
  const filter = menu.querySelector(".dd-filter");
  filter?.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase();
    menu.querySelectorAll(".dd-opt").forEach((x) => (x.hidden = q && !x.textContent.toLowerCase().includes(q)));
    focusAt(0);
  });
  let typed = "";
  let typedAt = 0;
  menu._key = (e) => {
    if (e.key === "Escape") return e.preventDefault(), close(true);
    if (e.key === "ArrowDown") return e.preventDefault(), focusAt(at + 1);
    if (e.key === "ArrowUp") return e.preventDefault(), focusAt(at - 1);
    if (e.key === "Enter") return e.preventDefault(), items()[at] && pick(items()[at]);
    if (e.key === "Tab") return close();
    // Type to jump, as in a native list.
    if (!filter && e.key.length === 1) {
      typed = performance.now() - typedAt > 700 ? e.key : typed + e.key;
      typedAt = performance.now();
      const k = items().findIndex((x) => x.textContent.toLowerCase().startsWith(typed.toLowerCase()));
      if (k >= 0) focusAt(k);
    }
  };
  document.addEventListener("keydown", menu._key, true);
  (filter ?? btn).focus({ preventScroll: true });
  requestAnimationFrame(() => menu.classList.add("in"));
}

function close(refocus) {
  if (!open) return;
  const { btn, menu } = open;
  document.removeEventListener("keydown", menu._key, true);
  menu.remove();
  btn.setAttribute("aria-expanded", "false");
  if (refocus) btn.focus({ preventScroll: true });
  open = null;
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

document.addEventListener("pointerdown", (e) => {
  if (open && !open.menu.contains(e.target) && !open.btn.contains(e.target)) close();
});
addEventListener("resize", () => close());
addEventListener("scroll", (e) => open && !open.menu.contains(e.target) && close(), true);
addEventListener("hashchange", () => close());
