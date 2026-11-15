// Run: node check-methods.js
const assert = require('assert');
const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
const logic = src.slice(src.indexOf('/* LOGIC START */'), src.indexOf('/* LOGIC END */'));
const L = new Function(logic + `; setMethods(methodsText(null));
  return { parseMethods, methodsText, setMethods, applyOps, parseWeek, newSession, sanitizeConf, configure, buildSteps,
    get METHODS() { return METHODS; }, get ERRORS() { return METHOD_ERRORS; } };`)();

// the example methods
const ex = L.parseMethods(L.methodsText(null));
assert.deepStrictEqual(ex.errors, []);
assert.deepStrictEqual(ex.order, ['four-way', 'groove', 'kick permutations']);
assert.deepStrictEqual(ex.methods['four-way'].ways.map(w => w.label), ['1A: R hand, R foot', '1B: R hand, L foot', '2A: L hand, R foot', '2B: L hand, L foot']);
const g = ex.methods.groove;
assert.ok(g.comfy);
assert.strictEqual(g.ways.length, 19);
assert.strictEqual(g.ways[1].label, '1A: R hand on cymbal (as written), hi-hat foot on quarters');
assert.strictEqual(g.ways[18].label, '6C: L hand on the "&", hi-hat foot on the "&"');
assert.strictEqual(ex.methods['kick permutations'].ways.length, 16);
assert.strictEqual(ex.methods['kick permutations'].ways[5].label, 'kick on 2e');

// older settings: reps and starting tempo go into the text, switched-off ways are kept by name
const old = { fourway: { reps: 6, floor: 70, ways: [true, false, true, true] }, groove: { floor: 55, ways: [true, true, false] } };
assert.ok(/# Four-way, 6 reps, 70 BPM/.test(L.methodsText(old)));
assert.ok(/# Groove, until comfortable, 55 BPM/.test(L.methodsText(old)));
assert.deepStrictEqual(L.sanitizeConf(old).off, { 'four-way': ['1B: R hand, L foot'], groove: ['1B: R hand on cymbal (as written), hi-hat foot on eighths'] });

// sections pick their method by name or by a word after a comma
const wk = L.parseWeek('# Syncopation, 20 min\nA\n# Carmine, 15 min\nB\n# Fills, 10 min, kick permutations\nC\n# Rudiments, groove\nD\n# Stick Control\nE');
assert.deepStrictEqual(wk.map(s => [s.name, s.type]), [['Syncopation', 'four-way'], ['Carmine', 'groove'], ['Fills', 'kick permutations'], ['Rudiments', 'groove'], ['Stick Control', 'ladder']]);

// Carmine 3C over a rock beat: right hand quarters on the hi-hat, left hand on the snare, hi-hat foot on the "&"
const rock = L.parseWeek('# A\nRock\nHH x-x-x-x-\nSD --o---o-\nBD o---o---')[0].items[0].pattern;
const w3c = g.ways.find(w => w.label.startsWith('3C'));
const bar = L.applyOps(rock, w3c.ops).bars[0];
const at = lane => bar.hits.filter(h => h.lane === lane).map(h => h.pos + (h.stick || ''));
assert.deepStrictEqual(at('HH'), ['0R', '4R', '8R', '12R']);
assert.deepStrictEqual(at('SD'), ['4L', '12L']);
assert.deepStrictEqual(at('HF'), [2, 6, 10, 14].map(String));
assert.strictEqual(bar.grid, 8);
// as written leaves the notes alone; a kick permutation adds one kick (none twice)
assert.strictEqual(L.applyOps(rock, g.ways[0].ops), rock);
const kp = L.METHODS['kick permutations'].ways;
assert.deepStrictEqual(L.applyOps(rock, kp[2].ops).bars[0].hits.filter(h => h.lane === 'BD').map(h => h.pos), [0, 8, 2]);
assert.strictEqual(L.applyOps(rock, kp[0].ops).bars[0].hits.filter(h => h.lane === 'BD').length, 2);
// an exercise without notes gets the method's notes alone
assert.deepStrictEqual(L.applyOps(null, kp[4].ops).bars[0].hits.map(h => h.lane + h.pos), ['BD4']);

// a session takes the ways that are switched on
L.configure(L.sanitizeConf({ off: { groove: g.ways.slice(2).map(w => w.label) } }));
const ses = L.newSession(wk[1], {});
assert.deepStrictEqual(ses.lines[0].steps.map(s => s.label), ['As written', g.ways[1].label]);
L.configure(L.sanitizeConf(null));

// your own method, and the errors it can show
L.setMethods('# Doubles, 8 reps, 50 BPM\nTwo hands, two ways.\nWays: hands\n  hands: right lead = hands R | left lead = hands L\n\n# Broken, 5 reps\nWays: a x b\n  a: one = SD 123\n');
assert.strictEqual(L.METHODS.doubles.reps, 8);
assert.strictEqual(L.METHODS.doubles.floor, 50);
assert.deepStrictEqual(L.METHODS.doubles.ways.map(w => w.label), ['right lead', 'left lead']);
assert.strictEqual(L.ERRORS.length, 2);
assert.ok(/^Line 8: "SD 123" is not an op/.test(L.ERRORS[0]));
assert.ok(/no options for "b"/.test(L.ERRORS[1]));
assert.strictEqual(L.parseWeek('# Doubles\nX')[0].type, 'doubles');
console.log('methods ok');
