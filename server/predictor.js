// View predictor: learns from the user's OWN posted clips (text + context -> views).
// Pure JS, no dependencies. Models: ridge regression + gradient-boosted trees, blended by cross-validation.
// It reports honest out-of-fold metrics and refuses to show estimates when it finds no reliable pattern.

export const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'X (Twitter)'];
export const MIN_TRAIN = 10;   // below this: cold start (hook score only)
export const MIN_READY = 30;   // from here on the estimate can be called "ready"

const HOOK = new Set(['secret', 'mistake', 'never', 'always', 'why', 'best', 'worst', 'free', 'money', 'stop', 'truth', 'important', 'biggest', 'nobody', 'everyone', 'you', 'your', 'how', 'warning', 'banned', 'insane', 'crazy', 'shocking', 'proven', 'instantly', 'hack', 'rich', 'broke', 'fail', 'wrong']);
const POWER = new Set(['free', 'secret', 'proven', 'instantly', 'massive', 'shocking', 'truth', 'warning', 'banned', 'insane', 'crazy', 'biggest', 'worst', 'best', 'ultimate', 'guaranteed']);
const NEG = new Set(['never', 'stop', 'worst', 'fail', 'wrong', 'lose', 'dead', 'broke', 'scam', 'danger', 'ruin', 'mistake', 'warning', 'hate', 'terrible']);
const CURIOUS = /(here'?s (why|how|what)|the (truth|secret|reason)|nobody (tells|knows|talks)|you (won'?t|wouldn'?t) believe|what (happens|if)|the real reason|most people (don'?t|never)|no one (tells|talks))/i;

