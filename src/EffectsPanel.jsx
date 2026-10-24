import React from 'react';
import { Sparkles, Download, Trash2 } from 'lucide-react';
import { FX_TYPES, longestStaticGap } from './lib/effects.js';

const LEVEL_INFO = {
  subtle: ['Subtle', 'Gentle zoom every ~5s'],
  balanced: ['Balanced', 'Zoom + shake + emoji'],
  wild: ['Wild', 'Fast cuts, flashes, max energy'],
};

const TOGGLES = [
  ['captions', 'Animated captions', 'Word-by-word highlight and pop'],
  ['progress', 'Progress bar', 'Keeps viewers watching to the end'],
  ['punchy', 'Punchy color', 'More contrast and saturation'],
  ['vignette', 'Vignette', 'Dark edges pull focus to the center'],
];

export default function EffectsPanel({ settings, setSettings, level, setLevel, onAuto, onClear, onExport, effects, clip, busy }) {
  const inClip = effects.filter((e) => e.end > clip.startTime && e.start < clip.endTime);
  const counts = Object.keys(FX_TYPES).map((k) => [k, inClip.filter((e) => e.type === k).length]).filter(([, n]) => n);
  const gap = longestStaticGap(inClip, clip);
  const gapOk = gap <= 4;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-400" /> Viral Effects
      </h3>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(LEVEL_INFO).map(([id, [name, hint]]) => (
            <button key={id} onClick={() => setLevel(id)}
              className={`p-2 rounded-lg border text-left transition-all ${level === id ? 'bg-fuchsia-600/20 border-fuchsia-500 ring-1 ring-fuchsia-500' : 'border-slate-800 hover:border-slate-700'}`}>
              <p className="text-xs font-bold text-white">{name}</p>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{hint}</p>
            </button>
          ))}
        </div>

        <button onClick={onAuto} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-600/20">
          <Sparkles className="h-4 w-4" /> Auto-Add Viral Effects to this clip
        </button>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {counts.length ? counts.map(([k, n]) => (
            <span key={k} className="px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: FX_TYPES[k].color }}>{n} {FX_TYPES[k].short}</span>
          )) : <span className="text-slate-500">No effects yet. Auto-add them, or add your own on the timeline.</span>}
          {inClip.length > 0 && (
            <button onClick={onClear} className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-300"><Trash2 className="h-3 w-3" /> Clear clip effects</button>
          )}
        </div>

        <div className={`text-[11px] rounded-lg px-3 py-2 border ${gapOk ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-amber-800 bg-amber-950/30 text-amber-300'}`}>
          Pacing: longest stretch with no visual change is <b>{gap.toFixed(1)}s</b>. {gapOk ? 'Good rhythm for short-form.' : 'Add a zoom or emoji there so viewers do not drift away.'}
        </div>

        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          {TOGGLES.map(([key, label, hint]) => (
            <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
              <span><span className="text-xs text-slate-200 font-medium">{label}</span> <span className="text-[10px] text-slate-500">{hint}</span></span>
              <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))} className="accent-fuchsia-500 h-4 w-4" />
            </label>
          ))}
        </div>

        <button onClick={onExport} disabled={!!busy} className="w-full py-2 rounded-xl bg-lime-600 hover:bg-lime-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2">
          <Download className="h-4 w-4" /> {busy ? busy : 'Export MP4 with effects'}
        </button>
        <p className="text-[10px] text-slate-500">Export renders in your browser with ffmpeg and needs your own uploaded video (not the demo samples). Long clips are slow.</p>
      </div>
    </div>
  );
}
