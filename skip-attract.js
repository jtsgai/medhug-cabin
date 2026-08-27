(function () {
  let lastAct = Date.now();
  const mark = () => { lastAct = Date.now(); };
  ["pointerdown", "touchstart", "keydown", "click"].forEach((ev) => {
    document.addEventListener(ev, mark, { passive: true });
  });
  const hide = () => {
    const layer = document.getElementById("attract-layer");
    const video = document.getElementById("attract-video");
    if (layer) {
      layer.classList.remove("allow-attract");
      layer.classList.add("hidden");
      try { layer.click(); } catch (e) {}
    }
    if (video) {
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {}
    }
  };
  hide();
  setInterval(() => {
    const idle = Date.now() - lastAct >= 90000;
    const layer = document.getElementById("attract-layer");
    if (!idle) {
      hide();
    } else if (layer) {
      layer.classList.add("allow-attract");
    }
  }, 200);
})();
