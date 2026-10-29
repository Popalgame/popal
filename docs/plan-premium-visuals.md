# Plan wdrożenia: premium oprawa graficzna (poziom „Palworld")

> Cel: rozwijać proceduralną, stylizowaną oprawę i czytelność gry, zachowując
> obecną architekturę bez bundlera. Wzmianki o „poziomie Palworld” opisują
> kierunek wizualny, a nie osiągniętą równoważność jakości.

---

## 0. STAN REALIZACJI — v0.5.0: **importowany bohater; plan trwa**

Wersja pakietu to **0.5.0**. Etap 1 nadal ma podstawowy pipeline
post-processingu i niebo z cyklem dnia/nocy. W v0.3.0 wykonano proceduralne
polerowanie świata, gry i wydajności; v0.4.0 dodało grywalną scenę, a v0.5.0
rozwija etap 3 o importowaną, rigowaną postać bohatera.

**Zmiany w v0.5.0:**

- Bohater korzysta z importowanego modelu GLB z rigiem i animacjami.
  `imported-hero.js` ładuje zasób przez lokalne `GLTFLoader` i `SkeletonUtils`
  dołączone do three.js r128; proceduralny bohater pozostaje fallbackiem na czas
  ładowania lub błędu. Szczegóły pipeline’u, zasobów i licencji opisuje
  [`hero-model.md`](hero-model.md).
- Model został wygenerowany w Tripo AI na podstawie referencyjnej pozy T
  dostarczonej przez użytkownika, a lokalny skrypt Blendera przygotował rig,
  wagi i klipy. Nie jest to animacja wygenerowana przez Mixamo.
- Runtime dobiera model według `(pointer: coarse)`: wskaźniki zgrubne otrzymują
  wariant mobilny o około 38 tys. trójkątów, a pozostałe — pełny model około
  50 tys. trójkątów. Oba zachowują 22 kości i siedem klipów; przy błędzie
  wariantu mobilnego następuje próba załadowania pełnego modelu, a następnie
  pozostaje proceduralny bohater. Wariant 38k zmniejsza geometrię o około 24%,
  bez potwierdzonego wzrostu FPS. Oba pliki są w pre-cache offline; mobilny GLB
  dodaje około 3,9 MB do cache. `hero-walk-candidate` pozostaje eksperymentalny
  i nie jest używany przez runtime.
- Przegląd wcześniejszej wersji modelu w przeglądarce potwierdził renderowanie
  i bieg. Pełne QA nadal trwa; wykonano pojedyncze, 30-sekundowe pomiary na
  fizycznym Androidzie, ale nie są one kontrolowanym porównaniem ani końcowym
  wynikiem FPS. Nie weryfikują nowego pakietu lokomocji.

**Kontynuacja etapu modeli środowiska:**

- `scripts/prepare-rocks.py` przygotowuje trzy niskopoligonowe warianty skał
  zapisane jako `docs/assets/terrain-rocks.blend` i
  `site/assets/models/terrain-rocks.glb`. Gra ładuje GLB przez `GLTFLoader`;
  do czasu załadowania oraz przy błędzie działa dotychczasowa geometria
  proceduralna. Zmiana kształtu dotyczy zwykłych skał, bez znaczników rud.
- `scripts/create-building-textures.py` tworzy kafelkowane tekstury drewna i
  kamienia w `site/assets/building/` oraz plik źródłowy
  `docs/assets/building-materials.blend`. Materiały budynków pobierają obrazy
  asynchronicznie, zachowując proceduralną teksturę canvas jako fallback.
- `scripts/prepare-meadow-flowers.py` przygotowuje pojedynczy kwiat w Blenderze,
  zapisuje źródło `docs/assets/meadow-flowers.blend` i eksportuje
  `site/assets/models/meadow-flowers.glb`. Po wczytaniu model zastępuje
  proceduralne kwiaty w istniejącym `InstancedMesh`; zachowuje instancjonowanie,
  warianty kolorów płatków i ugięcie na wietrze. Przy błędzie lub nieprawidłowym
  modelu pozostają dotychczasowe kwiaty.
- `scripts/prepare-berry-bush.py` tworzy krzew jagodowy w Blenderze i eksportuje
  `docs/assets/berry-bush.blend` oraz `site/assets/models/berry-bush.glb`.
  Moduł używa jednego współdzielonego szablonu wyglądu dla istniejących i nowych
  krzewów, pozostawiając ich stan zasobu i logikę gry bez zmian; do czasu
  poprawnego wczytania działa proceduralny wygląd zastępczy.
