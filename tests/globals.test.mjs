/* Klasyczne <script>-y współdzielą globalny zasięg leksykalny: jeśli dwa
 * moduły zadeklarują tę samą nazwę na najwyższym poziomie (const/let/var/
 * function/class), drugi skrypt rzuci SyntaxError i gra nie wystartuje.
 * Ten test wyłapuje takie kolizje PRZED wdrożeniem.
 *
 * Do parsowania używamy ESLinta (ten sam parser, co w `npm run lint`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Linter } from 'eslint';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODS = path.join(ROOT, 'site', 'src', 'modules');

const linter = new Linter({ configType: 'eslintrc' });

function topLevelNames(code, file) {
  let program = null;
  linter.defineRule('capture-program', {
    create() {
      return { Program(node) { program = node; } };
    },
  });
  const messages = linter.verify(code, {
    parserOptions: { sourceType: 'script', ecmaVersion: 'latest' },
    rules: { 'capture-program': 'error' },
  }, file);
  const fatal = messages.filter(m => m.fatal);
  assert.equal(fatal.length, 0,
    `${file}: błąd składni: ${fatal.map(m => m.message).join('; ')}`);
  const names = [];
  for (const stmt of program.body) {
    if (stmt.type === 'VariableDeclaration')
      for (const d of stmt.declarations)
        if (d.id.type === 'Identifier') names.push(d.id.name);
    if (stmt.type === 'FunctionDeclaration' && stmt.id) names.push(stmt.id.name);
    if (stmt.type === 'ClassDeclaration' && stmt.id) names.push(stmt.id.name);
  }
  return names;
}

test('żadne dwa moduły nie deklarują tej samej nazwy globalnej', () => {
  const owners = new Map(); // nazwa -> plik
  const collisions = [];
  for (const f of readdirSync(MODS).filter(f => f.endsWith('.js')).sort()) {
    const code = readFileSync(path.join(MODS, f), 'utf8');
    for (const name of topLevelNames(code, f)) {
      if (owners.has(name) && owners.get(name) !== f)
        collisions.push(`„${name}”: ${owners.get(name)} ↔ ${f}`);
      else owners.set(name, f);
    }
  }
  assert.deepEqual(collisions, [],
    `Kolizje deklaracji globalnych (SyntaxError przy ładowaniu!): ${collisions.join('; ')}`);
});
