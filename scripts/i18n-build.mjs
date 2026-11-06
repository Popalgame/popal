/* Будує словники мов гри з site/src/i18n/strings.tsv (колонки: uk, en, pl, ru).
   Результат — site/src/i18n/{en,pl,ru}.js: window.I18N_DICT = { "український текст": "переклад", … }.
   Запуск: node scripts/i18n-build.mjs (після кожної зміни strings.tsv). */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site', 'src', 'i18n');
const rows = readFileSync(path.join(DIR, 'strings.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const head = rows.shift();
head.slice(1).forEach((lang, c) => {
  const d = {};
  for (const r of rows) if (r[0] && r[c + 1]) d[r[0]] = r[c + 1];
  writeFileSync(path.join(DIR, lang + '.js'), '/* Згенеровано scripts/i18n-build.mjs з strings.tsv — не редагуйте вручну. */\nwindow.I18N_DICT=' + JSON.stringify(d) + ';window.I18N_LANG=' + JSON.stringify(lang) + ';\n');
  console.log(lang, Object.keys(d).length);
});
