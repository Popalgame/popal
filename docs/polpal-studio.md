# Polpal Studio a gra

Polpal Studio to osobna aplikacja (osobne repozytorium) do tworzenia
bohaterów 3D. Wcześniej leżała tu jako `tools/character-scan` i
`tools/character-build`; wydzielono ją 1 listopada 2026 r. (stan z commita
`5e9f314`, wcześniejsza historia tych plików zostaje w tym repozytorium).

## Kontrakt połączenia

Gra pozwala się podłączyć do Studio przez plik
[`polpal-game.json`](../polpal-game.json). Opisuje on:

- **kontrakt bohatera:** 22 kości `mixamorig:*`, klipy, 1,8 m, ≤ 4 wpływy
  (szczegóły w [`blender-project-contract.md`](blender-project-contract.md));
- **sloty bohaterów:** `aiko`, `classic`, z plikami modelu i pakietów animacji;
- **skrypty gry** przebudowujące pakiety animacji pod nowy szkielet
  (`scripts/build-*-locomotion.py`, `scripts/build-*-combat.py`);
- **kroki po podmianie:** `npm run bump` i kontrole `npm test`, `npm run lint`;
- **podgląd lokalny:** `node scripts/serve.mjs <port>`;
- **gałąź wdrożenia:** `main`, której scalenie uruchamia GitHub Actions i
  publikuje na Firebase.

Studio przygotowuje każde wdrożenie na osobnej gałęzi `studio/<bohater>-<czas>`
w osobnym worktree i nie zmienia kopii roboczej gry. Do gry trafia tylko przez
pull request scalony na wyraźne polecenie użytkownika.

Zmieniając nazwy plików, skrypty lub testy, zaktualizuj `polpal-game.json`.
W przeciwnym razie Studio odrzuci połączenie albo wdrożenie zatrzyma się na
kontroli.
