import assert from 'node:assert/strict';
import { trainModel, predictViews, extractFeatures, hookScore, PLATFORMS } from './predictor.js';

let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const norm = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const strong = ['Stop making this mistake! Here is why 90% of people fail at this.', 'Nobody tells you the secret to making 10000 dollars in 30 days, and you will not believe it.', 'Why does your business never grow? The truth is shocking.'];
const weak = ['So today we are going to talk about some general thoughts on the topic and how it relates to things.', 'Um yes so the meeting went okay and we discussed several items on the agenda for next quarter.', 'This is a long and quiet introduction to a subject that unfolds slowly over many sentences.'];

function make(n, signal) {
  return Array.from({ length: n }, () => {
    const good = rnd() < 0.5;
    const text = (good ? strong : weak)[Math.floor(rnd() * 3)];
    const followers = Math.round(10 ** (3 + rnd() * 2));
    const hour = Math.floor(rnd() * 24);
    const base = signal ? Math.log10(followers) + (good ? 0.9 : 0) + norm() * 0.35 : 3 + norm() * 0.8; // noise: views unrelated to anything
    return { text, duration: 20 + rnd() * 50, platform: PLATFORMS[Math.floor(rnd() * 5)], followers, hour, weekday: Math.floor(rnd() * 7), views: Math.round(10 ** base), sims: null };
  });
}

const sig = trainModel(make(200, true));
console.log('signal :', sig.status, sig.metrics, sig.blend);
assert.equal(sig.status, 'ready');
assert.ok(sig.metrics.rho > 0.5);
const good = predictViews(sig, { ...make(1, true)[0], text: strong[0], followers: 20000, platform: 'TikTok', hour: 18, duration: 30 }, null);
const bad = predictViews(sig, { text: weak[0], followers: 20000, platform: 'TikTok', hour: 18, duration: 30 }, null);
console.log('good', good, '\nbad ', bad);
assert.ok(good.median > bad.median, 'strong hook should outrank weak hook');

const noise = trainModel(make(200, false));
console.log('noise  :', noise.status, noise.metrics);
assert.ok(['weak', 'learning'].includes(noise.status) && noise.status !== 'ready', 'pure noise must NOT be reported as ready');
assert.equal(predictViews(trainModel(make(200, false)), { text: strong[0] }, null) === null || noise.status !== 'weak', true);

const cold = trainModel(make(5, true));
assert.equal(cold.status, 'cold');
assert.equal(predictViews(cold, { text: 'x y z' }, null), null);

const f = extractFeatures({ text: strong[0], duration: 30 }, null);
console.log('hookScore strong/weak:', hookScore(f.named), hookScore(extractFeatures({ text: weak[0], duration: 30 }, null).named));
console.log('ALL TESTS PASSED');
