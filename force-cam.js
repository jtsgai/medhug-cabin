(function () {
  let canvas, ctx, started = false;
  function ensureCanvas() {
    canvas = document.getElementById("video-sharp");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "video-sharp";
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:1;pointer-events:none;background:transparent;";
    if (!ctx) ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  }
  function sizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    }
  }
  function hideTag(v) {
    v.style.setProperty("opacity", "0", "important");
    v.style.setProperty("position", "fixed", "important");
    v.style.setProperty("width", "8px", "important");
    v.style.setProperty("height", "8px", "important");
    v.style.setProperty("z-index", "-1", "important");
    v.style.setProperty("transform", "none", "important");
  }
  function draw(video) {
    if (!ctx || !canvas) {
      requestAnimationFrame(() => draw(video));
      return;
    }
    if (video.readyState >= 2 && video.videoWidth) {
      const w = canvas.width, h = canvas.height;
      const vw = video.videoWidth, vh = video.videoHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      if (vw > vh) {
        ctx.rotate(-Math.PI / 2);
        const scale = Math.min(w / vh, h / vw);
        ctx.drawImage(video, -vw * scale / 2, -vh * scale / 2, vw * scale, vh * scale);
      } else {
        const scale = Math.min(w / vw, h / vh);
        ctx.drawImage(video, -vw * scale / 2, -vh * scale / 2, vw * scale, vh * scale);
      }
      ctx.restore();
    }
    requestAnimationFrame(() => draw(video));
  }
  function apply() {
    const v = document.getElementById("video-output");
    if (!v) return;
    if (v.parentElement !== document.body) document.body.insertBefore(v, document.body.firstChild);
    hideTag(v);
    ensureCanvas();
    sizeCanvas();
    if (!started) {
      started = true;
      draw(v);
    }
  }
  window.addEventListener("resize", sizeCanvas);
  apply();
  setInterval(apply, 400);
})();
