// Who a source is. A maker's own site carries the brand in its domain
// (fiio.com, dl.topping.audio, ifi-audio.com, smsl-audio.com); a maker's word
// wins over a store's when the two disagree.

const word = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function isMakerUrl(url, brand) {
  const b = word(brand).slice(0, 8);
  if (b.length < 3 || !url) return false;
  try {
    return word(new URL(url).hostname).includes(b);
  } catch {
    return false;
  }
}
