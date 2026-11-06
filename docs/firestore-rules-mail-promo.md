# Правила Firestore для пошти й промокодів (0.2.9)

Промокоди й листи гравцям створюються на окремій сторінці розробника **popalgame.pl/admin.html**
(файл `site/admin.html`). У самій грі цього інструменту немає. Сторінка не має посилань з гри й прихована від пошуковиків,
але головний захист — правила нижче: створювати промокоди й надсилати листи може лише акаунт розробника,
навіть якщо хтось інший відкриє сторінку.

Пошта від розробника, листи всім гравцям і промокоди зберігаються у Firestore проєкту `popal-4da6b`.
Щоб вони запрацювали, додайте ці блоки в **Firebase Console → Firestore Database → Rules**
всередину наявного `match /databases/{database}/documents { ... }` (наявні правила для `players`, `profiles`, `meta` не видаляйте).

```
    function isOwner() {
      return request.auth != null && request.auth.token.email == 'd.polataiko@gmail.com';
    }

    // Промокоди: читати може гравець з акаунтом; створює й вимикає лише розробник.
    // Гравець може лише збільшити лічильник використань на 1.
    match /promo/{code} {
      allow read: if request.auth != null;
      allow create, delete: if isOwner();
      allow update: if isOwner() || (request.auth != null
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['uses'])
        && request.resource.data.uses == resource.data.get('uses', 0) + 1);
      // позначка «цей акаунт уже використав код» — створює сам гравець, змінити чи видалити не може
      match /used/{uid} {
        allow read: if request.auth != null && (request.auth.uid == uid || isOwner());
        allow create: if request.auth != null && request.auth.uid == uid;
      }
    }

    // Особиста пошта: читає й видаляє (забирає) лише власник скриньки; надсилає лише розробник.
    match /mail/{uid}/items/{id} {
      allow read, delete: if request.auth != null && (request.auth.uid == uid || isOwner());
      allow create: if isOwner();
    }

    // Листи всім гравцям.
    match /mailAll/{id} {
      allow read: if request.auth != null;
      allow write: if isOwner();
    }

    // Розробнику потрібно знаходити гравця за ID (pid), щоб надіслати лист.
    match /profiles/{uid} {
      allow read: if isOwner();
    }
```

Якщо для `profiles` у вас уже є `allow read`, додайте до умови `|| isOwner()` замість окремого блоку.

Без цих правил гра працює як раніше: системні листи (наприклад, тестові кристали для ID 0001) приходять і забираються,
а промокоди й листи від розробника показують «ще не ввімкнені на сервері».

## Рейтинг гравців (0.2.10)

Вікно «🏆 Рейтинг» у лівому меню гри показує лідерів за рівнем героя — лише гравців з акаунтом і присвоєним ID.
Кожен такий гравець сам записує свій рядок у колекцію `leaders` (ID, імʼя, рівень, досвід). Додайте цей блок у ті самі Rules:

```
    // Рейтинг: бачать усі; кожен пише лише свій рядок, лише зі своїм ID з profiles і лише ці поля.
    match /leaders/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['pid', 'name', 'lv', 'xp', 't'])
        && request.resource.data.pid is string
        && request.resource.data.pid == get(/databases/$(database)/documents/profiles/$(uid)).data.pid
        && request.resource.data.name is string && request.resource.data.name.size() <= 16
        && request.resource.data.lv is int && request.resource.data.lv >= 1 && request.resource.data.lv <= 500
        && request.resource.data.xp is int && request.resource.data.xp >= 0;
      allow delete: if isOwner();
    }
```

Без цього блоку вікно рейтингу пише «Рейтинг ще не ввімкнено на сервері», а гра працює як звичайно.
Розробник може прибрати чийсь рядок (наприклад, тестовий акаунт) у Firebase Console → Firestore → `leaders`.

## Реферальна програма (0.2.15)

Вікно «🤝 Запроси друга» в лівому меню. Новий гравець, що прийшов за посиланням `popalgame.pl/game.html?ref=<ID>`,
після входу в акаунт записує себе в колекцію `referrals` і оновлює свій рівень. Запрошувач бачить своїх друзів за полем `ref`.
Додайте блок у ті самі Rules (поряд із `leaders`):

```
    // Реферали: читають гравці з акаунтом; кожен записує лише себе, зі своїм ID; запрошувача (ref) змінити не можна.
    match /referrals/{uid} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['ref', 'pid', 'name', 'lv', 't'])
        && request.resource.data.pid == get(/databases/$(database)/documents/profiles/$(uid)).data.pid
        && request.resource.data.ref is string && request.resource.data.ref != request.resource.data.pid
        && request.resource.data.lv is int && request.resource.data.lv >= 1 && request.resource.data.lv <= 500
        && request.resource.data.name is string && request.resource.data.name.size() <= 16;
      allow update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'lv', 't'])
        && request.resource.data.lv is int && request.resource.data.lv >= 1 && request.resource.data.lv <= 500
        && request.resource.data.name is string && request.resource.data.name.size() <= 16;
      allow delete: if request.auth != null && request.auth.token.email == 'd.polataiko@gmail.com';
    }
```
