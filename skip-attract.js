(function () {
  const until = Date.now() + 12000;
  const hide = () => {
    const layer = document.getElementById("attract-layer");
    const video = document.getElementById("attract-video");
    if (layer && !layer.classList.contains("hidden")) {
      layer.classList.add("hidden");
      try { layer.click(); } catch (e) {}
    }
    if (video) {
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {}
    }
  };
  hide();
  const t = setInterval(() => {
    hide();
    if (Date.now() > until) clearInterval(t);
  }, 200);
})();
