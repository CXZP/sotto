// Picks the best photo of a product for a card: front-on or top-down (both are mirror
// symmetric left to right), on a plain backdrop, with the product filling a fair part of the
// frame. Photos are read small from the store CDN (Shopify allows it); nothing is edited.
// Results are cached per browser, so it runs once per product.

const KEY = "sotto:front:v4:";
const SKIP = /box|packag|cable|lifestyle|accessor|banner|size|chart|compare|warranty/i;

/** @returns {Promise<{src:string, bg:string}>} the chosen photo and its backdrop colour (CSS) */
export async function pickFront(id, srcs) {
  try {
    const hit = localStorage.getItem(KEY + id);
    if (hit) return JSON.parse(hit);
  } catch {}
  const list = srcs.filter((s) => !SKIP.test(s.split("?")[0].split("/").pop())).slice(0, 4);
  if (!list.length) list.push(srcs[0]);
  const scored = await Promise.all(list.map((s, n) => score(s).then((r) => ({ ...r, s, n })).catch(() => null)));
  const ok = scored.filter(Boolean);
  // The first photo is the store's own choice, usually the product itself: another shot has
  // to beat it clearly (a case or a box can be just as symmetric).
  const best = ok.sort((a, b) => b.total + (b.n === 0 ? 0.6 : 0) - (a.total + (a.n === 0 ? 0.6 : 0)))[0];
  const out = best ? { src: best.s, bg: best.bg } : { src: srcs[0], bg: "" };
  try {
    localStorage.setItem(KEY + id, JSON.stringify(out));
  } catch {}
  return out;
}

const small = (src) => (/cdn\.shopify\.com|\/cdn\/shop\//.test(src) ? `${src}${src.includes("?") ? "&" : "?"}width=160` : src);

async function score(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";
  img.src = small(src);
  await img.decode();
  const k = 120 / Math.max(img.naturalWidth, img.naturalHeight);
  const W = Math.max(8, Math.round(img.naturalWidth * k));
  const H = Math.max(8, Math.round(img.naturalHeight * k));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  // Transparent PNGs show on the card colour; read them over white.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const at = (x, y, c) => px[(y * W + x) * 4 + c];
  // Backdrop: median colour of the border, and how much of the border matches it.
  const ring = [];
  for (let x = 0; x < W; x++) ring.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) ring.push([0, y], [W - 1, y]);
  const med = (c) => ring.map(([x, y]) => at(x, y, c)).sort((a, b) => a - b)[ring.length >> 1];
  const B = [med(0), med(1), med(2)];
  const diff = (x, y) => Math.max(Math.abs(at(x, y, 0) - B[0]), Math.abs(at(x, y, 1) - B[1]), Math.abs(at(x, y, 2) - B[2]));
  const plain = ring.filter(([x, y]) => diff(x, y) < 18).length / ring.length;
  const light = (B[0] + B[1] + B[2]) / 765;
  // The product: everything clearly off the backdrop.
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (diff(x, y) > 28) {
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { total: -1, bg: "" };
  const fill = n / (W * H);
  // Mirror symmetry about the product's own centre line.
  const cx = (x0 + x1) / 2;
  let same = 0;
  let cnt = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= Math.floor(cx); x++) {
      const m = Math.round(2 * cx - x);
      if (m < 0 || m >= W) continue;
      const a = diff(x, y) > 28;
      const b = diff(m, y) > 28;
      if (a || b) {
        cnt++;
        if (a && b) same++;
      }
    }
  const sym = cnt ? same / cnt : 0;
  // Centred, with some air round it: the card crops a little.
  const margin = Math.min(x0, y0, W - 1 - x1, H - 1 - y1) / Math.min(W, H);
  const room = margin > 0.03 ? 1 : margin / 0.03;
  const size = fill < 0.08 ? fill / 0.08 : fill > 0.6 ? Math.max(0, 1 - (fill - 0.6) * 3) : 1;
  // A dark or busy backdrop is a mood shot or a banner, not a product photo.
  const gate = light < 0.8 || plain < 0.7 ? -3 : 0;
  const total = 1.6 * plain + 1.0 * sym + 0.6 * size + 0.4 * room + gate;
  return { total, bg: `rgb(${B.join(",")})` };
}
