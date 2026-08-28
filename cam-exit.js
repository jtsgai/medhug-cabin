(function () {
  function stopCam() {
    if (window.jtCamOff) window.jtCamOff();
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#btn-end, #btn-end-close, #btn-session-done, #btn-change, #btn-return-dot, #btn-expand-strip")) return;
    stopCam();
    setTimeout(stopCam, 120);
  }, true);
})();
