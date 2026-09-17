(() => {
  const ENDPOINT = "https://live.medhug.ai/api/usage";
  const FEATURES = new Set(["tryon", "kids", "fx", "stage"]);
  let active = null;

  function clampSeconds(value) {
    const seconds = Number.isFinite(value) ? Math.ceil(value) : 0;
    return Math.min(60, Math.max(0, seconds));
  }

  function report(feature, seconds, closing = false) {
    const body = JSON.stringify({ feature, seconds: clampSeconds(seconds) });
    try {
      if (closing && navigator.sendBeacon) {
        const queued = navigator.sendBeacon(
          ENDPOINT,
          new Blob([body], { type: "text/plain;charset=UTF-8" }),
        );
        if (queued) return;
      }
      void fetch(ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: closing,
      }).catch(() => {});
    } catch (_) {
      // Usage reporting must never interrupt the experience.
    }
  }

  function start(feature) {
    if (!FEATURES.has(feature)) return;
    if (active?.feature === feature) return;
    if (active) stop(active.feature);
    active = { feature, startedAt: Date.now() };
  }

  function stop(feature, closing = false) {
    if (!active || active.feature !== feature) return;
    const seconds = Math.max(0, (Date.now() - active.startedAt) / 1000);
    report(active.feature, seconds, closing);
    active = null;
  }

  window.UsageClient = Object.freeze({ start, stop });

  window.addEventListener("pagehide", () => {
    if (active) stop(active.feature, true);
  });
})();
