(async function () {
  const video = document.querySelector("#video-output");
  if (!video || video._hqCam) return;
  video._hqCam = true;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    const prefer = cams.find((d) => /usb|hd|4k|logitech|c9|c92|brio|studio|external/i.test(d.label))
      || cams.find((d) => !/integrated|ir |infrared|face/i.test(d.label))
      || cams[0];
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: prefer?.deviceId ? { ideal: prefer.deviceId } : undefined,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 }
      }
    });
    const old = video.srcObject;
    if (old && old !== stream) {
      try { old.getTracks().forEach((t) => t.stop()); } catch (_) {}
    }
    video.srcObject = stream;
    video.muted = true;
    await video.play().catch(() => {});
  } catch (e) {
    console.warn("camera-quality", e);
  }
})();
