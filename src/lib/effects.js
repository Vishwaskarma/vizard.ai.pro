// Effects engine: one source of truth for the live preview AND the ffmpeg export.
// All effect times are absolute seconds in the SOURCE video.

export const FX_TYPES = {
  zoom:  { label: 'Punch Zoom', short: 'Zoom',  lane: 'motion',  color: '#8b5cf6', dur: 1.6 },
  shake: { label: 'Shake',      short: 'Shake', lane: 'motion',  color: '#f97316', dur: 0.45 },
  flash: { label: 'Flash',      short: 'Flash', lane: 'motion',  color: '#eab308', dur: 0.25 },
  emoji: { label: 'Emoji Pop',  short: 'Emoji', lane: 'overlay', color: '#ec4899', dur: 1.3 },
  text:  { label: 'Title Text', short: 'Text',  lane: 'overlay', color: '#06b6d4', dur: 2.4 },
};

export const EMOJI_CHOICES = ['🔥', '🤯', '🚨', '💰', '📈', '🚀', '⚡', '💡', '👀', '🎯', '❤️', '😂', '👏', '✅', '❌', '🏆'];

export const DEFAULT_SETTINGS = { captions: true, progress: true, punchy: true, vignette: false };

let _n = 0;
export const uid = () => `fx-${Date.now().toString(36)}-${(_n++).toString(36)}`;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
export const easeOutBack = (p) => { const c1 = 1.70158; return 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const f3 = (n) => Number(Number(n).toFixed(3));

export function makeEffect(type, start, extra = {}) {
  const d = FX_TYPES[type];
  return {
    id: uid(), type, start, end: start + d.dur,
    intensity: type === 'zoom' ? 1.18 : 1,
    emoji: '🔥', text: 'WAIT FOR IT', pos: 'top',
    ...extra,
  };
}

// ---------- words & captions ----------
// Whisper gives sentence-level timing, so word timing is spread by character length.
export function splitWords(seg) {
  const toks = String(seg.text || '').split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const total = toks.reduce((a, w) => a + w.length + 1, 0);
  const span = Math.max(0.1, seg.end - seg.start);
  let cur = seg.start;
  return toks.map((w) => { const d = (span * (w.length + 1)) / total; const o = { text: w, start: cur, end: cur + d }; cur += d; return o; });
}

export function captionWords(segs, deleted, a, b) {
  const out = [];
  for (const s of segs) {
    if (deleted.includes(s.id) || s.end <= a || s.start >= b) continue;
    for (const w of splitWords(s)) if (w.end > a && w.start < b) out.push({ ...w, segId: s.id });
  }
  return out.sort((x, y) => x.start - y.start);
}

export function groupWords(words, maxWords = 3, maxChars = 16) {
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) { groups.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end }); cur = []; } };
  for (const w of words) {
    const chars = cur.reduce((a, x) => a + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= maxWords || chars > maxChars)) flush();
    cur.push(w);
    if (/[.!?]$/.test(w.text)) flush();
  }
  flush();
  return groups;
}

export function activeCaption(groups, t) {
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i], nx = groups[i + 1];
    const showUntil = nx ? Math.min(nx.start, g.end + 0.4) : g.end + 0.4;
    if (t >= g.start && t < showUntil) {
      let active = 0;
      for (let k = 0; k < g.words.length; k++) if (t >= g.words[k].start) active = k;
      return { group: g, active };
    }
  }
  return null;
}

// ---------- live motion (preview) ----------
// dx/dy are fractions of the frame width. scale >= 1.
export function motionAt(effects, t) {
  let zoom = 0, shakeScale = 0, dx = 0, dy = 0, flash = 0;
  for (const e of effects) {
    if (t < e.start || t > e.end) continue;
    const dur = Math.max(0.05, e.end - e.start), el = t - e.start;
    if (e.type === 'zoom') {
      const r = Math.min(0.2, dur / 3);
      zoom = Math.max(zoom, (e.intensity - 1) * easeOut(Math.min(1, el / r)));
    } else if (e.type === 'shake') {
      const amp = 0.012 * e.intensity, env = 1 - el / dur;
      shakeScale = Math.max(shakeScale, 3 * amp);
      dx += amp * env * Math.sin(t * 70);
      dy += amp * env * Math.cos(t * 83);
    } else if (e.type === 'flash') {
      flash = Math.max(flash, 0.7 * Math.pow(1 - el / dur, 1.5));
    }
  }
  return { scale: 1 + Math.max(zoom, shakeScale), dx, dy, flash };
}

