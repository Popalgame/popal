# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Що це

Popal (PopalGame) — браузерна 3D-гра (three.js r128) про ловлю «попалів», з табором, крафтом і будівництвом. Орієнтована на телефони, працює і на ПК. Продакшн: https://popalgame.pl (Firebase Hosting, проєкт `popal-4da6b`). Інтерфейс і коментарі в коді — українською.

## Структура репозиторію й деплой

У git лежить **лише zip-архів сайту** (`popalgame-site-vX.Y.Z.zip`), а не розпаковані вихідники. Власник оновлює гру через «Add files via upload» на GitHub: видаляє старий zip і завантажує новий.

`.github/workflows/deploy.yml` на кожен push у `main`: перевіряє, що в корені **рівно один** `.zip` (інакше збій), розпаковує його в `site/` і деплоїть на Firebase Hosting (канал `live`). Отже:

- щоб змінити гру, розпакуйте zip у scratchpad/тимчасову папку, правте там, потім запакуйте назад (файли в корені архіву, без вкладеної папки) і замініть старий zip новим з новою назвою версії;
- ніколи не залишайте в корені два zip — деплой впаде;
- `firebase.json` усередині архіву задає хостинг (`public: "."`, `cleanUrls`, `no-cache` для html/js/css).

```bash
mkdir -p /tmp/site && unzip -qo popalgame-site-v*.zip -d /tmp/site      # розпакувати
(cd /tmp/site && python3 -m http.server 8765)                            # запустити локально → http://localhost:8765/game.html
for f in /tmp/site/src/modules/*.js /tmp/site/sw.js; do node --check "$f"; done   # перевірка синтаксису
(cd /tmp/site && zip -qr /home/user/popal/popalgame-site-vNEW.zip .)     # запакувати назад
```

Збірки, лінтера й тестів немає — це статичні файли. Перевірка змін: `node --check` + відкрити `game.html` у Playwright (Chromium встановлений) і зібрати `pageerror`/console errors. Помилки завантаження Firebase SDK з CDN у пісочниці очікувані (мережа закрита), гра працює й без них.

## Оновлення версії

Номер версії продубльований у кількох місцях — оновлюйте всі разом:
- назва zip-файлу;
- `index.html` — футер «версія X.Y.Z»;
- `game.html` — `core-world.js?v=X.Y.Z`;
- `src/modules/core-world.js` — `Версія X.Y.Z` у профілі;
- `sw.js` — назва кешу `popal-vX.Y.Z-...` (зміна назви скидає старий кеш service worker).

## Архітектура

- `index.html` — лендинг; `game.html` — сама гра: увесь HTML інтерфейсу, багато inline CSS і підключення скриптів. `src/styles/game.css` — основні стилі.
- Немає бандлера й ES-модулів. Усі `src/modules/*.js` — класичні `<script>`, що ділять один глобальний простір. **Порядок `<script>` у `game.html` важливий**: першим іде `core-world.js`, решта розширюють його глобали.
- `core-world.js` (найбільший файл, мініфікований стиль) — ядро: рендерер `R`, сцена `sc`, камера `cam`, гравець, світ, дикі істоти `wild`, попали `pals`/`selP`, інвентар `inv`/`IT`/`eq`, квести, головний цикл `frame()` через `requestAnimationFrame`, масив покадрових колбеків `ANI` (модулі роблять `ANI.push(fn)`), а також Firebase (auth + Firestore `players`).
- Інші модулі — це «патчі-фічі», здебільшого у вигляді `(function(){try{ ... }catch(e){console.warn(...)}})()`. Типові прийоми:
  - доступ до top-level `const/let` ядра через `const G=n=>{try{return eval(n)}catch(e){return undefined}}` (щоб не падати, якщо змінної немає);
  - перевизначення функцій ядра з обгорткою: `const _pf=pfTab; pfTab=function(){_pf.apply(this,arguments); ...}` (так само `ivR`, `msg`, `dmg`, `flash`, `buildHero`, `drawAv`). Кілька модулів можуть обгортати одну функцію — порядок підключення визначає ланцюжок;
  - доповнення словників `IT`/`inv` новими предметами, вставка власних DOM-елементів і `<style>`.
- Багато модулів починаються з коментаря `/* 0.1.x: ... */` — версія, у якій з'явилась фіча, і її опис. Додаючи новий модуль, дотримуйтесь цього формату й додайте його в `game.html` і в список `ASSETS` у `sw.js`.

## Збереження

- Локально: `save()` у `core-world.js` пише стан у `localStorage['zi']` кожні 5 с і викликає `cloudPush()` (Firestore `players/<uid>`). Налаштування модулів зберігаються в окремих ключах `zi_*` (`zi_gfx`, `zi_snd`, `zi_pc`, `zi_ord`, ...). Змінюючи формат збереження, зберігайте сумісність зі старими сейвами (модулі вже роблять `if(inv[k]==null)inv[k]=0`).
- `identity.js` — унікальні нікнейми/ID гравців (колекції `names`, `profiles`, `meta`).

## PWA

`sw.js` — network-first з кешем як fallback; реєструється в `pwa-install.js` лише на `https` і хостах `popalgame*`/`popal-4da6b*`.
