# Blender jako mózg agenta — architektura

Ten dokument opisuje, jak zrobić z OpenCode sterujący mózg Blendera, a nie
magazyn zapamiętanych skrótów. Punkt wyjścia: agent nie może wiarygodnie
„znać każdej funkcji” z pamięci. Może natomiast **mieć dostęp do pełnego,
wersjonowanego API, wykonywać kod i sprawdzać wynik** — i to jest realizowalne.

## 1. Zasada: wiedza + pętla, nie pamięć

Cztery warstwy:

```text
┌──────────────────────────────────────────────────────────────┐
│  MÓZG: plan → wykonanie → obserwacja → korekta               │
├──────────────────────────────────────────────────────────────┤
│  WIEDZA: indeks API 5.2, manual, receptury, kontrakt projektu│
│  ZMYSŁY: scena, rendery 4 widoków, pomiary sylwetki          │
│  RĘCE:   bpy, operatory, batch, zapis/checkpoint             │
└──────────────────────────────────────────────────────────────┘
```

Agent nie potrzebuje w kontekście całego API. Potrzebuje:

1. **Wyszukiwania** — „jak nazywa się operator bevel i jakie ma parametry?”,
2. **Introspekcji** — „czy ten obiekt ma tę właściwość i jaki ma typ?”,
3. **Wykonania** — „zrób to w scenie”,
4. **Walidacji** — „pokaż render i zmierz wynik”.

Bez punktu 4 agent tylko generuje kod. Z punktem 4 uczy się na wyniku, a nie na
własnych założeniach.

## 2. Warstwa wiedzy

### 2.1 Indeks API zainstalowanego Blendera

Narzędzie [`tools/blender-api`](../tools/blender-api/README.md) zrzuca
`bpy.ops`, `bpy.types`, właściwości RNA i funkcje modułów do SQLite FTS5.
Indeks jest generowany z konkretnego builda (obecnie 5.2.2), więc nie miesza
wersji ani parametrów z poradników.

Zastosowanie:

```bash
python3 tools/blender-api/blender_api.py query "armature bone parent"
python3 tools/blender-api/blender_api.py show bpy.ops.export_scene.gltf --summary
```

To rozwiązuje problem „skąd agent wie, że parametr nazywa się tak, a nie
inaczej”. Nie rozwiązuje problemu kontekstu — ten sprawdza się w scenie.

### 2.2 Manual i receptury

Drugi poziom to indeks oficjalnego manuala 5.2 (pojęcia, ostrzeżenia, przepływy)
oraz biblioteka **sprawdzonych receptur**: małych skryptów z warunkami wejścia,
kodem i testem wyniku. Receptura nie jest dokumentacją — jest wykonanym
przepisem, który można powtórzyć.

Proponowany format:

```yaml
name: render_orthographic_views
requires: [camera, object]
inputs: [object_name, output_dir]
steps:
  - utwórz kamery: front, left, back, right
  - ustaw ortograficzne, wyrównaj do bounds
  - renderuj z alpha
checks:
  - cztery pliki istnieją
  - sylwetka nie dotyka krawędzi
```

### 2.3 Introspekcja żywej sceny

Indeks opisuje typy. Żywa scena opisuje **instancję**: tryb, zaznaczenie,
modyfikatory, grupy wierzchołków, materiały, kości. Agent powinien przed każdą
zmianą odczytać `bpy.context` i po zmianie odczytać stan ponownie. Most
`tools/blender-mcp` już to umożliwia (`blender_scene`, `blender_execute_python`,
`blender_preview`).

## 3. Automatyczne widoki z boku i z tyłu

To nie jest problem „brakuujący render”. To problem **brakujących danych**.
Z jednego przodu nie da się odtworzyć tego, czego obraz nie pokazuje. Blender
może jednak automatycznie zbudować spójną bryłę, jeśli jawnie przyjmiemy
założenia. Trzy podejścia:

### A. Symetria + antropometria (deterministyczne, bez modelu AI)

- przód → maska i pomiary (już jest w `character-scan`),
- tył → lustro przodu względem osi X,
- bok → profil głębokości z proporcji anatomicznych (np. głębokość klatki,
  bioder, głowy) i z cieniowania,
- nogi, ręce i tors jako osobne przekroje, nie jedna płaska tablica.

Zalety: szybkie, powtarzalne, offline, brak halucynacji. Wady: tył jest
symetryczny, a głębokość to założenie, nie pomiar. Dla postaci symetrycznej
i stylizowanej — zwykle wystarczające jako baza.

### B. Głębokość z jednego obrazu (depth estimation)

Model monokularny (np. Depth Anything) daje mapę głębokości przodu. Można nią
wybrzuszyć siatkę i uzyskać relief. Tył nadal trzeba uzupełnić symetrią lub
generatywnie. To dobry dodatek do A, nie samodzielna rekonstrukcja.

### C. Generatywne widoki wielokrotne

Model generuje przód, bok, tył i 3/4 na podstawie jednego zdjęcia, a potem
siatka jest budowana z wielu widoków. Zalety: plausible detale tyłu i boków.
Wady: model może zmienić proporcje, dodać nieistniejące elementy i nie dać
„milimetra”. Wymaga starannej walidacji i akceptacji, że to interpretacja,
nie pomiar.

### Rekomendacja

Dla postaci do gry: **A jako baza + B dla reliefu + C tylko dla detali, których
nie da się wydedukować**. Dla wierności „co do milimetra”: potrzebne są
dodatkowe widoki, skan 3D albo praca artysty. Żaden automat nie odzyska
ukrytej prawdy z jednego obrazu.

