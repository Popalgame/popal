# Character Build

Parametryczny generator postaci w Blenderze z pomiarów
[`character-scan`](../character-scan/README.md). Z `measurements.json`
buduje blockout sylwetki, 22-kostny rig `mixamorig:*`, siedem demonstracyjnych
akcji, cztery widoki ortograficzne, render beauty, `.blend` i `.glb`.

To **blockout proporcjonalny, nie rekonstrukcja anatomii**. Widok z przodu
nie zawiera głębokości ani tyłu, więc wymiary osi Y (głębokości) są jawnymi
założeniami antropometrycznymi, a animacje demonstrują strukturę rigu,
nie jakość ruchu produkcyjnego.

## Wymagania

- Blender 5.2 LTS (testowane na 5.2.2) w PATH jako `blender`,
- Python w Blenderze pełny (domyślny),
- pomiary z `tools/character-scan` (plik `measurements.json`).

## Użycie

```bash
blender -b --factory-startup --python-exit-code 1 \
  --python tools/character-build/build_character.py -- \
  --measurements output/character-scan/aiko/measurements.json \
  --out output/character-build/aiko --name Aiko
```

Wynik w katalogu `--out`:

| Plik | Zawartość |
| --- | --- |
| `build.json` | plan wymiarów, statystyki siatki, rig, akcje, ścieżki renderów |
| `views/front|left|back|right.png` | widoki ortograficzne, tło przezroczyste |
| `views/beauty.png` | render perspektywiczny, pozycja `idle`, podłoże |
| `<name>-generated.blend` | edytowalna scena (body + rig, NLA wyciszone) |
| `<name>-generated.glb` | eksport: tylko body + rig, tryb NLA_TRACKS |

Weryfikacja eksportu (reimport + kontrole techniczne):

```bash
blender -b --factory-startup --python-exit-code 1 --python \
  tools/character-build/verify_glb.py -- \
  output/character-build/aiko/aiko-generated.glb \
  output/character-build/aiko/glb-verify.json
```

Raport zawiera sceny, siatki, materiały, skiny, kości, animacje, atrybuty
wag (maksimum wpływów, suma wag), SHA-256 pliku i bounds. Sprawdza też
zmienność kanałów animacji w binarnych danych GLB: nazwa klipu nie dowodzi
ruchu. `--render-dir KATALOG` zapisuje Rest i początek/środek/koniec każdego
klipu, ocenianego osobno w Pose (pozostałe ścieżki NLA są wyciszone).
Brak ruchu lub błędne wagi powoduje niezerowy kod wyjścia. Importer glTF dodaje własny
pomocniczy kształt kości (`Icosphere` w ukrytej kolekcji
`glTF_not_exported`); weryfikacja go pomija — to nie część assetu.

## Skąd biorą się wymiary

- **Przód (piksele → milimetry):** prosto z `measurements.json`; wysokość,
  rozpiętość ramion, talia, biodra, krok, łydka, podstawa.
- **Twarz (`face` w pomiarach):** gdy skaner wykrył parę tęczówek, głowa
  powstaje ze zmierzonej szerokości skóry twarzy, linii oczu i brody.
  Włosy (`head_max`) są wtedy tylko obrysem fryzury, nie czaszką.
- **Głębokość (oś Y):** założenia — pierścienie torsu mają głębokość
  0,50–0,58 szerokości, głowa ~1,0 szerokości twarzy. Żaden z tych
  wymiarów nie pochodzi z pomiaru.
- **Rekwizyty:** szerokość bioder liczy 72% pomiaru (plecak i kule przy
  biodrach zawyżają obrys), a talia 96% (rozpięta kurtka). Rozpiętość
  ramion zostaje jako zmierzona — przy przyciętym kadrze to dolna granica.

## Rig i kontrakt

- 22 kości `mixamorig:*`, hierarchia zgodna z `docs/blender-project-contract.md`.
- Maksymalnie 2 wpływy na wierzchołek (limit kontraktu: 4), suma wag ≈ 1.
- Akcje `idle, walk, run, swim, hit, throw, jump` jako ścieżki NLA;
  na eksport ścieżki są odmutowane, w `.blend` wyciszone (czysty rest).

## Warianty głębokości: B i C

Referencja pokazuje tylko przód. Dwa opcjonalne tory uzupełniają braki,
oba jawnie oznaczone jako interpretacja, nie pomiar:

**Wariant B — monokularna głębia (ONNX, CPU):**

```bash
python3 tools/character-build/depth_estimation.py \
  --image output/character-scan/reference.png \
  --measurements output/character-scan/aiko/measurements.json \
  --out output/character-build/aiko/depth-v2
```

Depth Anything V2 Small pobiera się raz z Hugging Face. Skrypt zachowuje
proporcje obrazu, odczytuje wyjście `[1,H,W]` lub `[1,1,H,W]`, zapisuje
`depth.npy` (float32), podgląd oraz `depth-hints.json` z sumami kontrolnymi.
Domyślnie mapa jest **wyłącznie diagnostyczna**. Inverse depth opisuje
względną odległość widocznej powierzchni od kamery, NIE grubość postaci.

