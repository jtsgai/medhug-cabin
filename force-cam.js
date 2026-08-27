(function () {
  let canvas, ctx;
  function ensureCanvas() {
    canvas = document.getElementById("video-sharp");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "video-sharp";
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;background:transparent;";
    ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  }
  function sizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
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
    v.style.setProperty("width", "4px", "important");
    v.style.setProperty("height", "4px", "important");
    v.style.setProperty("z-index", "-1", "important");
  }
  function isPortrait(video) {
    const set = video._camSet || {};
    const w = set.width || video.videoWidth || 0;
    const h = set.height || video.videoHeight || 0;
    return h > w;
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
      if (isPortrait(video)) {
        const scale = Math.min(w / vw, h / vh);
        ctx.drawImage(video, -vw * scale / 2, -vh * scale / 2, vw * scale, vh * scale);
      } else {
        ctx.rotate(-Math.PI / 2);
        const scale = Math.min(w / vh, h / vw);
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
    if (!v._sharpLoop) {
      v._sharpLoop = true;
      draw(v);
    }
  }
  window.addEventListener("resize", sizeCanvas);
  apply();
  setInterval(apply, 800);
})();
