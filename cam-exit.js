(function () {
  function stopCam() {
    window.__jtAllowCam = false;
    if (window.jtCamOff) window.jtCamOff();
    document.querySelectorAll("video").forEach((v) => {
      if (v.id === "attract-video") return;
      const s = v.srcObject;
      if (!s) return;
      try { s.getTracks().forEach((t) => t.stop()); } catch (_) {}
      v.srcObject = null;
    });
    const c = document.getElementById("video-sharp");
    if (c) {
      const x = c.getContext("2d");
      if (x) x.clearRect(0, 0, c.width, c.height);
      c.remove();
    }
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#btn-end, #btn-end-close, #btn-session-done, #btn-change, #btn-return-dot, #btn-expand-strip, #btn-stop, #btn-reset")) return;
    stopCam();
    setTimeout(stopCam, 80);
    setTimeout(stopCam, 400);
    setTimeout(stopCam, 1500);
  }, true);
})();
