# Jie Tian's personal media

Drop images into `wallpapers/`, `chatgpt-images/`, `projects/` or `research/`, and audio into `music/`. Run `npm run build` (or restart `npm run dev`). New files are registered recursively without editing code. JPG/JPEG/PNG/WEBP/AVIF images and MP3/FLAC/WAV/M4A audio are supported. ChatGPT Library is not connected.

For lyrics, place `song.lrc` beside `song.mp3`, `song.m4a`, `song.flac` or `song.wav` with exactly the same stem. Tagged lyrics are also read. The listening wall follows real timestamps, including LRC offsets, seeking and pauses. UTF-8, UTF-16 with BOM and GB18030 text are supported. Plain lyrics remain manually scrollable; missing-lyric / instrumental placeholders are ignored. Local LRC / TXT files up to 2 MB can also be attached through **IMPORT LYRICS** in the player, and timing adjusted in **Record Notes**. Browser attachments stay in IndexedDB; no lyric or music upload is made. Public builds exclude both private recordings and their lyrics.

Optional `collection.json` in each folder can be an array of records with a `file` field, or an object keyed by relative filename. For one image, a single record is also accepted:

```json
{"file":"supernova.png","title":"A star remembers","category":"cosmic","year":"2026","favorite":true,"color":"#263d78","width":1920,"height":1080}
```

Visual categories `cosmic`, `glass`, `portrait` enter their corresponding rooms. Unknown categories enter Imagined Worlds. Missing titles come from filenames. Root `collection.json` can override metadata using `wallpapers/example.png` keys. Lower `order` values appear first. Collection wings grow automatically. Music can include `artist`, `album`, and `title`; tagged browser imports also read artwork and duration.

Your Wallpaper Engine shortcut is not artwork. `npm run import:steam` (PowerShell 7) parses the Windows Steam registry/libraryfolders.vdf and inventories every Steam library's Workshop `431960` folder. It copies selected **preview images only** into the private local wallpaper folder; it does not unpack scenes or copy Workshop music/video. These retain their Workshop source attribution. Put high-resolution screenshots or exported images here to replace low-resolution previews.

Personal media binaries, generated manifests/copies, and local inventories are ignored by Git. They appear in your **local build only**. A public build should include only files you intend and have permission to publish; no commercial recordings are in the repository. Do not publish the local `dist` containing Workshop previews by accident. The public build can use browser imports instead.

`npm run build:public` explicitly builds an empty private-media manifest, excluding every local personal file. Use it for public releases. `npm run build` includes local collections for personal use. Re-run `npm run media:register` or restart `npm run dev` after a public build to restore local previews.

Browser imports are stored as Blobs and metadata in IndexedDB on this device, with no upload. They normally survive reloads. Storage errors show an explicit notice, and **Reconnect Library** allows reimport if browser data was cleared. Clearing site storage removes browser imports; original files remain untouched.


Placement metadata also supports `roomIds` (for example `['portraits']` in JavaScript, `["portraits"]` in JSON), `primary: true`, and numeric `order`. Room IDs: `wallpapers`, `imagined-worlds`, `cosmic`, `glass-life`, `portraits`, `editorial`, `projects`, `research`. A room stores a reference to one resource; multi-room references do not copy the original file. Provenance belongs in `origin` and is never inferred as authorship.

Inside the museum, open **Guide → Arrange / import works**. Drop a batch, inspect previews or tagged audio, choose the destination and category, then confirm. **See in the room** shows the actual placement. **Arrange work** edits title, target, category, order and the main work. Removing an image hides it from display and keeps its original browser blob available under **Removed works / restore**. Existing v1 IndexedDB records are normalized in place on read; the database is not cleared or replaced. Music's existing artwork editor remains the album-cover workflow.
