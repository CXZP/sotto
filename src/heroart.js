// Home hero art, drawn from the catalog itself: every source's output curve
// (volts it can deliver into each impedance) as a strand, every headphone as a
// dot at the volts it needs for loud peaks. The hero tells a short story in
// chapters (lit source, which dots it drives, which ones to look at), with the
// same maths as the builder. On first view the dots gather into place.

const X0 = Math.log10(6); // the range real headphones use: 6 Ω IEMs to 600 Ω classics
const X1 = Math.log10(700);
const Y0 = Math.log10(0.005);
const Y1 = Math.log10(25);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   strands: number[][], loads: number[], points: {z:number, v:number}[],
 *   chapters: {curve:number[], status:string[], focus?:Set<number>, labels?:{i:number,text:string}[]}[],
 *   plot: () => {l:number,r:number,t:number,b:number}, labels: {x:string,y:string}
 * }} data
 *   plot: the plot box as fractions of the canvas, measured from the page on each resize
 *   strands/curves: volts at each of `loads`; status per point: ok | overkill | tight | insufficient
 *   focus: points this chapter is about (the rest dim); labels: names drawn by some of them
 * @returns {{ show(n:number):void, stop():void }}
 */
export function heroArt(canvas, data) {
  const ctx = canvas.getContext("2d");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let at = 0;
  let from = 0;
  let fade = 1; // 0 → 1 while switching chapters
  let raf = 0;
  let last = 0;
  let visible = true;
  const t0 = performance.now();
  const GATHER = calm ? 0 : 1700; // ms for the opening gather
  // Each dot starts somewhere random and arrives a little after its neighbours.
  const seed = data.points.map((_, i) => {
    const r = Math.sin(i * 12.9898) * 43758.5453;
    const s = Math.sin(i * 78.233) * 12543.123;
    return { x: r - Math.floor(r), y: s - Math.floor(s), d: ((i * 7) % 23) / 23 };
  });
  // In a chapter change, focused dots flip one after another rather than all at once.
  const order = data.points.map((_, i) => ((i * 37) % 101) / 101);

  const css = (name, fallback) => getComputedStyle(canvas).getPropertyValue(name).trim() || fallback;
  let colors = {};
  let font = "";
  const readColors = () => {
    colors = {
      ink: css("--text", "#111"),
      bg: css("--bg", "#000"),
      accent: css("--art-accent", "#e8862e"),
      ok: css("--st-good", "#0ca30c"),
      warn: css("--art-warn", "#ff7a45"),
    };
    font = getComputedStyle(canvas).fontFamily;
  };

  let p = data.plot();
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
  const px = (ohms) => (p.l + ((Math.log10(ohms) - X0) / (X1 - X0)) * (p.r - p.l)) * W;
  const py = (v) => (p.b - ((Math.log10(Math.max(v, 1e-4)) - Y0) / (Y1 - Y0)) * (p.b - p.t)) * H;

  // A curve through the samples (knees rounded), drifting a little; it runs on flat past
  // the plot to the canvas's right edge, where the source's voltage tops out anyway.
  let xs = [];
  const line = (pts, wobble, time, k) => {
    ctx.beginPath();
    const wob = (i) => (wobble ? Math.sin(time * 0.55 + k * 0.33 + i * 0.22) * wobble * (1 - (i / pts.length) * 0.6) : 0);
    const P = pts.map((v, i) => [xs[i], py(v) + wob(i)]);
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    ctx.lineTo(W, P[P.length - 1][1]);
  };

  const lit = (s) => s === "ok" || s === "overkill";
  const ease = (x) => 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;

  const draw = (now) => {
    const time = calm ? 0 : (now - t0) / 1000;
    const g = GATHER ? (now - t0) / GATHER : 1; // opening gather progress
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    xs = data.loads.map(px);

    // Strands, fading in with the gather.
    const grad = ctx.createLinearGradient(p.l * W, 0, W, 0);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.18, colors.ink);
    grad.addColorStop(1, colors.ink);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.8;
    const sg = ease(g * 1.4 - 0.2);
    data.strands.forEach((s, k) => {
      ctx.globalAlpha = (0.07 + (k % 4) * 0.025) * sg;
      line(s, 2.4, time, k);
      ctx.stroke();
    });

    // Axis cues.
    ctx.globalAlpha = 0.55 * sg;
    ctx.fillStyle = colors.ink;
    ctx.font = `12px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(`${data.labels.x}  →`, p.r * W, p.b * H + 26);
    ctx.textAlign = "left";
    ctx.fillText(`↑  ${data.labels.y}`, p.l * W + 8, p.t * H + 4);

    // Dots. Lit (green) when the chapter's source drives them, faint otherwise; a chapter
    // with a focus dims everything else and draws its dots bigger, ringed in warm when not driven.
    const A = data.chapters[from];
    const B = data.chapters[at];
    const R = W > 900 ? 3 : 2.3;
    const draws = [];
    data.points.forEach((pt, i) => {
      // A few headphones sit below 6 Ω: keep them on the plot's left edge, not in the copy.
      let x = Math.max(px(pt.z), p.l * W + R + 2);
      let y = py(pt.v);
      if (g < 1) {
        const k = ease((g - seed[i].d * 0.35) / 0.65);
        x = (p.l + seed[i].x * (p.r - p.l)) * W * (1 - k) + x * k;
        y = (p.t + seed[i].y * (p.b - p.t)) * H * (1 - k) + y * k;
      }
      // Per-dot switch progress: staggered for focused dots.
      const f = fade >= 1 ? 1 : ease((fade - order[i] * 0.45) / 0.55);
      const state = (C) => {
        const on = lit(C.status[i]);
        const focused = !C.focus || C.focus.has(i);
        return { on, focused, a: focused ? (on ? 0.95 : C.focus ? 1 : 0.22) : on ? 0.12 : 0.08, r: C.focus && focused ? R * 1.9 : R };
      };
      const sa = state(A);
      const sb = state(B);
      const r = sa.r + (sb.r - sa.r) * f;
      const paint = (s, alpha) => {
        if (alpha <= 0.01) return;
        ctx.globalAlpha = s.a * alpha;
        ctx.fillStyle = s.on ? colors.ok : s.focused && B.focus ? colors.warn : colors.ink;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };
      if (f < 1 && (sa.on !== sb.on || sa.focused !== sb.focused)) {
        paint(sa, 1 - f);
        paint(sb, f);
      } else paint(sb, 1);
      if (B.focus?.has(i) && f > 0.3) draws.push([x, y, r, f]);
    });

    // Rings round the focused dots.
    ctx.lineWidth = 1.2;
    for (const [x, y, r, f] of draws) {
      ctx.globalAlpha = 0.5 * f;
      ctx.strokeStyle = colors.ink;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The lit source: a thick accent line with a soft glow, easing between chapters.
    if (B.curve) {
      const e = ease(fade);
      const curve = B.curve.map((v, i) => (A.curve && A.curve !== B.curve ? 10 ** (Math.log10(A.curve[i]) * (1 - e) + Math.log10(v) * e) : v));
      ctx.globalAlpha = sg;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2.6;
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 14;
      line(curve, 0, time, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Names of a few focused dots: a pill above the dot on a short leader line, placed where
    // it doesn't cover another name (tried higher up if the first spot is taken).
    if (B.labels && fade > 0.5 && g >= 1) {
      ctx.font = `600 12px ${font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const taken = [];
      const a = Math.min(1, (fade - 0.5) * 2);
      for (const { i, text } of B.labels) {
        const dx = Math.max(px(data.points[i].z), p.l * W + R + 2);
        const dy = py(data.points[i].v);
        const w = ctx.measureText(text).width + 18;
        const h = 22;
        let x = Math.min(dx + 10, p.r * W - w);
        let y = 0;
        let ok = false;
        for (const lift of [34, 60, 86]) {
          y = dy - lift;
          if (!taken.some((b) => x < b.x + b.w + 6 && b.x < x + w + 6 && Math.abs(b.y - y) < h + 4)) {
            ok = true;
            break;
          }
        }
        if (!ok) continue;
        taken.push({ x, y, w });
        ctx.globalAlpha = 0.6 * a;
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dx, dy - R * 2.6);
        ctx.lineTo(dx, y + h / 2);
        ctx.lineTo(x + 10, y + h / 2);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.fillStyle = colors.ink;
        ctx.beginPath();
        ctx.roundRect(x, y - h / 2, w, h, 11);
        ctx.fill();
        ctx.fillStyle = colors.bg;
        ctx.fillText(text, x + 9, y + 0.5);
      }
      ctx.textBaseline = "alphabetic";
    }
    ctx.globalAlpha = 1;
  };

  const loop = (now) => {
    raf = 0;
    if (fade < 1) fade = Math.min(1, fade + (now - last) / 1100);
    last = now;
    draw(now);
    if ((visible && !calm) || fade < 1) raf = requestAnimationFrame(loop);
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
      if (n === at) return;
      from = at;
      at = n;
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
