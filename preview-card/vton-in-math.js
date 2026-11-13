// Pure math for the preview-card Lucy input canvas. No DOM access: Node can import this file.
// The canvas that is pushed to Lucy AND shown locally is always 720x1280 (9:16).

export const CANVAS_W = 720;
export const CANVAS_H = 1280;
export const DEFAULT_FPS = 20;
export const FILL_COLOR = "#0e0e0e"; // same as --bg in styles.css

// Calibrated OBS "holo cabin" region: source canvas 1920x1080, person region ~3:4.
export const OBS_SRC_W = 1920;
export const OBS_SRC_H = 1080;
export const OBS_ROI = Object.freeze({ sx: 556, sy: 1, sw: 808, sh: 1078 });

export const STATUS_OBS_CONTAIN = "obs-contain";
export const STATUS_GENERIC_COVER = "generic-cover";

// reason: why this status was chosen. UI labels are derived from it.
export const REASON_PRESET_HIT = "preset-hit"; // preset on + measured 1920x1080
export const REASON_PRESET_MISS = "preset-miss"; // preset on + any other measured size
export const REASON_PRESET_OFF = "preset-off"; // preset toggled off
export const REASON_NO_VIDEO = "no-video"; // no measured size yet

export function resolveFps(value, fallback = DEFAULT_FPS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(60, Math.round(n));
}

// Same math as the live vton-portrait.js: centered 9:16 cover crop of the source.
export function genericCoverCrop(vw, vh) {
  const target = CANVAS_W / CANVAS_H;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (vw / vh > target) {
    sw = vh * target;
    sx = (vw - sw) / 2;
  } else {
    sh = vw / target;
    sy = (vh - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

/**
 * @param {number} videoWidth  measured videoWidth of the hidden source <video> (NOT a CSS size)
 * @param {number} videoHeight measured videoHeight
 * @param {{obsPresetEnabled?: boolean, fps?: number}} [opts]
 * @returns {{status:string, reason:string, fps:number, src:object|null, dst:object|null,
 *            canvas:{w:number,h:number}, fill:string, backdrop:boolean, videoWidth:number,
 *            videoHeight:number, obsPresetEnabled:boolean}}
 */
export function computeVtonLayout(videoWidth, videoHeight, opts = {}) {
  const obsPresetEnabled = opts.obsPresetEnabled === undefined ? true : Boolean(opts.obsPresetEnabled);
  const fps = resolveFps(opts.fps);
  const vw = Number(videoWidth);
  const vh = Number(videoHeight);
  const base = {
    fps,
    canvas: { w: CANVAS_W, h: CANVAS_H },
    fill: FILL_COLOR,
    videoWidth: vw || 0,
    videoHeight: vh || 0,
    obsPresetEnabled,
  };

  if (!(vw > 0) || !(vh > 0)) {
    // Nothing measured yet. Keep "preset off" visible to the UI even before the first frame.
    const reason = obsPresetEnabled ? REASON_NO_VIDEO : REASON_PRESET_OFF;
    return { ...base, status: STATUS_GENERIC_COVER, reason, src: null, dst: null, backdrop: false };
  }

  const generic = (reason) => ({
    ...base,
    status: STATUS_GENERIC_COVER,
    reason,
    src: genericCoverCrop(vw, vh),
    dst: { dx: 0, dy: 0, dw: CANVAS_W, dh: CANVAS_H },
    backdrop: false,
  });

  if (!obsPresetEnabled) return generic(REASON_PRESET_OFF);
  // The ROI is a fixed calibration for the 1920x1080 OBS canvas. Never apply it to any other size.
  if (vw !== OBS_SRC_W || vh !== OBS_SRC_H) return generic(REASON_PRESET_MISS);

  const dw = CANVAS_W;
  const dh = (CANVAS_W * OBS_ROI.sh) / OBS_ROI.sw; // ~960.5911
  return {
    ...base,
    status: STATUS_OBS_CONTAIN,
    reason: REASON_PRESET_HIT,
    src: { ...OBS_ROI },
    dst: { dx: 0, dy: (CANVAS_H - dh) / 2, dw, dh }, // dy ~159.7045
    backdrop: true,
  };
}

export const STATUS_LABELS = Object.freeze({
  [REASON_PRESET_HIT]: "预设已命中",
  [REASON_PRESET_MISS]: "预设未命中",
  [REASON_PRESET_OFF]: "预设已关闭",
  [REASON_NO_VIDEO]: "等待画面",
});