// ---------- auto "viral" generator ----------
const LEVELS = {
  subtle:   { zoomEvery: 5.5, zoomK: 1.10, shakes: 0, flashes: 0, emojis: 3,  flashStart: false },
  balanced: { zoomEvery: 3.6, zoomK: 1.16, shakes: 3, flashes: 0, emojis: 6,  flashStart: true },
  wild:     { zoomEvery: 2.4, zoomK: 1.24, shakes: 6, flashes: 5, emojis: 10, flashStart: true },
};
export const LEVEL_IDS = Object.keys(LEVELS);

const EMOJI_RULES = [
  [/\b(million|billion|money|revenue|profit|dollars?|\$\d+|cash|rich)\b|\$/i, '💰'],
  [/%|\b(grow|growth|scale|increase|boost|double|triple)\b/i, '📈'],
  [/\b(mistake|warning|danger|stop|wrong|never|ruin|behind|losing)\b/i, '🚨'],
  [/\b(crazy|insane|wow|shocking|unbelievable|literally|massive|huge)\b/i, '🤯'],
  [/\b(secret|hack|shortcut|trick|viral|best|golden)\b/i, '🔥'],
  [/\b(fast|quick|quickly|instant|instantly|minutes?|seconds?|speed)\b/i, '⚡'],
  [/\b(idea|tip|learn|lesson|insight|realize)\b/i, '💡'],
  [/\b(watch|look|see|notice|attention)\b/i, '👀'],
  [/\b(goal|target|focus|aim|win)\b/i, '🎯'],
  [/\b(launch|rocket|million followers|freedom)\b/i, '🚀'],
  [/\b(love|heart|passion)\b/i, '❤️'],
];
const SHAKE_RE = /!$|\b(literally|insane|crazy|never|stop|massive|huge|shocking)\b/i;

