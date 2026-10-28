// Home hero art, drawn from the catalog itself: every source's output curve
// (volts it can deliver into each impedance) as a strand, every headphone as a
// dot at the volts it needs for loud peaks. One source at a time is lit; the
// dots it can drive light up. Same maths as the builder, just as a picture.

const X0 = Math.log10(6); // the range real headphones use: 6 Ω IEMs to 600 Ω classics
const X1 = Math.log10(700);
const Y0 = Math.log10(0.005);
const Y1 = Math.log10(25);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ strands: number[][], loads: number[], points: {z:number, v:number}[], picks: {curve:number[], status:string[]}[], plot: () => {l:number,r:number,t:number,b:number}, labels: {x:string,y:string} }} data
 *   plot: the plot box as fractions of the canvas, measured from the page on each resize
 *   strands/curves: volts at each of `loads`; status per point: ok | overkill | tight | insufficient
 * @returns {{ show(n:number):void, stop():void }}
 */
export function heroArt(canvas, data) {
  const ctx = canvas.getContext("2d");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let pick = 0;
  let from = 0;
  let fade = 1; // 0 → 1 while switching picks
  let raf = 0;
  let last = 0;
  let visible = true;
  const t0 = performance.now();

  const css = (name, fallback) => getComputedStyle(canvas).getPropertyValue(name).trim() || fallback;
  let colors = {};
  const readColors = () => {
    colors = {
      ink: css("--text", "#111"),
      accent: css("--art-accent", "#e8862e"),
      ok: css("--st-good", "#0ca30c"),
      overkill: css("--st-over", "#3a8ee6"),
      tight: css("--st-warn", "#d4ac00"),
      insufficient: css("--st-bad", "#d03b3b"),
    };
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    readColors();
    p = data.plot();
  };

  let p = data.plot();
  const px = (ohms) => (p.l + ((Math.log10(ohms) - X0) / (X1 - X0)) * (p.r - p.l)) * W;
  const py = (v) => (p.b - ((Math.log10(Math.max(v, 1e-4)) - Y0) / (Y1 - Y0)) * (p.b - p.t)) * H;
  const xs = () => data.loads.map(px);

  // A curve through the samples (knees rounded), drifting a little; with `tail` it runs on
  // flat past the plot to the canvas's right edge, where the source's voltage tops out anyway.
  const line = (pts, wobble, time, k, tail = true) => {
    ctx.beginPath();
    const wob = (i) => (wobble ? Math.sin(time * 0.55 + k * 0.33 + i * 0.22) * wobble * (1 - (i / pts.length) * 0.6) : 0);
    const P = pts.map((v, i) => [xs_[i], py(v) + wob(i)]);
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    if (tail) ctx.lineTo(W, P[P.length - 1][1]);
  };

  let xs_ = [];
  const draw = (now) => {
    const time = calm ? 0 : (now - t0) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    xs_ = xs();

    // Strands: start soft at the plot's left edge (no lead-in corner), a gentle drift.
    const grad = ctx.createLinearGradient(p.l * W, 0, W, 0);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.18, colors.ink);
    grad.addColorStop(1, colors.ink);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.8;
    data.strands.forEach((s, k) => {
      ctx.globalAlpha = 0.07 + (k % 4) * 0.025;
      line(s, 2.4, time, k, true);
      ctx.stroke();
    });

    // Axis cues, small, on the plot's edges.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = colors.ink;
    ctx.font = "12px " + getComputedStyle(canvas).fontFamily;
    ctx.textAlign = "right";
    ctx.fillText(data.labels.x + "  →", p.r * W, p.b * H + 26);
    ctx.textAlign = "left";
    ctx.fillText("↑  " + data.labels.y, p.l * W + 8, p.t * H + 4);

    // Dots, two states only: lit when the source drives them, faint when it doesn't.
    // The switch cross-fades dot by dot.
    const lit = (s) => s === "ok" || s === "overkill";
    const a = data.picks[from]?.status;
    const b = data.picks[pick]?.status;
    const R = W > 900 ? 3 : 2.3;
    const dot = (x, y, on, alpha) => {
      ctx.globalAlpha = alpha * (on ? 0.95 : 0.22);
      ctx.fillStyle = on ? colors.ok : colors.ink;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
    };
    data.points.forEach((pt, i) => {
      const x = px(pt.z);
      const y = py(pt.v);
      if (x < p.l * W + 6) return;
      const on = lit(b?.[i]);
      const was = lit(a?.[i]);
      if (fade < 1 && was !== on) {
        dot(x, y, was, 1 - fade);
        dot(x, y, on, fade);
      } else dot(x, y, on, 1);
    });

    // The lit source: a thick accent line with a soft glow, easing between picks.
    const ca = data.picks[from]?.curve;
    const cb = data.picks[pick]?.curve;
    if (cb) {
      const e = 1 - (1 - fade) ** 3;
      const curve = cb.map((v, i) => (ca ? 10 ** (Math.log10(ca[i]) * (1 - e) + Math.log10(v) * e) : v));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2.6;
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 14;
      line(curve, 0, time, 0, true);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  };

  const loop = (now) => {
    raf = 0;
    if (fade < 1) fade = Math.min(1, fade + (now - last) / 700);
    last = now;
    draw(now);
    if (visible && !calm) raf = requestAnimationFrame(loop);
    else if (fade < 1) raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  resize();
  const ro = new ResizeObserver(() => {
    resize();
    draw(performance.now());
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  });
  io.observe(canvas);
  // Theme switch: re-read the colours.
  const mo = new MutationObserver(() => {
    readColors();
    draw(performance.now());
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  kick();

  return {
    show(n) {
      if (n === pick) return;
      from = pick;
      pick = n;
      fade = calm ? 1 : 0;
      kick();
      if (calm) draw(performance.now());
    },
    stop() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    },
  };
}
