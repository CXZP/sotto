// Some stores pad a photo that has its own backdrop (dark, coloured, a scene) with a white
// frame, so in a white tile it sits small inside a white border. This finds that frame and
// zooms the photo past it so it fills the tile edge to edge.
//
// A product cut out on white is left as it is: the box round a cut-out's outline is mostly
// white along its edges (a headphone isn't a rectangle), while a framed photo's inner edge is
// photo all the way round. Only the image's display changes; the photo itself is not edited.

const KEY = "sotto:frame:v1:";
const small = (src) => (/cdn\.shopify\.com|\/cdn\/shop\//.test(src) ? `${src}${src.includes("?") ? "&" : "?"}width=160` : src);

/** @returns {Promise<{x:number,y:number,w:number,h:number,a:number}|null>} the photo inside the frame, as fractions of the image (a: image width / height) */
async function measure(src) {
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
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const ink = (x, y) => {
    const i = (y * W + x) * 4;
    return 765 - px[i] - px[i + 1] - px[i + 2] > 45; // not (near) white
  };
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // No white border worth removing, or too little left inside it.
  if (w > W * 0.96 && h > H * 0.96) return null;
  if (w * h < W * H * 0.3) return null;
  // The inner edge: a framed photo is photo all along it, a cut-out mostly isn't.
  let on = 0, all = 0;
  const edge = (x, y) => { all++; if (ink(x, y)) on++; };
  for (let x = x0; x <= x1; x++) { edge(x, y0 + 1); edge(x, y1 - 1); }
  for (let y = y0; y <= y1; y++) { edge(x0 + 1, y); edge(x1 - 1, y); }
  if (on / all < 0.9) return null;
  // One pixel in, so no light seam from the scaled-down edge.
  return { x: (x0 + 1) / W, y: (y0 + 1) / H, w: (w - 2) / W, h: (h - 2) / H, a: W / H };
}

async function frameOf(src) {
  try {
    const hit = localStorage.getItem(KEY + src);
    if (hit) return JSON.parse(hit);
  } catch {}
  const r = await measure(src).catch(() => undefined);
  if (r === undefined) return null; // the store doesn't allow reading it: leave it, try again next time
  try {
    localStorage.setItem(KEY + src, JSON.stringify(r));
  } catch {}
  return r;
}

/** Zooms an <img> (object-fit: contain, filling a square box that clips) past a white frame. */
export async function unframe(img) {
  if (img.dataset.unframed) return;
  img.dataset.unframed = "1";
  const f = await frameOf(img.currentSrc || img.src);
  if (!f) return;
  // Where the image sits in the box under object-fit: contain, as fractions of the box.
  const box = img.getBoundingClientRect();
  const boxA = box.width && box.height ? box.width / box.height : 1;
  const dw = f.a >= boxA ? 1 : f.a / boxA;
  const dh = f.a >= boxA ? boxA / f.a : 1;
  const cx = (1 - dw) / 2 + (f.x + f.w / 2) * dw;
  const cy = (1 - dh) / 2 + (f.y + f.h / 2) * dh;
  const cw = f.w * dw;
  const ch = f.h * dh;
  // Fill the box when the photo is near its shape; otherwise fit it whole (no big crop).
  const s = Math.max(cw, ch) / Math.min(cw, ch) < 1.25 ? Math.max(1 / cw, 1 / ch) : Math.min(1 / cw, 1 / ch);
  img.style.transformOrigin = "0 0";
  img.style.transform = `translate(${(0.5 - cx * s) * 100}%, ${(0.5 - cy * s) * 100}%) scale(${s})`;
  img.classList.add("unframed");
}