export function autoEffects({ segs, deleted = [], clip, level = 'balanced', hookText = '' }) {
  const L = LEVELS[level] || LEVELS.balanced;
  const a = clip.startTime, b = clip.endTime;
  const lines = segs.filter((s) => !deleted.includes(s.id) && s.end > a && s.start < b).sort((x, y) => x.start - y.start);
  const words = captionWords(segs, deleted, a, b);
  const out = [];
  const stripEmoji = (t) => t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();

  // 1) Hook title in the first seconds
  const hook = stripEmoji(hookText || (lines[0]?.text || '').split(/\s+/).slice(0, 6).join(' ')).toUpperCase();
  if (hook) out.push(makeEffect('text', a + 0.15, { end: Math.min(b, a + 2.8), text: hook.slice(0, 48), pos: 'top' }));
  // 2) Pattern-interrupt flash on the very first frame
  if (L.flashStart) out.push(makeEffect('flash', a, { end: a + 0.22 }));

  // 3) Punch zooms. Viral lines get one first; then a steady cadence fills the gaps
  //    (retention: something changes every few seconds). Zooms never overlap.
  const zooms = [];
  const clash = (s, e) => zooms.some((z) => s < z.end && e > z.start);
  const addZoom = (s, e, k) => { const z = makeEffect('zoom', s, { end: e, intensity: f3(k) }); zooms.push(z); out.push(z); };
  for (const l of lines.filter((x) => x.isViral)) {
    const s = Math.max(a, l.start), e = Math.min(b, s + Math.min(2.2, L.zoomEvery * 0.85 + 0.3));
    if (e - s > 0.6 && !clash(s, e)) addZoom(s, e, L.zoomK + 0.04);
  }
  const starts = lines.map((l) => l.start).filter((s) => s > a + 0.4);
  let cursor = a + 0.9, beat = 0, guard = 0;
  while (cursor < b - 0.8 && guard++ < 500) {
    const near = starts.reduce((best, s) => (Math.abs(s - cursor) < Math.abs(best - cursor) ? s : best), Infinity);
    const s = Math.max(cursor, Math.abs(near - cursor) <= 0.9 ? near : cursor);
    const hit = zooms.find((z) => s < z.end && s + 0.9 > z.start && z.start <= s); // we start inside an existing zoom
    if (hit) { cursor = hit.end + 0.15; continue; }
    // trim so we stop before the next existing zoom
    const nextZ = zooms.filter((z) => z.start > s).reduce((m, z) => Math.min(m, z.start), Infinity);
    const e = Math.min(b, s + L.zoomEvery * 0.85, nextZ - 0.12);
    if (e - s > 0.9) {
      addZoom(s, e, 1 + (L.zoomK - 1) * (beat % 3 === 1 ? 0.55 : beat % 3 === 2 ? 1.2 : 1));
      beat++;
      cursor = Math.max(s + L.zoomEvery, e + 0.15);
    } else {
      cursor = Math.min(nextZ, s + 0.5) > cursor ? Math.min(nextZ, s + 0.5) : cursor + 0.5; // too tight a gap: move on
    }
  }

  // 4) Emoji on emphasis words (spaced out)
  let emojiLeft = L.emojis, lastEmoji = -9;
  for (const w of words) {
    if (!emojiLeft) break;
    if (w.start - lastEmoji < 1.8 || w.start > b - 0.8) continue;
    const hit = EMOJI_RULES.find(([re]) => re.test(w.text));
    if (hit) { out.push(makeEffect('emoji', w.start, { end: Math.min(b, w.start + 1.3), emoji: hit[1] })); lastEmoji = w.start; emojiLeft--; }
  }

  // 5) Shake on strong words
  let shakeLeft = L.shakes, lastShake = -9;
  for (const w of words) {
    if (!shakeLeft) break;
    if (w.start - lastShake < 2.2 || w.start < a + 1.2) continue;
    if (SHAKE_RE.test(w.text)) { out.push(makeEffect('shake', w.start, { end: Math.min(b, w.start + 0.45) })); lastShake = w.start; shakeLeft--; }
  }

  // 6) Flash on speaker changes (wild only)
  let flashLeft = L.flashes;
  for (let i = 1; i < lines.length && flashLeft; i++) {
    if (lines[i].speaker !== lines[i - 1].speaker && lines[i].start > a + 1) {
      out.push(makeEffect('flash', lines[i].start, { end: lines[i].start + 0.2 })); flashLeft--;
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

// Longest stretch (seconds) with no visual change: a pacing hint for retention.
export function longestStaticGap(effects, clip) {
  const marks = [clip.startTime, clip.endTime];
  for (const e of effects) if (e.end > clip.startTime && e.start < clip.endTime) marks.push(Math.max(clip.startTime, e.start), Math.min(clip.endTime, e.end));
  marks.sort((x, y) => x - y);
  let gap = 0;
  for (let i = 1; i < marks.length; i++) gap = Math.max(gap, marks[i] - marks[i - 1]);
  return gap;
}

// ---------- export: ffmpeg filter pieces ----------
// Times are made relative to the clip start (ffmpeg's -ss before -i resets t to 0).
const rel = (effects, start, end) => effects
  .filter((e) => e.end > start && e.start < end)
  .map((e) => ({ ...e, a: Math.max(0, e.start - start), b: Math.min(end, e.end) - start }));

// Frame-level stage: punch zoom + shake (scale+crop), punchy grade + flash (eq), vignette.
export function buildFxChain({ effects, settings, W, H, start, end }) {
  const r = rel(effects, start, end);
  const zooms = r.filter((e) => e.type === 'zoom'), shakes = r.filter((e) => e.type === 'shake'), flashes = r.filter((e) => e.type === 'flash');
  const parts = [];
  if (zooms.length || shakes.length) {
    const terms = [
      ...zooms.map((e) => `between(t,${f3(e.a)},${f3(e.b)})*${f3(e.intensity - 1)}*(1-pow(1-min(1,(t-${f3(e.a)})/${f3(Math.min(0.2, (e.b - e.a) / 3))}),2))`),
      ...shakes.map((e) => `between(t,${f3(e.a)},${f3(e.b)})*${f3(3 * 0.012 * e.intensity)}`),
    ];
    const S = `(1+${terms.reduce((acc, x) => (acc ? `max(${acc},${x})` : x), '')})`;
    const dxs = shakes.map((e) => `between(t,${f3(e.a)},${f3(e.b)})*${f3(W * 0.012 * e.intensity)}*(1-(t-${f3(e.a)})/${f3(e.b - e.a)})*sin(t*70)`);
    const dys = shakes.map((e) => `between(t,${f3(e.a)},${f3(e.b)})*${f3(W * 0.012 * e.intensity)}*(1-(t-${f3(e.a)})/${f3(e.b - e.a)})*cos(t*83)`);
    parts.push(`scale=w='trunc(${W}*${S}/2)*2':h='trunc(${H}*${S}/2)*2':eval=frame`);
    parts.push(`crop=w=${W}:h=${H}:x='(iw-${W})/2+${dxs.join('+') || '0'}':y='(ih-${H})/2+${dys.join('+') || '0'}'`);
  }
  const eq = [];
  if (settings.punchy) eq.push('contrast=1.12', 'saturation=1.3');
  if (flashes.length) {
    const fl = flashes.map((e) => `between(t,${f3(e.a)},${f3(e.b)})*0.7*pow(1-(t-${f3(e.a)})/${f3(e.b - e.a)},1.5)`).join('+');
    eq.push(`brightness='${fl}'`, 'eval=frame');
  }
  if (eq.length) parts.push(`eq=${eq.join(':')}`);
  if (settings.vignette) parts.push('vignette=angle=PI/5');
  return parts.join(',');
}

// Emoji stickers: one overlay input each (PNG drawn by the browser canvas), popped in with easeOutBack.
export function emojiPlan({ effects, settings, W, H, start, end, max = 12 }) {
  if (settings.emojis === false) return [];
  return rel(effects, start, end).filter((e) => e.type === 'emoji').slice(0, max).map((e) => ({
    emoji: e.emoji, a: e.a, b: e.b, size: Math.round(H * 0.13),
    cx: Math.round(W * (idSide(e.id) ? 0.2 : 0.8)), cy: Math.round(H * 0.3),
  }));
}
export const idSide = (id) => String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 2 === 0;

export function emojiFilter(plan, idx) {
  const { a, b, size, cx, cy } = plan;
  const p = `min(1,(t-${f3(a)})/0.25)`;
  const k = `(1+2.70158*pow(${p}-1,3)+1.70158*pow(${p}-1,2))`;
  const sz = `max(2,trunc(${size}*${k}/2)*2)`;
  return {
    pre: `[${idx}:v]format=rgba,setpts=PTS-STARTPTS+${f3(a)}/TB,scale=w='${sz}':h='${sz}':eval=frame[e${idx}]`,
    over: (inL, outL) => `[${inL}][e${idx}]overlay=x='${cx}-w/2':y='${cy}-h/2':eof_action=pass:enable='between(t,${f3(a)},${f3(b)})'[${outL}]`,
    seconds: Math.max(0.3, b - a),
  };
}

// ---------- export: ASS captions, title text, progress bar ----------
const p2 = (n) => String(n).padStart(2, '0');
const assT = (s) => { s = Math.max(0, s); return `${Math.floor(s / 3600)}:${p2(Math.floor(s / 60) % 60)}:${p2(Math.floor(s) % 60)}.${p2(Math.floor((s % 1) * 100))}`; };
const assC = (hex) => { const h = String(hex || '#FFFFFF').replace('#', '').padEnd(6, 'F'); return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`; };
const clean = (t) => String(t).replace(/[{}\\]/g, '').replace(/\n/g, ' ');
// Manual wrap (ASS WrapStyle 2 never wraps): break into lines of at most n characters.
export const wrapText = (t, n = 14) => {
  const lines = []; let cur = '';
  for (const w of String(t).split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + w).length > n) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
};

export function buildAss({ segs, deleted = [], effects, settings, caption, W, H, start, end, fontName = 'Arial' }) {
  const fs = Math.round(caption.fontSize * H / 640);
  const align = { top: 8, center: 5, bottom: 2 }[caption.position] || 2;
  const marginV = Math.round(H * 0.11);
  const outline = Math.max(2, Math.round(fs / 12));
  const badge = !!caption.badge;
  const titleFs = Math.round(H * 0.045);
  const hl = assC(caption.highlight);
  const L = [];
  L.push('[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '');
  L.push('[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  L.push(`Style: Cap,${fontName},${fs},${assC(caption.color)},${assC(caption.color)},${badge ? assC('#000000') : '&H00000000&'},&H80000000&,1,0,0,0,100,100,0,0,${badge ? 3 : 1},${badge ? Math.round(fs / 4) : outline},${badge ? 0 : 2},${align},30,30,${marginV},1`);
  L.push(`Style: Title,${fontName},${titleFs},&H00000000&,&H00000000&,${assC('#FFE600')},&H00000000&,1,0,0,0,100,100,0,0,3,${Math.round(titleFs / 3)},0,8,40,40,${Math.round(H * 0.12)},1`);
  L.push(`Style: Bar,${fontName},20,&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&H00000000&,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`, '');
  L.push('[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  if (settings.captions !== false) {
    const groups = groupWords(captionWords(segs, deleted, start, end));
    groups.forEach((g, gi) => {
      const nextStart = groups[gi + 1] ? groups[gi + 1].start : Infinity;
      g.words.forEach((w, i) => {
        const ws = Math.max(start, w.start), we = Math.min(end, i === g.words.length - 1 ? Math.min(nextStart, g.end + 0.4) : g.words[i + 1].start);
        if (we <= ws) return;
        const text = g.words.map((x, j) => {
          const t = clean(caption.uppercase ? x.text.toUpperCase() : x.text);
          return j === i ? `{\\1c${hl}\\fscx100\\fscy100\\t(0,90,\\fscx118\\fscy118)}${t}{\\r}` : t;
        }).join(' ');
        L.push(`Dialogue: 0,${assT(ws - start)},${assT(we - start)},Cap,,0,0,0,,${text}`);
      });
    });
  }
  for (const e of rel(effects, start, end).filter((x) => x.type === 'text')) {
    const tag = e.pos === 'center' ? `\\an5\\pos(${W / 2},${H / 2})` : `\\an8\\pos(${W / 2},${Math.round(H * 0.12)})`;
    L.push(`Dialogue: 1,${assT(e.a)},${assT(e.b)},Title,,0,0,0,,{${tag}\\fad(120,160)\\fscx60\\fscy60\\t(0,160,\\fscx100\\fscy100)}${wrapText(clean(e.text)).join('\\N')}`);
  }
  if (settings.progress !== false) {
    const bh = Math.max(4, Math.round(H * 0.009)), d = Math.round((end - start) * 1000);
    L.push(`Dialogue: 2,${assT(0)},${assT(end - start)},Bar,,0,0,0,,{\\an7\\pos(0,${H - bh})\\bord0\\shad0\\1c${hl}\\fscx1\\t(0,${d},\\fscx100)\\p1}m 0 0 l ${W} 0 ${W} ${bh} 0 ${bh}{\\p0}`);
  }
  return L.join('\n') + '\n';
}

// Full -filter_complex graph. Input 0 = source video, inputs 1..N = emoji PNGs (in plan order).
// cropChain = reframe stage (fit/fill/original) that outputs exactly W x H.
export function buildExportGraph({ cropChain, effects, settings, W, H, start, end, assFile = null }) {
  const plans = emojiPlan({ effects, settings, W, H, start, end });
  const chain = buildFxChain({ effects, settings, W, H, start, end });
  const stages = [];
  let label = 'base';
  stages.push(`[0:v]${[cropChain, chain].filter(Boolean).join(',')}[${label}]`);
  const emo = plans.map((p, i) => emojiFilter(p, i + 1));
  emo.forEach((e, i) => { stages.push(e.pre); const out = `ov${i}`; stages.push(e.over(label, out)); label = out; });
  stages.push(assFile ? `[${label}]ass=${assFile}:fontsdir=/[out]` : `[${label}]null[out]`);
  return { graph: stages.join(';'), plans, emojiSeconds: emo.map((e) => e.seconds) };
}