- `scripts/prepare-mushroom.py` przygotowuje w Blenderze niskopoligonową grupę
  grzybów z kolorami wierzchołków i eksportuje
  `docs/assets/mushroom.blend` oraz `site/assets/models/mushroom.glb`.
  Współdzielony model zastępuje wygląd grzybów w grze po poprawnym wczytaniu;
  podczas ładowania lub przy błędzie pozostaje proceduralny wygląd zastępczy.
- `scripts/prepare-building-roof.py` tworzy dwuspadowy dach w Blenderze,
  zapisany w `docs/assets/building-roof.blend` i
  `site/assets/models/building-roof.glb`. Model ma oddzielne powierzchnie
  `Roof_Surface` i `Roof_Trim`; do czasu wczytania lub przy błędzie używany jest
  dotychczasowy proceduralny stożek. Dach w zapisie nadal przechowuje te same
  dane elementu budowlanego, a model nie zmienia jego położenia ani reguł
  kolizji.
- Po ustawieniu lub usunięciu fundamentu roślinność jest ponownie rozmieszczana
  tak, by instancje trawy i kwiatów nie pojawiały się pod zajętymi komórkami.
  Odświeżenie uwzględnia również elementy odtworzone z zapisu.
- Modele skał, dachu, kwiatów, krzewu i grzybów, tekstury budowlane oraz nowe
  moduły są dodane do cache service workera. To kontynuacja etapu modeli
  środowiska; etap pozostaje niedokończony, nie oznacza ukończonej jakości ani
  równoważności wizualnej z Palworld. Nie ma końcowego wyniku FPS ani pełnej
  serii testów na urządzeniach fizycznych.
- Kolor terenu używa teraz płynnego, wieloskalowego szumu do subtelnych zmian
  jasności, zachowując kolory biomów i ścieżek.
- Importowany bohater otrzymał nowy pakiet lokomocji przygotowany w Blenderze:
  klipy `walk`, `jog` i `run` są wypiekane osobno z zachowaniem długości kości,
  a faza wspólnych cykli jest napędzana przebytym dystansem. Pakiet GLB ma około
  82,5 KB; runtime używa prędkości nominalnych 0,923, 4,992 i 8 jednostek/s.
  Prędkości sterowania PC pozostają 5 jednostek/s dla ruchu bez Shift i 8 z
  Shift; niższa długość kroku powoduje przejście w trucht przy prędkości 5.
  Szczegóły metody, dane z próbkowania surowego GLB i ograniczenia opisuje
  [`character-locomotion.md`](character-locomotion.md). Te pomiary nie są
  testami runtime.
- Wcześniejszy eksperyment z alternatywnym `hero-walk-clip.glb` odrzucono po
  ocenie animacji (nogi były wygięte); plik nie jest ładowany przez runtime.
  Historyczny pomiar odrzuconego wariantu na płaskim terenie przy centralnym
  podparciu wykazał medianę dryfu kostki 0,12 jednostki/s wobec 1,62 w wariancie
  porównawczym oraz kąty kolan około 26–37°. Wynik dotyczy wyłącznie tego
  odrzuconego eksperymentu. Pliki `hero-walk-candidate.blend` i `.glb` w
  `docs/assets/` również pozostają eksperymentalne i nie są używane przez
  runtime; nie są nowym pakietem lokomocji.
- Historyczne, pojedyncze 30-sekundowe próby na tym samym fizycznym Androidzie
  przed integracją eksperymentalnego klipu dały 59,70 FPS dla modelu mobilnego
  i 59,58 FPS dla pełnego modelu, przy p95 16,70 ms. Osobny pomiar wysokiej
  jakości dał 51,55 FPS i p95 33,2 ms. Test chodu w trybie Auto po integracji
  odrzuconego klipu dał 59,66 FPS i p95 16,70 ms. To pomiary RAF jednego
  urządzenia i historycznego wariantu; nie potwierdzają wzrostu FPS.
- Ekran umiejętności w ekwipunku pokazuje opis premii `water`, a pracownik przy
  piecu wyświetla status `smelt`.
- Service worker wstępnie zapisuje w cache 76 plików muzyki, efektów dźwiękowych
  i głosów stworów, aby były dostępne offline po pobraniu cache.
