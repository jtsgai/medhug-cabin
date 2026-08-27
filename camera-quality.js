(function () {
  const MODES = [
    { width: 2160, height: 3840 },
    { width: 1080, height: 1920 },
    { width: 720, height: 1280 },
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
        return { id: d.deviceId, s };
      }).sort((a, b) => b.s - a.s);
      return scored[0].id;
    } catch (_) {
      return undefined;
    }
  }

  function fitVideo(video) {
    video.style.position = "fixed";
    video.style.inset = "0";
    video.style.width = "100vw";
    video.style.height = "100vh";
    video.style.objectFit = "contain";
    video.style.objectPosition = "center bottom";
    video.style.background = "transparent";
    video.style.imageRendering = "auto";
  }

  async function openHighRes() {
    const video = document.querySelector("#video-output");
    if (!video) return;
    fitVideo(video);
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
        if ((set.height || 0) >= 720) break;
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
    fitVideo(video);
    await video.play().catch(() => {});
  }

  function boot() {
    const video = document.querySelector("#video-output");
    if (video) fitVideo(video);
    setTimeout(openHighRes, 500);
    setTimeout(openHighRes, 1800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
