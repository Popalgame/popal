/* Spójność wersji: package.json ↔ sw.js (cache) ↔ stopka index.html. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const sw = readFileSync(path.join(SITE, 'sw.js'), 'utf8');
const index = readFileSync(path.join(SITE, 'index.html'), 'utf8');

const swVer = sw.match(/const C='popal-v([\d.]+)-/)?.[1];
const footerVer = index.match(/версія\s+([\d.]+)/)?.[1];

test('package.json ma poprawny semver', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});

test('wersja w sw.js zgadza się z package.json', () => {
  assert.equal(swVer, pkg.version,
    `Podbij wersję: npm run bump (package.json=${pkg.version}, sw.js=${swVer})`);
});

test('wersja w stopce index.html zgadza się z package.json', () => {
  assert.equal(footerVer, pkg.version,
    `index.html stopka=${footerVer}, package.json=${pkg.version}`);
});
