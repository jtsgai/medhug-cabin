(function () {
  try { localStorage.setItem("jt_cam_rot", "-90"); } catch (_) {}
  const MODES = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 1080, height: 1920 }
  ];
  function fitVideo(video) {
    video.style.position = "fixed";
    video.style.left = "50%";
    video.style.top = "50%";
    video.style.width = "100vh";
    video.style.height = "100vw";
    video.style.objectFit = "cover";
    video.style.objectPosition = "center center";
    video.style.transformOrigin = "center center";
    video.style.transform = "translate(-50%, -50%) rotate(-90deg)";
  }
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
            frameRate: { ideal: 30, max: 30 }
          }
        });
        if ((stream.getVideoTracks()[0].getSettings?.().width || 0) >= 720) break;
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      } catch (_) { stream = null; }
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
    setTimeout(openHighRes, 400);
    setTimeout(openHighRes, 1600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
