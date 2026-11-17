// Run: node check-calc.js
const assert = require('assert');
const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
const logic = src.slice(src.indexOf('/* LOGIC START */'), src.indexOf('/* LOGIC END */'));
const L = new Function(logic + '; return { calcPlan, calcFrom, goalOf, parseWeek };')();
const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);

// your case: 60 to 115 by 2, 10 passes of 4 bars, drop 10, 4 weeks of 7 days
let r = L.calcPlan({ start: 60, goal: 115, step: 2, reps: 10, bars: 4, weeks: 4, days: 7, drop: 10 });
assert.strictEqual(r.tempos, 29);                 // 60, 62 ... 116
assert.strictEqual(r.perSession, 2);              // 29 tempos in 28 sessions: 2 new a session
assert.strictEqual(r.sessions, 15);
assert.strictEqual(r.climb, 6);                   // best - 10 ... best by 2
// no session is shorter than one tempo at the start: 160 beats at 60 BPM
const oneTempo = 10 * 4 * 4 * 60 / 60;
assert.ok(r.sessionSec > oneTempo, r.sessionSec);
// first session: 60 and 62, each with a count-in, one rest between
// tempos a session: 2, then 2+2 and 4+2 (the climb stops at 60), then 6+2 for 11 sessions, then 6+1 (116 is the last)
assert.strictEqual(r.passes, 10 * (2 + 4 + 6 + 11 * 8 + 7));
// session 2 replays 60 and 62 (60 is the floor) then plays 64, 66: 4 tempos
const two = L.calcPlan({ start: 60, goal: 66, step: 2, reps: 10, bars: 4, weeks: 1, days: 2, drop: 10 });
assert.deepStrictEqual([two.perSession, two.sessions], [2, 2]);
const t = b => 10 * 4 * 240 / b / 4 * 4;          // clean playing of one tempo, seconds
const bar = b => 240 / b;
const s1 = t(60) + bar(60) + t(62) + bar(62) + 1;
const s2 = [60, 62, 64, 66].reduce((a, b, k) => a + t(b) + bar(b) + (k ? 1 : 0), 0);
near(two.totalSec, s1 + s2, 1e-6);
near(two.longestSec, s2, 1e-6);
// drop 0 still replays the best: the app starts the next session at it
assert.strictEqual(L.calcPlan({ start: 60, goal: 80, step: 5, reps: 5, bars: 1, weeks: 1, days: 2, drop: 0 }).climb, 1);
// the formula is playing every tempo once: the planner's example, 80 to 120 by 2, 20 reps of 4 bars
r = L.calcPlan({ start: 80, goal: 120, step: 2, reps: 20, bars: 4, weeks: 2, days: 7, drop: 0 });
near(r.formulaSec / 60, 68.2, 0.05);
near(r.onceSec / 60, 68.2, 0.5);
assert.ok(r.totalSec > r.onceSec);
// the mistake buffer adds that share of the playing time, nothing else
{
  const o = { start: 60, goal: 66, step: 2, reps: 10, bars: 4, weeks: 1, days: 2, drop: 10 };
  const clean = L.calcPlan(o), buf = L.calcPlan(Object.assign({}, o, { buffer: 50 }));
  near(buf.bufferSec, clean.playSec * 0.5, 1e-6);
  near(buf.totalSec, clean.totalSec + clean.playSec * 0.5, 1e-6);
  assert.strictEqual(clean.bufferSec, 0);
}
// a goal not on a step: the last tempo is the first past it
assert.strictEqual(L.calcPlan({ start: 60, goal: 72, step: 5, reps: 1, bars: 1, weeks: 1, days: 1 }).last, 75);
// nonsense in, nothing out
assert.strictEqual(L.calcPlan({ start: 120, goal: 80, step: 2, reps: 20, bars: 4, weeks: 2, days: 7 }), null);

// from the week
assert.strictEqual(L.goalOf('Wrist, 60 BPM: Goal 115 bpm. 8ths'), 115);
const w = L.parseWeek('# Day 1, routine\nFinger dribbling, ladder, 100 BPM, 64 bars, 5 min: Goal 200 bpm.\nSD rrrr|rrrr\nPlain 60 BPM 2 min\n\n# Stick, 10 min\nSingles 50 BPM goal 120 bpm\nSD rlrl');
let c = L.calcFrom(w[0], w[0].items[0], {});
assert.deepStrictEqual(c, { name: 'Finger dribbling', start: 100, goal: 200, step: 5, bars: 2, reps: 32, drop: 10, minutes: 5 });
c = L.calcFrom(w[0], w[0].items[1], {});
assert.deepStrictEqual([c.reps, c.step, c.drop, c.goal], [5, 5, 0, 0]);
c = L.calcFrom(w[1], w[1].items[0], {});
assert.deepStrictEqual([c.name, c.start, c.goal, c.reps, c.bars, c.minutes], ['Singles 50 BPM', 50, 120, 20, 1, 10]);
console.log('calc ok');
