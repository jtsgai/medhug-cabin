(function () {
  const MODES = [
    { width: 1080, height: 1920 },
    { width: 720, height: 1280 },
    { width: 1440, height: 2560 },
    { width: 2160, height: 3840 },
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
        if (/usb|logitech|brio|studio|4k|1080|hd|c920|c922|c930/i.test(n)) s += 5;
        if (/integrated|ir |infrared|face/i.test(n)) s -= 4;
        return { id: d.deviceId, s };
      }).sort((a, b) => b.s - a.s);
      return scored[0].id;
    } catch (_) {
      return undefined;
    }
  }
  async function openPortrait() {
    const video = document.getElementById("video-output");
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
            aspectRatio: { ideal: mode.height / mode.width },
            frameRate: { ideal: 30, max: 30 }
          }
        });
        const set = stream.getVideoTracks()[0].getSettings?.() || {};
        video._camSet = set;
        if ((set.width || 0) >= 640) break;
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
    await video.play().catch(() => {});
  }
  function boot() {
    setTimeout(openPortrait, 300);
    setTimeout(openPortrait, 1400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
