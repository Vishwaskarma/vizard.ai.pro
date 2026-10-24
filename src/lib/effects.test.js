// Run with: node src/lib/effects.test.js  (also part of `npm test`)
import assert from 'node:assert/strict';
import { autoEffects, longestStaticGap, buildAss, buildExportGraph, motionAt, makeEffect, DEFAULT_SETTINGS } from './effects.js';

const segs = [
  { id: 1, start: 0.5, end: 3.2, speaker: 'A', text: 'If you are not using artificial intelligence in your workflow today,' },
  { id: 2, start: 3.3, end: 6.8, speaker: 'A', text: 'you are literally falling behind 90% of your competitors right now!', isViral: true },
  { id: 3, start: 7.0, end: 11.4, speaker: 'B', text: 'That is so true! The shift happening in content creation is faster than anything.' },
  { id: 4, start: 11.5, end: 16.2, speaker: 'B', text: 'Here is the secret shortcut: repurposing long form videos into viral shorts.', isViral: true },
  { id: 5, start: 16.5, end: 20.1, speaker: 'A', text: 'Exactly. People do not have time to watch 60-minute webinars anymore.' },
  { id: 6, start: 20.3, end: 25.8, speaker: 'A', text: 'Give them the golden nuggets in 30 seconds with bold subtitles and instant hooks.', isViral: true },
];
const clip = { startTime: 3.3, endTime: 25.3 };

for (const level of ['subtle', 'balanced', 'wild']) {
  const fx = autoEffects({ segs, clip, level, hookText: 'Stop making this mistake' });
  const zooms = fx.filter((e) => e.type === 'zoom').sort((a, b) => a.start - b.start);
  for (let i = 1; i < zooms.length; i++) assert.ok(zooms[i].start >= zooms[i - 1].end - 1e-6, `${level}: zooms overlap`);
  assert.ok(fx.every((e) => e.start >= clip.startTime - 1e-6 && e.end <= clip.endTime + 1e-6 && e.end > e.start), `${level}: effect outside clip`);
  const gap = longestStaticGap(fx, clip);
  const limit = { subtle: 5.5, balanced: 4, wild: 3 }[level];
  assert.ok(gap <= limit, `${level}: longest static gap ${gap.toFixed(2)}s > ${limit}s`);
}

// deleted lines are never captioned
const ass = buildAss({ segs, deleted: [2], effects: [], settings: DEFAULT_SETTINGS, caption: { fontSize: 28, color: '#FFFFFF', highlight: '#FFE600', position: 'bottom' }, W: 720, H: 1280, start: 3.3, end: 16 });
assert.ok(!/literally/.test(ass) && /Dialogue/.test(ass), 'ASS should skip deleted lines but contain captions');

// motion: zoom peaks at its intensity, nothing outside range
const z = makeEffect('zoom', 2, { end: 4, intensity: 1.2 });
assert.equal(motionAt([z], 1).scale, 1);
assert.ok(Math.abs(motionAt([z], 3).scale - 1.2) < 1e-9);

// graph builder always yields an [out] label
assert.match(buildExportGraph({ cropChain: 'null', effects: [z], settings: DEFAULT_SETTINGS, W: 720, H: 1280, start: 0, end: 10 }).graph, /\[out\]$/);
console.log('effects tests passed');
