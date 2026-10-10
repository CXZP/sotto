// Screenshot redactor. Order screenshots show names, addresses and phone
// numbers; people drag black boxes over them before anything leaves the device.
// Re-encoding through a canvas also drops EXIF (GPS, device) metadata.

const MAX_SIDE = 1600;
const MAX_BYTES = 1_900_000;

/** Opens a modal; resolves to a JPEG Blob, or null if cancelled. */
export function redactImage(file, t) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k);
      const h = Math.round(img.naturalHeight * k);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      const boxes = [];
      let drag = null;
      const draw = () => {
        ctx.drawImage(img, 0, 0, w, h);
        ctx.fillStyle = "#000";
        for (const b of boxes) ctx.fillRect(b.x, b.y, b.w, b.h);
        if (drag) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(drag.x, drag.y, drag.w, drag.h);
        }
      };
      draw();

      const dlg = document.createElement("dialog");
      dlg.className = "redact";
      dlg.innerHTML = `<form method="dialog" class="redact-inner">
        <p class="strong">${t("rd_title")}</p>
        <p class="small muted">${t("rd_help")}</p>
        <div class="redact-canvas"></div>
        <div class="row-inline">
          <button type="button" class="pill" data-undo>${t("rd_undo")}</button>
          <span class="grow"></span>
          <button type="button" class="pill" data-cancel>${t("rd_cancel")}</button>
          <button type="button" class="pill primary" data-ok>${t("rd_ok")}</button>
        </div></form>`;
      dlg.querySelector(".redact-canvas").append(canvas);
      document.body.append(dlg);
      dlg.showModal();

      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h };
      };
      let start = null;
      canvas.addEventListener("pointerdown", (e) => {
        canvas.setPointerCapture(e.pointerId);
        start = pos(e);
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!start) return;
        const p = pos(e);
        drag = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
        draw();
      });
      canvas.addEventListener("pointerup", () => {
        if (drag && drag.w > 3 && drag.h > 3) boxes.push(drag);
        start = drag = null;
        draw();
      });

      const finish = async (ok) => {
        dlg.close();
        dlg.remove();
        if (!ok) return resolve(null);
        let q = 0.85;
        let blob = await toBlob(canvas, q);
        while (blob && blob.size > MAX_BYTES && q > 0.4) blob = await toBlob(canvas, (q -= 0.15));
        resolve(blob);
      };
      dlg.querySelector("[data-undo]").addEventListener("click", () => {
        boxes.pop();
        draw();
      });
      dlg.querySelector("[data-cancel]").addEventListener("click", () => finish(false));
      dlg.querySelector("[data-ok]").addEventListener("click", () => finish(true));
      dlg.addEventListener("cancel", () => finish(false), { once: true });
    };
    img.src = url;
  });
}

const toBlob = (canvas, q) => new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