export const FEATURE_NAMES = [
  'logWords', 'firstWords', 'hook', 'power', 'neg', 'hasNumber', 'questions', 'exclaims', 'you', 'curious',
  'avgWordLen', 'speechRate', 'logDuration', 'firstHasHook', 'openQuestion',
  'p_0', 'p_1', 'p_2', 'p_3', 'p_4', 'hourSin', 'hourCos', 'weekend', 'logFollowers', 'hasFollowers',
  'e_0', 'e_1', 'e_2', 'e_3', 'e_4', 'e_5', 'e_6', 'e_7', 'e_max', 'hasEmb',
];
const LABELS = {
  logWords: 'Transcript length', firstWords: 'Opening sentence length', hook: 'Hook words', power: 'Power words', neg: 'Negative/tension words',
  hasNumber: 'Contains a number', questions: 'Questions', exclaims: 'Exclamations', you: 'Talks to the viewer ("you")', curious: 'Curiosity-gap phrase',
  avgWordLen: 'Word complexity', speechRate: 'Speech speed', logDuration: 'Clip duration', firstHasHook: 'Hook in first sentence', openQuestion: 'Opens with a question',
  hourSin: 'Posting hour', hourCos: 'Posting hour', weekend: 'Weekend posting', logFollowers: 'Follower count', hasFollowers: 'Follower count known',
  e_max: 'Similarity to viral patterns', hasEmb: 'Similarity to viral patterns',
};
const groupOf = (name) => (name.startsWith('p_') ? 'Platform' : /^e_\d$/.test(name) ? 'Topic match to viral patterns' : LABELS[name] || name);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const words = (s) => (String(s).toLowerCase().match(/[a-z0-9']+/g) || []);

// ---------- features ----------
export function extractFeatures(raw, sims = null, impute = {}) {
  const text = String(raw.text || '').trim();
  const tokens = words(text);
  const wc = tokens.length;
  const first = text.split(/(?<=[.!?])\s+/).filter(Boolean)[0] || '';
  const firstTokens = words(first);
  const dur = Math.max(1, Number(raw.duration) || wc / 2.5 || 30);
  const hour = Number.isFinite(Number(raw.hour)) && raw.hour !== '' && raw.hour != null ? clamp(Number(raw.hour), 0, 23) : 18;
  const wd = Number.isFinite(Number(raw.weekday)) && raw.weekday !== '' && raw.weekday != null ? clamp(Number(raw.weekday), 0, 6) : 2;
  const fol = Number(raw.followers);
  const pIdx = PLATFORMS.indexOf(raw.platform);
  const f = {
    logWords: Math.log10(wc + 1),
    firstWords: firstTokens.length,
    hook: tokens.filter((t) => HOOK.has(t)).length,
    power: tokens.filter((t) => POWER.has(t)).length,
    neg: tokens.filter((t) => NEG.has(t)).length,
    hasNumber: /\d/.test(text) ? 1 : 0,
    questions: (text.match(/\?/g) || []).length,
    exclaims: (text.match(/!/g) || []).length,
    you: wc ? tokens.filter((t) => t === 'you' || t === 'your').length / wc : 0,
    curious: CURIOUS.test(text) ? 1 : 0,
    avgWordLen: wc ? tokens.reduce((a, t) => a + t.length, 0) / wc : 0,
    speechRate: clamp(wc / dur, 0, 6),
    logDuration: Math.log10(dur + 1),
    firstHasHook: firstTokens.some((t) => HOOK.has(t)) || CURIOUS.test(first) || /\d/.test(first) || first.includes('?') ? 1 : 0,
    openQuestion: /\?\s*$/.test(first) ? 1 : 0,
    hourSin: Math.sin((2 * Math.PI * hour) / 24),
    hourCos: Math.cos((2 * Math.PI * hour) / 24),
    weekend: wd === 0 || wd === 6 ? 1 : 0,
    logFollowers: fol > 0 ? Math.log10(fol + 1) : impute.followersLog ?? 3.5,
    hasFollowers: fol > 0 ? 1 : 0,
    e_max: sims ? Math.max(...sims) : 0,
    hasEmb: sims ? 1 : 0,
  };
  for (let i = 0; i < 5; i++) f[`p_${i}`] = pIdx === i ? 1 : 0;
  for (let i = 0; i < 8; i++) f[`e_${i}`] = sims ? sims[i] ?? 0 : 0;
  return { named: f, vec: FEATURE_NAMES.map((n) => f[n]) };
}

// Style heuristic 0-100. Works from the very first clip (no training needed). NOT a view forecast.
export function hookScore(named) {
  let s = 35;
  s += Math.min(3, named.hook) * 6 + Math.min(2, named.power) * 4 + Math.min(2, named.neg) * 3;
  s += named.hasNumber ? 7 : 0;
  s += named.curious ? 10 : 0;
  s += named.firstHasHook ? 8 : 0;
  s += named.openQuestion ? 5 : 0;
  s += named.you > 0.02 ? 4 : 0;
  s -= named.firstWords > 18 ? 8 : named.firstWords > 12 ? 3 : 0;
  s -= Math.pow(10, named.logDuration) - 1 > 90 ? 6 : 0;
  s -= named.speechRate > 0 && named.speechRate < 1.2 ? 5 : 0;
  if (named.hasEmb) s += clamp((named.e_max - 0.25) * 60, -8, 15);
  return Math.round(clamp(s, 1, 99));
}

export function hookTips(named) {
  const t = [];
  if (named.firstWords > 14) t.push('Your opening sentence is long. Cut it to under 10 words so the hook lands in the first 2 seconds.');
  if (!named.firstHasHook) t.push('Nothing in the first sentence creates tension or curiosity. Open with a bold claim, a question, or a number.');
  if (!named.hasNumber) t.push('Add a specific number ("3 mistakes", "in 30 days"). Concrete numbers tend to stop the scroll.');
  if (!named.curious && !named.openQuestion) t.push('Try a curiosity gap such as "Here\'s why..." or "Nobody tells you..." before the answer.');
  if (named.you < 0.01) t.push('Speak to the viewer directly with "you" or "your".');
  if (named.speechRate > 0 && named.speechRate < 1.5) t.push('Pacing is slow. Trim pauses (delete filler lines) so the clip feels tighter.');
  if (Math.pow(10, named.logDuration) - 1 > 90) t.push('The clip is over 90 seconds. Shorter clips usually keep a higher completion rate.');
  return t.slice(0, 4);
}

// ---------- math helpers ----------
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
export function spearman(a, b) {
  if (a.length < 3) return 0;
  const ra = ranks(a), rb = ranks(b), ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-9;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const m = M[r][c]; if (m) for (let k = c; k <= n; k++) M[r][k] -= m * M[c][k]; }
  }
  return M.map((r) => r[n]);
}

// ---------- ridge regression ----------
function fitRidge(X, y, lambda) {
  const n = X.length, d = X[0].length;
  const mu = new Array(d).fill(0), sd = new Array(d).fill(1);
  for (let j = 0; j < d; j++) {
    mu[j] = mean(X.map((r) => r[j]));
    const v = mean(X.map((r) => (r[j] - mu[j]) ** 2));
    sd[j] = Math.sqrt(v) || 1;
  }
  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j]));
  const ym = mean(y);
  const A = Array.from({ length: d }, () => new Array(d).fill(0));
  const b = new Array(d).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) { b[j] += Z[i][j] * (y[i] - ym); for (let k = j; k < d; k++) A[j][k] += Z[i][j] * Z[i][k]; }
  for (let j = 0; j < d; j++) { for (let k = 0; k < j; k++) A[j][k] = A[k][j]; A[j][j] += lambda; }
  return { mu, sd, w: solve(A, b), ym };
}
const predRidge = (m, x) => m.ym + x.reduce((a, v, j) => a + ((v - m.mu[j]) / m.sd[j]) * m.w[j], 0);

