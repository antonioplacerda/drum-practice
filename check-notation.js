// Run: node check-notation.js
const assert = require('assert');
const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
const logic = src.slice(src.indexOf('/* LOGIC START */'), src.indexOf('/* LOGIC END */'));
const L = new Function(logic + '; return { parseWeek, gsToRows, gsLink, renderStaff, buildVoice, restsShown, newSession, results, applyResults, startTempo, planCsv, vidTime, vidSecs };')();

function pat(text) { return L.parseWeek('# Grooves, groove\nX\n' + text)[0].items[0].pattern; }
function hit(p, lane, pos) { return p.bars[0].hits.find(h => h.lane === lane && h.pos === pos); }

// symbols and accents
let p = pat('HH X-x-+-o-\nSD O-g-x-f-|d-z-R-L-\nBD o-------');
assert.deepStrictEqual([hit(p, 'HH', 0).acc, hit(p, 'HH', 8).kind, hit(p, 'HH', 12).kind], [true, 'closed', 'open']);
assert.deepStrictEqual(['SD 0', 'SD 4', 'SD 8', 'SD 12'].map(k => { const h = hit(p, 'SD', +k.split(' ')[1]); return h.kind + (h.acc ? '!' : ''); }), ['hit!', 'ghost', 'xs', 'flam']);
const b2 = p.bars[1].hits.filter(h => h.lane === 'SD').map(h => h.kind + (h.acc ? '!' : '') + (h.stick || ''));
assert.deepStrictEqual(b2, ['drag', 'buzz', 'hit!R', 'hit!L']);

// ST line gives sticking to the hand note at that place
p = pat('SD f---g---\nST r---l---');
assert.deepStrictEqual(p.bars[0].hits.map(h => h.stick), ['R', 'L']);

// GrooveScribe link under an exercise, and on its own line with a title
const url = 'https://www.mikeslessons.com/groove/?TimeSig=4/4&Div=8&Tempo=80&Measures=1&H=|xxxxxxxx|&S=|--O---O-|&K=|o---o---|';
p = pat(url);
assert.strictEqual(p.bars[0].hits.length, 12);
assert.ok(hit(p, 'SD', 4).acc);
let w = L.parseWeek('# Fun, routine\n' + url.replace('Tempo', 'Title=Rock%20beat&Tempo'));
assert.strictEqual(w[0].items[0].label, 'Rock beat 80 BPM');
w = L.parseWeek('# A\nMy groove ' + url);
assert.strictEqual(w[0].items[0].label, 'My groove');
assert.ok(w[0].items[0].pattern.bars);
assert.ok(/Only 4\/4/.test(pat(url.replace('4/4', '3/4')).error));

// round trip through a GrooveScribe link
const g2 = 'https://www.mikeslessons.com/groove/?TimeSig=4/4&Div=16&Measures=2&H=|X-x-+-o-r-R-c---|x---x---x---x---|&S=|g-O-x-f-d-b-----|----O-------O---|&K=|o-+-X---o-------|o-------o-------|&T1=|------------o---|----------------|&Stickings=|R-L-R-------L---|----------------|';
p = pat(g2);
const back = L.gsLink(p, '', 0);
['H', 'S', 'K', 'T1', 'Stickings'].forEach(k => {
  const re = new RegExp('[?&]' + k + '=([^&]*)');
  let want = re.exec(g2)[1];
  if (k === 'S') want = want.replace('f', 'f'); // GrooveScribe flams are accented; both write back as f
  assert.strictEqual(re.exec(back)[1], want, k);
});
// triplets
p = pat('HH xx-xx-xx-xx-\nSD ---o-----o--');
assert.ok(/Div=12/.test(L.gsLink(p)));
// straight 16ths mixed with triplets: 48 a bar
const mixed = L.gsLink(pat('SD oooo|oooooooo|oooooooooooo|oooooooooooooooo'));
assert.ok(/Div=48/.test(mixed));
assert.strictEqual(/S=([^&]*)/.exec(mixed)[1].split('|')[4], 'o--o--o--o--o--o--o--o--o--o--o--o--o--o--o--o--');
// and it reads back as written
assert.deepStrictEqual(L.gsToRows(mixed).rows, [{ name: 'SD', text: 'oooo|oooooooo|oooooooooooo|oooooooooooooooo' }]);
assert.ok(/16ths and triplets in the same bar/.test(L.gsToRows('https://x/?Div=48&S=|o--o------------o---o---o---o---o---o---o---o---|').error));

// rests: none under the other voice's notes; when both are silent, only the hands' rest
function shown(text, beat) {
  const bar = pat(text).bars[0], r = L.restsShown(L.buildVoice(bar, 'up', beat), L.buildVoice(bar, 'down', beat));
  return ['up', 'down'].map(v => r[v].filter(e => e.type === 'rest' && !e.hide).length);
}
const rock = 'HH x-x-x-x-\nSD --o---o-\nBD o---o---';
assert.deepStrictEqual([0, 1, 2, 3].map(b => shown(rock, b)), [[0, 0], [0, 0], [0, 0], [0, 0]]);
const gap = 'HH x-------\nSD --------\nBD --o-----';
assert.deepStrictEqual([0, 1, 2, 3].map(b => shown(gap, b)), [[0, 0], [0, 0], [1, 0], [1, 0]]);

