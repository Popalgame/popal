/* Zasoby dźwiękowe wskazane w kodzie muszą istnieć na dysku. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const MODS = path.join(SITE, 'src', 'modules');

const files = readdirSync(MODS).filter(f => f.endsWith('.js')).map(f => path.join(MODS, f));
const refs = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:sounds|img)\/[\w./-]+\.(?:mp3|webp|png|jpg)/g))
    refs.add(m[0]);
}
/* obrazki palów 0..9 są też używane przez landing i grę */
const landSrc = readFileSync(path.join(SITE, 'index.html'), 'utf8');
for (const m of landSrc.matchAll(/img\/pals\/\d+\.webp/g)) refs.add(m[0]);

test('kod gry wskazuje istniejące pliki dźwięków i obrazków', () => {
  const missing = [...refs].filter(r => !existsSync(path.join(SITE, r)));
  assert.deepEqual(missing, [], `Brakujące zasoby: ${missing.join(', ')}`);
});

test('każdy pal (0–9) ma komplet dźwięków catch/happy/hurt/attack/idle', () => {
  const palSounds = readdirSync(path.join(SITE, 'sounds', 'pals'));
  const problems = [];
  for (let i = 1; i <= 10; i++) {
    const prefix = `${String(i).padStart(2, '0')}_`;
    const own = palSounds.filter(s => s.startsWith(prefix));
    for (const kind of ['catch', 'happy', 'hurt', 'attack', 'idle']) {
      if (!own.some(s => s.includes(`_${kind}.mp3`)))
        problems.push(`${prefix}* brak ${kind}.mp3`);
    }
  }
  assert.deepEqual(problems, [], problems.join('; '));
});
