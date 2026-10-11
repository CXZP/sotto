// Materials and looks, read from store text. Deterministic keyword rules,
// each match kept with the sentence it came from so the page can show why.
//
// A material only counts when the same sentence talks about the product's
// body (shell, faceplate, cavity, housing, cups, chassis...). "Comes with a
// leather case" or "copper cable" must not make an IEM "leather" or "metal".

import { textify } from "./specs.js";

const BODY = /\b(shells?|faceplates?|face ?plates?|cavity|cavities|housings?|body|bodies|chassis|enclosures?|ear ?cups?|cups|frame|casing|cases? made|construction|crafted|machined|built (?:from|with|of)|made (?:from|of|with))\b/i;
const NOT_BODY = /(cable|wire|plug|connector|\bcase\b|pouch|\bbox\b|packag|\btips?\b|pads?\b|cushion|headband|diaphragm|driver|magnet|coating|coated|coil|dome|membrane|\bstand\b|shelf|display|screen|panel|knob|button)/i;

export const MATERIALS = {
  resin: /\b(resin|3d[- ]printed|acrylic)\b/i,
  wood: /\b(wood(?:en)?|walnut|ebony|rosewood|zebrawood|zebra wood|maple|sandalwood|burl|cherry wood|teak)\b/i,
  metal: /\b(alumin(?:i)?um|titanium|stainless steel|steel|brass|copper|zinc alloy|magnesium|metal(?:lic)?|cnc)\b/i,
  ceramic: /\b(ceramic|zirconia)\b/i,
  carbon: /\b(carbon fib(?:er|re)|forged carbon)\b/i,
  glass: /\b(glass|sapphire)\b/i,
  // no "leather": on headphones it is almost always the pads or headband
};

// Looks: from the title and tags only (descriptions are too loose for this).
// Store text rarely says "anime"; most art/collab IEMs need community tags.
export const STYLES = {
  anime: /\b(anime|waifu|vtuber|hololive|genshin|kawaii|chibi|manga)\b/i,
  clear: /\b(transparent|clear shell|translucent)\b/i,
};

const sentences = (text) =>
  text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 400);

/** → { materials: {resin: "quote"...}, styles: {anime: "quote"} } */
export function detectLooks({ title = "", tags = [], body = "" }) {
  const materials = {};
  const styles = {};
  const head = `${title} ${Array.isArray(tags) ? tags.join(" ") : tags}`;
  for (const [k, re] of Object.entries(STYLES)) {
    const m = head.match(re);
    if (m) styles[k] = title.match(re) ? title : `tag: ${m[0]}`;
  }
  // Title words count as body material ("Walnut Wood Headphones").
  for (const [k, re] of Object.entries(MATERIALS)) if (re.test(title) && !NOT_BODY.test(title)) materials[k] = title;
  const plain = textify(body);
  for (const s of sentences(Array.isArray(plain) ? plain.join("\n") : String(plain))) {
    if (!BODY.test(s)) continue;
    for (const [k, re] of Object.entries(MATERIALS)) {
      if (materials[k] || !re.test(s)) continue;
      // The material word must sit next to a word about the body (within a
      // few words), and not next to a part like a driver, cable or screen.
      const word = s.match(re)[0];
      const at = s.indexOf(word);
      const near = s.slice(Math.max(0, at - 30), at + word.length + 30);
      if (!BODY.test(near) || NOT_BODY.test(near)) continue;
      materials[k] = s.length > 200 ? `${s.slice(0, 197)}…` : s;
    }
  }
  return { materials, styles };
}
