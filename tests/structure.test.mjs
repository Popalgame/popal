/* Testy spójności struktury projektu Popal (node --test). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const read = (...p) => readFileSync(path.join(...p), 'utf8');

/* --- parsowanie game.html --- */
const gameHtml = read(SITE, 'game.html');
const allSrcs = [...gameHtml.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)]
  .map(m => m[1].split('?')[0]);
/* skrypty lokalne (ładowane z site/) vs CDN (fallback three.js, Firebase SDK) */
const scriptSrcs = allSrcs.filter(src => !src.startsWith('http'));
const cdnSrcs = allSrcs.filter(src => src.startsWith('http'));

/* Zewnętrzne zależności CDN. Celowo NIE są w pre-cache sw.js:
 * - local three.min.js jest w cache; CDN to tylko fallback,
 * - Firebase SDK offline po prostu nie działa (brak chmurowego zapisu),
 *   a gra ma na to zabezpieczenie (flaga FB_OK). */
const CDN_ALLOWED = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/firebase@10.12.2/firebase-app-compat.js',
  'https://cdn.jsdelivr.net/npm/firebase@10.12.2/firebase-auth-compat.js',
  'https://cdn.jsdelivr.net/npm/firebase@10.12.2/firebase-firestore-compat.js',
];

/* --- parsowanie sw.js --- */
const sw = read(SITE, 'sw.js');
const assetsMatch = sw.match(/const ASSETS=\[([^\]]+)\]/);
assert.ok(assetsMatch, 'sw.js: nie znaleziono listy ASSETS');
const swAssets = [...assetsMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

test('wszystkie lokalne <script src> z game.html istnieją na dysku', () => {
  const missing = scriptSrcs.filter(src => !existsSync(path.join(SITE, src)));
  assert.deepEqual(missing, [], `Brakujące pliki: ${missing.join(', ')}`);
});

test('zewnętrzne skrypty CDN są zgodne z białą listą', () => {
  const unknown = cdnSrcs.filter(src => !CDN_ALLOWED.includes(src));
  assert.deepEqual(unknown, [],
    `Nieznane CDN (dodaj do CDN_ALLOWED lub usuń): ${unknown.join(', ')}`);
});

test('brak zduplikowanych <script> w game.html', () => {
  const dupes = scriptSrcs.filter((s, i) => scriptSrcs.indexOf(s) !== i);
  assert.deepEqual([...new Set(dupes)], [], `Zduplikowane: ${dupes.join(', ')}`);
});

test('każdy moduł z src/modules/ jest ładowany w game.html (brak osieroconych)', () => {
  const modules = readdirSync(path.join(SITE, 'src', 'modules'))
    .filter(f => f.endsWith('.js'))
    .map(f => `src/modules/${f}`);
  const loaded = new Set(scriptSrcs);
  const orphaned = modules.filter(m => !loaded.has(m));
  assert.deepEqual(orphaned, [], `Moduły nigdzie nie ładowane: ${orphaned.join(', ')}`);
});

test('każdy wpis ASSETS w sw.js istnieje na dysku', () => {
  const missing = swAssets.filter(a => a !== './' && !existsSync(path.join(SITE, a)));
  assert.deepEqual(missing, [], `sw.js pre-cache wskazuje nieistniejące pliki: ${missing.join(', ')}`);
});

test('wszystkie lokalne skrypty z game.html są w pre-cache sw.js (offline)', () => {
  const cached = new Set(swAssets);
  const notCached = scriptSrcs.filter(src => !cached.has(src));
  assert.deepEqual(notCached, [], `Brak w pre-cache (gra offline ich nie załaduje): ${notCached.join(', ')}`);
});

test('ikony z manifest.webmanifest istnieją', () => {
  const manifest = JSON.parse(read(SITE, 'manifest.webmanifest'));
  const missing = manifest.icons.filter(i => !existsSync(path.join(SITE, i.src)));
  assert.deepEqual(missing, [], `Brakujące ikony: ${missing.map(i => i.src).join(', ')}`);
});

test('pliki JSON są poprawne', () => {
  for (const f of ['manifest.webmanifest', 'firebase.json', '.firebaserc', 'manus-routes.json']) {
    assert.doesNotThrow(() => JSON.parse(read(SITE, f)), `${f}: niepoprawny JSON`);
  }
});
