# Vizard Clone (React + Vite + Tailwind + Node backend)

## One-time setup
1. Install Node 18+.
2. Install yt-dlp (only needed for YouTube/link import): https://github.com/yt-dlp/yt-dlp. ffmpeg is bundled automatically (a system ffmpeg is used if you have one).
   (Windows: `winget install yt-dlp.yt-dlp Gyan.FFmpeg`  |  Mac: `brew install yt-dlp ffmpeg`)
3. `npm install`

## Run
npm run dev:all     # starts the backend (3001) + the app; open the printed localhost URL in Chrome

Upload or import a video -> the backend (Node + ffmpeg + Whisper) transcribes it and the ML model scores viral moments. Always start with npm run dev:all. First run downloads ~100MB of models into the backend.
Without the backend you can still upload/record files: `npm run dev`.

## Troubleshooting
- On start, the terminal prints whether ffmpeg and yt-dlp were found. Fix any MISSING line, then restart.
- "Backend not reachable": you started with `npm run dev`; use `npm run dev:all`.
- First transcription is slow: ~100MB of models download once into the server cache.
- Transcription is English only. Only the first 15 minutes are processed (set MAX_MIN to change).
- Export uses ffmpeg in the browser: use Chrome/Edge, and expect it to be slow for 3-minute clips.
# Vizard.ai

## Timeline & Viral Effects (new)
Open **Editor Workspace**. A multi-track timeline now sits under the preview, and the right panel has a **Viral Effects** section.
- **Auto-Add Viral Effects** (Subtle / Balanced / Wild): punch zooms on a steady cadence snapped to your sentences, a flash on frame one, a hook title,
  emoji pops on emphasis words (money, secret, mistake, ...), shake on strong words. It checks pacing and shows the longest stretch with no visual change.
- **Timeline tracks**: Clip (drag the white edges to trim), Captions, Motion FX (zoom / shake / flash), Emoji & Text. Click to scrub, drag blocks to move,
  drag their edges to resize, Delete to remove, "+ Zoom / Shake / Flash / Emoji / Text" adds one at the playhead. Slider zooms the timeline.
- **Animated captions**: word-by-word highlight with pop, styled by your caption preset. Plus progress bar, punchy color grade, vignette toggles.
- **Export**: "Export MP4 with effects" burns everything in with ffmpeg.wasm (zoom/shake/flash/color via filters, captions + title + progress bar via ASS,
  emoji drawn to PNG by your browser). Needs your own video, and is slow for long clips. Emoji look depends on your OS emoji font.
- Word timing is estimated from sentence timing (spread by word length), so highlights can drift slightly on long sentences.
- Code: `src/lib/effects.js` (engine + auto generator + ffmpeg/ASS builders), `src/Timeline.jsx`, `src/PreviewFX.jsx`, `src/EffectsPanel.jsx`. `npm test` also checks the generator.

## Changelog (this version)
- Video preview now shows the complete video (Fit mode, default) and uses the available height; Fill (crop) is optional. Ratio buttons added next to the preview.
- New **Features** tab (desktop + mobile menu) with shortcuts to every tool.
- Fixes: mobile navigation, workspace scrolling, sample picks ignoring old uploads, "Generate" ignoring uploaded video, stale timers, play/pause sync, export fill/crop scaling, ffmpeg listener leak, unaligned audio buffer crash on the server.

## View Predictor (new)
Open the **Predictor** tab. The model trains on YOUR posted clips (transcript, platform, followers, posting hour/day, duration)
and estimates a view range plus "better than X% of your posts" for each new clip.
- Models: ridge regression + gradient-boosted trees, blended and validated with k-fold cross-validation (server/predictor.js).
- 0-9 posts: hook score only (a style heuristic, not a forecast). 10+: estimates appear. 30+: "ready" if it beats guessing.
- If the model cannot find a pattern that holds on unseen posts it says so and shows no estimate.
- Fastest way to train: import past posts as CSV (text,views,followers,platform,hour,weekday,duration).
- Data is stored locally in server/data/performance.json. `npm test` checks the model on synthetic signal vs noise data.
# vizard.ai.pro
