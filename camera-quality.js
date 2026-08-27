(function () {
  const MODES = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 1080, height: 1920 },
    { width: 2160, height: 3840 }
  ];
  function rot() {
    const n = Number(localStorage.getItem("jt_cam_rot"));
    return n === 90 || n === -90 || n === 0 || n === 180 ? n : -90;
  }
  function fitVideo(video) {
    const r = rot();
    video.style.position = "fixed";
    video.style.left = "50%";
    video.style.top = "50%";
    video.style.right = "auto";
    video.style.bottom = "auto";
    video.style.width = r === 0 || r === 180 ? "100vw" : "100vh";
    video.style.height = r === 0 || r === 180 ? "100vh" : "100vw";
    video.style.objectFit = "cover";
    video.style.objectPosition = "center center";
    video.style.background = "transparent";
    video.style.transformOrigin = "center center";
    video.style.transform = "translate(-50%, -50%) rotate(" + r + "deg)";
  }
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
        const set = stream.getVideoTracks()[0].getSettings?.() || {};
        if ((set.width || 0) >= 720) break;
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
    setTimeout(openHighRes, 400);
    setTimeout(openHighRes, 1600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
