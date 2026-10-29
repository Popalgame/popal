# Model bohatera

## Zasób runtime

Moduł `site/src/modules/imported-hero.js` wybiera zasób według zapytania
`(pointer: coarse)`: wskaźnik zgrubny ładuje
`site/assets/models/hero-mobile.glb` (około 38 tys. trójkątów), a pozostałe
urządzenia — `site/assets/models/hero-rigged.glb` (49 999 trójkątów). Wariant
mobilny ma około 24% mniej trójkątów. Oba modele zachowują 22 kości w stylu
nazewnictwa Mixamo i siedem klipów: `idle`, `walk`, `run`, `swim`, `hit`,
`throw` i `jump`. Klip `jump` jest obecny w pliku, ale nie oznacza dodania
nowego sterowania skokiem w grze. Przy błędzie lub nieprawidłowym modelu
mobilnym moduł próbuje załadować pełny model, a po niepowodzeniu pozostaje
proceduralny bohater. Modele ładuje lokalny `site/vendor/GLTFLoader.js` z
`site/vendor/SkeletonUtils.js`, zgodnymi z używanym three.js r128.

Pełny model ma 4 330 168 bajtów, a mobilny — 3 914 984 bajty. Service worker
umieszcza oba w pre-cache offline: dodaje to 3 914 984 bajty (około 3,73 MiB)
cache na wariant mobilny, łącznie 8 245 152 bajty (około 7,86 MiB) na oba modele.
Redukcja liczby trójkątów nie jest potwierdzeniem wzrostu FPS.

Podczas ładowania oraz w razie błędu pozostaje aktywny proceduralny bohater.
Model zachowuje stałą tożsamość wizualną postaci, edytowalne imię i obsługę
wyposażenia. Narzędzia są mocowane do dłoni, a plecak jest częścią
zaimportowanego modelu. Pliki robocze można otworzyć w Blenderze:
[`hero-rigged.blend`](assets/hero-rigged.blend) lub
zaimportować jako FBX: [`hero-rigged.fbx`](assets/hero-rigged.fbx).

Chód i bieg przełączają się według prędkości ruchu. Tempo odtwarzania klipów
skorygowano po pomiarze poślizgu stóp; poślizg został ograniczony, ale nadal
występuje. Pliki [`hero-walk-candidate.blend`](assets/hero-walk-candidate.blend)
i [`hero-walk-candidate.glb`](assets/hero-walk-candidate.glb) są eksperymentalne
i nie są używane przez grę.

## Kontrola działania

Model wyrenderował się w przeglądarce na ekranie 1440 × 900; sprawdzono bieg,
atak z drewnianym toporem stworzonym w interfejsie gry, wygaszanie
powtarzanego uderzenia, pływanie przy `H(x, z) < -1.15` oraz portret i podgląd
bohatera w HUD. Na ekranie 844 × 390, DPR 2 sprawdzono dotykowy joystick,
stan ruchu i bieg; konsola nie zgłosiła błędów strony.

Manifest service workera umieszcza oba modele w pre-cache offline: pełny GLB
(4 330 168 bajtów), mobilny GLB (3 914 984 bajty) i wymagane pliki vendor.
Wcześniejsza kontrola pełnego odświeżenia offline potwierdziła dostępność modelu
pełnego i vendorów, a `importedHero.ready` zwrócił prawdę z siedmioma klipami.
`npm run check` zakończył 40 testów bez błędów, ESLint przeszedł, a 51 klasycznych skryptów
przeszło parsowanie. Zrzuty i nagranie: [desktop](screenshots/imported-hero-desktop.jpg),
[mobile](screenshots/imported-hero-mobile.jpg), [wideo](videos/imported-hero.mp4).

Nie sprawdzono fizycznego telefonu ani synchronizacji chmurowej.

## Pochodzenie i przygotowanie

Model bazowy wygenerowano w Tripo AI z dostarczonego przez użytkownika obrazu
referencyjnego pozy T ([hero-reference.png](assets/hero-reference.png)). Zadanie w Tripo:
[podgląd zadania](https://studio.tripo3d.ai/ru/workspace/generate/f8db47fc-fd02-41e9-b528-f7903bbb23b6).
Wykorzystano istniejące darmowe konto, model H2.5 i 40 darmowych kredytów;
nie dokonano zakupów. GLB-y z dołączonego przez użytkownika ZIP-a nie zostały
użyte: zawierały pojedynczą płaszczyznę z obrazem i 10 prostopadłościanów, bez szkieletu.

Skrypt [`scripts/prepare-hero.py`](../scripts/prepare-hero.py) przygotowuje
model w Blenderze: normalizuje orientację i skalę, redukuje geometrię, tworzy
szkielet i wagi, zachowuje sztywne wagi głowy, laski i plecaka oraz zapisuje
klipy. Rig i animacje powstały lokalnie w tym skrypcie; nie zostały wygenerowane
przez Mixamo. Skrypt waliduje wagi i klipy, eksportuje GLB, Blend i FBX, po czym
importuje wyeksportowany GLB ponownie do Blendera i waliduje go ponownie.

Przy ponownym przygotowaniu zasobu, mając zainstalowany Blender, z katalogu
głównego projektu można uruchomić:

```bash
blender -b --python scripts/prepare-hero.py -- --source /Users/oleksandr/Desktop/popal-reference-hero-source.glb
```

Bez `--glb`, `--blend` i `--fbx` skrypt zapisuje pliki w lokalizacjach
wymienionych powyżej. Nie uruchamiaj ponownie bez potrzeby: istniejący wynik
jest już przygotowany i zwalidowany.

## Atrybucja i licencja

Referencja wizualna pochodzi od użytkownika; model bazowy wygenerowano w Tripo
AI, a rig, wagi i animacje przygotowano lokalnie dla Popal. Nie użyto zasobów
Palworld.

Interfejs darmowego konta Tripo informuje, że modele publiczne są
niekomercyjne. [Strona cennika Tripo](https://www.tripo3d.ai/pricing) podaje
ten sam warunek, natomiast [dokumentacja kredytów i cennika](https://www.tripo3d.ai/product-doc/getting-started/pricing-credits)
opisuje przypisanie autorstwa. Przyjęto ostrożniejszą interpretację: darmowy
model jest niekomercyjny; przypisanie autorstwa samo w sobie nie stanowi
potwierdzenia prawa do użycia komercyjnego. Przed komercyjnym wydaniem gry
należy sprawdzić warunki dotyczące konkretnego modelu i uzyskać wymagane prawa.

## Eksport FBX

FBX zawiera osadzone mapy koloru i normalnych. Katalog `docs/assets/hero-rigged.fbm/` zawiera także trzy oryginalne mapy 4096 px, w tym roughness/metallic; do przenoszenia do innego edytora należy zachować ten katalog obok FBX. Ponowny import FBX w Blenderze potwierdził 22 kości, siedem animacji i osadzone obrazy.
