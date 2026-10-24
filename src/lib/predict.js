// Client helpers for the view predictor (talks to the local backend).
export const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'X (Twitter)'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const call = async (url, opts) => {
  let r;
  try { r = await fetch(url, opts); } catch { throw new Error('Backend not reachable. Start the app with "npm run dev:all".'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Server error');
  return j;
};
const post = (url, body) => call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const predictClips = (items, bestHours = false) => post('/api/predict', { items, bestHours });
export const getPerformance = () => call('/api/performance');
export const addPerformance = (rec) => post('/api/performance', rec);
export const bulkAdd = (rows) => post('/api/performance/bulk', { rows });
export const deletePerformance = (id) => call(`/api/performance/${id}`, { method: 'DELETE' });
export const retrainModel = () => post('/api/model/train', {});

export const fmtNum = (n) => {
  if (n == null) return '-';
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(n);
};

// Small RFC-4180 style CSV parser (quotes, commas, newlines inside quotes)
export function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export const toCSV = (records) =>
  ['title,text,views,followers,platform,hour,weekday,duration,added']
    .concat(records.map((r) => [r.title, r.text, r.views, r.followers, r.platform, r.hour, r.weekday, r.duration, r.added].map(esc).join(','))).join('\n');
