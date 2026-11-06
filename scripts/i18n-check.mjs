/* Перевірка перекладів перед пушем: знаходить у коді гри українські тексти, яких немає в site/src/i18n/strings.tsv
   або в яких бракує en / pl / ru. Запуск: npm run i18n:check  (з --tsv — вивести заготовку рядків для strings.tsv).
   Тексти беруться так само, як їх бачить гравець: рядки й шаблони в site/src/modules/*.js (крім console.*) і текст game.html,
   розбиті по HTML-тегах. CSS і коментарі не беруться. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as acorn from 'acorn';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const CY = /[А-Яа-яІіЇїЄєҐґ]/;
const SKIP = new Set(['у', 'і', 'Є', 'К']);
const found = new Map();
const put = (p, f) => { p = p.replace(/\s+/g, ' ').trim(); if (!p || !CY.test(p) || SKIP.has(p)) return; if (/^[\s\d.,:;!?·—–\-+×%()/]*$/.test(p)) return; if (!found.has(p)) found.set(p, f); };
function add(s, f) {
  if (/\{[^}]*:[^}]*;/.test(s) && /[#.a-z][\w-]*\s*\{/.test(s)) return;
  for (const m of s.matchAll(/(?:title|aria-label|placeholder|alt)=['"]([^'"]*)/g)) put(m[1], f);
  for (let p of s.split(/<[^>]*>/)) { if (p.includes('>')) p = p.slice(p.lastIndexOf('>') + 1); if (p.includes('<')) p = p.slice(0, p.indexOf('<')); put(p, f); }
}
function walk(n, cb) {
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression' && n.callee.object?.name === 'console') return;
  cb(n);
  for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x, cb)); else if (v && typeof v.type === 'string') walk(v, cb); }
}
for (const f of readdirSync(path.join(ROOT, 'src/modules')).filter(f => f.endsWith('.js') && f !== 'i18n.js')) {
  const src = readFileSync(path.join(ROOT, 'src/modules', f), 'utf8');
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { console.error('parse', f, e.message); continue; }
  walk(ast, n => { if (n.type === 'Literal' && typeof n.value === 'string' && CY.test(n.value)) add(n.value, f); if (n.type === 'TemplateElement' && CY.test(n.value.cooked || '')) add(n.value.cooked, f); });
}
const html = readFileSync(path.join(ROOT, 'game.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
add(html, 'game.html');
const rows = readFileSync(path.join(ROOT, 'src/i18n/strings.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
rows.shift();
const have = new Map(rows.map(r => [r[0], r]));
const missing = [], partial = [];
for (const [k, f] of found) { const r = have.get(k); if (!r) missing.push([k, f]); else if (!r[1] || !r[2] || !r[3]) partial.push([k, f]); }
if (process.argv.includes('--tsv')) { for (const [k] of missing) console.log([k, '', '', ''].join('\t')); process.exit(0); }
for (const [k, f] of missing) console.log('✗ немає перекладу  ' + f + '  «' + k + '»');
for (const [k, f] of partial) console.log('◐ не всі мови     ' + f + '  «' + k + '»');
console.log(`\nТекстів у грі: ${found.size} · без перекладу: ${missing.length} · неповних: ${partial.length}`);
if (missing.length || partial.length) { console.log('Додайте рядки в site/src/i18n/strings.tsv і запустіть node scripts/i18n-build.mjs'); process.exit(1); }
console.log('✅ Усе перекладено: en, pl, ru');