// ---------- gradient boosted trees ----------
function buildTree(X, r, idx, depth, minLeaf, gain) {
  const n = idx.length;
  const sum = idx.reduce((a, i) => a + r[i], 0);
  if (depth === 0 || n < 2 * minLeaf) return { v: sum / n };
  let best = null;
  const d = X[0].length;
  for (let j = 0; j < d; j++) {
    const s = idx.slice().sort((a, b) => X[a][j] - X[b][j]);
    let left = 0;
    for (let k = 0; k < n - 1; k++) {
      left += r[s[k]];
      const nl = k + 1, nr = n - nl;
      if (X[s[k]][j] === X[s[k + 1]][j] || nl < minLeaf || nr < minLeaf) continue;
      const g = (left * left) / nl + ((sum - left) ** 2) / nr - (sum * sum) / n;
      if (!best || g > best.g) best = { g, j, t: (X[s[k]][j] + X[s[k + 1]][j]) / 2 };
    }
  }
  if (!best || best.g <= 1e-9) return { v: sum / n };
  gain[best.j] += best.g;
  const L = idx.filter((i) => X[i][best.j] <= best.t), R = idx.filter((i) => X[i][best.j] > best.t);
  return { j: best.j, t: best.t, l: buildTree(X, r, L, depth - 1, minLeaf, gain), r: buildTree(X, r, R, depth - 1, minLeaf, gain) };
}
const walk = (t, x) => (t.v !== undefined ? t.v : walk(x[t.j] <= t.t ? t.l : t.r, x));
function fitGBM(X, y, { trees = 80, depth = 3, lr = 0.1, sub = 0.8, minLeaf = 3, seed = 7 } = {}) {
  const n = X.length, d = X[0].length;
  const base = mean(y), pred = new Array(n).fill(base), rng = mulberry32(seed), ens = [], gain = new Array(d).fill(0);
  for (let t = 0; t < trees; t++) {
    const resid = y.map((v, i) => v - pred[i]);
    let idx = [];
    for (let i = 0; i < n; i++) if (rng() < sub) idx.push(i);
    if (idx.length < 2 * minLeaf) idx = Array.from({ length: n }, (_, i) => i);
    const tree = buildTree(X, resid, idx, depth, minLeaf, gain);
    ens.push(tree);
    for (let i = 0; i < n; i++) pred[i] += lr * walk(tree, X[i]);
  }
  return { base, lr, ens, gain };
}
const predGBM = (m, x) => m.ens.reduce((a, t) => a + m.lr * walk(t, x), m.base);

// ---------- training with cross-validation ----------
function kfold(n, k, seed = 11) {
  const rng = mulberry32(seed), order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order.map((v, i) => [v, i % k]).reduce((f, [v, g]) => { (f[g] = f[g] || []).push(v); return f; }, []);
}
function cvPredict(X, y, folds, fitFn, predFn) {
  const out = new Array(X.length).fill(0);
  for (const test of folds) {
    const ts = new Set(test), tr = X.map((_, i) => i).filter((i) => !ts.has(i));
    const m = fitFn(tr.map((i) => X[i]), tr.map((i) => y[i]));
    for (const i of test) out[i] = predFn(m, X[i]);
  }
  return out;
}
const mae = (p, y) => mean(p.map((v, i) => Math.abs(v - y[i])));

