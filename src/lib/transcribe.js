import { pipeline, env } from '@xenova/transformers';
import { extractAudio } from './exporter.js';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1; // avoids hangs when the page is not cross-origin isolated
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} took too long (over ${Math.round(ms / 60000)} min)`)), ms))]);
let asr;
let embedder;
const MAX_MIN = 10; // only the first 10 minutes are processed in-browser (keeps it fast)

// Real on-device transcription (Whisper tiny, English). No API key, runs in the browser.
export async function transcribe(url, onStatus = () => {}) {
  onStatus('Loading Whisper model (first run downloads ~40MB)...');
  asr = asr || (await withTimeout(pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
    progress_callback: (p) => { if (p.status === 'progress') onStatus(`Downloading model ${Math.round(p.progress)}%`); if (p.status === 'ready') onStatus('Model downloaded, starting it...'); },
  }), 300000, 'Loading the Whisper model'));
  const audio = await extractAudio(url, MAX_MIN * 60, onStatus);
  onStatus('Transcribing on your device (can take a few minutes)...');
  const out = await withTimeout(asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true }), 30 * 60000, 'Transcription');
  return out.chunks.map((c, i) => ({
    id: i + 1, start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 3,
    speaker: 'Speaker 1', text: c.text.trim(),
  }));
}

const HOOKS = ['secret', 'mistake', 'never', 'always', 'how to', 'why', 'best', 'worst', 'free', 'money', 'stop', 'truth', 'important', 'biggest', 'nobody', 'everyone', 'you'];
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// Rule-based viral moment detection (hook words, numbers, questions, emphasis)
export async function detectClips(segs, thumb, onStatus = () => {}, mlPre = null, target = 60) {
  const ml = mlPre || (await mlScores(segs, onStatus));
  const scored = segs.map((s, idx) => {
    const l = s.text.toLowerCase();
    let sc = 50 + HOOKS.filter((h) => l.includes(h)).length * 8;
    if (/\d/.test(l)) sc += 8;
    if (/[?!]/.test(l)) sc += 8;
    if (s.text.split(' ').length > 8) sc += 5;
    sc = Math.round(Math.min(99, 0.4 * sc + 0.6 * ml[idx]));
    return { ...s, viralScore: sc, isViral: sc >= 65, topic: 'Hook' };
  });
  const clips = buildClips(scored, thumb, target);
  return { segs: scored, clips };
}

// ML viral scoring: sentence embeddings (MiniLM, runs in-browser) compared with prototypes of viral content.
const PROTOTYPES = [
  'A shocking surprising statement that grabs attention immediately',
  'A bold controversial opinion that most people disagree with',
  'A secret shortcut or hack that saves a lot of time or money',
  'A common mistake everyone makes and how to avoid it',
  'A powerful emotional personal story with a lesson',
  'A question that makes the viewer curious and want to keep watching',
  'A surprising statistic or fact that changes how you think',
  'Actionable step by step advice you can use today',
];
async function mlScores(segs, onStatus) {
  try {
    onStatus('Loading viral-detection model (first run ~25MB)...');
    embedder = embedder || (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'));
    onStatus('Scoring segments with ML...');
    const texts = [...PROTOTYPES, ...segs.map((s) => s.text)];
    const out = await embedder(texts, { pooling: 'mean', normalize: true });
    const d = out.dims[1];
    const vec = (i) => out.data.slice(i * d, (i + 1) * d);
    const protos = PROTOTYPES.map((_, i) => vec(i));
    return segs.map((_, i) => {
      const v = vec(PROTOTYPES.length + i);
      const best = Math.max(...protos.map((p) => p.reduce((a, x, k) => a + x * v[k], 0)));
      return Math.max(0, Math.min(100, ((best - 0.1) / 0.5) * 100));
    });
  } catch (e) {
    console.warn('ML scoring failed, using rules only', e);
    return segs.map(() => 50);
  }
}

// Preferred path: the local backend transcribes (Node + ffmpeg). Upload -> job id -> poll for progress.
const BACKEND_MSG = 'Cannot reach the backend. Start the app with "npm run dev:all" (not "npm run dev"), keep that terminal open, and check it for errors.';
const api = async (url, opts) => { try { return await fetch(url, opts); } catch { throw new Error(BACKEND_MSG); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function transcribeRemote(url, onStatus = () => {}) {
  const health = await api('/api/health');
  if (!health.ok) throw new Error(BACKEND_MSG);
  let r;
  if (url.startsWith('blob:')) {
    onStatus('Uploading video to the local server...');
    const blob = await (await fetch(url)).blob();
    r = await api('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
  } else {
    r = await api('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: url }) });
  }
  const start = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(start.error || 'Server error while starting transcription');
  const t0 = Date.now();
  for (;;) {
    await sleep(1500);
    const jr = await api(`/api/jobs/${start.jobId}`);
    const j = await jr.json().catch(() => ({}));
    if (!jr.ok) throw new Error(j.error || 'Lost track of the transcription job');
    if (j.status === 'done') return j.result;
    if (j.status === 'error') throw new Error(j.error);
    onStatus(`${j.message} [${Math.round((Date.now() - t0) / 1000)}s]`);
  }
}

// Builds clips of a target length (60 / 120 / 180 s) from scored transcript segments.
// Each candidate window starts at a sentence, ends at a sentence boundary near the target length,
// and is ranked by its opening hook + average viral score. Picks the best non-overlapping windows.
export function buildClips(segs, thumb, target = 60, max = 5) {
  const sc = (s) => s.viralScore ?? 50;
  const cands = [];
  for (let i = 0; i < segs.length; i++) {
    const start = segs[i].start;
    let j = i;
    while (j + 1 < segs.length && segs[j + 1].end - start <= target * 1.1) j++;
    const win = segs.slice(i, j + 1);
    const dur = segs[j].end - start;
    if (dur < target * 0.6 && !(i === 0 && j === segs.length - 1)) continue;
    const avg = win.reduce((a, x) => a + sc(x), 0) / win.length;
    const score = (0.4 * sc(segs[i]) + 0.6 * avg) * (0.85 + 0.15 * Math.min(1, dur / target));
    cands.push({ i, j, start, end: segs[j].end, score, win });
  }
  const picked = [];
  cands.sort((a, b) => b.score - a.score).forEach((c) => {
    if (picked.length < max && !picked.some((p) => c.start < p.end && c.end > p.start)) picked.push(c);
  });
  return picked.map((c, n) => {
    const best = c.win.reduce((a, x) => (sc(x) > sc(a) ? x : a), c.win[0]);
    const words = c.win[0].text.split(' ');
    const v = Math.round(Math.min(99, c.score));
    return {
      id: `clip-${n + 1}`, title: words.slice(0, 10).join(' ') + (words.length > 10 ? '…' : ''),
      duration: fmt(c.end - c.start), viralScore: v, hookScore: v > 80 ? 'High Hook' : 'Moderate',
      transcriptSnippet: best.text, aspectRatio: '9:16', hookText: c.win[0].text.split(/[.!?]/)[0],
      hashtags: '#shorts #viral #fyp', thumbnail: thumb, startTime: c.start, endTime: c.end,
    };
  });
}
