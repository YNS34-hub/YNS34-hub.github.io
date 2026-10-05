# Jie Tian's personal media

Drop images into `wallpapers/`, `chatgpt-images/`, `projects/` or `research/`, and audio into `music/`. Run `npm run build` (or restart `npm run dev`). New files are registered recursively without editing code. JPG/JPEG/PNG/WEBP/AVIF images and MP3/FLAC/WAV/M4A audio are supported. ChatGPT Library is not connected.

Optional `collection.json` in each folder can be an array of records with a `file` field, or an object keyed by relative filename. For one image, a single record is also accepted:

```json
{"file":"supernova.png","title":"A star remembers","category":"cosmic","year":"2026","favorite":true,"color":"#263d78","width":1920,"height":1080}
```

Visual categories `cosmic`, `glass`, `portrait` enter their corresponding rooms. Unknown categories enter Imagined Worlds. Missing titles come from filenames. Root `collection.json` can override metadata using `wallpapers/example.png` keys. Lower `order` values appear first. Collection wings grow automatically. Music can include `artist`, `album`, and `title`; tagged browser imports also read artwork and duration.

Your Wallpaper Engine shortcut is not artwork. `npm run import:steam` (PowerShell 7) parses the Windows Steam registry/libraryfolders.vdf and inventories every Steam library's Workshop `431960` folder. It copies selected **preview images only** into the private local wallpaper folder; it does not unpack scenes or copy Workshop music/video. These retain their Workshop source attribution. Put high-resolution screenshots or exported images here to replace low-resolution previews.

Personal media binaries, generated manifests/copies, and local inventories are ignored by Git. They appear in your **local build only**. A public build should include only files you intend and have permission to publish; no commercial recordings are in the repository. Do not publish the local `dist` containing Workshop previews by accident. The public build can use browser imports instead.

`npm run build:public` explicitly builds an empty private-media manifest, excluding every local personal file. Use it for public releases. `npm run build` includes local collections for personal use. Re-run `npm run media:register` or restart `npm run dev` after a public build to restore local previews.

Browser imports are stored as Blobs and metadata in IndexedDB on this device, with no upload. They normally survive reloads. Storage errors show an explicit notice, and **Reconnect Library** allows reimport if browser data was cleared. Clearing site storage removes browser imports; original files remain untouched.
