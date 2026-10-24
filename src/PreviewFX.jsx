import React, { useEffect, useMemo, useRef, useState } from 'react';
import { captionWords, groupWords, activeCaption, motionAt, easeOutBack, idSide } from './lib/effects.js';

// Renders everything the exporter burns in: animated captions, emoji pops, title text, flash,
// vignette, progress bar. Zoom/shake/colour grade are applied straight to the <video> element
// inside a requestAnimationFrame loop, so only this small component re-renders per frame.
export default function PreviewFX({ videoRef, effects, settings, caption, clip, transcript, deleted }) {
  const [t, setT] = useState(0);
  const [box, setBox] = useState({ w: 300, h: 500 });
  const boxRef = useRef(null);
  const live = useRef({});
  live.current = { effects, settings };

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth || 300, h: el.clientHeight || 500 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf;
    const v = videoRef.current;
    const loop = () => {
      const vid = videoRef.current;
      if (vid) {
        const tt = vid.currentTime;
        const { effects: fx, settings: st } = live.current;
        const m = motionAt(fx, tt);
        const w = boxRef.current ? boxRef.current.clientWidth : 300;
        vid.style.transform = m.scale > 1.0001 || m.dx || m.dy
          ? `translate(${(m.dx * w).toFixed(2)}px, ${(m.dy * w).toFixed(2)}px) scale(${m.scale.toFixed(4)})` : '';
        vid.style.filter = st.punchy ? 'contrast(1.12) saturate(1.3)' : '';
        setT(tt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); if (v) { v.style.transform = ''; v.style.filter = ''; } };
  }, [videoRef]);

  const words = useMemo(() => captionWords(transcript, deleted, clip.startTime, clip.endTime), [transcript, deleted, clip.startTime, clip.endTime]);
  const groups = useMemo(() => groupWords(words), [words]);

  const m = motionAt(effects, t);
  const cap = settings.captions !== false ? activeCaption(groups, t) : null;
  const H = box.h;
  const fs = caption.fontSize * H / 640;
  const stroke = Math.max(1.5, fs / 14);
  const outline = `${-stroke}px ${-stroke}px 0 #000, ${stroke}px ${-stroke}px 0 #000, ${-stroke}px ${stroke}px 0 #000, ${stroke}px ${stroke}px 0 #000, 0 ${stroke * 2}px ${stroke * 3}px rgba(0,0,0,.55)`;
  const pos = { top: { top: '10%' }, center: { top: '50%', transform: 'translateY(-50%)' }, bottom: { bottom: '11%' } }[caption.position] || { bottom: '11%' };
  const progress = Math.max(0, Math.min(1, (t - clip.startTime) / Math.max(0.1, clip.endTime - clip.startTime)));

  const wordStyle = (isActive, w) => {
    const pop = isActive ? 1 + 0.18 * Math.min(1, Math.max(0, (t - w.start) / 0.09)) : 1;
    const base = { display: 'inline-block', transform: `scale(${pop})`, margin: '0 0.14em', transition: 'color 60ms' };
    if (caption.badge) return { ...base, color: isActive ? caption.highlight : caption.color };
    return { ...base, color: isActive ? caption.highlight : caption.color, textShadow: isActive && caption.glow ? `${outline}, 0 0 ${fs * 0.6}px ${caption.highlight}` : outline };
  };

  return (
    <div ref={boxRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      {settings.vignette && <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)' }} />}

      {cap && (
        <div className="absolute left-0 right-0 flex justify-center px-3" style={pos}>
          <div style={{
            fontFamily: caption.font === 'System-UI' ? 'system-ui, sans-serif' : `${caption.font}, Impact, sans-serif`,
            fontSize: fs, fontWeight: 900, lineHeight: 1.15, textAlign: 'center', maxWidth: '94%',
            textTransform: caption.uppercase ? 'uppercase' : 'none',
            ...(caption.badge ? { background: '#000', borderRadius: fs * 0.25, padding: `${fs * 0.15}px ${fs * 0.4}px` } : {}),
          }}>
            {cap.group.words.map((w, i) => <span key={`${w.start}-${i}`} style={wordStyle(i === cap.active, w)}>{w.text}</span>)}
          </div>
        </div>
      )}

      {effects.map((e) => {
        if (t < e.start || t > e.end) return null;
        const p = Math.min(1, Math.max(0, (t - e.start) / 0.25));
        if (e.type === 'emoji' && settings.emojis !== false) {
          const size = H * 0.13;
          return <div key={e.id} className="absolute leading-none" style={{
            left: idSide(e.id) ? '20%' : '80%', top: '30%', fontSize: size,
            transform: `translate(-50%, -50%) scale(${Math.max(0.05, easeOutBack(p))})`,
          }}>{e.emoji}</div>;
        }
        if (e.type === 'text') {
          const tp = Math.min(1, Math.max(0, (t - e.start) / 0.16));
          const fadeOut = Math.min(1, (e.end - t) / 0.16);
          return <div key={e.id} className="absolute left-0 right-0 flex justify-center" style={e.pos === 'center' ? { top: '50%', transform: 'translateY(-50%)' } : { top: '12%' }}>
            <div style={{
              background: '#FFE600', color: '#000', fontFamily: 'Impact, Arial Black, sans-serif', fontWeight: 900, textTransform: 'uppercase',
              fontSize: H * 0.045, lineHeight: 1.15, textAlign: 'center', maxWidth: '84%', padding: '0.18em 0.5em', borderRadius: '0.2em',
              transform: `scale(${0.6 + 0.4 * tp})`, opacity: Math.max(0, Math.min(tp, fadeOut)),
            }}>{e.text}</div>
          </div>;
        }
        return null;
      })}

      {m.flash > 0.01 && <div className="absolute inset-0 bg-white" style={{ opacity: m.flash }} />}

      {settings.progress !== false && (
        <div className="absolute left-0 bottom-0" style={{ height: Math.max(4, H * 0.009), width: `${progress * 100}%`, background: caption.highlight }} />
      )}
    </div>
  );
}
