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

Chód, trucht i bieg korzystają z opcjonalnego pakietu lokomocji przygotowanego
w Blenderze: [`hero-locomotion.blend`](assets/hero-locomotion.blend) i
[`hero-locomotion.glb`](../site/assets/models/hero-locomotion.glb) (około
82,5 KB). Źródło, metoda i ograniczenia są opisane w
[`character-locomotion.md`](character-locomotion.md). Ruch postaci na PC nadal
ma prędkość 5 jednostek/s, a bieg z Shift — 8 jednostek/s; profile animacji
mają prędkości nominalne około 0,923, 4,992 i 8 jednostek/s. Przy 5 jednostkach/s
postać przechodzi w trucht, a przy 8 — w bieg. Moduł może pozostać przy
wbudowanych klipach, jeśli pakietu brakuje lub nie przejdzie walidacji.

Ataki korzystają z opcjonalnego pakietu walki przygotowanego w Blenderze:
[`hero-combat.blend`](assets/hero-combat.blend) i
[`hero-combat.glb`](../site/assets/models/hero-combat.glb). Źródłem jest
[`build-hero-combat.py`](../scripts/build-hero-combat.py). Pakiet zawiera
klipy `sword_hit` i `throw_right`, po 0,75 s i 96 klatek/s; początek i koniec
każdego klipu odpowiadają pozie spoczynkowej. Nakładki obejmują górną część
ciała, więc nie zmieniają animacji lokomocji. Lewy miecz atakuje stworzenie w
zasięgu 2,6 jednostki, z priorytetem przed zbieraniem; bez celu postać wykonuje
cios w powietrze lewą ręką. Zbieranie nadal używa oryginalnej animacji
wyposażonego narzędzia prawą ręką, a rzut — prawej ręki. Kliknięcie i wywołanie
`heroAct` korzystają z tego samego wyboru ręki; zmiana nie modyfikuje obrażeń.
Przy braku lub błędnej walidacji pakietu pozostaje wbudowana animacja.

Eksperyment z alternatywnym klipem chodu `hero-walk-clip.glb` został odrzucony
po ocenie animacji (nogi były wygięte); plik nie jest ładowany przez grę. W
historycznym pomiarze tego wariantu, na płaskim terenie i przy centralnym
podparciu, mediana prędkości dryfu kostki wyniosła 0,12 jednostki/s wobec 1,62
w wariancie porównawczym, a próbkowane kąty kolan wynosiły około 26–37°.
Wynik ten dotyczy odrzuconego eksperymentu i nie opisuje aktualnej poprawy
animacji.

Nowe pomiary surowego GLB dotyczą klipów i są opisane w
[`character-locomotion.md`](character-locomotion.md); nie są testem runtime.
Pojedyncze, historyczne 30-sekundowe próby na tym samym fizycznym Androidzie
dały 59,70 FPS dla modelu mobilnego i 59,58 FPS dla pełnego modelu, z p95
16,70 ms; wykonano je przed integracją eksperymentalnego klipu. Osobny pomiar
wysokiej jakości dał 51,55 FPS i p95 33,2 ms. Test chodu w trybie Auto po
integracji tego klipu dał 59,66 FPS i p95 16,70 ms. Są to pomiary RAF jednego
urządzenia i historycznego wariantu; nie potwierdzają wzrostu FPS.

Pliki [`hero-walk-candidate.blend`](assets/hero-walk-candidate.blend) i
[`hero-walk-candidate.glb`](assets/hero-walk-candidate.glb) pozostają
eksperymentalne i nie są używane przez grę.

## Kontrola działania

Poprawkę lewego miecza sprawdzono spacją na PC: klip `sword_hit`,
lewą dłonią wykonano łuk około 0,39 jednostki, a trafienie zadało obrażenia.
W emulacji mobilnej w przeglądarce sprawdzono także rzeczywiste dotknięcie
przycisku ataku na `hero-mobile.glb`: lewa dłoń wykonała łuk około 0,39,
prawa około 0,075 jednostki; obrażenia naliczyły się, klip wrócił do idle
i nie zgłoszono błędów strony.
Pełne kontrole po poprawce: ESLint i 63 testy zaliczone. Nowe cięcie i rzut
kończą się według odtworzonego czasu klipu, aby pauza podczas zmiany pełnego
ekranu nie wygaszała animacji przed widocznym zamachem.

Aktualny pakiet lokomocji sprawdzono w grze na PC oraz fizycznym Androidzie.
Pełne kontrole: 59 testów i ESLint zaliczone. Pomiar Auto na Androidzie:
59,80 FPS, p95 16,70 ms; warunki i ograniczenia opisano w
[`character-locomotion.md`](character-locomotion.md#sprawdzenie-w-grze).

Wcześniejszą wersję modelu wyrenderowano w przeglądarce na ekranie 1440 × 900; sprawdzono bieg,
atak z drewnianym toporem stworzonym w interfejsie gry, wygaszanie
powtarzanego uderzenia, pływanie przy `H(x, z) < -1.15` oraz portret i podgląd
bohatera w HUD. Na ekranie 844 × 390, DPR 2 sprawdzono dotykowy joystick,
stan ruchu i bieg; konsola nie zgłosiła błędów strony.

Manifest service workera umieszcza oba modele w pre-cache offline: pełny GLB
(4 330 168 bajtów), mobilny GLB (3 914 984 bajty) i wymagane pliki vendor.
Wcześniejsza kontrola pełnego odświeżenia offline potwierdziła dostępność modelu
pełnego i vendorów, a `importedHero.ready` zwrócił prawdę z siedmioma klipami.
`npm run check` zakończył 40 testów bez błędów, ESLint przeszedł, a 51 klasycznych skryptów
przeszło parsowanie. Kontrole te poprzedzają integrację nowego pakietu lokomocji.
Zrzuty i nagranie: [desktop](screenshots/imported-hero-desktop.jpg),
[mobile](screenshots/imported-hero-mobile.jpg), [wideo](videos/imported-hero.mp4).

Synchronizacja chmurowa nie została sprawdzona.

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