- Przywrócono bonus pracy typu `water` dla aktywnego, przypisanego do pracy Pala;
  jego poziom przyspiesza postęp zbierania zasobów i gotowania. Bonus nie działa,
  gdy specjalista nie jest aktywny lub przypisany.

**Zmiany w v0.4.0:**

- `hero-skeleton.js` tworzy proceduralny `SkinnedMesh` z 10 kośćmi oraz
  ciągłymi rękawami i nogawkami z płynnym blendowaniem wag. Istniejące warianty
  edytora bohatera i elementy wyposażenia są zachowane.
- `hero-anim.js` dodaje sześć klipów `AnimationMixer`: idle, walk, run, swim,
  hit i throw.
- Pukhoklub (typ 4) ma organiczne proceduralne ciało typu `SkinnedMesh` i kości
  poruszające głową, uszami, łapami i ogonem.
- Drzewa liściaste i iglaste korzystają z kart z alpha-testem; wiatr porusza
  koronami, a materiał głębi zachowuje wycięcia w cieniach.
- Trawa i kolor terenu wyznaczają ścieżkę. `meadow-scene.js` tworzy nową
  polanę z kamienną, otwartą bramą i kolizjami filarów; wybiera jedno z
  przygotowanych miejsc, omija zapisane struktury gracza i usuwa drzewa z
  przejścia.
- W v0.4.0 nowe modele i tekstury były generowane w JavaScript; w v0.5.0
  bohater przeszedł na importowany model GLB. Pozostałe postacie i środowisko
  nadal wymagają dalszych zasobów. To rozwój oprawy, nie równoważność wizualna
  z Palworld.
- `perf.js` pomija w statycznym pakietowaniu skórki, instancje i meshe z
  `customDepthMaterial`. Presety jakości są wspólne dla gry w przeglądarce na
  komputerze i urządzeniu mobilnym.

Przegląd wcześniejszej wersji gry w przeglądarce potwierdził renderowanie
modelu bohatera i bieg. Nowy pakiet lokomocji nie został objęty tym przeglądem.
Wykonano ograniczone pomiary na fizycznym Androidzie, ale nie ma kontrolowanego
porównania ani końcowego wyniku FPS. Synchronizacja postępu przez chmurę również
pozostaje niezweryfikowana.

**Co pozostaje w planie:** własne zasoby dla pozostałych postaci i środowiska,
dalsze dopracowanie animacji i tekstur, migracja z three.js r128 oraz pomiary
wydajności na docelowych urządzeniach. Etapy 2 i 3 są częściowo wykonane
proceduralnie, ale pierwotny plan zasobów artystycznych nadal jest otwarty.
---

## 1. Punkt wyjścia — audyt sprzed wdrożenia v0.2.0

Audyt wykonano na kodzie z `site/` (three.js **r128**, WebGL, bez build-stepu):

