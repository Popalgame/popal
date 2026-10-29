import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(path.join(root, 'site/src/modules/core-world.js'), 'utf8');
const ai = readFileSync(path.join(root, 'site/src/modules/pal-ai.js'), 'utf8');
const saveCode = core.slice(core.indexOf('/* save/load */'), core.indexOf('/* ui */'));

function world(saved) {
  const storage = new Map(saved ? [['zi', JSON.stringify(saved)]] : []);
  const intervals = [];
  const context = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setInterval: fn => intervals.push(fn), cloudPush: () => {},
    P: { x: 0, z: 0, face: 0 }, res: {}, plv: 1, xp: 0, qi: 0, qa: 0, pname: 'Меглен', look: null,
    inv: {}, cf: 0, st: {}, eq: {}, hasSave: 0, pals: [],
    T: [{ c: 0xffaa00 }], rn: () => 0,
    mkPal: () => ({ position: { x: 0, z: 0, set(x, _y, z) { this.x = x; this.z = z; } } }),
    sc: { add() {} },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(saveCode, context);
  return { context, storage, intervals };
}

test('guest starts or continues without Firebase', () => {
  const handlers = {};
  const elements = new Map([['mc', { addEventListener: (name, fn) => { handlers[name] = fn; } }], ['mm', { style: { display: 'flex' } }]]);
  const context = { $: id => elements.get(id), look: null, menuO: 1, started: 0, dlgX() {}, ccShow: () => { context.created = true; } };
  vm.createContext(context);
  vm.runInContext(core.slice(core.indexOf('function mmShow()'), core.indexOf("$('ms').onclick")), context);
  handlers.click({ preventDefault() {} });
  assert.equal(context.created, true);
  context.look = { g: 0 };
  handlers.click({ preventDefault() {} });
  assert.equal(context.started, 1);
  assert.equal(elements.get('mm').style.display, 'none');
});

test('old saves load and worker cargo survives a new save and reload', () => {
  const old = { res: {}, inv: {}, pals: [[0, 2, 1, 1, 3], [0, 1, -1, 0, 0]] };
  const first = world(old);
  assert.equal(first.context.pals.length, 2);
  assert.equal(first.context.pals[0].ai, undefined);
  first.context.pals[0].ai = { s: 'work', bag: { w: 3, sti: 1 }, food: 'be', tg: { m: { scene: true } } };
  first.context.save();
  const serialized = first.storage.get('zi');
  assert.equal(serialized.includes('scene'), false);
  const saved = JSON.parse(serialized);
  assert.deepEqual(saved.pals[0][5], { bag: { w: 3, sti: 1 }, food: 'be' });
  const next = world(saved);
  assert.equal(next.context.pals[0].ai.s, 'deliver');
  assert.equal(next.context.pals[0].ai.bag.w, 3);
  assert.equal(next.context.pals[0].ai.food, 'be');
  assert.equal(next.context.pals[0].ai.tg, undefined);
  assert.equal(next.context.pals[1].ai, undefined);
});

test('removed worker retains cargo until chest has room, including food', () => {
  const pal = { ty: 0, lv: 1, cr: 1, wk: 0, cs: 1, x: 2, z: 3, ai: { s: 'deliver', bag: { w: 3 }, food: 'be', tg: { _cl: null } } };
  pal.ai.tg._cl = pal;
  const pals = [pal];
  let room = 2;
  const stored = { w: 0, be: 0 };
  const intervals = [];
  const context = { pals, addPal() {}, T: [{ wk: {} }], window: null, setInterval: fn => intervals.push(fn),
    chStore(k, n) { const put = Math.min(n, room); room -= put; stored[k] += put; return put; },
    Math, console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(ai, context);
  intervals[0]();
  assert.deepEqual(stored, { w: 2, be: 0 });
  assert.equal(pal.ai.bag.w, 1);
  assert.equal(pal.ai.food, 'be');
  assert.equal(pal.ai.tg, null);
  room = 2;
  intervals[0]();
  assert.deepEqual(stored, { w: 3, be: 1 });
  assert.equal(pal.ai, null);
  intervals[0]();
  assert.deepEqual(stored, { w: 3, be: 1 });
});

test('guest character name proceeds even when Firebase SDK exists offline', async () => {
  const identity = readFileSync(path.join(root, 'site/src/modules/identity.js'), 'utf8');
  const handlers = {};
  const input = { value: 'Мандрівник' };
  const button = { id: 'ccgo', dataset: {}, click() { this.clicked = true; } };
  const document = {
    addEventListener(name, fn) { handlers[name] = fn; },
    getElementById(id) { return id === 'ccn' ? input : null; },
  };
  const context = {
    document, pfTab() {}, FB_OK: true, fbDb: { collection() { throw new Error('network touched'); } },
    firebase: { auth: () => ({ currentUser: null, onAuthStateChanged() {} }) },
    console, msg() { throw new Error('unexpected validation error'); },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(identity, context);
  await handlers.click({ target: { closest: () => button }, stopImmediatePropagation() {}, preventDefault() {} });
  assert.equal(button.clicked, true);
  assert.equal(input.value, 'Мандрівник');
});
