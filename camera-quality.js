(function () {
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
  async function upgradeIfOn() {
    if (!window.__jtAllowCam) return;
    const video = document.getElementById("video-output");
    if (!video) return;
    const cur = video.srcObject;
    const track = cur && cur.getVideoTracks && cur.getVideoTracks()[0];
    const set = track && track.getSettings ? track.getSettings() : {};
    video._camSet = set;
    if (set.height >= 1280 && set.width <= set.height) return;
    try {
      const deviceId = await bestDeviceId();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
          frameRate: { ideal: 30, max: 30 }
        }
      });
      video._camSet = stream.getVideoTracks()[0].getSettings?.() || {};
      if (cur && cur !== stream) {
        try { cur.getTracks().forEach((t) => t.stop()); } catch (_) {}
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
    } catch (_) {}
  }
  setInterval(upgradeIfOn, 2000);
})();
