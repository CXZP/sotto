// One highlight behind the nav links that glides to the link under the pointer and back to
// the current page's link when the pointer leaves (after Clay's header, where the menu panel
// morphs from one size to the next instead of jumping). It grows in from smaller the first
// time it appears.

export function navPill(nav) {
  const pill = document.createElement("span");
  pill.className = "nav-pill";
  pill.setAttribute("aria-hidden", "true");
  nav.prepend(pill);
  let shown = false;
  const place = (a, instant) => {
    if (!a) {
      pill.classList.remove("on");
      shown = false;
      return;
    }
    const jump = instant || !shown;
    if (jump) pill.style.transition = "none";
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
    pill.style.width = `${a.offsetWidth}px`;
    if (jump) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
    pill.classList.add("on");
    shown = true;
  };
  const active = () => nav.querySelector("a.active");
  nav.addEventListener("pointerover", (e) => {
    const a = e.target.closest("a");
    if (a) place(a);
  });
  nav.addEventListener("pointerleave", () => place(active()));
  nav.addEventListener("focusin", (e) => place(e.target.closest("a")));
  nav.addEventListener("focusout", () => place(active()));
  // Link widths change with the language and when the fonts arrive: re-measure in place.
  // (After a click the pill is already over the new page's link, so no glide is lost.)
  const sync = () => place(active(), true);
  new ResizeObserver(sync).observe(nav);
  document.fonts?.ready.then(sync);
  return { sync };
}
