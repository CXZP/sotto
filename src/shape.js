// The box as a shape: a plain model of one device, measured in millimetres from
// the maker's own dimensioned image (data/layouts.json "model"). It is drawn as
// a cloud of points with the sockets lit, so you see where each socket sits and
// which way it faces. It is not a photo and makes no claim beyond the numbers
// written in the model.
//
// Coordinates: x from the left edge seen from the screen side, y up from the
// bottom end, z from the back face toward the front. Pure geometry here
// (modelGeometry) so Node can test it; drawShape() puts it on a canvas.

const TAU = Math.PI * 2;

function circle(cx, cy, r, n, at) {
  const pts = [];
  for (let k = 0; k <= n; k++) pts.push(at(cx + r * Math.cos((k / n) * TAU), cy + r * Math.sin((k / n) * TAU)));
  return pts;
}

// A rounded slot (USB-C) or a rectangle with corner radius rc.
function rounded(cx, cy, w, h, rc, at) {
  const pts = [];
  const corners = [[w / 2 - rc, h / 2 - rc, 0], [-w / 2 + rc, h / 2 - rc, 0.25], [-w / 2 + rc, -h / 2 + rc, 0.5], [w / 2 - rc, -h / 2 + rc, 0.75]];
  for (const [ox, oy, a0] of corners) for (let k = 0; k <= 6; k++) {
    const a = (a0 + k / 24) * TAU;
    pts.push(at(cx + ox + rc * Math.cos(a), cy + oy + rc * Math.sin(a)));
  }
  pts.push(pts[0]);
  return pts;
}

const NORMAL = { front: [0, 0, 1], back: [0, 0, -1], top: [0, 1, 0], bottom: [0, -1, 0], right: [1, 0, 0], left: [-1, 0, 0] };

// Where a 2D point on a face lands in 3D.
function onFace(face, b) {
  switch (face) {
    case "front": return (u, v) => [u, v, b.d];
    case "back": return (u, v) => [u, v, 0];
    case "top": return (u, v) => [u, b.h, v];
    case "bottom": return (u, v) => [u, 0, v];
    case "right": return (u, v) => [b.w, u, v];
    case "left": return (u, v) => [0, u, v];
  }
  throw new Error(`unknown face ${face}`);
}

/**
 * Lines and points for a model. Returns
 *   { lines: [{pts:[[x,y,z]...], socket?, kind}], dots: [[x,y,z]...],
 *     labels: [{at:[x,y,z], text, socket?}], size: {w,h,d} }
 */
