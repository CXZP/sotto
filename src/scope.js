// The bench scope on the home page: the loudest stretch of a song, drawn as the voltage a
// headphone needs, under a dashed ceiling at the most the chosen source can give. Where
// the wave reaches the ceiling its peaks are cut flat and drawn in red: clipping, which is
// what "not enough power" sounds like. Volts map to height on one fixed scale, so a wave
// that barely moves really does ask for very little.

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ set(v:{need:number, ceil:number, label?:string, short?:string}):void, stop():void }}
 *   need: volts the headphone needs on peaks; ceil: volts the source gives into it;
 *   label (short on narrow screens): printed on the ceiling line (or at the top edge when the ceiling is above the screen).
 */
export function scope(canvas) {
  const ctx = canvas.getContext("2d");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FULL = 1.6; // volts at the top of the screen (the dongle's ~0.5 V sits a third of the way up)
  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let visible = false;
  let last = performance.now();
  let phase = 0;
  const cur = { need: 0.001, ceil: 0.5 };
  const goal = { need: 0.001, ceil: 0.5 };
  let colors = {};
  let label = "";
  let short = "";
  let font = "";

  const css = (n, f) => getComputedStyle(canvas).getPropertyValue(n).trim() || f;
  const readColors = () => {
    colors = { ink: css("--ink", "#000"), grid: css("--grid", "rgba(0,0,0,.12)"), wave: css("--wave", "#000"), ceil: css("--ceil", "#000"), clip: css("--clip", "#e8392a") };
    font = getComputedStyle(canvas).getPropertyValue("--display").trim() || "sans-serif";
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    readColors();
    draw();
  };

  // A song-like signal: three partials under a slow swell, scaled so its loudest peak is 1.
  const raw = (x) => {
    const swell = 0.28 + 0.72 * Math.abs(Math.sin(x * 0.0021)) ** 2.4;
    return swell * (0.6 * Math.sin(x * 0.045) + 0.28 * Math.sin(x * 0.11 + 1.3) + 0.12 * Math.sin(x * 0.27 + 0.4));
  };
  let peak = 0;
  for (let x = 0; x < 6000; x++) peak = Math.max(peak, Math.abs(raw(x)));

  const vy = (v) => (H / 2) * Math.min(v / FULL, 1.25); // volts → pixels from the centre line

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;
    // Graticule: 10 × 8 divisions, finer ticks on the centre lines, like a bench scope.
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 10; i++) {
      const x = Math.round((W * i) / 10) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let j = 1; j < 8; j++) {
      const y = Math.round((H * j) / 8) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    for (let k = 0; k <= 50; k++) {
      const x = Math.round((W * k) / 50) + 0.5;
      ctx.moveTo(x, mid - 4);
      ctx.lineTo(x, mid + 4);
    }
    for (let k = 0; k <= 40; k++) {
      const y = Math.round((H * k) / 40) + 0.5;
      ctx.moveTo(W / 2 - 4, y);
      ctx.lineTo(W / 2 + 4, y);
    }
    ctx.stroke();

    const amp = vy(cur.need);
    const lim = vy(cur.ceil);
    // Ceiling, top and bottom (the wave swings both ways).
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = colors.ceil;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (lim < mid) {
      ctx.moveTo(0, mid - lim);
      ctx.lineTo(W, mid - lim);
      ctx.moveTo(0, mid + lim);
      ctx.lineTo(W, mid + lim);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Its value, at the left end of the line (the photo stands on the right); above the screen, an arrow near the top.
    if (label) {
      ctx.font = `600 13px ${font}`;
      ctx.textAlign = "left";
      ctx.fillStyle = colors.ceil;
      const text = ctx.measureText(label).width > W * 0.42 ? short : label;
      ctx.fillText(lim < mid ? text : `↑ ${text}`, 14, lim < mid ? mid - lim - 8 : 70);
    }

    // The wave as it would be (faint where it's cut), then as the source can deliver it.
    const pts = [];
    for (let x = 0; x <= W; x += 2) pts.push([x, (raw(x * 1.4 + phase) / peak) * amp]);
    ctx.lineJoin = "round";
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.clip;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (const [x, s] of pts) if (Math.abs(s) > lim) (ctx.moveTo(x, mid - s), ctx.lineTo(x, mid - Math.sign(s) * lim));
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.wave;
    ctx.beginPath();
    pts.forEach(([x, s], i) => {
      const y = mid - Math.max(-lim, Math.min(lim, s));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    // The cut-off tops, in red.
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = colors.clip;
    ctx.beginPath();
    let on = false;
    for (const [x, s] of pts) {
      if (Math.abs(s) >= lim) {
        const y = mid - Math.sign(s) * lim;
        on ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        on = true;
      } else on = false;
    }
    ctx.stroke();
  }

  const loop = (now) => {
    raf = 0;
    const dt = Math.min(now - last, 64);
    last = now;
    const k = 1 - Math.exp(-dt / 140);
    cur.need += (goal.need - cur.need) * k;
    cur.ceil += (goal.ceil - cur.ceil) * k;
    if (!calm) phase += dt * 0.12;
    draw();
    const moving = Math.abs(goal.need - cur.need) > 1e-4 || Math.abs(goal.ceil - cur.ceil) > 1e-4;
    if ((visible && !calm) || moving) raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  });
  io.observe(canvas);
  resize();

  return {
    set({ need, ceil, label: l = "", short: s = "" }) {
      short = s || l;
      goal.need = need;
      goal.ceil = ceil;
      label = l;
      if (calm) Object.assign(cur, goal), draw();
      else kick();
    },
    stop() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    },
  };
}