Opcjonalne `--derive-hints` włącza jawną heurystykę `lateral-relief-v1`:
różnice głębi w obrębie poziomych przekrojów zwiększają założoną głębokość
torsu o maksymalnie 15%. Nie korzystamy z samej średniej odległości pasa
ciała od kamery. Gradient pionowy bez reliefu nie dostarcza wskazówek.
Przykład: dodaj `--derive-hints` do polecenia powyżej, a następnie:

```bash
blender -b --factory-startup --python-exit-code 1 \
  --python tools/character-build/tests/blender_depth_pipeline.py -- \
  --measurements output/character-scan/aiko/measurements.json \
  --hints output/character-build/aiko/depth-v2/depth-hints.json \
  --out output/character-build/aiko-depth-v2-animated
```

To sprawdza build → eksport → reimport i zapisuje rendery wszystkich klipów.
Builder odrzuca stare raporty v1 (błędny odczyt tensora), `usable=false`,
nieobsługiwaną politykę, NaN/Inf i mnożniki spoza 1..1,15.

**Korekta wcześniejszego wyniku Aiko:** paski na starej mapie były skutkiem
błędu kodu (`output[0,0]` wycinało wiersz z tensora `[1,H,W]`), nie dowodem
nieprzydatności modelu na ilustracji. Po poprawce mapa zawiera relief twarzy,
włosów i stroju. Eksperymentalne mnożniki: chest 1,0194, waist 1,0225,
hip 1,0367. Nie dowodzi to zgodności ukrytych powierzchni z referencją.

**Wariant C — profil z widoku bocznego:**

```bash
python3 tools/character-build/depth_from_side.py \
  --image WIDOK_BOCZNY.png \
  --measurements output/character-scan/aiko/measurements.json \
  --source-label generated --out output/character-build/aiko

blender -b --factory-startup --python-exit-code 1 \
  --python tools/character-build/build_character.py -- \
  --measurements output/character-scan/aiko/measurements.json \
  --depth-profile output/character-build/aiko/depth-profile.json \
  --out output/character-build/aiko-side-candidate --name Aiko
```

`--source-label generated` zapisuje w profilu, że widok jest interpretacją
AI. Głębokości z profilu nadpisują założenia torsu i głowy, w granicach
clampów proporcjonalnych do szerokości. Przycięcie w pionie odrzuca cały
pomiar; przycięty przekrój ma `depth_m: null`. Profil musi mieć tę samą
wysokość odniesienia co plan. `--depth-profile` i `--depth-hints` wzajemnie
się wykluczają. **Użyty backend generatywny odmówił z powodu braku kredytów**;
nie wygenerowano boku ani tyłu. Tor pomiarowy jest przetestowany syntetycznie,
ale nie jest to potwierdzenie całego wariantu generatywnego.

## Znane ograniczenia

- Geometria jest zgrubna ( loft + elipsoidy + stożki ); to podstawa pod
  dalszą pracę, nie gotowy model produkcyjny.
- Fryzura to przybliżenie obrysu: kolce i kucyk nie odwzorowują pojedynczych
  kosmyków referencji.
- Młot z referencji nie jest modelowany; `arm_span` referencji go zawiera.
- Deformacje sprawdzono na próbkach klipów (bounds i oględziny renderów);
  bez kontroli każdego klipu klatka po klatce.

## Wynik dla referencji Aiko (2026-10-31)

- Siatka 11 102 wierzchołki / 10 918 ścian, wysokość 1,7957 m, stopy przy 0.
- Rig 22 kości, 7 akcji. Nowy eksport z ruchem ~0,75 MB (749 416 B).
  Poprzednie ~0,70 MB miało nazwy klipów, ale stałe kanały: eksport w Rest
  wyłączał ocenę animacji. Eksport odbywa się teraz w Pose z przywróceniem
  ustawień w `finally`; zapisany `.blend` pozostaje w Rest.
- `character-scan compare` (przód): IoU sylwetki **76,8%**, różnice szerokości
  w dziewięciu punktach ≤ 6,3% wysokości; największa odchyłka to górna masa
  włosów (10% wysokości), którą blockout upraszcza.
- Weryfikacja GLB: 1 scena, 1 siatka, 1 skin, 7 animacji, maks. 2 wpływy,
  sumy wag w normie. Potwierdzony ruch: idle 3, walk/run 6, swim 4,
  hit/throw 3, jump 7 zmiennych kanałów. Obejrzano 21 próbek po reimporcie.
- Aktualny kandydat B: `output/character-build/aiko-depth-v2-animated/`;
  `views-comparison.jpg` porównuje cztery widoki, `animation-contact-sheet.jpg`
  pokazuje próbki klipów. Blockout nadal ma zgrubne połączenia kończyn.
- **Żadnej integracji z grą bez osobnej decyzji użytkownika.**

## Testy

```bash
python3 -m unittest discover -s tools/character-build/tests -p 'test_*.py'
```
