# CVAT Point Cloud Boost

Chromium Manifest V3 extension for Chrome, Edge, Brave, and other Chromium-based browsers. It adds a draggable panel to CVAT's 3D view to adjust point size and brightness. Settings are saved in the site's local storage; the extension does not send data anywhere.

## Install for testing

1. Open the browser's extensions page (`chrome://extensions` or `edge://extensions`).
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this folder.
4. Open or reload a matching CVAT page.

## Project cuboids onto camera images

CVAT 2.82/2.83 does not draw cuboids on the related camera images. This extension overlays them on every visible camera tile:

1. Click **Load calib** and select `calib.json` from the sequence you are annotating (`data/data-VF/sequence_XX/calib.json`). Alternatively, click **Folder** and select the whole `data-VF` folder to load all sequences at once. Files are read locally and never uploaded.
2. The projected cuboids appear on the camera tiles. Hover a tile and use its gear icon to switch camera.
3. `Alt+O` toggles projection on/off. With projection off, clicking a cuboid in any 3D frame shows only that cuboid on the image; clicking empty space hides it again. Calibration is saved in the CVAT site's `localStorage`, keyed by sequence (`sXX` in the frame name).

The overlay reads the live cuboid meshes from CVAT's 3D canvas on every animation frame, so the box follows the pointer while you draw, move, or resize it. It falls back to CVAT's annotation API (about every 0.7 seconds) if the live canvas data is unavailable. The overlay is clipped to its own image tile and hides automatically while a zoomed/maximized 3D frame covers that tile.

## Add another CVAT address

Add a matching URL pattern to `matches` in `manifest.json`. For example:

```json
"https://cvat.example.com/*"
```

Then reload the unpacked extension and refresh CVAT.

## Publish

Zip the contents of this folder (so `manifest.json` is at the ZIP root) and upload the ZIP to the relevant Chromium extension store. Store accounts, listing materials, and review are handled by the publisher; this source package does not publish itself.

The extension requests access only to the CVAT addresses listed in its manifest. Store review may require adding further CVAT addresses to the manifest and explaining this site access in the listing.
