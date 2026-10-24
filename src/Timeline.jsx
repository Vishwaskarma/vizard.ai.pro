import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Trash2, Copy, Plus } from 'lucide-react';
import { FX_TYPES, EMOJI_CHOICES, makeEffect, clamp, uid } from './lib/effects.js';

const LABEL_W = 84;
const LANES = [
  { id: 'clip', label: 'Clip', h: 38 },
  { id: 'captions', label: 'Captions', h: 28 },
  { id: 'motion', label: 'Motion FX', h: 32 },
  { id: 'overlay', label: 'Emoji / Text', h: 32 },
];
const ICON = { zoom: '🔍', shake: '📳', flash: '⚡', text: 'T' };
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const snap = (x) => Math.round(x * 10) / 10;
const ROW = 26;
const MIN_W = 16;
// Overlapping effects in a lane are stacked into sub-rows so none is hidden behind another.
function pack(list, pps) {
  const ends = [], row = {};
  for (const f of [...list].sort((a, b) => a.start - b.start)) {
    const visEnd = Math.max(f.end, f.start + MIN_W / pps);
    let r = ends.findIndex((e) => e <= f.start + 0.001);
    if (r < 0) { r = ends.length; ends.push(0); }
    ends[r] = visEnd; row[f.id] = r;
  }
  return { row, rows: Math.max(1, ends.length) };
}

