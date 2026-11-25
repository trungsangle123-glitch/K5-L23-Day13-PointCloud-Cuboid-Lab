# CVAT Point Cloud Boost

Chromium Manifest V3 extension for Chrome, Edge, Brave, and other Chromium-based browsers. It adds a draggable panel to CVAT's 3D view to adjust point size and brightness. Settings are saved in the site's local storage; the extension does not send data anywhere.

## Install for testing

1. Open the browser's extensions page (`chrome://extensions` or `edge://extensions`).
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this folder.
4. Open or reload a matching CVAT page.

## Add another CVAT address

Add a matching URL pattern to `matches` in `manifest.json`. For example:

```json
"https://cvat.example.com/*"
```

Then reload the unpacked extension and refresh CVAT.

## Publish

Zip the contents of this folder (so `manifest.json` is at the ZIP root) and upload the ZIP to the relevant Chromium extension store. Store accounts, listing materials, and review are handled by the publisher; this source package does not publish itself.

The extension requests access only to the CVAT addresses listed in its manifest. Store review may require adding further CVAT addresses to the manifest and explaining this site access in the listing.
