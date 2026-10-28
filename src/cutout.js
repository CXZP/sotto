// Product photos from stores are shot on white. To sit them on coloured blocks the way a
// cut-out render would, the white around the product is made transparent in the browser:
// a flood fill from the photo's edges through near-white, low-colour pixels, a soft edge,
// then a crop to the product. The photo stays on the store's CDN; nothing is copied.
// Needs the CDN to allow cross-origin reads (Shopify does); otherwise the caller falls back.

const cache = new Map();

/** @returns {Promise<{url:string, w:number, h:number}>} a transparent PNG blob URL cropped to the product */
export function cutout(src, max = 1100) {
  if (!cache.has(src)) cache.set(src, make(src, max));
  return cache.get(src);
}

async function make(src, max) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";
  img.src = src;
  await img.decode();
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * k);
  const H = Math.round(img.naturalHeight * k);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H); // throws if the CDN doesn't allow it
  const px = data.data;
  const N = W * H;
  // Background: transparent, or light and nearly grey (white sweep, soft floor shadow).
  const isBg = (i) => {
    const o = i * 4;
    if (px[o + 3] < 24) return true;
    const r = px[o];
    const g = px[o + 1];
    const b = px[o + 2];
    const lo = Math.min(r, g, b);
    return lo >= 238 && Math.max(r, g, b) - lo <= 12;
  };
  const bg = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const seed = (i) => {
    if (!bg[i] && isBg(i)) {
      bg[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < W; x++) (seed(x), seed((H - 1) * W + x));
  for (let y = 0; y < H; y++) (seed(y * W), seed(y * W + W - 1));
  while (sp) {
    const i = stack[--sp];
    const x = i % W;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (i >= W) seed(i - W);
    if (i < N - W) seed(i + W);
  }
  // Clear the background; product pixels next to it fade by how light they are, so the edge isn't jagged.
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (bg[i]) {
      px[o + 3] = 0;
      continue;
    }
    const x = i % W;
    const y = (i - x) / W;
    const edge = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (i >= W && bg[i - W]) || (i < N - W && bg[i + W]);
    if (edge) {
      const lo = Math.min(px[o], px[o + 1], px[o + 2]);
      px[o + 3] = Math.round(px[o + 3] * Math.min(1, Math.max(0.3, (250 - lo) / 40)));
    }
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error("empty cutout");
  ctx.putImageData(data, 0, 0);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d").drawImage(cv, x0, y0, w, h, 0, 0, w, h);
  const blob = await new Promise((res) => out.toBlob(res, "image/png"));
  return { url: URL.createObjectURL(blob), w, h };
}