export default function Timeline({ duration, clip, onClipChange, transcript, deleted, effects, setEffects, selected, setSelected, videoRef }) {
  const [pps, setPps] = useState(14); // pixels per second
  const [t, setT] = useState(0);
  const scrollRef = useRef(null);
  const drag = useRef(null);
  const dur = Math.max(10, duration || 10);
  const width = dur * pps;
  const live = useRef({});
  live.current = { pps, dur, onClipChange, setEffects };

  // follow the video playhead; keep it in view while playing
  useEffect(() => {
    let raf;
    const loop = () => {
      const v = videoRef.current, sc = scrollRef.current;
      if (v) {
        setT(v.currentTime);
        if (sc && !v.paused && !drag.current) {
          const x = v.currentTime * live.current.pps;
          if (x < sc.scrollLeft + 30 || x > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, x - 80);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  // bring the active clip into view when it changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, clip.startTime * pps - 40);
  }, [clip.id]);

  const xToTime = (clientX) => {
    const sc = scrollRef.current, r = sc.getBoundingClientRect();
    return clamp((clientX - r.left + sc.scrollLeft) / live.current.pps, 0, live.current.dur);
  };
  const seek = (time) => { const v = videoRef.current; if (v) v.currentTime = time; setT(time); };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const { pps: P, dur: D, onClipChange: change, setEffects: setFx } = live.current;
    if (d.kind === 'scrub') { seek(xToTime(e.clientX)); return; }
    const dt = (e.clientX - d.x0) / P;
    if (d.kind === 'clipL') change('startTime', clamp(snap(d.a0 + dt), 0, d.b0 - 1));
    else if (d.kind === 'clipR') change('endTime', clamp(snap(d.b0 + dt), d.a0 + 1, D));
    else if (d.kind === 'fx') {
      setFx((list) => list.map((f) => {
        if (f.id !== d.id) return f;
        const len = d.b0 - d.a0;
        if (d.mode === 'move') { const s = clamp(snap(d.a0 + dt), 0, D - len); return { ...f, start: s, end: s + len }; }
        if (d.mode === 'l') return { ...f, start: clamp(snap(d.a0 + dt), 0, d.b0 - 0.15) };
        return { ...f, end: clamp(snap(d.b0 + dt), d.a0 + 0.15, D) };
      }));
    }
  };
  const onUp = () => {
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  const begin = (e, info) => {
    drag.current = { x0: e.clientX, ...info };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const scrub = (e) => {
    if (e.button !== 0) return;
    setSelected(null);
    seek(xToTime(e.clientX));
    begin(e, { kind: 'scrub' });
  };
  const grab = (e, f, mode) => {
    e.stopPropagation();
    setSelected(f.id);
    begin(e, { kind: 'fx', id: f.id, mode, a0: f.start, b0: f.end });
  };

  const addAt = (type) => {
    const e = makeEffect(type, Math.min(t, Math.max(0, dur - 0.5)));
    e.end = Math.min(dur, e.end);
    setEffects((l) => [...l, e]);
    setSelected(e.id);
  };
  const sel = effects.find((f) => f.id === selected);
  const patch = (p) => setEffects((l) => l.map((f) => (f.id === selected ? { ...f, ...p } : f)));
  const remove = () => { setEffects((l) => l.filter((f) => f.id !== selected)); setSelected(null); };
  const duplicate = () => {
    if (!sel) return;
    const len = sel.end - sel.start;
    const c = { ...sel, id: uid(), start: Math.min(dur - len, sel.end + 0.1), end: Math.min(dur, sel.end + 0.1 + len) };
    setEffects((l) => [...l, c]); setSelected(c.id);
  };
  const onKey = (e) => {
    if (!selected || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
  };

  const step = pps >= 40 ? 1 : pps >= 18 ? 2 : pps >= 8 ? 5 : 10;
  const ticks = [];
  for (let s = 0; s <= dur; s += step) ticks.push(s);

  const inLane = (lane) => effects.filter((f) => FX_TYPES[f.type].lane === lane);
  const packed = { motion: pack(inLane('motion'), pps), overlay: pack(inLane('overlay'), pps) };
  const laneH = (l) => (packed[l.id] ? Math.max(l.h, packed[l.id].rows * ROW + 6) : l.h);
  const laneBlocks = (lane) => inLane(lane).map((f) => {
    const info = FX_TYPES[f.type];
    const on = f.id === selected;
    const label = f.type === 'emoji' ? f.emoji : f.type === 'text' ? f.text : f.type === 'zoom' ? `${ICON.zoom} ${Number(f.intensity).toFixed(2)}×` : ICON[f.type];
    return (
      <div key={f.id} onPointerDown={(e) => grab(e, f, 'move')}
        className={`absolute rounded-md text-[10px] font-bold text-white flex items-center px-1.5 overflow-hidden whitespace-nowrap cursor-grab active:cursor-grabbing select-none ${on ? 'ring-2 ring-white z-10' : 'ring-1 ring-black/40'}`}
        style={{ left: f.start * pps, width: Math.max(MIN_W, (f.end - f.start) * pps), top: 3 + packed[lane].row[f.id] * ROW, height: ROW - 4, background: info.color }} title={`${info.label} · ${f.start.toFixed(1)}s–${f.end.toFixed(1)}s`}>
        <span className="truncate">{label}</span>
        <span onPointerDown={(e) => grab(e, f, 'l')} className="absolute left-0 top-0 bottom-0 cursor-ew-resize bg-white/40 hover:bg-white/80" style={{ width: 4 }} />
        <span onPointerDown={(e) => grab(e, f, 'r')} className="absolute right-0 top-0 bottom-0 cursor-ew-resize bg-white/40 hover:bg-white/80" style={{ width: 4 }} />
      </div>
    );
  });

  const totalH = LANES.reduce((a, l) => a + laneH(l), 0);
  return (
    <div tabIndex={0} onKeyDown={onKey} className="shrink-0 border-t border-slate-800 bg-slate-950 outline-none select-none">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/70 text-xs">
        <span className="font-bold text-slate-200 uppercase tracking-wider mr-1">Timeline</span>
        <span className="font-mono text-slate-400 w-24">{mmss(t)} / {mmss(dur)}</span>
        <span className="text-slate-500 hidden md:inline">Add at playhead:</span>
        {Object.entries(FX_TYPES).map(([k, v]) => (
          <button key={k} onClick={() => addAt(k)} className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-700 hover:border-slate-500 text-slate-200" style={{ borderLeft: `3px solid ${v.color}` }}>
            <Plus className="h-3 w-3" /> {v.short}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-slate-400">
          <ZoomOut className="h-3.5 w-3.5" />
          <input type="range" min="4" max="80" value={pps} onChange={(e) => {
            const sc = scrollRef.current, np = Number(e.target.value);
            const center = sc ? (sc.scrollLeft + sc.clientWidth / 2) / pps : 0;
            setPps(np);
            requestAnimationFrame(() => { if (sc) sc.scrollLeft = Math.max(0, center * np - sc.clientWidth / 2); });
          }} className="w-24 accent-purple-500" />
          <ZoomIn className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* tracks */}
      <div className="flex">
        <div className="shrink-0 border-r border-slate-800 bg-slate-900/60" style={{ width: LABEL_W, paddingTop: 22 }}>
          {LANES.map((l) => (
            <div key={l.id} style={{ height: laneH(l) }} className="flex items-center px-2 text-[10px] font-semibold text-slate-400 border-b border-slate-800/70">{l.label}</div>
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
          <div className="relative" style={{ width, height: totalH + 22 }} onPointerDown={scrub}>
            {/* ruler */}
            <div className="absolute top-0 left-0 right-0 h-[22px] border-b border-slate-800 bg-slate-900/60">
              {ticks.map((s) => (
                <div key={s} className="absolute top-0 bottom-0 border-l border-slate-700/80 pl-1 text-[9px] font-mono text-slate-500" style={{ left: s * pps }}>{mmss(s)}</div>
              ))}
            </div>

            <div className="absolute left-0 right-0" style={{ top: 22 }}>
              {/* lane backgrounds */}
              {LANES.map((l, i) => (
                <div key={l.id} className={`relative border-b border-slate-800/70 ${i % 2 ? 'bg-slate-950' : 'bg-slate-900/30'}`} style={{ height: laneH(l) }}>
                  {l.id === 'clip' && (
                    <>
                      <div className="absolute top-1 bottom-1 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 ring-1 ring-black/40 text-[10px] text-white/90 font-semibold flex items-center px-2 overflow-hidden whitespace-nowrap"
                        style={{ left: clip.startTime * pps, width: Math.max(10, (clip.endTime - clip.startTime) * pps) }}>
                        <span className="truncate">{clip.title || 'Clip'} · {(clip.endTime - clip.startTime).toFixed(1)}s</span>
                        <span onPointerDown={(e) => { e.stopPropagation(); begin(e, { kind: 'clipL', a0: clip.startTime, b0: clip.endTime }); }} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/60 hover:bg-white" title="Drag to trim start" />
                        <span onPointerDown={(e) => { e.stopPropagation(); begin(e, { kind: 'clipR', a0: clip.startTime, b0: clip.endTime }); }} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/60 hover:bg-white" title="Drag to trim end" />
                      </div>
                      {transcript.filter((s) => deleted.includes(s.id)).map((s) => (
                        <div key={s.id} className="absolute top-1 bottom-1 bg-red-600/70 pointer-events-none rounded-sm" style={{ left: s.start * pps, width: Math.max(2, (s.end - s.start) * pps), backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,.35) 0 4px, transparent 4px 8px)' }} title="Cut line" />
                      ))}
                    </>
                  )}
                  {l.id === 'captions' && transcript.map((s) => (
                    <div key={s.id} className={`absolute top-1 bottom-1 rounded px-1 text-[9px] leading-[18px] overflow-hidden whitespace-nowrap pointer-events-none ${deleted.includes(s.id) ? 'bg-red-900/40 text-red-300 line-through' : s.isViral ? 'bg-orange-500/30 text-orange-200 border border-orange-500/50' : 'bg-slate-700/60 text-slate-300'}`}
                      style={{ left: s.start * pps, width: Math.max(4, (s.end - s.start) * pps - 1) }}>{s.text}</div>
                  ))}
                  {(l.id === 'motion' || l.id === 'overlay') && laneBlocks(l.id)}
                </div>
              ))}
              {/* dim everything outside the active clip */}
              <div className="absolute top-0 bottom-0 left-0 bg-black/45 pointer-events-none" style={{ width: clip.startTime * pps, height: totalH }} />
              <div className="absolute top-0 bg-black/45 pointer-events-none" style={{ left: clip.endTime * pps, right: 0, height: totalH }} />
            </div>

            {/* playhead */}
            <div className="absolute top-0 w-px bg-red-500 pointer-events-none z-20" style={{ left: t * pps, height: totalH + 22 }}>
              <div className="absolute -top-0.5 -left-[5px] w-[11px] h-[11px] bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* inspector */}
      <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/50 text-xs min-h-[44px] flex flex-wrap items-center gap-3">
        {!sel ? (
          <span className="text-slate-500">Click the timeline to move the playhead. Click an effect to edit it, drag it to move, drag its edges to resize. Press Delete to remove.</span>
        ) : (
          <>
            <span className="font-bold px-2 py-0.5 rounded text-white" style={{ background: FX_TYPES[sel.type].color }}>{FX_TYPES[sel.type].label}</span>
            <label className="text-slate-400 flex items-center gap-1">Start
              <input type="number" step="0.1" min="0" value={Number(sel.start.toFixed(1))} onChange={(e) => patch({ start: clamp(Number(e.target.value) || 0, 0, sel.end - 0.15) })} className="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-slate-200" />
            </label>
            <label className="text-slate-400 flex items-center gap-1">End
              <input type="number" step="0.1" min="0" value={Number(sel.end.toFixed(1))} onChange={(e) => patch({ end: clamp(Number(e.target.value) || 0, sel.start + 0.15, dur) })} className="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-slate-200" />
            </label>
            {sel.type === 'zoom' && (
              <label className="text-slate-400 flex items-center gap-1">Zoom {Number(sel.intensity).toFixed(2)}×
                <input type="range" min="1.05" max="1.6" step="0.01" value={sel.intensity} onChange={(e) => patch({ intensity: Number(e.target.value) })} className="w-28 accent-purple-500" />
              </label>
            )}
            {sel.type === 'shake' && (
              <label className="text-slate-400 flex items-center gap-1">Strength
                <input type="range" min="0.5" max="2.5" step="0.1" value={sel.intensity} onChange={(e) => patch({ intensity: Number(e.target.value) })} className="w-28 accent-orange-500" />
              </label>
            )}
            {sel.type === 'emoji' && (
              <div className="flex flex-wrap gap-1">
                {EMOJI_CHOICES.map((em) => (
                  <button key={em} onClick={() => patch({ emoji: em })} className={`text-base leading-none px-1 py-0.5 rounded ${sel.emoji === em ? 'bg-pink-600/40 ring-1 ring-pink-400' : 'hover:bg-slate-800'}`}>{em}</button>
                ))}
              </div>
            )}
            {sel.type === 'text' && (
              <>
                <input value={sel.text} maxLength={48} onChange={(e) => patch({ text: e.target.value.toUpperCase() })} className="w-52 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200" placeholder="Title text" />
                <select value={sel.pos} onChange={(e) => patch({ pos: e.target.value })} className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-slate-200">
                  <option value="top">Top</option><option value="center">Center</option>
                </select>
              </>
            )}
            <button onClick={duplicate} className="ml-auto flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-slate-300 hover:border-slate-500"><Copy className="h-3 w-3" /> Duplicate</button>
            <button onClick={remove} className="flex items-center gap-1 px-2 py-1 rounded border border-red-900 text-red-400 hover:bg-red-950"><Trash2 className="h-3 w-3" /> Delete</button>
          </>
        )}
      </div>
    </div>
  );
}