| Warstwa | Stan w audycie sprzed v0.2.0 | Ocena |
|---|---|---|
| **Niebo** | canvas 2×256 px z gradientem jako `scene.background` (core-world.js:3) | ❌ płaskie, martwe |
| **Oświetlenie** | HemisphereLight + DirectionalLight 2.2, shadow map 1024, ACES 0.86 | 🟡 fundament jest |
| **Teren** | proceduralny (simplex noise), **vertex colors** + jedna płaska tekstura szumu 256 px (paint) | 🟡 czysto, ale „programmer art" |
| **Woda** | przezroczysty PlaneGeometry 2400×2400, opacity .78 | ❌ |
| **Trawa/kwiaty** | InstancedMesh: stożki 3-kątne + sfery — bez wiatru (core-world.js:62-65) | 🟡 |
| **Drzewa/skały** | proceduralne komy/boxy (trees.js poprawił gatunki, ale to nadal bryły) | 🟡 |
| **Bohater** | składany z boxów/sfer (`buildHero`), animacje = obroty części (hero-anim.js) | ❌ brak riggingu |
| **Stwory (pale)** | 10 modeli z brył (pal-models.js, „multytyazhnyj stil") — czytelne, ale sztywne | 🟡 |
| **Post-processing** | **brak** — render wprost na ekran | ❌ największy brak |
| **Cykl dnia** | jest (world-007.js), ale nie napędza nieba/mlgi dynamicznie | 🟡 |

**Wniosek:** geometria i logika są OK. Do „premium" brakuje głównie: post-processingu,
nieba, wody, prawdziwych materiałów, rigowanych postaci z animacjami i wiatru na wegetacji.

## 2. Czego uczą nas Palworld i gry premium (research)

**Palworld (UE5)** nie jest fotorealistyczny — jego look to:
- **stylizowane, ręcznie malowane tekstury** zamiast fotograficznych PBR,
- **nasycone, żywe kolory** (krytyka graczy dotyczyła właśnie zbyt przygaszonego,
  żółtawego filtra — wniosek: **vibrance/saturacja to klucz do tego gatunku**),
- „pulchne" proporcje postaci, wyraziste sylwetki, mało detalu na teksturze,
- miękkie światło + mocne cienie kierunkowe; bez ray-tracingu (Nanite/Lumen nieużywane).

**Wiedza z branży (web/Three.js):**
- Post-processing to „największy pojedynczy czynnik, który odróżnia skończoną grę od
  programmer art". Na mobile: **max 1–3 efekty** (bloom + grading + vignette; FXAA zamiast MSAA).
- Trawa „BotW-style" w Three.js: InstancedMesh (1 draw call, dziesiątki tysięcy źdźbeł),
  zgięcie w shaderze wierzchołków wg wagi (vertex color), szum jako „cienie chmur".
- Postacie: **GLTF + SkinnedMesh + AnimationMixer** (`crossFadeTo` między stanami)
  to standard; Mixamo/KayKit/Quaternius dają gotowe rigi i animacje.
- Three.js r128 jest z 2021 r.; nowoczesne featy (OutputPass, KTX2, lepszy bloom,
  poprawny color management) wymagają r150+. Migracja wg oficjalnego guide —
  **krokami po ≤10 wersji**, z testem po każdym kroku.

**Darmowe zasoby (licencje zweryfikowane):**

| Źródło | Co daje | Licencja |
|---|---|---|
| **KayKit** (kaylousberg) | bohaterowie (41-kościowy rig, 76 animacji), Medieval Builder (budynki!), skeletons | **CC0** |
| **Quaternius** | Universal Base Characters (rig humanoid, Mixamo-compatible), Ultimate Monsters, Animals, Nature packi | **CC0** |
| **Quaternius Universal Animation Library** | ~260 animacji humanoid (idle/run/attack/farm…) | **CC0** |
| **Mixamo** (Adobe) | tysiące animacji mocap | darmowe komercyjnie, bez redystrybucji plików |
| **Kenney** | Animated Characters, nature | **CC0** |
| **ambientCG / Poly Haven** | tekstury PBR (w tym stylizowane) | **CC0** |

> ⚠️ Stwory („pale") to serce gry — **10 własnych modeli** to największy koszt artystyczny.
> Strategia przejściowa: KayKit/Quaternius monsters jako baza podmieniana stopniowo.

---

## 3. Plan wdrożenia — 5 etapów

### ETAP 0 — Fundament (1–2 dni) — *częściowo zrealizowany*

- [ ] **Kierunek artystyczny** (½ dnia): paleta 8–12 kolorów, 2–3 obrazy referencyjne
      (BotW / Palworld / Genshin), decyzja: „stylizowany PBR-lite" (nie fotorealizm).
      Zasada z researchu: **żywe kolory, czyste sylwetki, mało szumu tekstur**.
- [x] Presety jakości Auto / Battery / Balanced / Cinematic z limitami DPR i
      adaptacją rozdzielczości w Auto (`perf.js`). Docelowe metryki FPS, draw
      calls, pamięci GPU i rozmiaru ładowania nadal wymagają pomiarów.
- [ ] Weryfikacja po zmianach: `npm run check` i uruchomienie gry przez
      `npm start`, z uwzględnieniem urządzeń docelowych.

### ETAP 1 — „Instant premium”: post-processing + niebo + światło — **zrealizowany**
*Największy efekt/najmniej pracy. Zero zmian zasobów — wszystko na r128.*

1. **Post-processing**: własny pipeline render-targetów z bloom, FXAA i shaderem
   gradingu (vibrance, temperatura, kontrast, winieta); nie `EffectComposer`.
2. **Niebo**: własna shader-kopuła synchronizowana z cyklem dnia/nocy; nie `Sky.js`.
3. **Noc i światło**: gwiazdy, księżyc, światło wypełniające postać oraz cienie
   podążające za graczem.
4. **Jakość obrazu**: gałąź mobilna ogranicza efekty; w v0.3.0 doszły presety
   jakości i adaptacyjna rozdzielczość w Auto.

**Dotykane pliki:** `core-world.js` (renderer/scena/pętla), `world-007.js` (cykl dnia),
`world-effects.js` (vignette→shader), `graphics.js` (presety), `game.html` (nowe `<script>`),
`sw.js` (ASSETS — **testy z tests/ same wyłapią brak**), `eslint.config.mjs` (nowe globalne).

**Efekt po etapie 1:** gra wygląda „jak z trailer-a" na zrzucie ekranu; koszt: ~1–2 ms GPU na PC.

### ETAP 2 — Świat: woda, wiatr, tekstury terenu, roślinność (częściowo)

1. [x] **Woda proceduralna**: shader Fresnela, efekt płycizny i płytkie
   caustics; to nie `Water.js` i nie planowana normal map.
2. [x] **Wiatr i ugięcie trawy przy graczu** dodane w istniejącym systemie
   proceduralnym. Pełny pierwotny system BotW-style shaderowego zginania
   pozostaje osobnym kierunkiem rozwoju.
3. **Teren**: wdrożono paletę biomów, spokojniejsze tonowanie i płynny,
   wieloskalowy szum jasności; pełne splatting kilku tekstur nadal otwarte.
4. [x] **Roślinność i skały**: proceduralne drzewa zachowują karty liści i igieł
   z alpha-testem, wiatr i dopasowany materiał głębi; skały mają trzy
   importowane warianty GLB. Kwiaty, krzew jagodowy i grzyby otrzymały modele
   z Blendera; kwiaty nadal korzystają z `InstancedMesh`, a krzewy ze
   współdzielonego szablonu. Dach budynków otrzymał importowany model GLB.
   Dalsze modele środowiska, w tym zasoby Quaternius Nature / KayKit i
   kompresja DRACO, pozostają otwarte.
5. Tekstury drewna i kamienia dla budynków są pierwszym krokiem teksturowania
   zasobów środowiska; pełne teksturowanie terenu nadal pozostaje otwarte.
   Modele skał, dachu, kwiatów, krzewu i grzybów oraz obie tekstury są dodane do
   runtime-cache SW. Trawa i kwiaty są usuwane spod komórek zajętych przez
   fundamenty, także po odtworzeniu zapisanych budowli.

**Efekt docelowy:** świat przestaje być „plastikowy"; wiatr + woda = życie sceny.
W v0.4.0 dodano kolorowanie ścieżki w terenie i trawie oraz polanę z otwartą
kamienną bramą. Teren, większość roślinności i postaci nadal opierają się na
zasobach generowanych w JavaScript. Importowane skały, dach, kwiaty, krzew
jagodowy i grzyby oraz tekstury budynków są kontynuacją etapu modeli, a nie jego
ukończeniem. Dalsze GLTF środowiska, pełne teksturowanie terenu i pomiary
wydajności pozostają otwarte. Bohater jest wyjątkiem od v0.5.0. Zmiany nie
oznaczają ukończonej jakości Palworld, końcowego wyniku FPS ani pełnych testów
na fizycznych urządzeniach.

### ETAP 3 — Postacie i stwory (bohater GLB; pozostałe zasoby otwarte)

W v0.4.0 bohater otrzymał proceduralny `SkinnedMesh` z 10 kośćmi oraz
sześcioma klipami `AnimationMixer`, a Pukhoklub (typ 4) — organiczne ciało
typu `SkinnedMesh` z animowanymi kośćmi kończyn i ogona. W v0.5.0 zastąpił go
importowany model GLB z rigiem i siedmioma klipami; warianty edytora i
wyposażenie bohatera są zachowane, a przy ładowaniu lub błędzie działa
proceduralny fallback. Szczegóły procesu opisuje [`hero-model.md`](hero-model.md).
Pozostałe postacie i istoty wymagają dalszych zasobów.

1. **Bohater**: model GLB z 22 kośćmi i klipami idle/walk/run/swim/hit/throw/jump
   jest podłączony od v0.5.0. Pozostają dalsze testy i dopracowanie. **Customizacja
   zachowana**: warianty wyglądu i wyposażenie pozostają dostępne.
2. **Pals**: rozwinąć od pierwszego proceduralnie rigowanego Pukhokluba do
   pełnego zestawu modeli z animacjami (idle/walk/attack/hurt/happy/catch — zgodnie
   z istniejącymi dźwiękami). Plan kosztów: baza KayKit/Quaternius monsters (CC0) →
   retexturing/edycja → docelowo własne. Kolejność wg popularności u graczy (popaldex!).
3. **NPC + budynki**: KayKit **Medieval Builder** (CC0) idealnie pasuje do systemu
   budowania (building.js) — fundamenty/ściany/dachy są już w tym packu.
4. Materiały postaci: **stylizowany toon-lite** — gradient map (3–4 tony) na
   MeshStandardMaterial zamiast pełnego PBR (szybkie na mobile, „cartoonowy" look).
5. `mixer.update(dt)` w pętli `ANI` (core-world.js envUp) — jedno miejsce dla wszystkich.

**Efekt:** emotions! Stwory ruszają się, atakują i cieszą się — to buduje więź
(zgadza się z tym, co Pocketpair robił najdłużej: 100+ modeli × 20+ animacji).

### ETAP 4 — Migracja three.js r128 → r16x/r18x (3–5 dni)

Migracja pozostaje otwarta; należy ją planować po ustabilizowaniu obecnego pipeline’u na r128.

- [ ] Usunąć monkey-patch `setHex`+`convertSRGBToLinear` (core-world.js:1) — nowy
      Color Management robi to natywnie (`ColorManagement.enabled` default true).
- [ ] `outputEncoding` → `outputColorSpace`; `.encoding` → `.colorSpace` na teksturach
      canvas (cv2) — wg oficjalnego Migration Guide, **krokami po ~10 wersji**
      (r128→r138→…), smoke-test po każdym (CI + browser).
- [ ] `examples/js` nie istnieje od r148 → addony (Sky, Water, GLTFLoader, EffectComposer)
      jako ES modules przez **importmap** (bez bundlera) lub skok na Vite (decyzja!).
- [ ] Zysk: OutputPass, lepszy bloom, KTX2/Basis (tekstury ~4–6× mniejsze niż PNG!),
      Draco w standardzie, gotowość na WebGPU.

### ETAP 5 — Szlif (ciągłe)

- SSAO/GTAO tylko PC; DoF w menu; pogoda (deszcz/mgła/burza — grudy w world-007);
- cząsteczki: liście na wiatrze, iskry z piece (furnace.js już ma żar), spryski wody;
- polishing UI (HUD ma już własne ikony — dopasować styl do nowej palety);
- LUT color grading per pora dnia / biom (pustynia ciepła, tundra chłodna).

---

## 4. Zasady bezpieczeństwa wdrożenia

1. Rozdzielaj zmiany wizualne i gameplayowe; przy nowej logice zachowuj zgodność ze starszymi zapisami.
2. Po zmianie uruchamiaj `npm run check` i sprawdzaj grę przez `npm start`; testy obejmują też wybrane zachowania modułów uruchamianych w VM.
3. Nowe globalne (composer, sky, mixery…) → dopisać do `PROJECT_GLOBALS` (eslint).
4. Wersjonowanie: bump wersji przy każdym etapie (0.2.0, 0.3.0…) — CI dba o cache SW.
5. Metryka jakości: zrzuty ekranu przed/po w tym samym miejscu świata i porze dnia.

## 5. Szacunkowe nakłady pierwotnego planu

| Etap | Praca dev | Praca artystyczna | Efekt „wow" |
|---|---|---|---|
| 0 Fundament | 1–2 dni | — | — |
| 1 Post-processing+niebo | 3–5 dni | — | ★★★★★ (najlepszy stosunek) |
| 2 Świat (woda/wiatr/tekstury) | 1–2 tyg. | mała (tekstury) | ★★★★ |
| 3 Postacie+stwory | 2–4 tyg. | **duża** (10 modeli) | ★★★★★ |
| 4 Migracja three.js | 3–5 dni | — | ★★ (fundament pod dalsze) |
| 5 Szlif | ciągle | — | ★★★ |

**Kolejność dalszych prac:** domknąć kierunek wizualny i mierzyć budżet wydajności,
następnie rozwijać tekstury oraz zasoby GLTF (etapy 2–3), a migrację three.js
(r128) planować osobno po ustabilizowaniu obecnych rozwiązań.
