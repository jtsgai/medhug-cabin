(function () {
  const W = 720, H = 1280;
  let canvas, ctx, srcVideo, raf;

  function ensure() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.style.display = "none";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d", { alpha: false });
    srcVideo = document.createElement("video");
    srcVideo.muted = true;
    srcVideo.playsInline = true;
    srcVideo.autoplay = true;
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!srcVideo || !srcVideo.videoWidth) return;
    const vw = srcVideo.videoWidth;
    const vh = srcVideo.videoHeight;
    const target = W / H;
    const srcR = vw / vh;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (srcR > target) {
      sw = vh * target;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / target;
      sy = (vh - sh) / 2;
    }
    ctx.drawImage(srcVideo, sx, sy, sw, sh, 0, 0, W, H);
  }

  async function fromStream(stream) {
    if (!stream) {
      window.__jtVtonIn = null;
      return null;
    }
    ensure();
    srcVideo.srcObject = stream;
    await srcVideo.play().catch(() => {});
    cancelAnimationFrame(raf);
    draw();
    window.__jtVtonIn = canvas.captureStream(30);
    return window.__jtVtonIn;
  }

  window.jtPortraitIn = fromStream;
})();
