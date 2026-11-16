// Run: node check-notation.js
const assert = require('assert');
const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
const logic = src.slice(src.indexOf('/* LOGIC START */'), src.indexOf('/* LOGIC END */'));
const L = new Function(logic + '; return { parseWeek, gsToRows, gsLink, renderStaff, buildVoice, restsShown, newSession, results, applyResults, startTempo };')();

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
  assert.deepStrictEqual(mem[sec.items[0].key], { label: 'Wrist development right hand', last: 90, type: 'ladder', from: 60 });
  assert.strictEqual(mem[sec.items[1].key].type, 'routine');
  // next session: 10 below the highest clean, never below the written tempo
  assert.strictEqual(L.newSession(sec, mem).lines[0].tempo, 80);
  mem[sec.items[0].key].last = 65;
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
