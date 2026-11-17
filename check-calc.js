// Run: node check-calc.js
const assert = require('assert');
const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
const logic = src.slice(src.indexOf('/* LOGIC START */'), src.indexOf('/* LOGIC END */'));
const L = new Function(logic + '; return { calcPlan, calcFrom, goalOf, parseWeek };')();
const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);

// the planner's example: 80 to 120 by 2 BPM, 20 reps of 4 bars, 2 weeks of 7 days
const r = L.calcPlan({ start: 80, goal: 120, step: 2, reps: 20, bars: 4, weeks: 2, days: 7, drop: 0 });
assert.strictEqual(r.tempos, 21);
assert.strictEqual(r.cleanReps, 420);
assert.strictEqual(r.sessions, 14);
assert.strictEqual(r.gainPerWeek, 20);
near(r.formulaSec / 60, 68.2, 0.05);          // the formula: 2RB ln((G+1)/(S-1)) minutes
near(r.playSec / 60, 68.2, 0.5);              // the exact sum is close to it
near(r.dailySec, r.playSec / 14, 1e-9);
assert.strictEqual(r.climbSec, 0);
// doubling the reps doubles the time
near(L.calcPlan({ start: 80, goal: 120, step: 2, reps: 40, bars: 4, weeks: 2, days: 7 }).playSec, 2 * r.playSec, 1e-6);
// a goal not on a step: the last tempo is the first past it
assert.strictEqual(L.calcPlan({ start: 60, goal: 72, step: 5, reps: 1, bars: 1, weeks: 1, days: 1 }).last, 75);
// a drop adds the climb back each session after the first
assert.ok(L.calcPlan({ start: 80, goal: 120, step: 2, reps: 20, bars: 4, weeks: 2, days: 7, drop: 10 }).climbSec > 0);
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