export function modelGeometry(model) {
  const b = model.body;
  const c = Math.min(b.chamfer ?? 0, b.w / 4, b.d / 4);
  const lines = [];
  const labels = [];
  const dots = [];

  // Body: a prism whose section (x–z) is a rectangle with chamfered corners.
  const sec = c
    ? [[c, 0], [b.w - c, 0], [b.w, c], [b.w, b.d - c], [b.w - c, b.d], [c, b.d], [0, b.d - c], [0, c]]
    : [[0, 0], [b.w, 0], [b.w, b.d], [0, b.d]];
  for (const y of [0, b.h]) lines.push({ kind: "body", pts: [...sec, sec[0]].map(([x, z]) => [x, y, z]) });
  for (const [x, z] of sec) lines.push({ kind: "body", pts: [[x, 0, z], [x, b.h, z]] });

  // Surface points: a fixed grid, so the cloud is the same every time.
  const step = 2.2;
  for (let i = 0; i < sec.length; i++) {
    const [x0, z0] = sec[i];
    const [x1, z1] = sec[(i + 1) % sec.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / step));
    for (let s = 0; s < n; s++) {
      const t = (s + 0.5) / n;
      for (let y = step / 2; y < b.h; y += step) dots.push([x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t]);
    }
  }
  for (const y of [0, b.h]) for (let x = step / 2; x < b.w; x += step) for (let z = step / 2; z < b.d; z += step) {
    const inside = c === 0 || (Math.min(x, b.w - x) + Math.min(z, b.d - z) >= c);
    if (inside) dots.push([x, y, z]);
  }

  for (const p of model.parts ?? []) {
    const lit = p.socket ? { socket: p.socket } : {};
    if (p.face) lit.normal = NORMAL[p.face];
    if (p.kind === "knob") {
      const ring = (x) => circle(p.y, p.z, p.r, 28, (y, z) => [x, y, z]);
      lines.push({ kind: "knob", pts: ring(p.x0) }, { kind: "knob", pts: ring(p.x1) });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        const y = p.y + p.r * Math.cos(a);
        const z = p.z + p.r * Math.sin(a);
        lines.push({ kind: "knob", pts: [[p.x0, y, z], [p.x1, y, z]] });
      }
      if (p.label) labels.push({ at: [p.x1, p.y + p.r, p.z], text: p.label });
      continue;
    }
    const at = onFace(p.face, b);
    const u = ["right", "left"].includes(p.face) ? p.y : p.x;
    const v = ["front", "back"].includes(p.face) ? p.y : p.z;
    if (p.kind === "jack") {
      lines.push({ kind: p.kind, ...lit, pts: circle(u, v, p.r, 32, at) });
      if (p.hole) lines.push({ kind: p.kind, ...lit, pts: circle(u, v, p.hole, 24, at) });
    } else if (p.kind === "hole") {
      lines.push({ kind: p.kind, ...lit, pts: circle(u, v, p.r, 12, at) });
    } else if (p.kind === "usbc") {
      lines.push({ kind: p.kind, ...lit, pts: rounded(u, v, p.w, p.h, p.h / 2 - 0.01, at) });
    } else if (p.kind === "button" || p.kind === "switch") {
      // On a side face u runs along y (its height), v along z (its width).
      lines.push({ kind: p.kind, ...lit, pts: rounded(u, v, p.h, p.w, Math.min(p.h, p.w) / 4, at) });
      if (p.kind === "switch") lines.push({ kind: p.kind, ...lit, pts: rounded(u, v, p.h / 3, p.w * 0.6, 0.3, at) });
    } else if (p.kind === "screen" || p.kind === "panel") {
      lines.push({ kind: p.kind, ...lit, pts: rounded(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, p.kind === "screen" ? 1.2 : 2.4, at) });
    } else {
      throw new Error(`unknown part ${p.kind}`);
    }
    if (p.label) labels.push({ at: at(u, v), text: p.label, ...lit });
  }
  return { lines, dots, labels, size: { w: b.w, h: b.h, d: b.d } };
}

/** The sockets a model shows: {jacks:[...], ports:[...]}, for checking against our data. */
export function modelSockets(model) {
  const all = (model.parts ?? []).map((p) => p.socket).filter(Boolean);
  const JACKS = ["6.35", "4.4", "3.5", "2.5", "xlr4"];
  return { jacks: all.filter((s) => JACKS.includes(s)), ports: all.filter((s) => !JACKS.includes(s)) };
}

/**
 * Draw a model on a canvas and keep it turning; drag to turn it by hand.
 * Returns a stop() function. Colors come from the page's CSS tokens.
 */
