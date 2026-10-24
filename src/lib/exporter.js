import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { buildAss, buildExportGraph, DEFAULT_SETTINGS } from './effects.js';

let ff;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const t = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)},${pad(Math.round((s % 1) * 1000), 3)}`;

async function loadFF(onStatus) {
  if (ff) return;
  onStatus('Loading video engine (first run ~30MB)...');
  const inst = new FFmpeg();
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await inst.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ff = inst; // only cache once fully loaded, so a failed load can be retried
}

// Pulls only the first maxSec seconds of audio as 16kHz mono samples (fast, low memory)
export async function extractAudio(url, maxSec, onStatus = () => {}) {
  await loadFF(onStatus);
  onStatus('Reading video file...');
  await ff.writeFile('a_in', await fetchFile(url));
  onStatus('Extracting audio...');
  await ff.exec(['-i', 'a_in', '-t', String(maxSec), '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', 'a.pcm']);
  const raw = await ff.readFile('a.pcm');
  await ff.deleteFile('a_in');
  await ff.deleteFile('a.pcm');
  const i16 = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 2));
  const f32 = new Float32Array(i16.length);
  for (let n = 0; n < i16.length; n++) f32[n] = i16[n] / 32768;
  return f32;
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const probe = (url) => new Promise((res) => {
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.onloadedmetadata = () => res([even(v.videoWidth), even(v.videoHeight)]);
  v.onerror = () => res([1280, 720]);
  v.src = url;
});

// Emoji -> transparent PNG using the browser's own colour-emoji font
async function emojiPng(emoji, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${Math.round(size * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  x.fillText(emoji, size / 2, size / 2 + size * 0.04);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

const DEFAULT_CAPTION = { fontSize: 28, color: '#FFFFFF', highlight: '#FFE600', position: 'bottom', uppercase: false, badge: false };

// Real export: cut + reframe (9:16 / 1:1 / 16:9) + viral effects, using ffmpeg.wasm in the browser.
//   fit  = whole video visible, black bars where needed (nothing is cut off)
//   fill = scale up and center-crop so the frame is completely filled
// fx = { effects, settings, caption } adds punch zooms, shake, flash, emoji pops, title text,
//      word-by-word animated captions, a progress bar and a punchy colour grade.
export async function exportClip({ url, start, end, ratio, fit = 'fit', segs, deleted = [], fx = null, onStatus = () => {} }) {
  await loadFF(onStatus);
  const onProgress = ({ progress }) => onStatus(`Rendering ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`);
  ff.on('progress', onProgress);
  const made = ['in.mp4', 'cap.ass', 'out.mp4'];
  try {
    onStatus('Preparing files...');
    await ff.writeFile('in.mp4', await fetchFile(url));
    await ff.writeFile('arial.ttf', await fetchFile('https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf'));

    const dims = { '9:16': [720, 1280], '1:1': [720, 720], '16:9': [1280, 720] }[ratio];
    const [W, H] = dims || (await probe(url));
    const crop = !dims
      ? `scale=${W}:${H},setsar=1` // original: keep the whole picture untouched
      : fit === 'fit'
      ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`
      : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;

    const settings = { ...DEFAULT_SETTINGS, progress: false, punchy: false, vignette: false, ...(fx?.settings || {}) };
    const effects = fx?.effects || [];
    const caption = { ...DEFAULT_CAPTION, ...(fx?.caption || {}) };
    const lines = segs.filter((x) => x.end > start && x.start < end && !deleted.includes(x.id));

    const needAss = (settings.captions !== false && lines.length) || settings.progress || effects.some((e) => e.type === 'text');
    if (needAss) await ff.writeFile('cap.ass', buildAss({ segs: lines, deleted: [], effects, settings, caption, W, H, start, end }));

    const { graph, plans, emojiSeconds } = buildExportGraph({ cropChain: crop, effects, settings, W, H, start, end, assFile: needAss ? 'cap.ass' : null });
    const emojiInputs = [];
    for (let i = 0; i < plans.length; i++) {
      await ff.writeFile(`em${i}.png`, await emojiPng(plans[i].emoji, plans[i].size));
      made.push(`em${i}.png`);
      emojiInputs.push('-loop', '1', '-framerate', '25', '-t', String(emojiSeconds[i]), '-i', `em${i}.png`);
    }

    onStatus('Rendering 0%');
    const code = await ff.exec([
      '-ss', String(start), '-i', 'in.mp4', ...emojiInputs, '-t', String(end - start),
      '-filter_complex', graph, '-map', '[out]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', 'out.mp4',
    ]);
    if (code !== 0) throw new Error(`ffmpeg could not render this clip (code ${code})`);
    const data = await ff.readFile('out.mp4');
    return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
  } finally {
    ff.off('progress', onProgress);
    for (const f of made) { try { await ff.deleteFile(f); } catch {} }
  }
}
