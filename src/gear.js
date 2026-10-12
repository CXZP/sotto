// Generic line drawings of each kind of gear, for a box with no usable photo
// (none tracked, or a store that doesn't let other sites load it). 96×96,
// drawn in `currentColor` unless a colour is passed (a canvas has no CSS).

const PATHS = {
  turntable: `<rect x="8" y="30" width="80" height="44" rx="6"/><circle cx="40" cy="52" r="17"/><circle cx="40" cy="52" r="3"/><path d="M74 36v22l-14 6"/><circle cx="74" cy="36" r="3"/>`,
  cd: `<rect x="8" y="34" width="80" height="30" rx="5"/><path d="M16 44h30"/><rect x="56" y="42" width="20" height="8" rx="2"/><circle cx="20" cy="56" r="2"/><circle cx="28" cy="56" r="2"/>`,
  box: `<rect x="10" y="34" width="76" height="30" rx="5"/><rect x="18" y="42" width="22" height="10" rx="2"/><circle cx="70" cy="49" r="7"/><path d="M48 56h8"/>`,
  amp: `<rect x="8" y="28" width="80" height="40" rx="6"/><circle cx="26" cy="48" r="9"/><circle cx="70" cy="48" r="9"/><path d="M42 42h12M42 50h12"/><path d="M14 68v6M82 68v6"/>`,
  phono: `<rect x="18" y="36" width="60" height="26" rx="5"/><circle cx="34" cy="49" r="5"/><circle cx="62" cy="49" r="5"/><path d="M46 44v10"/>`,
  speaker: `<rect x="26" y="10" width="44" height="76" rx="6"/><circle cx="48" cy="58" r="14"/><circle cx="48" cy="58" r="4"/><circle cx="48" cy="28" r="7"/>`,
  headphone: `<path d="M20 58V48a28 28 0 0 1 56 0v10"/><rect x="12" y="54" width="16" height="26" rx="6"/><rect x="68" y="54" width="16" height="26" rx="6"/>`,
  iem: `<path d="M30 26c-10 0-16 8-16 16s6 16 16 16c8 0 12-6 12-14"/><circle cx="30" cy="42" r="6"/><path d="M66 26c10 0 16 8 16 16s-6 16-16 16c-8 0-12-6-12-14"/><circle cx="66" cy="42" r="6"/><path d="M30 58c0 14 8 22 18 26M66 58c0 14-8 22-18 26"/>`,
  wireless: `<rect x="24" y="44" width="48" height="34" rx="14"/><path d="M24 58h48"/><circle cx="48" cy="66" r="2"/><path d="M36 30c4-4 8-6 12-6s8 2 12 6M42 36c2-2 4-3 6-3s4 1 6 3"/>`,
  dongle: `<rect x="36" y="22" width="24" height="44" rx="6"/><path d="M48 66v10M44 76h8M48 22V12"/><circle cx="48" cy="34" r="3"/>`,
  portable: `<rect x="28" y="14" width="40" height="68" rx="7"/><circle cx="48" cy="58" r="10"/><path d="M38 28h20"/>`,
  dap: `<rect x="28" y="10" width="40" height="76" rx="7"/><rect x="34" y="18" width="28" height="34" rx="3"/><circle cx="48" cy="68" r="8"/>`,
  cartridge: `<path d="M30 30h36l-6 30H36z"/><path d="M48 60v12M44 72h8"/><path d="M36 38h24"/>`,
  power: `<rect x="18" y="32" width="50" height="34" rx="5"/><path d="M68 49h10c4 0 6 4 6 8v14"/><path d="M38 40l-6 10h10l-6 10"/>`,
  phone: `<rect x="30" y="10" width="36" height="76" rx="7"/><path d="M42 18h12M44 78h8"/>`,
  computer: `<rect x="14" y="18" width="68" height="44" rx="4"/><path d="M8 74h80l-6-12H14z"/>`,
  tv: `<rect x="8" y="18" width="80" height="50" rx="4"/><path d="M36 80h24M48 68v12"/>`,
};

/** Which drawing fits a desk node ({device} or {item}). */
export function gearKind(node) {
  if (node.device) return PATHS[node.device] ? node.device : "box";
  const i = node.item;
  if (i.category === "desktop") return ["integrated", "poweramp", "amp", "dacamp"].includes(i.role) ? "amp" : "box";
  return PATHS[i.category] ? i.category : "box";
}

/** The drawing as an inline SVG string. */
export function gearSvg(kind, color = "currentColor") {
  return `<svg class="gear-ic" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[kind] ?? PATHS.box}</svg>`;
}