Szkielet pipeline'u:

```text
front.png
   │
   ├─ character-scan → measurements.json (proporcje, punkty, paleta)
   │
   ├─ parametryczny humanoid → siatka bazowa w skali
   │        │
   │        ├─ lustro tyłu
   │        ├─ profil głębokości (antropometria / depth)
   │        └─ detale: włosy, strój, rekwizyty
   │
   ├─ render 4 widoków (front, left, back, right)
   │
   └─ compare → IoU, różnice szerokości → korekta → render…
```

## 4. Pętla pracy agenta

Dla każdego zadania:

1. **Zrozum cel** — jaki zasób, jaki format, jakie kryteria odbioru.
2. **Odczytaj kontrakt** — `docs/blender-project-contract.md` dla istniejącego
   zasobu; nie zgaduj kości, skali ani eksportu.
3. **Zaplanuj** — podziel na małe kroki, każdy z testem.
4. **Sprawdź API** — `blender-api query/show`.
5. **Wykonaj** — `blender_execute_python` lub batch; checkpoint przed zmianą.
6. **Zobacz** — render z przodu, boków, tyłu i 3/4; nie tylko viewport.
7. **Zmierz** — `character-scan compare` dla sylwetki; metryki siatki dla
   techniki.
8. **Popraw** — jedna zmiana na raz, porównanie przed/po.
9. **Zapisz** — `.blend`, eksport, raport z ograniczeniami.

Ważne: agent ma **zatrzymać się i zaraportować**, gdy brakuje danych albo
kontekst jest niejednoznaczny. Automatyzacja nie zwalnia z walidacji.

## 5. Etapy wdrożenia

| Etap | Zakres | Stan |
| --- | --- | --- |
| P0 | Indeks API 5.2 + wyszukiwanie + testy | gotowe (39 116 rekordów, 5.2.2) |
| P1 | Manual 5.2 w tym samym indeksie; receptury i walidatory sceny | gotowe (14 stron manuala, 3 receptury zweryfikowane, `scene_check.py`) |
| P2 | Generator parametryczny humanoida z `measurements.json` | gotowe (`tools/character-build`, commit d608030) |
| P3 | Automatyczne uzupełnienie tyłu/boków + render 4 widoków + compare | gotowe w wariancie A: budowa parametryczna z jawnymi założeniami głębokości, 4 widoki, pętla `compare` (IoU 76,8% dla Aiko). Warianty B (depth) i C (generatywne) niezrealizowane |
| P4 | Materiały, rig, wagi, animacje, eksport i reimport | blockout gotowy: 19 materiałów, rig 22 kości, 7 akcji, GLB + weryfikacja reimportu. Docelowa jakość assetu gry wymaga dalszej pracy |

P1 jest tanie i natychmiast poprawia trafność. P2 daje pierwszy realny model
3D. P3 zamyka pętlę wizualną. P4 dopiero czyni z tego asset gry.

Stan integracji z żywym Blenderem: **pętla na żywo działa** (2026-10-31).
Serwer `polpal-blender` jest zarejestrowany w OpenCode (`opencode mcp add`,
konfiguracja globalna), dodatek zainstalowany w preferencjach Blendera 5.2.2,
a most uruchomiony jest w otwartym GUI Blendera. Zweryfikowano na żywo:
`blender_status`, `blender_scene` i `blender_preview` (render podglądu otwartej
sceny bez jej zmiany). Zapis do cudzej sesji pozostaje świadomą decyzją:
każdy batch tworzy checkpoint, ale nie jest transakcyjny.

Warianty głębokości:
- **B (depth monokularny)** — gotowy narzędziowo (`tools/character-build/depth_estimation.py`,
  Depth Anything V2 Small ONNX na CPU), z kontrolami jakości mapy (gradient
  kadru, plauzybilność anatomiczna). Dla referencji Aiko wskazówki zostały
  odrzucone: mapa śledziła pozycję w kadrze, nie formę. Przyda się na
  fotografiach i renderach, nie na płaskiej ilustracji.
- **C (widok generatywny)** — tor pomiarowy gotowy (`depth_from_side.py` +
  `--depth-profile` w build), przetestowany syntetycznie. Generacja widoków
  wymaga kredytów OpenRouter (stan: brak); bez nich wracamy do wariantu A.

## 6. Ryzyka

- **Kontekst operatora** — indeks zna parametr, ale nie wie, czy jesteś
  w Edit Mode. Zawsze sprawdzaj scenę.
- **Zmiana wersji** — po aktualizacji Blendera przebuduj indeks; stare
  parametry mogą nie istnieć.
- **Generatywna interpretacja** — model może „upiększyć” tył. To trzeba
  oznaczyć w raporcie, nie nazywać pomiarem.
- **Fałszywa pewność** — brak wyjątku nie znaczy, że render jest poprawny.
  Kryteria odbioru muszą być wizualne i mierzalne.
- **Prawa i licencje** — modele generatywne i tekstury mają własne warunki;
  nie zakładaj, że wynik jest wolny od ograniczeń.

## 7. Zasada końcowa

„Mózg Blendera” to nie model, który recytuje API. To system, który **wie,
gdzie sprawdzić**, **umie wykonać**, **widzi wynik** i **potrafi się wycofać**.
Indeks API jest pierwszym filarem; bez pętli walidacyjnej byłby tylko
wyszukiwarką dokumentacji.
