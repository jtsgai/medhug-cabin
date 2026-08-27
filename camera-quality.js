(function () {
  const MODES = [
    { width: 3840, height: 2160 },
    { width: 2560, height: 1440 },
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 }
  ];

  async function bestDeviceId() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      if (!cams.length) return undefined;
      const scored = cams.map((d) => {
        const n = (d.label || "").toLowerCase();
        let s = 0;
        if (/usb|logitech|brio|studio|4k|1080|hd|c920|c922|c930|osmo|insta/i.test(n)) s += 5;
        if (/integrated|ir |infrared|face|metadata/i.test(n)) s -= 4;
        return { id: d.deviceId, s, n };
      }).sort((a, b) => b.s - a.s);
      return scored[0].id;
    } catch (_) {
      return undefined;
    }
  }

  async function openHighRes() {
    const video = document.querySelector("#video-output");
    if (!video) return;
    const deviceId = await bestDeviceId();
    let stream = null;
    for (const mode of MODES) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: mode.width },
            height: { ideal: mode.height },
            frameRate: { ideal: 30, max: 30 }
          }
        });
        const track = stream.getVideoTracks()[0];
        const set = track.getSettings ? track.getSettings() : {};
        if ((set.width || 0) >= 1280 || mode.width <= 1280) break;
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      } catch (_) {
        stream = null;
      }
    }
    if (!stream) return;
    const prev = video.srcObject;
    if (prev && prev !== stream) {
      try { prev.getTracks().forEach((t) => t.stop()); } catch (_) {}
    }
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.style.imageRendering = "auto";
    await video.play().catch(() => {});
    video._hqW = (stream.getVideoTracks()[0].getSettings() || {}).width || 0;
  }

  async function keep() {
    const video = document.querySelector("#video-output");
    if (!video) return;
    const w = video.videoWidth || video._hqW || 0;
    if (w && w < 1280) await openHighRes();
    if (!video.srcObject) await openHighRes();
  }

  function boot() {
    setTimeout(openHighRes, 400);
    setTimeout(openHighRes, 1600);
    setInterval(keep, 4000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
