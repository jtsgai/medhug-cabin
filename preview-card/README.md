# `/preview-card/` — isolated try-on preview (not production)

This route is a **feature-branch preview** of the new card + right-rail try-on layout. It is **not** the live site at `/`. Do not merge to `main` or point GitHub Pages at it until the cabin trial and review are signed off.

## What it is

- Person is shown in a rounded 9:16 card at **标准 2×** by default (with **清晰 1×** and **全屏对照** staff switches). Switching modes only changes CSS; the model stream stays `720×1280`.
- Garment grid is on the **right**, using the existing dark + ivory + soft gold palette.
- Local preview and the stream sent to Lucy share one offscreen `720×1280` canvas (`window.__jtVtonIn`). This folder does **not** load `force-cam.js` or `ui-over-video.css`.
- OBS 1920×1080 preset (default on) crops the calibrated ROI `[556, 1, 808, 1078]` and **contains** it into 9:16 with dark / soft-blur top and bottom padding. If the measured source is not exactly 1920×1080, or the preset is turned off, it falls back to the live generic 9:16 center cover. The ROI is never applied silently to the wrong size.
- Token, catalog, and assets are reused from the site root (`../catalog.json`, `../assets/`, `https://live.medhug.ai/api/decart-token`). Live root files are not modified.

## How to serve (cabin or laptop)

From the repository root (so `../catalog.json` and `../assets/` resolve):

```bash
npx serve .
# or: python3 -m http.server 8080
```

Then open `/preview-card/` in Chrome. Compare against live `/` on the same machine.

Useful query flags:

- `?mode=1` / `?mode=2` / `?mode=full` — initial display mode
- `?obs=off` — start with the OBS preset off
- `?fps=20` — canvas capture frame rate (default 20)
- `?usage=0` — do not report try-on minutes to `live.medhug.ai`
- `?owner=0` — hide the owner minutes badge

When an OBS / virtual camera is selected, the page requests `1920×1080` with `resizeMode: "none"` (no 9:16 aspectRatio) so Chrome does not pre-crop the landscape canvas. The ROI still applies only if the measured track is exactly 1920×1080; the badge detail shows `track.getSettings()` width × height for cabin verification.

## Checks

```bash
# unit + static only
node preview-card/check-preview-card.mjs --no-browser

# also headless Chromium @ 1440×2560, dpr 1.5
PREVIEW_CARD_SHOTS=/tmp/preview-card-shots node preview-card/check-preview-card.mjs
```

Playwright is not a repo dependency. The script uses a machine-local Playwright/Chromium if present.

## Not tested here

These require the Windows 86" cabin and must be done on site:

- Physical C922 + production OBS 1920×1080@60 virtual camera
- Live Decart Lucy session with a real `live.medhug.ai` token
- Perceived sharpness of 1× vs 2× vs fullscreen on the 4K panel
- Any change to production OBS (this route does not touch OBS)

## Files

All new code lives in this folder. The pinned try-on core is still loaded from jsDelivr (`jtsgai/medhug-cabin@424f015…`) and patched in memory (paths, token, canvas input, layout no-op).
