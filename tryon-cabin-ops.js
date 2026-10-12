(() => {
  const reason = document.createElement("div");
  reason.id = "tryon-reason";
  reason.className = "tryon-reason hidden";
  document.body.appendChild(reason);
  let reasonTimer = 0;

  function showReason(text) {
    const clean = String(text || "").replace(/\u8bf7\u770b\u6444\u50cf\u5934/g, "").trim();
    if (!clean) return;
    reason.textContent = clean;
    reason.classList.remove("hidden");
    clearTimeout(reasonTimer);
    reasonTimer = setTimeout(() => reason.classList.add("hidden"), 5000);
  }
  window.__jtTryonReason = showReason;

  const dock = document.getElementById("jt-dock");
  const end = document.createElement("button");
  end.type = "button";
  end.id = "btn-dock-end";
  end.className = "jt-dock-end hidden";
  end.textContent = "\u7ed3\u675f\u8bd5\u7a7f";
  end.addEventListener("click", () => document.getElementById("btn-end")?.click());
  dock?.appendChild(end);

  const stats = document.createElement("div");
  stats.id = "owner-stats";
  stats.className = "owner-stats hidden";
  document.body.appendChild(stats);

  async function refreshOwner() {
    try {
      const r = await fetch("https://live.medhug.ai/api/cabin-owner", { credentials: "include" });
      if (!r.ok) return stats.classList.add("hidden");
      const d = await r.json();
      stats.textContent = `\u6362\u8863\u5df2\u7528 ${d.tryon_minutes || 0} \u5206\u949f\n\u5df2\u5145\u503c S$${Number(d.topped_up || 0).toFixed(0)}\n\u5269\u4f59 S$${Number(d.remaining || 0).toFixed(0)}`;
      stats.classList.remove("hidden");
    } catch {
      stats.classList.add("hidden");
    }
  }
  refreshOwner();
  setInterval(refreshOwner, 20000);

  const video = document.getElementById("video-output");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let last = null;
  let absentSince = 0;
  let detector = null;
  if (typeof FaceDetector !== "undefined") {
    try { detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); } catch { detector = null; }
  }

  setInterval(async () => {
    const live = document.getElementById("btn-end") && !document.getElementById("btn-end").classList.contains("hidden");
    end.classList.toggle("hidden", !live);
    end.textContent = document.documentElement.lang === "en" ? "End" : "\u7ed3\u675f\u8bd5\u7a7f";
    if (!live || !video?.videoWidth) {
      absentSince = 0;
      return;
    }
    let person = false;
    if (detector) {
      try {
        const faces = await detector.detect(video);
        person = Boolean(faces && faces.length);
      } catch { person = false; }
    }
    if (!person) {
      canvas.width = 64;
      canvas.height = 36;
      try {
        ctx.drawImage(video, 0, 0, 64, 36);
        const data = ctx.getImageData(0, 0, 64, 36).data;
        if (last) {
          let diff = 0;
          for (let i = 0; i < data.length; i += 16) diff += Math.abs(data[i] - last[i]);
          if (diff / (data.length / 16) > 8) person = true;
        }
        last = data;
      } catch { last = null; }
    }
    if (person) absentSince = 0;
    else if (!absentSince) absentSince = Date.now();
    else if (Date.now() - absentSince >= 20000) {
      absentSince = 0;
      document.getElementById("btn-end")?.click();
    }
  }, 500);
})();
