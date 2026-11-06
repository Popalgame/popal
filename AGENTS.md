# Instrukcje projektu Polpal

## Obowiązkowy przewodnik Blendera

Przed **każdym użyciem Blendera** agent AI musi odczytać w całości plik
[`Blender_user.md`](Blender_user.md) w katalogu głównym tego repozytorium
oraz zastosować opisane w nim zasady do bieżącego zadania.

Gdy zadanie dotyczy istniejącego zasobu lub eksportu do gry, agent musi
odczytać również [`docs/blender-project-contract.md`](docs/blender-project-contract.md).
Przewodnik opisuje sposób pracy, a kontrakt — konkretne wymagania projektu:
kości, klipy, skalę, wagi i ustawienia eksportu.

Dotyczy to każdego wywołania narzędzia `blender_*`, pracy przez interfejs
Blendera, uruchomienia Blendera z CLI oraz wykonania skryptu korzystającego
z `bpy`. Odczyt wykonaj przed wywołaniem, również po wznowieniu zadania lub
skróceniu kontekstu; nie zastępuj go pamięcią wcześniejszej wersji dokumentu.
Przekazując pracę subagentowi, przekaż również ten obowiązek i ścieżki obu
plików.

Jeżeli któregokolwiek z tych plików nie da się odczytać, najpierw przywróć
dostęp do instrukcji; nie wykonuj operacji Blendera bez ich znajomości.
Samo przeczytanie dokumentów nie oznacza potwierdzenia jakości wykonanej
pracy — obowiązują opisane w nich kontrole wizualne, techniczne i uczciwe
raportowanie wyników.

## Tłumaczenia gry przed wypchnięciem na `main`

Gra ma cztery języki: ukraiński (źródło w kodzie), angielski, polski i rosyjski
(`site/src/modules/i18n.js`, słownik `site/src/i18n/strings.tsv`).

Przed **każdym** wypchnięciem na `main` agent musi:

1. uruchomić `npm run i18n:check`;
2. dla każdego nowego lub zmienionego tekstu dopisać do `strings.tsv` poprawne,
   naturalne tłumaczenia en / pl / ru (te same nazwy popali, przedmiotów i budynków
   co w istniejących wierszach);
3. uruchomić `npm run i18n:build` i ponownie `npm run i18n:check` — wynik musi być
   „✅ Усе перекладено”.

Podczas pracy na gałęzi roboczej tłumaczenia nie są wymagane — dopiero przed
wypchnięciem na `main`.

## Wersja przy każdej aktualizacji

Każde wypchnięcie na `main` (każda aktualizacja gry) podnosi wersję o jeden numer
poprawki (np. 0.2.11 → 0.2.12): `package.json` i `package-lock.json`
(`npm version X.Y.Z --no-git-tag-version`), stopka `site/index.html`
(„wersja Alpha X.Y.Z”), `core-world.js?v=` i `i18n.js?v=` w `site/game.html`,
`VER` w `site/src/modules/i18n.js`, `README.md`, lista „Co nowego” na stronie
głównej, a na końcu `npm run bump` (cache service workera). Testy `version.test.mjs`
pilnują zgodności.
