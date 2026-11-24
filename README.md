# CurseForge Direct Downloads

Chrome extension that intercepts CurseForge Minecraft mod download links and downloads files directly through the CurseForge API and authenticated ForgeCDN requests.

## Features

- Popup settings in English
- API key testing
- Toggle interception
- Optional confirmation before downloads
- Optional download subfolder
- Project ID caching and cache clearing
- Restore default settings

## Installation

1. Download and extract this repository.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Select **Load unpacked** and choose this folder.

## API key

The extension includes a default key value. You can edit or replace it in the popup settings.

## GitGuardian

If GitGuardian flags the intentionally bundled default key, mark that specific finding as ignored using GitGuardian's ignore workflow rather than disabling secret scanning globally. For ggshield, run `ggshield secret ignore --last-found` after the relevant scan; it records the ignored match in `.gitguardian.yaml`.

## License

MIT