export function trainModel(records) {
  const n = records.length;
  if (n < MIN_TRAIN) return { status: 'cold', n, metrics: null, importance: [] };
  const used = records.slice(-3000);
  const fl = used.filter((r) => r.followers > 0).map((r) => Math.log10(r.followers + 1)).sort((a, b) => a - b);
  const impute = { followersLog: fl.length ? fl[Math.floor(fl.length / 2)] : 3.5 };
  const X = used.map((r) => extractFeatures(r, r.sims, impute).vec);
  const y = used.map((r) => Math.log10(Math.max(0, Number(r.views) || 0) + 1));
  const k = Math.min(5, used.length);
  const folds = kfold(used.length, k);

  // ridge: choose lambda by CV
  let ridgeBest = null;
  for (const lambda of [1, 5, 20, 60, 150]) {
    const cv = cvPredict(X, y, folds, (a, b) => fitRidge(a, b, lambda), predRidge);
    const e = mae(cv, y);
    if (!ridgeBest || e < ridgeBest.e) ridgeBest = { lambda, cv, e };
  }
  // boosted trees only when there is enough data to avoid memorising
  let gbmCV = null;
  if (used.length >= 40) gbmCV = cvPredict(X, y, folds, (a, b) => fitGBM(a, b), predGBM);

  let wGbm = 0, cv = ridgeBest.cv;
  if (gbmCV) {
    let bestE = Infinity;
    for (const w of [0, 0.25, 0.5, 0.75, 1]) {
      const mix = cv.map((v, i) => (1 - w) * ridgeBest.cv[i] + w * gbmCV[i]);
      const e = mae(mix, y);
      if (e < bestE) { bestE = e; wGbm = w; }
    }
    cv = ridgeBest.cv.map((v, i) => (1 - wGbm) * v + wGbm * gbmCV[i]);
  }

  const ym = mean(y);
  const rmse = Math.sqrt(mean(cv.map((v, i) => (v - y[i]) ** 2)));
  const sst = mean(y.map((v) => (v - ym) ** 2));
  const r2 = sst ? 1 - rmse ** 2 / sst : 0;
  const rho = spearman(cv, y);
  const metrics = { rho: +rho.toFixed(3), r2: +r2.toFixed(3), mae: +mae(cv, y).toFixed(3), baselineMae: +mae(y.map(() => ym), y).toFixed(3), rmse: +rmse.toFixed(3), folds: k };

  const ridge = fitRidge(X, y, ridgeBest.lambda);
  const gbm = wGbm > 0 ? fitGBM(X, y) : null;

  // feature importance (blend of |ridge weight| and tree gain), grouped for readability
  const rw = ridge.w.map(Math.abs), rs = rw.reduce((a, b) => a + b, 0) || 1;
  const gs = gbm ? gbm.gain.reduce((a, b) => a + b, 0) || 1 : 1;
  const imp = {};
  FEATURE_NAMES.forEach((nm, j) => {
    const v = (1 - wGbm) * (rw[j] / rs) + (gbm ? wGbm * (gbm.gain[j] / gs) : 0);
    const g = groupOf(nm);
    imp[g] = (imp[g] || 0) + v;
  });
  const importance = Object.entries(imp).map(([label, value]) => ({ label, value: +value.toFixed(4) })).sort((a, b) => b.value - a.value).slice(0, 10);

  let status;
  if (rho < 0.15 || r2 <= 0) status = 'weak';
  else if (n >= MIN_READY && rho >= 0.25) status = 'ready';
  else status = 'learning';

  return { status, n, metrics, importance, blend: { ridge: +(1 - wGbm).toFixed(2), gbm: wGbm }, lambda: ridgeBest.lambda, sigma: rmse, impute, ridge, gbm, wGbm, cvSorted: [...cv].sort((a, b) => a - b) };
}

export function summary(model) {
  const { status, n, metrics, importance, blend } = model;
  return { status, n, metrics, importance, blend: blend || null, minTrain: MIN_TRAIN, minReady: MIN_READY };
}

const fromLog = (v) => Math.max(0, Math.round(10 ** v - 1));
const sig2 = (v) => (v < 100 ? v : Number(v.toPrecision(2)));

export function predictViews(model, raw, sims) {
  if (!model || !model.ridge || !['learning', 'ready'].includes(model.status)) return null;
  const { vec } = extractFeatures(raw, sims, model.impute);
  const r = predRidge(model.ridge, vec);
  const yhat = model.gbm ? (1 - model.wGbm) * r + model.wGbm * predGBM(model.gbm, vec) : r;
  const z = 1.28 * model.sigma; // ~80% interval from out-of-fold error
  const below = model.cvSorted.filter((v) => v < yhat).length;
  return {
    median: sig2(fromLog(yhat)), low: sig2(fromLog(yhat - z)), high: sig2(fromLog(yhat + z)),
    percentile: Math.round((below / model.cvSorted.length) * 100),
    confidence: model.status === 'ready' ? 'ok' : 'low',
  };
}

export function bestHours(model, raw, sims) {
  if (!model || model.status !== 'ready' || model.n < 60) return null;
  const out = [];
  for (let h = 0; h < 24; h++) {
    const p = predictViews(model, { ...raw, hour: h }, sims);
    if (p) out.push({ hour: h, median: p.median });
  }
  return out.sort((a, b) => b.median - a.median).slice(0, 3);
}
