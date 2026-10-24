// Run: node check-merge.js
const assert = require('assert');
const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
const start = src.indexOf('function mergeData(');
let i = src.indexOf('{', start), depth = 0;
do { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; } while (depth);
const mergeData = new Function(src.slice(start, i) + '; return mergeData;')();

const phone = {
  v: 1, weekText: 'old plan', edited: true, mask: [true, true, true, true], conf: { c: 'phone' },
  memory: { a: { label: 'A', last: 90, type: 'ladder' }, r: { label: 'R', start: 70, last: 80, type: 'routine' } },
  sessions: [{ ts: 3, section: 'S' }, { ts: 1, section: 'S' }],
  templates: [{ name: 'Mine', text: 'phone' }, { name: 'Shared', text: 'old' }]
};
const computer = {
  v: 1, weekText: 'new plan', edited: true, mask: [true, false, true, false], conf: { c: 'computer' },
  memory: { a: { label: 'A', last: 80, type: 'ladder' }, b: { label: 'B', last: 60, type: 'ladder' }, r: { label: 'R', start: 75, last: 76, type: 'routine' } },
  sessions: [{ ts: 2, section: 'S' }, { ts: 1, section: 'S' }],
  templates: [{ name: 'Shared', text: 'new' }]
};

const m = mergeData(phone, computer);
assert.strictEqual(m.weekText, 'new plan');
assert.deepStrictEqual(m.mask, computer.mask);
assert.strictEqual(m.conf.c, 'computer');
assert.deepStrictEqual(m.sessions.map(s => s.ts), [3, 2, 1]);
assert.strictEqual(m.memory.a.last, 90);
assert.strictEqual(m.memory.b.last, 60);
assert.strictEqual(m.memory.r.start, 75);
assert.deepStrictEqual(m.templates, [{ name: 'Shared', text: 'new' }, { name: 'Mine', text: 'phone' }]);
console.log('merge ok');
