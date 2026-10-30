// Product photos from stores are shot on white. To sit them on coloured blocks the way a
// cut-out render would, the white around the product is made transparent in the browser:
// the backdrop colour is measured from the border, the region touching the border is
// un-mixed from it (shadows stay as see-through shadows, edges lose their white fringe),
// then the image is cropped to the product. The photo stays on the store's CDN; nothing is copied.
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
  // The backdrop's colour: the median of the photo's border (studio white is rarely 255).
  const ring = [];
  for (let x = 0; x < W; x += 3) ring.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y += 3) ring.push(y * W, y * W + W - 1);
  const med = (c) => {
    const v = ring.filter((i) => px[i * 4 + 3] > 200).map((i) => px[i * 4 + c]).sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : 255;
  };
  const B = [med(0), med(1), med(2)];
  // Backdrop-like: transparent, or close to the backdrop and nearly grey (the sweep, its soft
  // shadows, the glow around edges). Only what touches the border counts, so a white part of
  // the product surrounded by darker parts is kept.
  const near = (i) => {
    const o = i * 4;
    if (px[o + 3] < 24) return true;
    const r = px[o];
    const g = px[o + 1];
    const b = px[o + 2];
    return Math.max(Math.abs(r - B[0]), Math.abs(g - B[1]), Math.abs(b - B[2])) <= 46 && Math.max(r, g, b) - Math.min(r, g, b) <= 26;
  };
  const bg = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const seed = (i) => {
    if (!bg[i] && near(i)) {
      bg[i] = 1;
      stack[sp++] = i;
    }
  };
  // Studio backdrops are often a grey sweep, lighter at the top. Besides the measured colour,
  // the fill also creeps along smooth, colourless steps from pixel to pixel, so the whole sweep
  // goes; a product's edge is a sharper step and stops it.
  const grey = (i) => {
    const o = i * 4;
    return Math.max(px[o], px[o + 1], px[o + 2]) - Math.min(px[o], px[o + 1], px[o + 2]) <= 18 && px[o] + px[o + 1] + px[o + 2] >= 3 * 110;
  };
  const step = (i, j) => {
    const a = i * 4;
    const b = j * 4;
    return Math.max(Math.abs(px[a] - px[b]), Math.abs(px[a + 1] - px[b + 1]), Math.abs(px[a + 2] - px[b + 2])) <= 3;
  };
  const creep = (i, j) => {
    if (bg[j]) return;
    if (near(j) || (grey(j) && step(i, j))) {
      bg[j] = 1;
      stack[sp++] = j;
    }
  };
  for (let x = 0; x < W; x++) (seed(x), seed((H - 1) * W + x));
  for (let y = 0; y < H; y++) (seed(y * W), seed(y * W + W - 1));
  while (sp) {
    const i = stack[--sp];
    const x = i % W;
    if (x > 0) creep(i, i - 1);
    if (x < W - 1) creep(i, i + 1);
    if (i >= W) creep(i, i - W);
    if (i < N - W) creep(i, i + W);
  }
  // A product shot has a plain backdrop all round. If much of the border isn't backdrop, it's a
  // scene or a cropped shot, and cutting it out would look broken: refuse, the caller skips it.
  const edge = ring.filter((i) => bg[i]).length / ring.length;
  if (edge < 0.9) throw new Error(`not a plain backdrop (${Math.round(edge * 100)}%)`);
  // Backdrop showing through closed loops (inside a headband, between cable and shell) doesn't
  // touch the border. A large enclosed patch that is the backdrop colour almost exactly is
  // cleared too; small or shaded light areas are more likely part of the product and stay.
  const exact = (i) => {
    const o = i * 4;
    return Math.max(Math.abs(px[o] - B[0]), Math.abs(px[o + 1] - B[1]), Math.abs(px[o + 2] - B[2])) <= 9;
  };
  const seen = new Uint8Array(N);
  const comp = [];
  for (let s = 0; s < N; s++) {
    if (bg[s] || seen[s] || !exact(s)) continue;
    comp.length = 0;
    seen[s] = 1;
    stack[sp++] = s;
    while (sp) {
      const i = stack[--sp];
      comp.push(i);
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || seen[j] || bg[j] || !exact(j)) continue;
        seen[j] = 1;
        stack[sp++] = j;
      }
    }
    if (comp.length > N * 0.002) for (const i of comp) bg[i] = 1;
  }
  // In the backdrop region, take the backdrop back out of each pixel: how much darker it is
  // than the backdrop becomes its opacity, and its colour is un-mixed from the backdrop. Pure
  // backdrop goes clear, a soft shadow becomes a see-through shadow, edge pixels lose their
  // white fringe. Everything else is the product and stays as shot.
  // Bright, colourless edges of the product itself (a polished side, a white rim) can look like
  // backdrop and get bitten in narrow teeth. Close the product outline: anything the backdrop
  // reaches only through a gap narrower than ~2R pixels is given back to the product.
  const R = Math.max(3, Math.round(Math.max(W, H) / 110));
  const grow = (seedOf, r) => {
    const dist = new Int16Array(N).fill(-1);
    let q = [];
    for (let i = 0; i < N; i++) if (seedOf(i)) (dist[i] = 0), q.push(i);
    for (let d = 0; d < r && q.length; d++) {
      const next = [];
      for (const i of q) {
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= N || dist[j] >= 0) continue;
          dist[j] = d + 1;
          next.push(j);
        }
      }
      q = next;
    }
    return dist;
  };
  const dil = grow((i) => !bg[i], R); // product, dilated
  const far = grow((i) => dil[i] < 0, R); // what stays backdrop, dilated back
  // Only bright pixels go back (a product edge catching light); a shadow between feet stays backdrop.
  const bright = (i) => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) >= Math.min(...B) - 10;
  for (let i = 0; i < N; i++) if (bg[i] && far[i] < 0 && bright(i)) bg[i] = 0;
  // Only backdrop within a few pixels of the product is un-mixed (that's where fringes and
  // contact shadows are); the rest goes fully clear, so a sweep darker than the measured colour
  // can't come back as a grey box.
  const near6 = new Uint8Array(N);
  let ring1 = [];
  for (let i = 0; i < N; i++) if (!bg[i]) ring1.push(i);
  for (let d = 0; d < 2 && ring1.length; d++) {
    const next = [];
    for (const i of ring1) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || !bg[j] || near6[j]) continue;
        near6[j] = 1;
        next.push(j);
      }
    }
    ring1 = next;
  }
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (bg[i] && !near6[i]) px[o + 3] = 0;
    else if (bg[i]) {
      let a = 0;
      for (let c = 0; c < 3; c++) a = Math.max(a, (B[c] - px[o + c]) / Math.max(B[c], 1));
      a = a < 0.035 ? 0 : Math.min(1, a * 1.15);
      if (a > 0) for (let c = 0; c < 3; c++) px[o + c] = Math.max(0, Math.min(255, (px[o + c] - B[c] * (1 - a)) / a));
      px[o + 3] = Math.round(px[o + 3] * a);
    }
    if (px[o + 3] < 90) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error("empty cutout");
  // Pieces: label what's left. A store badge is a small separate piece in a corner: drop it.
  // A see-through product (clear resin shells) shatters into many pieces: refuse the photo.
  {
    const lab = new Int32Array(N).fill(-1);
    const pieces = [];
    for (let s = 0; s < N; s++) {
      if (lab[s] >= 0 || px[s * 4 + 3] < 90) continue;
      const id = pieces.length;
      const p = { px: [], x0: W, y0: H, x1: 0, y1: 0 };
      lab[s] = id;
      stack[sp++] = s;
      while (sp) {
        const i = stack[--sp];
        p.px.push(i);
        const x = i % W;
        const y = (i - x) / W;
        if (x < p.x0) p.x0 = x;
        if (x > p.x1) p.x1 = x;
        if (y < p.y0) p.y0 = y;
        if (y > p.y1) p.y1 = y;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= N || lab[j] >= 0 || px[j * 4 + 3] < 90) continue;
          lab[j] = id;
          stack[sp++] = j;
        }
      }
      pieces.push(p);
    }
    const total = pieces.reduce((n, p) => n + p.px.length, 0);
    const big = pieces.filter((p) => p.px.length > total * 0.004);
    if (big.length > 6) throw new Error(`breaks into ${big.length} pieces`);
    const corner = (p) => (p.x1 < W * 0.2 || p.x0 > W * 0.8) && (p.y1 < H * 0.2 || p.y0 > H * 0.8);
    for (const p of pieces) if (p.px.length < total * 0.04 && corner(p)) for (const i of p.px) px[i * 4 + 3] = 0;
    // Re-measure the crop without the dropped pieces.
    x0 = W;
    y0 = H;
    x1 = -1;
    y1 = -1;
    for (const p of pieces) {
      if (px[p.px[0] * 4 + 3] < 90) continue;
      x0 = Math.min(x0, p.x0);
      y0 = Math.min(y0, p.y0);
      x1 = Math.max(x1, p.x1);
      y1 = Math.max(y1, p.y1);
    }
  }
  // Keep a margin so a soft shadow isn't cropped hard.
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(W - 1, x1 + m);
  y1 = Math.min(H - 1, y1 + m);
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
