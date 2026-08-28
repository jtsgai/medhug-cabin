(function () {
  let canvas, ctx;
  function ensure() {
    canvas = document.getElementById("video-key");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "video-key";
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;background:transparent;";
    if (!ctx) ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  }
  function hideVideo(v) {
    v.style.setProperty("opacity", "0", "important");
    v.style.setProperty("position", "fixed", "important");
    v.style.setProperty("width", "8px", "important");
    v.style.setProperty("height", "8px", "important");
    v.style.setProperty("z-index", "-1", "important");
  }
  function keyFrame(video) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const landscape = vw > vh;
    const dw = landscape ? 640 : 360;
    const dh = Math.round(dw * vh / vw);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(video, 0, 0, dw, dh);
    const img = ctx.getImageData(0, 0, dw, dh);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const y = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
      if (y < 18) {
        p[i + 3] = 0;
      } else if (y < 42) {
        p[i + 3] = Math.round(((y - 18) / 24) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    if (landscape) {
      canvas.style.setProperty("inset", "auto", "important");
      canvas.style.setProperty("left", "50%", "important");
      canvas.style.setProperty("top", "50%", "important");
      canvas.style.setProperty("width", "1280px", "important");
      canvas.style.setProperty("height", "720px", "important");
      canvas.style.setProperty("max-width", "92vw", "important");
      canvas.style.setProperty("max-height", "36vh", "important");
      canvas.style.setProperty("transform", "translate(-50%, -50%)", "important");
      canvas.style.setProperty("object-fit", "contain", "important");
    } else {
      canvas.style.setProperty("inset", "0", "important");
      canvas.style.setProperty("left", "0", "important");
      canvas.style.setProperty("top", "0", "important");
      canvas.style.setProperty("width", "100vw", "important");
      canvas.style.setProperty("height", "100vh", "important");
      canvas.style.setProperty("max-width", "none", "important");
      canvas.style.setProperty("max-height", "none", "important");
      canvas.style.setProperty("transform", "none", "important");
    }
  }
  function tick() {
    const v = document.getElementById("video-output");
    ensure();
    if (!v || !v.srcObject || v.readyState < 2 || !v.videoWidth) {
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      requestAnimationFrame(tick);
      return;
    }
    hideVideo(v);
    keyFrame(v);
    requestAnimationFrame(tick);
  }
  tick();
})();
