# Recolour

A Chrome extension that lets you right-click any element on a webpage and recolor it on the fly — background, border, shadow, or text — without touching DevTools.

<img width="449" height="336" alt="image" src="https://github.com/user-attachments/assets/7c4a6006-41ad-4904-a8bf-35b2da7ac945" />

## Features

- **Right-click → Recolour** to open a draggable popup with controls for whichever color properties the element actually has (background, border, shadow, text).
- **Native color picker** on each row for fine-tuning, plus an **eyedropper** to sample any pixel on the page.
- **Suggested palette** of the most-used colors on the current page, applied with one click.
- **Yellow highlight outline** marks the element you're editing (toggleable).
- **Reset** restores the element's original styles.
- **Hex everywhere** — copy or apply colors as `#RRGGBB` (or `#RRGGBBAA` if the source has alpha).

## Install (Chrome / Edge — load unpacked)

1. Clone or download this repo to a folder on your machine.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Toggle **Developer mode** on (top-right corner).
4. Click **Load unpacked** and select the cloned folder.
5. The paintbrush icon should appear in your extensions list.

## Install (Firefox — temporary add-on)

1. Clone or download this repo.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select the `manifest.json` file in the cloned folder.
4. The extension is active until you close Firefox. For permanent install, the add-on needs to be signed via [AMO](https://addons.mozilla.org/).

> **Note:** the eyedropper button relies on the Chrome-only [`EyeDropper` API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API). On Firefox it shows a "not supported" toast — every other feature (color pickers, suggested palette, recolor, reset, outline) works fine.

## Usage

Right-click any element on a webpage and choose **Recolour** from the context menu. If the page was open before you installed the extension, the first right-click will auto-inject the content script and prompt you to right-click again — after that it works on every page.

## Files

- `manifest.json` — Manifest V3 config
- `background.js` — service worker that registers the context menu
- `content.js` — page-side UI and color logic
- `icon.svg` / `icons/` — extension icon (SVG source + rasterized PNGs)
