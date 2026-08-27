(function () {
  let lastAct = Date.now();
  const mark = () => { lastAct = Date.now(); };
  ["pointerdown", "touchstart", "keydown", "click"].forEach((ev) => {
    document.addEventListener(ev, mark, { passive: true });
  });
  const hide = () => {
    const layer = document.getElementById("attract-layer");
    const video = document.getElementById("attract-video");
    if (layer && !layer.classList.contains("hidden")) {
      layer.classList.add("hidden");
      try { layer.click(); } catch (e) {}
    }
    if (video) {
      try { video.pause(); } catch (e) {}
    }
  };
  hide();
  setInterval(() => {
    if (Date.now() - lastAct < 90000) hide();
  }, 250);
})();
