/* Wersjonowanie cache service workera.
 *
 * sw.js trzyma nazwę cache:  const C='popal-v0.1.28-local-three';
 * Żeby klienci po nowym wydaniu pobrali świeże pliki, ta nazwa MUSI się zmienić.
 *
 * To narzędzie synchronizuje wersję z package.json:
 *   - npm run bump            → 'popal-v<package.json version>-local'
 *   - npm run bump -- --sha <sha>  → 'popal-v<version>-<7 znaków sha>'
 * (CI przekazuje --sha ${GITHUB_SHA}, więc każde wdrożenie ma świeży cache.)
 *
 * Sama wersja gry: podbij "version" w package.json + stopka index.html
 * (testy tests/version.test.mjs pilnują spójności).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(ROOT, 'site', 'sw.js');

const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

let suffix = 'local';
const shaIdx = process.argv.indexOf('--sha');
if (shaIdx !== -1 && process.argv[shaIdx + 1]) {
  suffix = String(process.argv[shaIdx + 1]).slice(0, 7);
} else {
  /* lokalnie: spróbuj wziąć skrót z gita, jeśli to repozytorium */
  try { suffix = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { /* nie repo — zostaje 'local' */ }
}

const src = readFileSync(SW, 'utf8');
const next = src.replace(/const C='[^']*'/, `const C='popal-v${version}-${suffix}'`);
if (next === src) {
  if (/const C='[^']*'/.test(src)) {
    /* regex pasuje, a treść identyczna → cache już jest aktualny (idempotentność) */
    console.log(`✅ sw.js cache już aktualny: popal-v${version}-${suffix}`);
    process.exit(0);
  }
  console.error('⚠️  Nie znaleziono nazwy cache w sw.js (szukam: const C=\'...\')');
  process.exit(1);
}
writeFileSync(SW, next);
console.log(`✅ sw.js cache → popal-v${version}-${suffix}`);