// a tempo in an exercise line: where it starts, and the lowest it comes back to
const sec = L.parseWeek('# Timing, ladder\nTiming masterclass subdivisions, 50 bpm\nOther line')[0];
let ses = L.newSession(sec, {});
assert.deepStrictEqual(ses.lines.map(l => l.tempo), [50, 60]);
ses.lines[0].top = 55;
const mem = {};
L.applyResults(mem, L.results(ses), 'ladder');
const k = sec.items[0].key;
assert.strictEqual(mem[k].from, 50);
assert.strictEqual(L.startTempo(mem[k].last, 'ladder', mem[k].from), 50); // 55 - 10, but never below 50
assert.strictEqual(L.newSession(sec, { [k]: { last: 80, type: 'ladder', from: 50 } }).lines[0].tempo, 70);

// the staff draws without errors
const svg = L.renderStaff(pat('HH X-x-+-o-\nSD O-g-x-f-|d-z-R-L-\nBD o-------'), 600);
assert.ok(svg.startsWith('<svg') && !/NaN|undefined/.test(svg));
console.log('notation ok');

// a routine item marked ladder: ladder rules for its time, tempo memory like a ladder line
{
  const sec = L.parseWeek('# Day 1 hands, routine\nWrist development, right hand, ladder, 60 BPM, 7 min: details\nSD r-r-r-r-\nPlain item 60 BPM 2 min\nSD rrrr')[0];
  assert.strictEqual(sec.type, 'routine');
  assert.strictEqual(sec.minutes, 9);
  let s = L.newSession(sec, {});
  assert.deepStrictEqual([s.lines[0].name, s.lines[0].ladder, s.lines[0].tempo, s.lines[0].detail], ['Wrist development right hand', true, 60, 'details']);
  assert.strictEqual(s.lines[1].ladder, false);
  s.lines[0].top = 90; s.lines[1].top = 70;
  const mem = {};
  L.applyResults(mem, L.results(s), 'routine');
  assert.deepStrictEqual(mem['wrist development right hand'], { label: 'Wrist development right hand', last: 90, type: 'ladder', from: 60 });
  assert.strictEqual(mem['plain item'].type, 'routine');
  // next session: 10 below the highest clean, never below the written tempo
  assert.strictEqual(L.newSession(sec, mem).lines[0].tempo, 80);
  mem['wrist development right hand'].last = 65;
  assert.strictEqual(L.newSession(sec, mem).lines[0].tempo, 60);
}
console.log('routine ladder items ok');

// "N bars" in a routine item: bars at each tempo, rounded up to whole passes of the notes
{
  const sec = L.parseWeek('# Day 1 hands, routine\nFinger dribbling, right hand, ladder, 100 BPM, 64 bars, 5 min: details\nSD rrrr|rrrr|rrrr|rrrr\nOdd 60 BPM 10 bars 2 min\nSD r-r-|r-r-|r-r-\nOne bar 60 BPM 12 bars\nPlain 60 BPM 2 min')[0];
  const s = L.newSession(sec, {});
  assert.deepStrictEqual(s.lines.map(l => [l.name, l.bars]), [['Finger dribbling right hand', 64], ['Odd', 10], ['One bar', 12], ['Plain', 0]]);
  assert.strictEqual(s.lines[0].ladder, true);
  assert.strictEqual(s.lines[0].tempo, 100);
}
console.log('bars per tempo ok');

// the click fades only when the item says fade
{
  const sec = L.parseWeek('# A, routine\nWrist, ladder, fade, 60 BPM, 7 min: d\nSD r-r-\nWrist left, ladder, 60 BPM, 7 min\nSD l-l-')[0];
  const s = L.newSession(sec, {});
  assert.deepStrictEqual(s.lines.map(l => [l.name, l.ladder, l.fade]), [['Wrist', true, true], ['Wrist left', true, false]]);
}
console.log('fade ok');

