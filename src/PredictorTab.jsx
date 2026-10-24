import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, Trash2, Download, Upload, RefreshCw, Plus, Clock, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { PLATFORMS, WEEKDAYS, fmtNum, getPerformance, addPerformance, bulkAdd, deletePerformance, retrainModel, parseCSV, toCSV, predictClips } from './lib/predict.js';

const STATUS = {
  cold:     { label: 'Not trained yet',  tone: 'text-slate-300 bg-slate-800 border-slate-700', icon: Clock },
  weak:     { label: 'No reliable pattern yet', tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30', icon: AlertTriangle },
  learning: { label: 'Learning (low confidence)', tone: 'text-sky-300 bg-sky-500/10 border-sky-500/30', icon: RefreshCw },
  ready:    { label: 'Ready', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
};
const input = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500';
const label = 'text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1';

export default function PredictorTab({ clips, clipText, settings, setSettings, logClipId, setLogClipId, onChanged, predictions }) {
  const [data, setData] = useState({ records: [], model: null });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ clipId: '', title: '', text: '', views: '', followers: '', platform: settings.platform, hour: settings.hour, weekday: settings.weekday, duration: '' });
  const [csv, setCsv] = useState('');
  const [hours, setHours] = useState(null);
  const fileRef = useRef(null);

  const load = async () => { try { setData(await getPerformance()); setErr(''); } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, []);

  // prefill the form when arriving from a clip card
  useEffect(() => {
    if (!logClipId) return;
    const c = clips.find((x) => x.id === logClipId);
    if (c) setForm((f) => ({ ...f, clipId: c.id, title: c.title, text: clipText(c), duration: Math.round(c.endTime - c.startTime), platform: settings.platform, hour: settings.hour, weekday: settings.weekday, followers: settings.followers || '' }));
    setLogClipId(null);
  }, [logClipId]);

  const refresh = async (m) => { await load(); onChanged(); if (m) { setMsg(m); setTimeout(() => setMsg(''), 4000); } };
  const wrap = (fn) => async (...a) => { setBusy(true); setErr(''); try { await fn(...a); } catch (e) { setErr(e.message); } setBusy(false); };

  const pickClip = (id) => {
    const c = clips.find((x) => x.id === id);
    setForm((f) => c ? { ...f, clipId: id, title: c.title, text: clipText(c), duration: Math.round(c.endTime - c.startTime) } : { ...f, clipId: '' });
  };
  const submit = wrap(async () => {
    await addPerformance({ ...form, views: form.views === '' ? NaN : Number(form.views) });
    setForm((f) => ({ ...f, clipId: '', title: '', text: '', views: '' }));
    await refresh('Result saved. Model retrained.');
  });
  const importCsv = wrap(async () => {
    const rows = parseCSV(csv);
    if (!rows.length) throw new Error('Paste a CSV with a header row: text,views,followers,platform,hour,weekday,duration');
    const r = await bulkAdd(rows);
    setCsv('');
    await refresh(`Imported ${r.added} posts${r.skipped ? `, skipped ${r.skipped} (${r.errors[0]})` : ''}.`);
  });
  const remove = wrap(async (id) => { await deletePerformance(id); await refresh(); });
  const retrain = wrap(async () => { await retrainModel(); await refresh('Model retrained.'); });
  const bestHours = wrap(async () => {
    const c = clips[0]; if (!c) return;
    const r = await predictClips([{ id: c.id, text: clipText(c), duration: c.endTime - c.startTime, ...settings }], true);
    setHours(r.results[0].bestHours || []);
  });
  const exportCsv = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCSV(data.records)], { type: 'text/csv' })); a.download = 'my-posts.csv'; a.click(); };
  const onFile = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => setCsv(String(r.result)); r.readAsText(f); };

  const m = data.model;
  const st = STATUS[m?.status || 'cold'];
  const StIcon = st.icon;
  const pct = m ? Math.min(100, Math.round((m.n / m.minReady) * 100)) : 0;
  const maxImp = Math.max(0.0001, ...(m?.importance || []).map((i) => i.value));
  const factor = m?.metrics ? 10 ** m.metrics.mae : null;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><TrendingUp className="h-6 w-6 text-emerald-400" /> View Predictor</h1>
        <p className="text-slate-400 text-sm mt-1">Learns from <b>your own</b> posted clips (transcript, platform, followers, posting time) and estimates how a new clip will perform relative to your history.</p>
      </div>

      {err && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{err}</div>}
      {msg && <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${st.tone}`}><StIcon className="h-3.5 w-3.5" /> {st.label}</span>
            <button onClick={retrain} disabled={busy} className="text-xs text-slate-300 hover:text-white flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Retrain</button>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{m?.n ?? 0} posts logged</span><span>{m?.minReady ?? 30} needed for a reliable model</span></div>
            <div className="h-2 bg-slate-950 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-600 to-emerald-500" style={{ width: `${pct}%` }} /></div>
          </div>
          {m?.metrics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Rank accuracy', m.metrics.rho.toFixed(2), 'Spearman, out-of-fold. 1 = perfect ordering, 0 = random'],
                ['Typical error', `×${factor.toFixed(1)}`, 'Predictions are usually within this factor of the real views'],
                ['vs. guessing', `${Math.max(0, Math.round((1 - m.metrics.mae / m.metrics.baselineMae) * 100))}% better`, 'Error compared with always guessing your average'],
                ['Blend', m.blend ? `${Math.round(m.blend.ridge * 100)}% linear / ${Math.round(m.blend.gbm * 100)}% trees` : '-', 'Chosen by cross-validation'],
              ].map(([k, v, tip]) => (
                <div key={k} title={tip} className="bg-slate-950 border border-slate-800 rounded-xl p-3"><p className="text-[10px] uppercase text-slate-500 font-bold">{k}</p><p className="text-sm font-bold text-white mt-1">{v}</p></div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">Log at least {m?.minTrain ?? 10} posts with their real views to train. Until then you only get the <b>Hook score</b>, a style heuristic that is not a view forecast.</p>}
          {m?.status === 'weak' && <p className="text-xs text-amber-300">The model cannot find a pattern that holds on unseen posts, so it shows no view estimates. This is usually fixed by logging more posts, not by changing settings.</p>}
          {m?.status === 'learning' && <p className="text-xs text-sky-300">Estimates are shown with wide ranges. Treat them as rough until you reach {m.minReady} posts.</p>}
        </div>

        {/* Defaults for predictions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Posting plan (used for estimates)</h3>
          <div><label className={label}>Platform</label><select className={input} value={settings.platform} onChange={(e) => setSettings({ ...settings, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label className={label}>Your followers</label><input className={input} type="number" min="0" placeholder="e.g. 12000" value={settings.followers} onChange={(e) => setSettings({ ...settings, followers: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Hour</label><select className={input} value={settings.hour} onChange={(e) => setSettings({ ...settings, hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></div>
            <div><label className={label}>Day</label><select className={input} value={settings.weekday} onChange={(e) => setSettings({ ...settings, weekday: Number(e.target.value) })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          </div>
          <button onClick={bestHours} disabled={busy || !clips.length} className="w-full text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl py-2 flex items-center justify-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Find best posting hours</button>
          {hours && (hours.length
            ? <p className="text-xs text-emerald-300">Best hours from your history: {hours.map((h) => `${String(h.hour).padStart(2, '0')}:00`).join(', ')}. Small differences can be noise.</p>
            : <p className="text-xs text-slate-500">Needs a "ready" model trained on 60+ posts.</p>)}
        </div>
      </div>

      {/* Top factors */}
      {m?.importance?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">What drives views for you</h3>
          <div className="space-y-2">
            {m.importance.map((i) => (
              <div key={i.label} className="flex items-center gap-3 text-xs">
                <span className="w-56 shrink-0 text-slate-300 truncate">{i.label}</span>
                <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden"><div className="h-full bg-purple-500" style={{ width: `${(i.value / maxImp) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Importance shows correlation in your data, not proven cause.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log a result */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Plus className="h-4 w-4 text-purple-400" /> Log a posted clip</h3>
          <div><label className={label}>From your generated clips (optional)</label>
            <select className={input} value={form.clipId} onChange={(e) => pickClip(e.target.value)}>
              <option value="">Write manually</option>{clips.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select></div>
          <div><label className={label}>Clip transcript / what is said</label><textarea rows={3} className={input} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Paste what is said in the clip..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Views *</label><input className={input} type="number" min="0" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} /></div>
            <div><label className={label}>Followers then</label><input className={input} type="number" min="0" value={form.followers} onChange={(e) => setForm({ ...form, followers: e.target.value })} /></div>
            <div><label className={label}>Platform</label><select className={input} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label className={label}>Duration (sec)</label><input className={input} type="number" min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            <div><label className={label}>Posted hour</label><select className={input} value={form.hour} onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></div>
            <div><label className={label}>Posted day</label><select className={input} value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          </div>
          <button onClick={submit} disabled={busy} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60">Save result & retrain</button>
          <p className="text-[11px] text-slate-500">Tip: log the views 7 days after posting so every clip is compared at the same age.</p>
        </div>

        {/* CSV import */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Upload className="h-4 w-4 text-purple-400" /> Import past posts (CSV)</h3>
          <p className="text-xs text-slate-400">Fastest way to train. Columns: <code className="text-purple-300">text,views,followers,platform,hour,weekday,duration</code>. Only <b>text</b> and <b>views</b> are required. Weekday is 0 (Sun) to 6 (Sat).</p>
          <textarea rows={6} className={`${input} font-mono text-xs`} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'text,views,followers,platform,hour,weekday,duration\n"Stop making this mistake! Here is why...",125000,20000,TikTok,18,2,30'} />
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl py-2">Choose file</button>
            <button onClick={importCsv} disabled={busy || !csv.trim()} className="flex-1 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-2 disabled:opacity-50">Import & train</button>
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Logged posts ({data.records.length})</h3>
          {data.records.length > 0 && <button onClick={exportCsv} className="text-xs text-slate-300 hover:text-white flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Export CSV</button>}
        </div>
        {data.records.length === 0 && <p className="text-sm text-slate-500">Nothing logged yet.</p>}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {data.records.slice(0, 100).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <div className="min-w-0"><p className="text-sm text-slate-200 truncate">{r.title}</p><p className="text-[11px] text-slate-500">{r.platform} · {r.followers ? `${fmtNum(r.followers)} followers · ` : ''}{r.hour != null ? `${String(r.hour).padStart(2, '0')}:00 · ` : ''}{r.added?.slice(0, 10)}</p></div>
              <div className="flex items-center gap-3 shrink-0"><span className="text-sm font-bold text-emerald-300">{fmtNum(r.views)}</span><button onClick={() => remove(r.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" /> No tool can guarantee virality. Reach also depends on the platform algorithm, trends, thumbnails and luck. This model only learns what has worked for your own account, and tells you when it cannot.</p>
    </div>
  );
}