export function drawShape(canvas, model, { caption = "" } = {}) {
  const g = modelGeometry(model);
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(canvas);
  const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const ink = color("--text", "#ddd");
  const dim = color("--text-2", "#888");
  const accent = color("--accent", "#4af");
  const center = [g.size.w / 2, g.size.h / 2, g.size.d / 2];
  const radius = Math.hypot(g.size.w, g.size.h, g.size.d) / 2;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let yaw = -0.6;
  let pitch = 0.25;
  let drag = null;
  let idleSince = 0;
  let raf = 0;

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  function frame(now) {
    const [W, H] = size();
    if (!drag && !still && now - idleSince > 1200) yaw += 0.004;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const ring = Math.min(W, H) * 0.46;
    const scale = (ring * 0.86) / radius;
    // Model y is up; screen y is down.
    const proj = ([x, y, z]) => {
      x -= center[0]; y -= center[1]; z -= center[2];
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp;
      const z2 = y * sp + z1 * cp;
      const f = 1 + z2 / (radius * 6);
      return [W / 2 + x1 * scale * f, H / 2 - y2 * scale * f, z2];
    };

    // Is a face turned toward us? (Parts on the far side are drawn faint.)
    const facing = (n) => !n || -n[0] * sy * cp + n[1] * sp + n[2] * cy * cp > 0.05;

    ctx.clearRect(0, 0, W, H);

    // HUD ring: two circles, ticks every 10°, a slow sweep.
    ctx.strokeStyle = dim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, ring, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, ring * 0.93, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5;
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU + yaw;
      const r0 = k % 9 === 0 ? ring * 0.9 : ring * 0.96;
      ctx.beginPath();
      ctx.moveTo(W / 2 + r0 * Math.cos(a), H / 2 + r0 * Math.sin(a));
      ctx.lineTo(W / 2 + ring * Math.cos(a), H / 2 + ring * Math.sin(a));
      ctx.stroke();
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, ring, -yaw * 2, -yaw * 2 + 0.5); ctx.stroke();

    // Points, nearer ones brighter.
    ctx.fillStyle = ink;
    for (const d of g.dots) {
      const [x, y, z] = proj(d);
      ctx.globalAlpha = 0.12 + 0.3 * Math.max(0, Math.min(1, 0.5 + z / (radius * 2)));
      ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    }

    // Lines: the body faint, parts brighter, sockets in the accent color.
    for (const l of g.lines) {
      const seen = facing(l.normal);
      ctx.strokeStyle = l.socket ? accent : ink;
      ctx.globalAlpha = (l.socket ? 1 : l.kind === "body" ? 0.45 : 0.7) * (seen ? 1 : 0.18);
      ctx.lineWidth = l.socket ? 1.6 : 1;
      ctx.beginPath();
      l.pts.forEach((p, k) => { const [x, y] = proj(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }

    // Labels: a leader line out to the side the point is on.
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    // Only labels on faces we can see; each side's labels stacked so they never overlap.
    const shown = g.labels.filter((lb) => facing(lb.normal)).map((lb) => {
      const [x, y] = proj(lb.at);
      return { ...lb, x, y, right: x >= W / 2, ty: y - 10 };
    });
    for (const side of [true, false]) {
      const col = shown.filter((lb) => lb.right === side).sort((a, b) => a.ty - b.ty);
      for (let k = 1; k < col.length; k++) col[k].ty = Math.max(col[k].ty, col[k - 1].ty + 15);
    }
    for (const lb of shown) {
      const { x, y, right, ty } = lb;
      const ex = right ? Math.max(x + 14, W / 2 + ring * 0.55) : Math.min(x - 14, W / 2 - ring * 0.55);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = lb.socket ? accent : dim;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ty); ctx.lineTo(ex + (right ? 12 : -12), ty); ctx.stroke();
      ctx.fillStyle = lb.socket ? accent : dim;
      ctx.textAlign = right ? "left" : "right";
      ctx.fillText(lb.text, ex + (right ? 15 : -15), ty);
    }

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = dim;
    ctx.textAlign = "center";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(`${g.size.w} × ${g.size.h} × ${g.size.d} mm`, W / 2, H - 10);
    if (caption) ctx.fillText(caption, W / 2, 12);
    ctx.globalAlpha = 1;
    if (!still || drag) raf = requestAnimationFrame(frame);
  }

  const down = (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); if (still) raf = requestAnimationFrame(frame); };
  const move = (e) => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * 0.01));
  };
  const up = () => { drag = null; idleSince = performance.now(); };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