// settings per item: passes, step and drop; tempo memory follows the name
{
  const L2 = new Function(logic + '; return { parseWeek, newSession, results, applyResults, splitItem, routineStart };')();
  const sp = L2.splitItem('Wrist development, right hand, ladder, 60 BPM, 10 passes, 4 BPM drop, 2 BPM step, 7 min: Goal 115 bpm');
  assert.deepStrictEqual([sp.name, sp.tempo, sp.secs, sp.passes, sp.inc, sp.drop, sp.ladder], ['Wrist development right hand', 60, 420, 10, 2, 4, true]);
  assert.deepStrictEqual(['step 3 BPM, drop of 0 BPM, 80 BPM', 'x 80 bpm +2 bpm steps'].map(t => { const q = L2.splitItem(t); return [q.tempo, q.inc, q.drop]; }), [[80, 3, 0], [80, 2, null]]);
  const sec = L2.parseWeek('# A, routine\nWrist, ladder, 60 BPM, 10 passes, 4 BPM drop, 2 BPM step, 7 min\nSD r-r-|r-r-\nPlain, 60 BPM, 3 BPM drop, 3 passes, 2 min')[0];
  let s = L2.newSession(sec, {});
  assert.deepStrictEqual(s.lines.map(l => [l.passes, l.inc, l.drop, l.key]), [[10, 2, 4, 'wrist'], [3, 0, 3, 'plain']]);
  s.lines[0].top = 80; s.lines[1].top = 70;
  const mem = {};
  L2.applyResults(mem, L2.results(s), 'routine');
  assert.deepStrictEqual(mem.wrist, { label: 'Wrist', last: 80, type: 'ladder', from: 60, drop: 4 });
  // next session: 4 below the best for both, the plain one too because it has a drop
  assert.deepStrictEqual(L2.newSession(sec, mem).lines.map(l => l.tempo), [76, 67]);
  // changing its settings, tempo or details keeps the memory
  const sec2 = L2.parseWeek('# A, routine\nWrist, ladder, 50 BPM, 20 passes, 6 BPM drop, 5 min: new details\nSD r-r-')[0];
  assert.strictEqual(L2.newSession(sec2, mem).lines[0].tempo, 74);
  // an entry kept by the whole line, from before, is still found
  const old = L2.parseWeek('# A, routine\nOld item 60 BPM 2 min')[0];
  assert.strictEqual(L2.newSession(old, { [old.items[0].key]: { last: 70, start: 66, type: 'routine' } }).lines[0].tempo, 67);
}
console.log('item settings ok');

// a heading with no type whose items have times is a routine, and adds them up
{
  const w = L.parseWeek('# Day 1 hands\nWrist, ladder, 60 BPM, 10 passes, 7 min\nSD r-r-\nDribbling, 100 BPM, 5 min\n\n# Stick Control\nSingles 60 BPM\n\n# Mixed, routine\nA 60 BPM 7 min\nB 60 BPM');
  assert.deepStrictEqual(w.map(x => [x.name, x.type, x.minutes, x.untimed || 0, !!x.open]), [['Day 1 hands', 'routine', 12, 0, false], ['Stick Control', 'ladder', 10, 0, false], ['Mixed', 'routine', 7, 1, true]]);
  assert.strictEqual(L.newSession(w[2], {}).open, true);
  // no item timed: the default, with a clock
  const none = L.parseWeek('# Warm up, routine\nStretch\nBreathe')[0];
  assert.deepStrictEqual([none.minutes, !!none.open], [10, false]);
  // the words the Week tab writes read back: "10 passes a tempo, +2 BPM steps"
  const L3 = new Function(logic + '; return { splitItem };')();
  const q = L3.splitItem('Wrist development, right hand, ladder, 60 BPM, 10 passes a tempo, +2 BPM steps, 4 BPM drop, 12 mins: Goal 115 bpm');
  assert.deepStrictEqual([q.name, q.passes, q.inc, q.drop, q.secs], ['Wrist development right hand', 10, 2, 4, 720]);
  assert.deepStrictEqual([L3.splitItem('X, 60 BPM, 24 bars per tempo').name, L3.splitItem('X, 60 BPM, 24 bars per tempo').bars], ['X', 24]);
  // a type in the heading always wins
  assert.strictEqual(L.parseWeek('# Day 1, ladder\nWrist 60 BPM 7 min')[0].type, 'ladder');
}
console.log('routine minutes ok');

// session timeline -> drumcoach plan
{
  assert.deepStrictEqual([L.vidTime(7), L.vidTime(75.4), L.vidTime(3725)], ['0:07', '1:15', '1:02:05']);
  assert.deepStrictEqual([L.vidSecs(''), L.vidSecs('0:07'), L.vidSecs('1:02:05'), L.vidSecs('12.5'), isNaN(L.vidSecs('abc'))], [0, 7, 3725, 12.5, true]);
  const tl = { segs: [{ t0: 0, t1: 62.3, label: 'Wrist right' }, { t0: 64, t1: 130, label: 'Groove p20, line 1\n(Right foot)' }] };
  const csv = L.planCsv(tl, 7, 'today').split('\n');
  assert.ok(csv[0].startsWith('#') && csv[1].startsWith('#'));
  assert.deepStrictEqual(csv.slice(2), ['0:07,1:09,Wrist right', '1:11,2:17,Groove p20, line 1 (Right foot)', '']);
}
console.log('timeline ok');

// no two functions share a name (a later one silently replaces the earlier)
{
  const names = [...src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepStrictEqual(dup, [], 'duplicate function names: ' + dup.join(', '));
}
console.log('names ok');
