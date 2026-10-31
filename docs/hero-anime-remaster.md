# Kandydat bohatera: Anime Remaster

## Zasób

To osobny, ulepszony wariant istniejącej postaci, przygotowany do oceny jako
kandydat dla three.js r128. Projekt Blendera:
[`hero-anime-remaster.blend`](assets/hero-anime-remaster.blend), eksport GLB:
[`hero-anime-remaster.glb`](assets/hero-anime-remaster.glb), podgląd:
[`hero-anime-remaster-preview.png`](assets/hero-anime-remaster-preview.png),
zbliżenie twarzy:
[`hero-anime-remaster-face.png`](assets/hero-anime-remaster-face.png),
porównanie przed poprawkami:
[`hero-anime-remaster-before.png`](assets/hero-anime-remaster-before.png),
raport:
[`hero-anime-remaster-report.json`](assets/hero-anime-remaster-report.json).

GLB ma 120 480 trójkątów, 9 768 472 bajtów i pięć materiałów. Zachowuje 22
kości o nazwach `mixamorig:` oraz klipy `idle`, `walk`, `run`, `swim`, `hit`,
`throw` i `jump`. Wariant powstał z lokalnego, oryginalnego źródła Tripo o
liczbie 389 636 trójkątów; rig, wagi i animacje przeniesiono z GLB używanego
przez grę.

Wariant ma drobniejszą geometrię i bardziej matowe materiały. Ujednolicony
kasztanowy materiał włosów usuwa większość przebarwień; dodano geometryczny
uśmiech ze sztywną wagą do kości `Head` oraz materiały butów. Nadal widoczne są
pozostałości jakości źródłowej siatki i tekstur.

## Walidacja i zakres

Ponowny import GLB do Blendera zaliczył kontrolę: raport potwierdza
znormalizowane wagi, 22 kości, siedem klipów i pięć materiałów. Próbkowano 21
póz; wartości były skończone i ograniczone. Nie wykonano testu w grze ani
pomiaru FPS. Porównanie danych GLB potwierdziło jedną siatkę ze szkieletem,
zgodne zestawy ścieżek animacji i maksymalną różnicę lokalnych transformacji
kości w pozycji bazowej poniżej 0,000001.

Kandydat nie zmienia runtime ani service workera i jest cięższy od aktualnego
pełnego modelu. `scripts/refine-hero-anime.py` jest helperem dla bieżącej
sceny Blendera, a nie kompletnym generatorem modelu od zera. Pochodzenie i
ograniczenia modelu źródłowego opisuje sekcja
[`Pochodzenie i przygotowanie`](hero-model.md#pochodzenie-i-przygotowanie).

Przed użyciem w grze potrzebne są testy w grze; dopiero po nich można zastąpić
ścieżkę desktopową w `site/src/modules/imported-hero.js`. Wariant mobilny
wymaga osobnej optymalizacji. Przy wdrożeniu należy zaktualizować service
workera.

## Status prac

Ostatni eksport nie został uznany za gotowy. Po eksporcie użytkownik zgłosił
kanciasty prawy policzek. Porównanie Rest/Pose wskazało niezamierzony wpływ
barku i ramienia na dolną część twarzy. Praca nad wagami w otwartej scenie
została przerwana przed końcową walidacją i ponownym eksportem.

Przed dalszą pracą porównaj aktualną scenę, zapisany `.blend` i `.glb`.
Wcześniejszy raport nie jest dowodem naprawienia policzka.
