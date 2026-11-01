# Plan Polpal Studio

**Stan dokumentu:** 1 listopada 2026 r. (uzupełniony o P0-A, P0-D, P1-A, P3-B i próby P0-C)

**Punkt wyjścia:** Scan Studio 2.0, moduł automatycznego dopasowania v6.

**Cel:** lokalne oprogramowanie, które prowadzi pomiar, dopasowanie i kontrolę postaci przy minimalnym udziale agenta w pojedynczym przebiegu.

## 1. Na czym polega Studio

Polpal Studio jest lokalnym warsztatem do porównywania obrazu referencyjnego
postaci z modelem 3D i stopniowego zmniejszania widocznych różnic.
Łączy edytor w przeglądarce, analizę obrazów w Pythonie i wykonywanie operacji
w Blenderze. Dane, projekty oraz wyniki są przechowywane w plikach lokalnych.

Użytkownik dostarcza referencję, model bazowy i ograniczenia, np. zachowanie
zatwierdzonego podbródka. Studio ustala, co rzeczywiście widać na obrazie,
przygotowuje pomiary i kamerę, próbuje ograniczonych korekt kopii modelu,
a następnie sprawdza wynik. Jeśli dane lub dostępne korekty nie wystarczają,
zapisuje przyczynę zatrzymania.

**Obecnie automatyczne modelowanie obejmuje obrys istniejącej, osobnej,
statycznej siatki twarzy w rzucie ortograficznym.** Pozostałe moduły potrafią
zbierać obserwacje i porównywać obrazy, ale pełny automat oczu, włosów,
ciała, ubrań, materiałów i rigowania pozostaje do wykonania.

### Podział odpowiedzialności

- **Użytkownik:** wybiera referencję i bazę, określa wymagania wizualne oraz
  zatwierdzone cechy, ocenia końcowy wygląd.
- **Studio:** wykonuje powtarzalne skanowanie, obliczenia, próby korekt,
  walidację, zapis historii i diagnozę.
- **Blender:** udostępnia geometrię, tworzy osobnego kandydata, renderuje
  porównania i pozwala sprawdzić zapisany zasób.
- **Agent:** rozwija i diagnozuje oprogramowanie. Docelowo nie pisze nowego
  skryptu przesunięć wierzchołków dla każdej postaci.

### Cztery części interfejsu

| Zakładka | Zastosowanie |
| --- | --- |
| Adnotacje | Obrazy, maski, punkty, widoczne odcinki konturu, skala, region analizy i historia rewizji. |
| Kamery i 3D | Dopasowanie kamer, kontrola reprojekcji oraz pomiary wspólnych punktów z wielu ujęć. |
| Odchylenia | Porównanie masek i konturów, mapy różnic oraz zakres dostępnych danych. |
| Dopasowanie | Uruchomienie automatu, podgląd stanu, diagnoza, raporty i pliki kandydata, jeśli powstał. |

## 1a. Lokalny silnik postaci (od 1 listopada 2026 r.)

Decyzja użytkownika: Studio ma samodzielnie tworzyć postać do gry z paczki
referencyjnej (zip lub obrazy + opis), **wyłącznie lokalnie** — bez kont,
tokenów i limitów generacji. Wybrany kierunek: **silnik parametryczny**
(baza ze szkieletem i animacjami + biblioteka części sterowana receptą).
Generatory obraz→3D działają na Macu tylko jako nieoficjalne porty i wymagają
24 GB+ pamięci (M4 ma 16 GB); Hunyuan3D wyklucza UE licencyjnie.

```text
zip / obrazy + opis
   → reference_pack.py   (bezpieczne rozpakowanie, opis → kolory/style/proporcje,
                          sylwetka T-pose → proporcje, pasy ubrania w Lab)
   → recipe.json         (character_recipe.py: schemat, zakresy, pochodzenie każdej wartości)
   → engine_blender.py   (Blender w tle: części → proporcje → wysokość 1,8 →
                          22 kości mixamorig → wagi → 7 klipów → GLB → reimport)
   → engine_render.py    (rendery kontrolne: przód, ¾, bok, tył, pozy)
   → engine.py serve     (okno podglądu: model narasta etapami, klipy, paleta,
                          proporcje, uwagi; tylko 127.0.0.1)
```

**Silnik jest zakładką „05 Silnik postaci” w Scan Studio** (ten sam serwer
`studio.py serve`, przebiegi w `<projekt>/engine-runs/`); `engine.py serve`
pozostaje jako samodzielny podgląd. Budowa wymaga Blender AI Bridge
z włączonym Pythonem (ta sama zgoda co w potoku Studio).

Skanery Studio pracują dla silnika: `face_scan` na obrazie T-pose daje
rozstaw, szerokość i wysokość oczu, udział tęczówki, wysokość brwi i ust
(sekcja `face` recepty, źródło `scan`), w jednostkach „linia oczu → broda”.

**Stan po pierwszym przebiegu (paczka `girl_hero_blender_pack.zip`):**

- Paczka zawiera 5 renderów póz i opis; oba GLB to atrapy (2 i 168 trójkątów,
  bez szkieletu). `blender_import.py` z paczki jest pomijany, nigdy uruchamiany.
- Z opisu: 19 kolorów z poprawnymi przypisaniami, style części, 5 kul Pal Sphere,
  głowa 1/3, oczy 30% twarzy. Z obrazu T-pose: krok, ramiona, rozpiętość rąk,
  szerokość tułowia oraz długości kurtki, topu, brzucha, ud, skarpet i butów.
- Wynik: 11 232 trójkąty (cel z opisu 12 tys.), 22 kości, 7 klipów, wysokość 1,8,
  reimport zgodny z kontraktem; budowa < 1 s, cały przebieg z renderami kilka sekund.
- **Wygląd niezatwierdzony i daleki od referencji**: układ, kolory i długości
  ubrań się zgadzają, ale części to proste bryły z obecnego modelu gry.
- Gra nietknięta: brak podmiany modeli w `site/` (kontrakt).

**Biblioteka części v2 (1 listopada):** pasma włosów jako zwężające się rurki
z dwoma kolorami (różowa nasada, błękitny koniec), czapa z oknem na twarz,
grzywka, pasma boczne i tylne, wysoki kucyk z 14 pasm; anime-oczy osadzone na
krzywiźnie głowy (białko, tęczówka, źrenica, 2 odblaski, rzęsa z „pazurkiem”),
brwi, usta, nos; rozpięta kurtka puchowa z wałkami i bufiastymi rękawami,
futrzany kołnierz z kępkami; zaokrąglone szorty z paskiem, klamrą i kieszeniami;
skarpety z wywinięciem; buty z podeszwą, cholewką i klamrami; dwukolorowe
kule Pal Sphere z guzikiem; młot ze świecącymi panelami run. Kolory palety
konwertowane z sRGB do liniowych (wcześniej wszystko było wyprane).
Wynik: 15 308 trójkątów, 22 kości, 7 klipów, wysokość 1,8, skala normalizacji 0,99.

### Biblioteka baz rzeźbionych (1 listopada 2026 r.)

Ocena użytkownika: wynik parametryczny to „klocki”, niepodobne do referencji.
Przyczyna: skan daje liczby (kolory, proporcje, układ twarzy), a kształty
pochodziły z biblioteki prostych brył. Tej jakości nie da się osiągnąć
dopracowywaniem brył.

Rozwiązanie wdrożone: **silnik korzysta z wyrzeźbionych, wyrigowanych baz**
(pierwsza: Aiko v16, 1,66 mln trójkątów, 22 kości, 7 klipów).

- `engine.py add-base` rejestruje bazę (plik `.blend` tylko przez ścieżkę
  i sumę kontrolną — nigdy nie jest zmieniany) z miniaturą sylwetki referencji.
- Przy analizie paczki główna referencja jest porównywana z bazami
  (pokrycie sylwetki × zgodność koloru). Próg 0,90; T-pose bohaterki = 1,00,
  inne pozy tej postaci 0,35–0,42, obca postać 0,30. Wynik i kandydaci są w recepcie.
- `engine_optimize.py`: podział siatki według materiałów, budżet według
  ważności (twarz/oczy więcej), decymacja przed modyfikatorem szkieletu,
  ≤ 4 wpływy i normalizacja wag, eksport z ustawieniami v16, reimport.
- Aiko v16 → desktop **42 843** trójkąty / 2,7 MB, mobile 18 244 / 1,8 MB;
  22 kości, 7 klipów, wysokość 1,80. Oględziny EEVEE: sylwetka praktycznie
  bez różnic, twarz w desktop bez różnic, w mobile kanciaste pasma włosów;
  animacje run/hit/throw działają bez widocznych rozdarć.
- Przebieg w Studio (zakładka 05): paczka → rozpoznanie bazy → wersja do gry
  w ~24 s → podgląd Three.js r128 bez błędów → rendery EEVEE.

**Ograniczenie:** dla zupełnie nowej postaci, bez rzeźby w bibliotece, silnik
nadal tworzy wersję parametryczną. Jakość jak Aiko v16 wymaga raz wykonanej
rzeźby bazy (tak powstała v16: etapy `output/aiko-sculpt/production-v16`).

### Dalsze kroki silnika

- [ ] Budżet trójkątów parametrycznej wersji: 15,3 tys. wobec 12 tys. z opisu.
- [x] **Baza mobile w budżecie** (1 listopada): Aiko v16 → mobile **12 284**
  trójkąty / 1,41 MB (cel 12 tys., tolerancja 5%), desktop 40 022 / 2,46 MB.
  Budżet dzielony według ważności × √(widocznej powierzchni) zamiast liczby
  trójkątów — gęsty kołnierz nie zabiera już budżetu plecakowi i butom.
  Przed decymacją silnik mierzy (bez zmiany siatki), do ilu trójkątów każda część
  realnie da się zredukować (otwarte rurki szwów kurtki: 1 982, pierścienie kul: 456),
  i dzieli resztę budżetu między pozostałe części („water-filling”). Części z wielu
  wysepek: włókna kołnierza tracą równomiernie rozłożone pasma (min. 1/3),
  okucia i ściegi — najpierw najmniejsze wysepki (min. 1/2). Oględziny EEVEE:
  plecak, buty i kurtka zachowane, twarz bez różnic, włosy nieco rzadsze;
  run/hit/throw bez rozdarć. Pozostaje: rurki szwów zajmują 16% budżetu mobile —
  kandydat do zastąpienia teksturą/normal mapą.
- [x] **Warianty z bazy** (1 listopada): nowi bohaterowie na jakości v16 bez
  nowej rzeźby. `engine_profile.py` czyta materiały bazy (kolor materiału,
  kolor wierzchołków, gradient, tekstury); mapa materiał → slot palety po całych
  słowach nazw; przekolorowanie zachowuje cieniowanie (nowy kolor × jasność bazy),
  gradient włosów nasada → końcówki, tekstury tęczówek, połysk włosów; usuwanie
  młota, futrzanego kołnierza i kul razem z ich drobnymi okuciami. Panel
  „Wariant z rzeźby” w zakładce 05 (kolory, części, jakość, „Zbuduj wariant”).
  Próby: „Mira” (fiolet/złoto, czerwona kurtka) i „Kiko” (czarne/różowe włosy,
  żółta kurtka, bez młota) — ok. 40 tys. trójkątów, 22 kości, 7 klipów.
- [x] **Skóra w wariantach** (1 listopada): wszystkie materiały skóry (ciało,
  tekstura twarzy z piegami, szyja, kolana, rumieniec uszu, fałd powieki) dostają
  to samo przesunięcie kanałów: nowy kolor ÷ rzeczywisty kolor największego
  materiału skóry. Ciało ma dokładnie wybrany kolor, piegi i rumieniec zachowują
  relację do skóry. Próba „Nadia” (skóra #8D5A3B, czarno-fioletowe włosy, żółta
  kurtka, mobile) — 12,3 tys. trójkątów, oczy i piegi bez uszkodzeń.
  Regiony baz liczone są przy każdym odczycie z `profile.json`, więc nowe reguły
  nie wymagają ponownej rejestracji bazy.
- [x] **Pomiar wydajności w podglądzie**: trójkąty, wywołania rysowania,
  materiały/tekstury, kości, rozmiar pliku, czas wczytania, FPS i ocena budżetu
  (mobile/desktop). Podgląd zwalnia pamięć GPU poprzedniego modelu (wcześniej
  każda zmiana modelu dokładała ok. 40 tekstur).
- [ ] Wywołania rysowania: model ma 36 materiałów → 37 wywołań i (w loaderze
  three.js r128) osobna tekstura kości na każdy prymityw. Dla telefonów warto
  złączyć materiały w atlas i współdzielić szkielet — dotyczy też ładowania
  w grze, więc wymaga decyzji o integracji.
- [x] **Nos bohaterki** (1 listopada, zatwierdzone przez użytkownika: 10 mm).
  Rzeźba v16 nie miała nosa (gładki profil twarzy). Na kopii bazy
  `output/aiko-sculpt/production-v16-nose/aiko-v16-nose-10mm.blend` dodano mały
  nos w stylu referencji: wierzchołek 60% drogi od środka oczu do ust (z = 1,166),
  szerokość ~14% rozstawu oczu, delikatny grzbiet, stromszy spód. Lokalne
  zagęszczenie siatki (180 ścian, interpolacja UV, kolorów i wag), przesunięte
  tylko wierzchołki skóry twarzy niewspółdzielone z innymi częściami. Skrypty:
  `nose_candidate.py`, `render_face.py` obok pliku. Oryginał v16 bez zmian
  (suma kontrolna przed i po). W optymalizatorze twarz ma priorytet 5 (wcześniej 3)
  — przy 40 tys. trójkątów skóra twarzy ma 4,2 tys. zamiast 2,7 tys.; bez tego
  nos wygładzał się w wersji do gry. Baza `aiko-v16-nose` zastąpiła `aiko-v16`
  (stara przeniesiona do `bases/_retired/`); bohaterka zbudowana w Studio:
  40 038 trójkątów, 22 kości, 7 klipów, nos widoczny w podglądzie Three.js.
- [x] **Bohaterka w grze** (1 listopada, decyzja użytkownika: „podmień teraz”).
  Wariant „Ajko” w grze (`site/assets/models/hero-aiko.glb`) to teraz rzeźba
  z Polpal Studio zamiast bryłowej wersji. Po uwadze „ręce w boki, mają być w dół”
  baza `aiko-v16-hero` ma ramiona opuszczone o 27° w idle/walk/run/swim/jump
  (`arms_down.py`; klucze obracane wokół osi przód–tył, ruch klipów zachowany).
  Pakiety chodu i walki wygenerowane na nowo pod szkielet v16: generator mierzy
  kostkę (0,166) i długość nogi (0,482 → krok ×1,07), ramiona startują z pozy
  idle; młot to zamach znad głowy i cios w dół (ręka 0,52 m, 0,26 m od głowy).
  Telefon ładuje ten sam pełny model (bez `hero-aiko-mobile.glb`). Sprawdzone
  w grze lokalnie: loader przyjmuje model i oba pakiety, ekran tworzenia postaci,
  chód/bieg i `hammer_hit` prawą ręką; pozy obejrzane w three.js r128.
  Wdrożenie produkcyjne następuje dopiero po scaleniu do `main`.
- [ ] Wymiana części na inne kształty (np. inna fryzura, płaszcz zamiast kurtki)
  — potrzebna biblioteka rzeźbionych części zgodnych ze szkieletem.
- [ ] Półautomatyczny warsztat rzeźby nowej bazy w Studio (etapy jak przy v16).
- [ ] Dalsza jakość części: włosy jako karty z teksturą zamiast rurek, pikowanie
  kurtki szwami, kształt dłoni, ciało pod ubraniem (szyja, ramiona), uszy.
- [x] Twarz z obrazu ze skanerów Studio (`face_scan`).
- [ ] Kości kucyka (3) — wymaga rozszerzenia kontraktu gry (dziś dokładnie 22 kości).
- [ ] Pozy z obrazów (bieg, atak, rzut) jako wzorzec do strojenia klipów;
  porównanie sylwetek pozy z referencją.
- [ ] Tekstury zamiast samych kolorów (wariant mobilny bazy jest już w budżecie).
- [ ] Edycja recepty w oknie (suwaki, kolory) z ponowną budową — punkt
  `/api/runs/<id>/build` już przyjmuje poprawioną receptę.
- [ ] Porównanie renderu frontu z referencją (sylwetka) jako automatyczna miara
  podobieństwa i pętla dopasowania proporcji.

## 2. Jak działa aktualny automat

```text
Referencja + zapisany model bazowy + ograniczenia
                       ↓
Niezmienny snapshot geometrii i identyfikacja źródeł
                       ↓
Skan obrazu i ocena wiarygodności widocznych granic
                       ↓
Dopasowanie kamery i sprawdzenie pokrycia danych
                       ↓
Generowanie dopuszczalnych kontrolek deformacji
                       ↓
Próby korekt → pomiar → przyjęcie lub odrzucenie
                       ↓
Osobny kandydat w Blenderze, jeśli uzyskano dopuszczalny wynik
                       ↓
Rendery przed/po → niezależny pomiar → ponowne otwarcie pliku
                       ↓
Raport techniczny, diagnoza i ocena wizualna
```

Przebieg może zatrzymać się wcześniej. Wówczas raport nie powinien sugerować,
że wykonano późniejsze etapy, np. render albo eksport.

### Ważne pojęcia

- **Snapshot:** zapis geometrii i jej atrybutów, od którego zaczyna się zadanie.
- **Kontrolka:** ograniczony kierunek deformacji, np. przesunięcie fragmentu
  żuchwy; nie jest kością animacyjną.
- **Ochrona:** twarda blokada wskazanych wierzchołków lub elementów źródła.
- **Kandydat:** osobna wersja do sprawdzenia, nie automatycznie zatwierdzony model.
- **p95 błędu:** wartość, której nie przekracza 95% zmierzonych odchyleń konturu.
  Nie oznacza procentu podobieństwa postaci.
- **Hipoteza detektora:** proponowana interpretacja granicy obrazu, wymagająca
  odróżnienia od potwierdzonej tożsamości anatomicznej.

### Ograniczenia pomiaru

Pełne wyznaczenie pozy kamery wymaga co najmniej sześciu odpowiednich,
niekoplanarnych par punktów 3D/2D. W aktualnym przebiegu Aiko używane są obie
tęczówki i broda: orientacja pochodzi z modelu bazowego, a automat dopasowuje
skalę i przesunięcie. Nie jest to odzyskanie pełnej kamery z trzech punktów.

Pojedynczy front nie ustala głębokości, tyłu głowy ani anatomii pod włosami.
Te obszary pozostają założeniem bazy lub wymagają dodatkowych referencji.
Render własnego modelu nie staje się kolejnym niezależnym źródłem danych.

## 3. Co już działa

| Obszar | Stan na v6 |
| --- | --- |
| Projekt i edytor | Lokalne pliki, rewizje, maski, punkty, kontury i przywracanie historii. |
| Analiza referencji | Skan twarzy, oczu, brwi, sylwetki oraz hipotezy włosów i części stroju. Część reguł jest dostosowana do palety i proporcji Aiko. |
| Lokalne AI | Opcjonalne propozycje segmentacji BiSeNet ONNX na CPU; nie stanowią automatycznie zatwierdzonej maski. |
| Kamery i pomiary | Kalibracja, reprojekcja, triangulacja przy odpowiednich danych oraz jawne jednostki i niepewność. |
| Dopasowanie obrysu | Automatyczne kontrolki, limity ruchu, twarde blokady, kontrola orientacji trójkątów i regresji regionów. |
| Niepełny kontur | Korekta wspartych fragmentów, zamrożenie pozostałych, zachowanie luk i kontrola ruchu nieobserwowanego obrysu. |
| Wiarygodność granic | Odrzucanie podejrzanych przejść przy włosach, słabym kontraście i cieniach; v6 dodaje kontekst broda–szyja. |
| Diagnoza | Powody odrzucenia próbek i prób korekty, brakujące regiony, zablokowane kontrolki oraz ich dostępny ruch. |
| Worker Blendera | Trwałe zapisy stanów zadania, blokada równoległego wykonania dla projektu, osobne procesy, snapshot, render, zapis i ponowny odczyt. |
| Pakiet i przegląd wyników | Wersjonowane katalogi wydań, sumy kontrolne, raporty oraz nakładki dostępne z UI. |

Automat nie wznawia jeszcze obliczeń od dowolnego przerwanego etapu.
Restart zachowuje artefakty i oznacza niedokończone zadanie jako przerwane.
Aktualny worker nie obsługuje połączonego finalnego modelu z rigiem,
shape keys i aktywnymi modyfikatorami.

## 4. Rzeczywisty wynik v6 i obecna blokada

### Weryfikacja oprogramowania

- 143 testy Pythona i kontrola składni JavaScript zakończone powodzeniem.
- Pełny, chroniony i częściowy przebieg sprawdzony w Blenderze 5.2.2 LTS
  na geometrii laboratoryjnej, łącznie z ponownym otwarciem kandydata.
- W osobnym zbiorze 28 przykładów proceduralnych: 8 poprawnie przyjętych
  granic, 16 poprawnych odrzuceń, 0 błędnych przyjęć i 4 błędne odrzucenia.
- Czułość wyniosła 66,7%, wobec 33,3% bez analizy kontekstu. Wszystkie cztery
  płaskie brody zostały pominięte.

To ocena na znanych maskach i rejestracji. Skuteczność semantyczna na niezależnie
opisanych rzeczywistych obrazach pozostaje niezmierzona.

### Aiko — przebieg `716bc5786c78`

| Pomiar / stan | Wynik |
| --- | --- |
| Status | `stalled` na etapie dopasowania; 0 zaakceptowanych kroków. |
| Broda | 106 próbek przyjętych jako kandydat styku broda–szyja. |
| Żuchwa | 19 próbek po lewej i 35 po prawej stronie obrazu. |
| Policzki | Oba pozostają `unknown`. |
| Kamera | RMS 2,174 px, przy orientacji przejętej z bazy. |
| Ochrona | 4993 źródłowe blokady brody, łącznie 25042 zamrożone wierzchołki. |
| Lewa kontrolka żuchwy | 0 ruchomych wierzchołków. |
| Prawa kontrolka żuchwy | 73 ruchome wierzchołki; maksymalnie 0,402 px ruchu na jednostkę parametru. |
| Pozostałe p95 | Lewa żuchwa 36,5 px; prawa 14,8 px; broda 10,5 px, przy celu około 2,468 px. |
| Nowy model | Brak nowego kandydata i nowych renderów Blendera z tego przebiegu. |

**V6 poprawiło rozpoznawanie i diagnozę, ale nie poprawiło kształtu Aiko.**
Powyższe błędy obrysu pochodzą z rasteryzatora dopasowania. Wynik ma identyczne
współrzędne jak snapshot. Zatwierdzona szersza broda, grubsze brwi z uniesionymi
zewnętrznymi końcami oraz wcześniejsze zasoby zostały zachowane.

Głównym problemem jest teraz połączenie niepewnych danych policzków z bardzo
ograniczonym ruchem istniejących kontrolek. Samo dodanie iteracji nie rozwiązuje
tego problemu. Nie ma też podstaw, aby przypisać cały błąd wyłącznie geometrii:
wpływ mogą mieć kamera i interpretacja granic.

## 5. Plan pozostałych prac

Priorytety oznaczają kolejność zależności: **P0** — najbliższa blokada,
**P1** — wiarygodny automat twarzy, **P2** — rozszerzenie na postać,
**P3** — końcowy zasób i utrzymanie produktu. Poniższe zadania są otwarte.

### P0-A. Ustalić, co faktycznie blokuje korektę Aiko

- [x] Dodać nakładkę pokazującą osobno: ochronę użytkownika, zamrożenie przez
  brak danych, wygaszanie (na końcach fragmentów i przy blokadach) i efektywny
  wpływ kontrolek — `control_reach.py`, plik `control-reach.png` w każdym przebiegu.
- [x] Sprawdzić, które wierzchołki rzeczywiście tworzą mierzony obrys oraz
  czy dostępne kontrolki mogą poruszyć właśnie ten brzeg — raport
  `control_reach` w `autopilot-report.json`.
- [x] Rozdzielić wkład kamery, niepewności referencji i zakresu deformacji
  poprzez kontrolowane eksperymenty z zachowanymi źródłami —
  `probes/p0a-camera-separation-2026-11-01/` (wynik poniżej).
- [ ] Sprawdzić uogólnione sposoby budowania kontrolek dla krótkich fragmentów,
  z uwzględnieniem sąsiedztwa siatki i łagodnego przejścia do blokad.
- [x] Przy braku dopuszczalnej korekty podać konkretny brak danych lub konflikt
  wymagań, zamiast ponawiać tę samą optymalizację — nowa akcja
  `resolve_protection_conflict` oraz ustalenia `outline_locked_by_protection`,
  `reach_below_observed_error`, `step_below_raster_resolution`.

#### Wynik P0-A dla przebiegu `716bc5786c78` (1 listopada 2026 r.)

Sonda tylko do odczytu:
`output/character-scan/aiko-pipeline-v2/probes/p0a-control-reach-2026-11-01/`.

| Region | Wierzchołki obrysu | Chronione przez użytkownika | Zasięg kontrolek | Średni błąd |
| --- | --- | --- | --- | --- |
| Lewa żuchwa | 128 | 128 (100%) | 0 px | 29,0 px |
| Broda | 1104 | 1104 (100%) | 0 px | 6,2 px |
| Prawa żuchwa | 188 | 166 (88%); 11 zamrożonych z braku wsparcia, 11 wytłumionych | 0,40 px | 7,5 px |

- **Dlaczego lewa kontrolka nie działa:** manifest ochrony nie chroni samej
  brody, lecz cały pas obrazu `pixel[1] >= 870` na pełnej szerokości twarzy.
  Obserwowane fragmenty lewej żuchwy leżą w wierszach 880–904, więc każdy
  wierzchołek tworzący ten obrys jest zablokowany. To konflikt wymagań, nie błąd
  algorytmu ani brak danych.
- **Co ogranicza prawą:** wolne są tylko wiersze 863–869 nad pasem. Pozostałe
  wierzchołki leżą w odległości mniejszej niż wygaszanie (~5,9 mm) od blokad,
  więc pełny zakres kontrolki daje 0,40 px. Pierwszy krok (0,5) przesuwa brzeg
  o 0,2 px; rasteryzator zaokrągla rzut do pikseli, więc sylwetka się nie
  zmienia. 27 z 28 prób kończy się „brakiem poprawy”, a krok maleje do limitu.
- **Broda** w trybie częściowym nie ma żadnej kontrolki, a jej obrys i tak jest
  w pełni chroniony.
- **Kierunek rozbieżności:** punkty referencji leżą wewnątrz sylwetki modelu —
  referencja ma węższą i wyżej położoną żuchwę oraz brodę niż model. Zatwierdzona
  „szersza broda” jest więc wprost sprzeczna z obserwowanym obrysem w tym ujęciu
  (przy obecnej kamerze; wkład kamery pozostaje nierozdzielony).

#### Rozdzielenie wkładu kamery — `probes/p0a-camera-separation-2026-11-01/`

Siatka bez deformacji, zmieniana tylko kamera ortograficzna:

| Kamera | Lewa żuchwa | Prawa żuchwa | Broda | Punkty oczu/brody |
| --- | --- | --- | --- | --- |
| Obecna (oczy + broda) | 29,0 px | 7,5 px | 6,2 px | ≤ 1,1 σ |
| Oś symetrii twarzy (+6,4 px) | 22,3 px | 10,7 px | 6,3 px | do 8 px |
| +12 px, skala 0,96 | 2,5 px | 5,5 px | 1,4 px | do 8,4 σ |

- Siatka twarzy jest symetryczna względem x = 0 mm, ale środek tęczówek modelu
  (`Iris L` −76,4 mm, `Iris R` +90,5 mm) leży na x = +7,0 mm. W referencji oczy
  leżą na osi twarzy.
- Kamera dopasowana do oczu przenosi tę asymetrię na przesunięcie twarzy
  o ~6,4 px; dolna część twarzy jest też ~4% większa względem rozstawu oczu.
- **Większość błędu żuchwy wynika z położenia oczu i proporcji oczy–żuchwa
  w modelu, a nie z kształtu żuchwy.** Bez ruszania siatki obrys pasuje do
  ~2–6 px, jeśli te dwie różnice usunąć. Czy asymetria oczu jest zamierzona —
  decyzja użytkownika (P2-A).

**Decyzja użytkownika (1 listopada 2026 r.): zawęzić ochronę.** Nowy manifest
`protection-aiko-v17-chin-center.json` jest podzbiorem v16 (3020 z 4993
wierzchołków): chroni środek brody, |x − oś| ≤ 0,30 × rozstaw oczu (~49 px).
Zostaje zablokowane 1062 z 1104 wierzchołków obrysu brody, a obrys obu boków
żuchwy jest wolny. Plik v16 pozostaje bez zmian, a projekt Studio nadal jest
powiązany z v16; przełączenie wymaga `bind-blender --protection` przy
zatrzymanym serwerze projektu.

#### Próba z ochroną v17 — `probes/p0a-v17-narrowed-protection-2026-11-01/`

Ten sam snapshot, skan i kamera co `716bc5786c78`; tylko ochrona v17.

| Region | p95 przed → po | Średnio przed → po | Zasięg kontrolki |
| --- | --- | --- | --- |
| Lewa żuchwa | 36,5 → 35,5 px | 29,0 → 27,8 px | 3,4 px |
| Prawa żuchwa | 14,8 → 13,5 px | 7,5 → **7,9** px | 10,5 px |
| Broda | 10,5 → 10,5 px | 6,2 → 6,2 px | 0,05 px (chroniona) |

- Kontrolki ruszyły: 5 przyjętych kroków, obie na granicy zakresu (−0,98 i −1).
- Status `rejected`: brama końcowa wykryła wzrost błędu średniego prawej żuchwy.
  Kandydat nie powstał i nie trafia do Blendera.
- **Następna blokada to ekspresja kontrolek, nie ochrona.** Na prawej żuchwie
  referencja wymaga poszerzenia górnych wierszy (863–866, model węższy o ~10 px)
  i zwężenia dolnych (890–902, szerszy o 8–16 px). Jedna kontrolka boczna na
  stronę może tylko przesunąć cały bok, więc poprawia dół kosztem wierszy
  878–884 (1,5 → 10 px). Po lewej zasięg 3,4 px wobec błędu 29 px.
- Wniosek: P0-C wymaga najpierw P0-D — kilku lokalnych kontrolek wzdłuż żuchwy
  oraz zakresu dobranego do mierzonego błędu.

**Kryterium ukończenia:** raport wskazuje, dlaczego lewa kontrolka nie działa
i co ogranicza prawą. Ewentualna zmiana algorytmu działa również na oddzielnych
przypadkach testowych i respektuje ochronę zatwierdzonej geometrii.

### P0-D. Naprawić ograniczenia wyszukiwania wykryte przy P0-A

Wynikają z kodu i dotyczą każdego modelu, nie tylko Aiko.

- [ ] **Rozdzielczość rastra:** `render_silhouette` zaokrągla rzut do pełnych
  pikseli, więc kroki poniżej ~0,5 px są niewidoczne dla celu. Dodać
  rasteryzację z nadpróbkowaniem lub pomiar brzegu z dokładnością podpikselową.
  Po zmianie skali kontrolek przestało to blokować Aiko, ale nadal ogranicza
  dokładność końcowych kroków.
- [x] **Skala kontrolek:** w układzie lokalnym jednostka oznacza znany ruch brzegu
  (`edge_px_per_unit`) = 1,25 × błąd zmierzony w paśmie, w zakresie
  `sep·fraction`…`sep·0,25`; żaden wierzchołek nie przekracza `sep·0,25`.
- [x] **Podwójne tłumienie w trybie częściowym:** w układzie lokalnym wygaszanie
  przy blokadach dotyczy tylko ochrony użytkownika; końce fragmentu wygasza
  raz samo pasmo.
- [x] **Akceptacja (sprawdzone, bez zmiany):** tolerancja regresji regionu
  0 / 0,5 / 1 / 2 px daje na Aiko identyczny wynik — odrzucenia nie są szumem
  rastra, lecz rzeczywistym pogorszeniem sąsiedniego regionu. Zostaje 0.
- [ ] **Wspólne przesunięcie boków:** kontrolki są wyłącznie poprzeczne i osobne
  dla stron; przesunięcie osi (kamera, `axis_x_px`) nie jest korygowane.
  Dodać kontrolkę translacji poziomej albo jawnie przypisać ją kamerze.
  Aiko: w wierszu 899 model wystaje poza referencję o 34 px po lewej i 14,5 px
  po prawej, przy niemal symetrycznej referencji (46 i 51 px od osi) — wskazuje
  to na przesunięcie poziome ~10 px między modelem a referencją (kamera z 3 punktów).
- [ ] **Broda w trybie częściowym:** brak kontrolki mimo pomiaru regionu
  (dla Aiko obojętne, dopóki środek brody jest chroniony).
- [x] **Lokalne kontrolki wzdłuż żuchwy:** `local_controls()` w `autopilot.py`,
  domyślne w trybie częściowym (`control_layout: 'local'`; stary układ:
  `'regional'`). Każdy fragment dostaje pasma co `max(2·taper, sep·0,06)` px,
  tworzące podział jedności w wierszach; waga boczna liczona względem brzegu
  sylwetki w danym wierszu, liniowo od 0,15 do 1 półszerokości.
- [x] **Załamania na zamrożonych przerwach** (decyzja użytkownika: interpolować
  krótkie przerwy). `bridge_gaps()` łączy fragmenty jednej strony oddalone
  o nie więcej niż `bridge_gap_px` (domyślnie odstęp pasm, Aiko ~11,5 px;
  `0` wyłącza). Wiersze przerwy są zapisane w `coverage.interpolated_gaps_px`
  i ustaleniu `interpolated_gaps`; nigdy nie są mierzone ani oceniane.
  Dłuższe przerwy pozostają zamrożone.
- [x] **Ścinanie brzegu:** zmiana przesunięcia brzegu między sąsiednimi wierszami
  jest ograniczona do `max_edge_shear_px_per_row` (domyślnie 1 px/wiersz,
  minimum 1); próby, które ją przekraczają, są odrzucane (`edge_shear`).
  Usuwa schodki na zewnętrznych końcach obserwowanych odcinków, gdzie ruchomy
  brzeg spotyka nieobserwowany. Wynik zapisuje `report.edge_shear`.

#### Wynik P0-D dla Aiko — `probes/p0d-final-bridged-v17-2026-11-01/`

Ochrona v17, ten sam snapshot, skan i kamera co `716bc5786c78`; 7 pasm,
przerwy 884–891 (lewa) i 867–875 (prawa) interpolowane, limit 1 px/wiersz.

| Region | p95 przed → po | Średnio przed → po |
| --- | --- | --- |
| Prawa żuchwa | 14,8 → **11,5** px | 7,5 → **5,0** px |
| Lewa żuchwa | 36,5 → 34,5 px | 29,0 → 27,2 px |
| Broda (chroniona) | 10,5 → 10,5 px | 6,2 → 6,2 px |

Porównanie wariantów na tych samych danych (średni błąd prawa / lewa żuchwa):

| Wariant | Prawa | Lewa | Sylwetka |
| --- | --- | --- | --- |
| Pasma bez interpolacji | 4,6 px | 26,1 px | schodki na przerwach |
| Interpolacja, bez limitu | 3,8 px | 24,1 px | schodki na końcach odcinków |
| Interpolacja, 2 px/wiersz | 3,9 px | 23,9 px | hak u góry prawej żuchwy |
| **Interpolacja, 1 px/wiersz (domyślnie)** | 5,0 px | 27,2 px | bez nowych schodków |

- Wybrano wariant bez nowych załamań kosztem ~1 px średniego błędu prawej strony.
  Drobny uskok lewego brzegu ok. wiersza 887 istniał w modelu przed korektą.
- Lewa żuchwa: w wierszach 899–903 obrys referencji (x 542–556) leży wewnątrz
  chronionego środka brody v17 (x ≥ 538); wyżej brzeg musiałby wejść ~30 px
  w pas ~35 px przed blokadą, co składa siatkę. Ograniczenie wynika z ochrony
  i prawdopodobnego przesunięcia kamery, nie z liczby pasm.
- Sylwetka 2D bez nowych schodków; **ocena 3D (front, boki, tył, ¾) w Blenderze
  nie była jeszcze wykonana** — to warunek P0-C przed jakimkolwiek importem.

**Kryterium ukończenia:** na przypadkach testowych z odblokowanym obrysem
pierwszy krok zmienia mierzony brzeg, a raport `control_reach` nie zgłasza
`step_below_raster_resolution` dla kontrolek o zasięgu powyżej 1 px; wynik
nie zawiera załamań na granicach fragmentów.

### P0-B. Zweryfikować granice na rzeczywistych referencjach

- [ ] Przygotować niezależnie opisany zbiór stylizowanych twarzy: widoczny
  kontur, włosy, cień, kołnierz, szyja, płaska i zaokrąglona broda.
- [ ] Oznaczać również niejednoznaczne i niewidoczne regiony; nie wymuszać
  rozstrzygnięcia tam, gdzie obraz go nie dostarcza.
- [ ] Rozdzielić dane rozwojowe i nowy zbiór końcowej oceny przed strojeniem.
- [ ] Mierzyć błędne przyjęcia i odrzucenia, błąd położenia granicy oraz
  pokrycie regionów, osobno dla klas problemów.
- [ ] Przed oceną końcową zapisać wymagane progi jakości: maksymalny poziom
  błędnych przyjęć i błędu położenia oraz minimalną czułość dla obsługiwanych
  klas. Wartości ustalić na danych rozwojowych i wymaganiach dopasowania.
- [ ] Rozwinąć obsługę płaskiej brody i rzeczywistych brzegów przy włosach
  bez globalnego poluzowania wszystkich progów.
- [ ] Dla Aiko ustalić, czy istnieją dodatkowe rzeczywiście widoczne fragmenty;
  jeśli nie, zachować brak danych lub pozyskać dodatkowe ujęcie.

**Kryterium ukończenia:** nowa wersja spełnia wcześniej zapisane progi na
zamrożonym, niewykorzystanym wcześniej zbiorze. Samo wykonanie pomiaru nie
zalicza etapu; przy niespełnieniu progów zapisujemy ograniczenie. Proceduralny
wynik v6 pozostaje historycznym punktem odniesienia,
a nie zbiorem do dalszego dostrajania. Adnotacja zewnętrzna zachowuje swoje pochodzenie.

### P0-C. Uzyskać pierwszą wykazaną poprawę kształtu

#### Próby P0-C (1 listopada 2026 r.) — **kryterium niespełnione**

Kandydaci w Blenderze 5.2.2 z workera Studio, ponowne otwarcie zweryfikowane
(błąd 0,0001 mm, 23 428 chronionych wierzchołków bez zmian, UV/materiały/grupy
zachowane), oględziny z 8 ujęć tym samym aparatem i światłem.

| Próba | Żuchwa P / L (średnio) | Powierzchnia (liczbowo) | Oględziny |
| --- | --- | --- | --- |
| `p0c-blender-candidate-2026-11-01` (bez kontroli powierzchni w wyszukiwaniu) | 5,6 / 26,6 px | pass przy progach 25°/20° | **fałdy i półka u dołu żuchwy** |
| `p0c-blender-candidate-v2-2026-11-01` (rampa C1, laplasjan, zgięcie ≤ 10°) | 6,3 / 26,8 px | obrót 10,4°, zgięcie 9,5°, pole 0,62–1,24 | **słabe poziome pasy w cieniowaniu** (bok, ¾) |

Przyczyna: obserwowane odcinki żuchwy mają 4–29 wierszy, a wiersze powyżej
i poniżej muszą pozostać nieruchome. Zmiana o kilka pikseli mieści się w 2–3
rzędach siatki (~4,6 mm), co zawsze zostawia ślad w cieniowaniu. Dalsze
dokręcanie progów daje zerową korektę albo pasy.

**Decyzja wymagana:** (a) poprawić położenie oczu / proporcje oczy–żuchwa
(wg P0-A to główna przyczyna rozbieżności), (b) dopuścić łagodne wygaszanie
ruchu w wiersze nieobserwowane, oznaczone jako interpolacja, albo (c) uznać,
że z jednego ujęcia ta korekta Aiko nie jest dostępna, i przejść do kolejnych baz.

Zależność: wyniki P0-A i P0-B muszą wskazać dopuszczalną zmianę.

- [ ] Uruchomić nowy przebieg na osobnym kandydacie z niezmiennymi źródłami.
- [ ] Porównać błędy każdego wspieranego regionu, zamiast tylko średniej twarzy.
- [ ] Wykonać porównywalne rendery przed/po oraz zbliżenia granic korekty.
- [ ] Obejrzeć front, oba boki, tył i ¾ pod kątem nowych wad powierzchni.
  Ujęcia bez referencji sprawdzają jakość geometrii, nie jej zgodność ze źródłem.
- [ ] Potwierdzić ochronę brody i brwi oraz poprawny ponowny odczyt pliku.

**Kryterium ukończenia:** widoczna, udokumentowana poprawa wspartych obszarów
bez nowych szczelin, załamań i zapadnięć. Brak danych nadal daje wynik częściowy.
Jeżeli korekta jest nieosiągalna przy wymaganiach, zapisać blokadę i wymagane
wejście — nie oznaczać etapu jako osiągniętej poprawy.

### P1-A. Rozszerzyć kontrolę jakości powierzchni

- [x] Dodać kontrolę samoprzecięć, gwałtownych zmian normalnych, lokalnego
  rozciągania i nowych zgięć — `surface_quality.py`. Wady obecne w źródle nie
  są liczone. Obrót normalnych, zgięcia i rozciąganie są sprawdzane w każdej
  próbie wyszukiwania (`surface_limits`, odrzucenie `surface_quality`);
  samoprzecięcia raz po dopasowaniu.
- [x] Regularizacja deformacji: rampa boczna C1 i wygładzanie laplasjanem pola
  przesunięć wewnątrz wsparcia pasma (bez przenoszenia ruchu na drugą stronę
  osi ani do wierszy nieobserwowanych).
- [ ] Dodać stały zestaw neutralnych ujęć kontrolnych i czytelne porównanie
  przed/po do Studio. Prototyp: skrypt oględzin użyty w P0-C (przód, boki, tył,
  oba ¾, żuchwa od dołu, ten sam aparat i światło, plik bez zapisu).
- [x] Rozdzielić statusy: `outline_status`, `quality_status`, `likeness_approved`.
  Nieudana kontrola powierzchni zmienia status kandydata na `rejected`
  (`stop_reason: surface_quality`).
- **Progi** (`LIMITS`: obrót 25°, zgięcie 10°, pole 0,5–2,0) są wstępne.
  Próba P0-C pokazała, że przejście progów nie gwarantuje braku widocznych
  pasów w cieniowaniu — progi trzeba skalibrować na oględzinach.

**Kryterium ukończenia:** znane wadliwe deformacje są wykrywane lub odrzucane,
a poprawne przypadki zachowują atrybuty siatki. Test orientacji trójkątów
nie jest jedyną kontrolą jakości.

### P1-B. Włączyć wiele referencji do automatycznego przebiegu

- [ ] Połączyć istniejące narzędzia kamer, triangulacji i wielowidokowego
  dopasowania z workerem automatycznym.
- [ ] Obsługiwać zgodne obserwacje frontu, profilu i ¾ oraz sprzeczności między nimi.
- [ ] Przekazywać niepewność kamery i skali do decyzji o dopuszczalnej korekcie.
- [ ] Wprowadzić kontrolki głębokości dopiero przy danych, które je wspierają,
  albo jawnie oznaczonym założeniu modelarskim.

**Kryterium ukończenia:** poprawa jednego ujęcia nie ukrywa regresji innego;
pomiary 3D mają jawne źródła i ograniczenia. Aiko wymaga dodatkowej referencji,
aby oceniać zgodność głębokości z zamierzoną postacią.

### P1-C. Uogólnić współpracę z modelem bazowym

- [ ] Zbudować profil części: twarz, oczy, brwi, włosy, ciało, strój i wyposażenie.
- [ ] Zastąpić zależność od konkretnych nazw Aiko jawnymi rolami i markerami;
  niejednoznaczne przypisania kierować do jednorazowej konfiguracji.
- [ ] Rozszerzyć manifest ochrony na części i zatwierdzone cechy, z kontrolą
  zgodności po zmianie źródła lub topologii.
- [ ] Zaprojektować kontrolowane przeniesienie dopasowania ze studium statycznego
  do zasobu produkcyjnego z rigiem, UV, wagami i shape keys.

**Kryterium ukończenia:** kolejny zgodny model można skonfigurować bez nowego
skryptu dla jego nazw obiektów; przeniesienie korekty zachowuje wymagane atrybuty.
Do tego czasu źródłem Aiko pozostaje etap przed rigowaniem.

### P2-A. Automatyzacja rysów twarzy

#### Ręczna korekta oczu Aiko (decyzja użytkownika, 1 listopada 2026 r.)

Szczegóły: `output/character-scan/aiko-pipeline-v2/probes/p2a-eyes-2026-11-01/README.md`.

- Przyczyna z P0-A potwierdzona w Blenderze: otwory oczu w siatce i całe zespoły
  oczu były przesunięte o ~4,5 mm w +X, a spojrzenie było nierówne (10 / 5 mm).
- **Kandydat C3** (`eyes-C3.blend`): całe oczy przesunięte sztywnie (−4,55 mm
  i rozsunięcie 3 mm na oko), otwory w siatce razem z nimi, spojrzenie bez zmian.
  Punkty oczu i brody zgadzają się z kamerą do 0,71 px (było 2,17 px), a obrys
  bez żadnej deformacji żuchwy: 29,0 / 7,5 / 6,2 → **17,8 / 6,1 / 3,4 px**.
  Kontrola powierzchni i oględziny bez nowych wad. **Wygląd niezatwierdzony.**
- Odrzucone: wyrównanie spojrzenia przesunięciem tęczówek (prawa tęczówka
  chowa się za zakrzywioną twardówką — wymagałoby obrotu wokół środka gałki)
  oraz dodatkowa korekta żuchwy na C3 (słabe pasy w cieniowaniu, jak w P0-C).
- To ręczna, jednorazowa edycja. Automatyczne kontrolki oczu z tego punktu
  pozostają otwarte; skrypt edycji jest w katalogu próby jako punkt wyjścia.

- [ ] Dodać osobne kontrolki rozmiaru i położenia oczu, powiek, tęczówek,
  źrenic oraz widocznych fragmentów brwi.
- [ ] Usprawnić odróżnianie bliku od brakującej części maski tęczówki.
- [ ] Rozwinąć rozpoznawanie nosa, ust i uszu poza kandydatami plam kontrastu.
- [ ] Połączyć ocenę odstępów, kształtów i proporcji z kontrolą kolizji części.
- [ ] Zachować zatwierdzoną grubość i uniesienie końców brwi Aiko.

**Kryterium ukończenia:** poprawa rysów jest widoczna w porównywalnym renderze,
a nie tylko w pomiarze prostokątów masek. Niewidoczne części nie dostają
pozornej dokładności pomiarowej.

### P2-B. Włosy, sylwetka, strój i wyposażenie

- [ ] Włosy: obwiednia fryzury, grzywka, główne pasma, kucyk oraz relacja
  do twarzy; później szczegóły i przejścia kolorystyczne.
- [ ] Ciało: proporcje i sylwetka w zgodnej pozie, z oddzieleniem anatomii
  od obrysu ubrania.
- [ ] Strój: osobne części kurtki, kołnierza, topu, szortów, pasów, skarpet
  i butów; kontrola ich nakładania oraz przenikania.
- [ ] Wyposażenie: osobne obiekty i punkty mocowania.
- [ ] Zbudować lokalną bibliotekę baz i parametrycznych elementów pozwalającą
  składać pełną postać, zamiast zaczynać każdy przypadek od osobnego skryptu.

**Kryterium ukończenia:** pełna postać powstaje z jawnie określonej bazy
i obserwacji, a poprawki części nie niszczą pozostałych. Tył i ukryte powierzchnie
pozostają oznaczoną interpretacją, jeśli nie mają referencji.

### P2-C. Materiały i wygląd renderu

- [ ] Oddzielić ocenę geometrii od koloru, tekstury, światła i cienia.
- [ ] Dodać porównania palety i widocznych detali powierzchni, np. piegów,
  pikowania oraz końcówek włosów.
- [ ] Wprowadzić kontrolowany profil neutralnego oświetlenia i kolorów.
- [ ] Rozwijać ocenę wyglądu na niezależnie ocenionych przykładach, z wynikami
  regionalnymi zamiast jednego niezweryfikowanego „procentu podobieństwa”.

**Kryterium ukończenia:** poprawa jest widoczna w neutralnych warunkach;
tekstura i światło nie maskują błędów kształtu, a cień referencji nie jest
automatycznie wypalany w kolorze materiału.

### P3-A. Rig, animacje i eksport

- [ ] Włączyć przygotowanie rigu, wag i eksportu do trwałego przepływu Studio.
- [ ] Sprawdzać deformacje w Rest/Pose i reprezentatywnych momentach każdego klipu.
- [ ] Zachowywać wymagane kości, klipy, skalę, transformacje oraz mocowanie wyposażenia.
- [ ] Automatycznie reimportować końcowy GLB i porównywać z kandydatem Blenderowym.
- [ ] Wykonać izolowany podgląd w rzeczywistym loaderze Three.js i pomiary
  wydajności dla docelowych wariantów jakości.

**Kryterium ukończenia:** zasób zachowuje wygląd i poprawną deformację po
reimporcie i w docelowym rendererze. Wcześniejszy eksport Aiko nie jest dowodem
ukończenia automatycznej obsługi eksportu w Studio.

Integracja z grą następuje wyłącznie po osobnej decyzji użytkownika,
zgodnie z [kontraktem projektu](docs/blender-project-contract.md).

### P3-B. Obsługa długich zadań i wygoda pracy

Te prace można prowadzić równolegle z rozwojem geometrii.

- [ ] Wprowadzić trwały graf zależności: obraz → skan → kamera → dopasowanie
  → render → walidacja → eksport.
- [ ] Wznawiać tylko nieukończone lub unieważnione etapy, na podstawie wersji
  algorytmu, parametrów i sum kontrolnych wejścia.
- [ ] Dodać anulowanie w trakcie optymalizacji CPU; obecnie jest obsługiwane
  na granicach etapów.
- [ ] Pokazywać na obrazie brakujące dane i zablokowane zakresy oraz podawać
  konkretny następny krok bez konieczności czytania JSON.
- [ ] Dodać porównywarkę kandydatów, widoczny identyfikator wydania i rozróżnienie
  wersji interfejsu 2.0 od wersji automatu v6 i kolejnych.
- [ ] Uporządkować instalację, wybór Pythona/Blendera, diagnostykę zależności
  i kopie projektów. Obecny worker korzysta z `fcntl` na macOS/Linux;
  wsparcie Windows wymaga osobnej implementacji i weryfikacji.
- [ ] Uporządkować zmiany Studio w repozytorium i wydania odtwarzalne z konkretnej
  rewizji kodu, z zachowaniem innych trwających prac. **Stan 1 listopada:**
  ~35 modułów Studio, `studio-web/` i ~20 plików testów istniały tylko jako
  nieśledzone pliki w głównym katalogu; serwery uruchamiano z kopii
  w `output/…/runtime-…` i z dodatku Blendera.
- [x] `studio_project.commit()` zapisuje `revisions/N.json` przed `project.json`;
  przerwanie między zapisami blokuje dalsze zapisy projektu („Revision already
  exists”). Brak blokady międzyprocesowej między CLI a `serve`.
- [x] `import_view` tworzy `views/<id>/` przed zapisem rewizji; nieudany import
  zostawia katalog i blokuje ten identyfikator widoku.
- [x] `import fcntl` na poziomie modułu w `blender_pipeline.py` uniemożliwia
  `serve` na Windows, nawet bez `--blender`.
- [x] Anulowanie: zdarzenie może zostać utracone między pobraniem dzierżawy
  a utworzeniem nowego `cancel_event`; etap `fit` nie sprawdza anulowania.
- [x] Jeden uszkodzony `state.json` psuje całą listę `/api/pipeline`.
  Naprawione 1 listopada: blokada `.studio.lock` (flock / msvcrt) wokół zapisu
  rewizji, osierocone rewizje przenoszone do `*.orphan-*`, import widoku przez
  katalog tymczasowy, `fcntl` ładowany leniwie (Windows bez testu na sprzęcie),
  anulowanie pod tą samą blokadą co start i sprawdzane po etapie `fit`,
  uszkodzone stany zgłaszane jako `unreadable`, GET/POST zwracają 404/400/500
  zgodnie z przyczyną, rozłączenie klienta nie generuje śladu błędu.
- Sprawdzone bez zastrzeżeń: serwer słucha tylko na 127.0.0.1, ochrona Host/Origin,
  `safe_path` przeciw wyjściu poza projekt, brak `innerHTML` w UI, Blender
  uruchamiany listą argumentów z `--disable-autoexec`.

**Kryterium ukończenia:** zadanie można przerwać i odtworzyć bez utraty źródeł
oraz bez mylenia częściowych artefaktów ze zweryfikowanym kandydatem.

## 6. Zalecana kolejność najbliższych prac

1. **Diagnoza kontrolek i blokad Aiko — P0-A.** Główna przyczyna ustalona
   (konflikt ochrony z obserwowanym obrysem); pozostaje rozdzielenie wkładu kamery.
2. **Zakres ochrony brody** — zdecydowano o zawężeniu (manifest v17).
   **Korekta oczu C3** usuwa większość rozbieżności bez deformacji żuchwy;
   czeka na ocenę wyglądu przez użytkownika.
3. **Ograniczenia wyszukiwania — P0-D.** Lokalne pasma, skala, interpolacja
   przerw, limit ścinania i kontrola powierzchni gotowe. P0-C dla Aiko
   zablokowane decyzją (oczy/proporcje, wygaszanie w wiersze nieobserwowane
   albo rezygnacja z tej korekty).
4. **Nowe dane i walidacja detektora — P0-B.** Można prowadzić równolegle.
5. **Nowy kandydat i oględziny — P0-C.** Dopiero po wykazaniu dopuszczalnej zmiany.
6. **Jakość powierzchni i adapter bazy — P1-A/P1-C.** Utrwalić rozwiązanie
   jako funkcję programu, nie jednorazową poprawkę Aiko.
7. **Wiele ujęć — P1-B**, gdy dostępne będą odpowiednie referencje.
8. **Rysy twarzy → włosy → sylwetka i strój → materiały — P2.**
9. **Automatyczny rig/eksport — P3-A**, po uzyskaniu właściwego wyglądu.

Nie przypisujemy jeszcze terminów etapom zależnym od brakujących referencji
i wyników eksperymentów. Podstawą przejścia dalej są kryteria odbioru.

## 7. Kiedy uznajemy Studio za gotowe

### Najbliższy cel: użyteczny automat twarzy

- [ ] Dla obsługiwanych baz samodzielnie wykonuje pomiar, kamerę, dopasowanie,
  render i ponowny odczyt albo podaje sprawdzalną przyczynę zatrzymania.
- [ ] Daje wykazaną poprawę na kilku niezależnych przypadkach, nie tylko Aiko.
- [ ] Chroni zatwierdzone cechy i nie tworzy nowych wad powierzchni.
- [ ] Poprawnie rozróżnia brak danych, brak dopuszczalnego ruchu i błąd wykonania.
- [ ] Nie wymaga ręcznych przesunięć wierzchołków przez agenta podczas przebiegu.

### Cel końcowy: pełne Studio postaci

- [ ] Obsługuje twarz, włosy, sylwetkę, strój, materiały i wyposażenie w jednym projekcie.
- [ ] Prowadzi kontrolowany przepływ od bazy do zweryfikowanego zasobu z rigiem.
- [ ] Zachowuje historię, pochodzenie danych i odtwarzalność wydania.
- [ ] Wskazuje, co wynika z referencji, co z bazy, a co jest decyzją modelarską.
- [ ] Ma sprawdzony eksport i czytelny odbiór wizualny; wdrożenie do gry jest osobnym krokiem.

## 8. Zasady obowiązujące podczas realizacji

1. Praca lokalna, bez płatnych generatorów i kredytów; TRELLIS.2 poza domyślnym przepływem.
2. Oryginały oraz wcześniejsze kandydaty pozostają zachowane. Każdy eksperyment ma własny katalog.
3. Ochrona zatwierdzonej brody i brwi nie jest automatycznie znoszona dla poprawy wyniku liczbowego.
4. Ukryte fragmenty pozostają nieustalone; nie uzupełniamy ich symetrią jako rzekomym pomiarem.
5. Wynik częściowy nie otrzymuje statusu pełnego dopasowania. `target_met` dotyczy progu obrysu, nie całej jakości 3D.
6. Testy techniczne, walidacja detektora i oględziny modelu są osobnymi kontrolami.
7. Przed operacjami Blendera obowiązuje pełna lektura [Blender_user.md](Blender_user.md)
   i, dla istniejącego zasobu, [kontraktu projektu](docs/blender-project-contract.md).

## 9. Pliki i punkt wznowienia

Ścieżki są względem katalogu głównego repozytorium.

| Element | Lokalizacja |
| --- | --- |
| Kod Studio i dokumentacja techniczna | [tools/character-scan/](tools/character-scan/) i [README.md](tools/character-scan/README.md) |
| Interfejs | `tools/character-scan/studio-web/` |
| Analiza granic | `contour_evidence.py`, `face_shape.py` w katalogu kodu Studio |
| Dopasowanie i diagnoza | `autopilot.py`, `mesh_fit.py`, `outline_objective.py`, `fit_diagnosis.py` |
| Kamera i worker | `automatic_camera.py`, `blender_landmarks.py`, `blender_pipeline.py`, `blender_pipeline_worker.py` |
| Testy | `tools/character-scan/tests/` |
| Aktywny projekt Aiko | `output/character-scan/aiko-pipeline-v2/`, rewizja 13 |
| Źródło statycznej twarzy | `output/aiko-sculpt/production-v16/04-detail/aiko-detail.blend` |
| Obiekt / układ współrzędnych | `Face - clean cheek and jaw surface` / `aiko-model`, milimetry świata |
| Manifest ochrony | `output/character-scan/aiko-pipeline-v2/protection-aiko-v16.json` |
| Ostatni przebieg Aiko v6 | [pipeline/716bc5786c78/](output/character-scan/aiko-pipeline-v2/pipeline/716bc5786c78/) |
| Przegląd wydania v6 | [review.json](output/character-scan/review-autopilot-v6/review.json) |
| Oddzielny benchmark granic | [benchmark.json](output/character-scan/boundary-benchmark-v6-heldout/benchmark.json) |
| Integracja Blendera v6 | `output/character-scan/blender-pipeline-lab-v6-context/` |
| Zachowany kandydat v4 | `output/character-scan/aiko-pipeline-v2/pipeline/2f82ec466c76/candidate.blend` |
| Zachowany eksport Aiko v16 | `output/aiko-sculpt/production-v16/05-rig-export/aiko-v16-final.glb` |
| Sprawdzony pakiet | `output/character-scan/polpal-blender-autopilot-v6-reviewed.zip` |

Identyfikacja sprawdzonego v6 opiera się obecnie na pakiecie i
[manifeście plików](output/character-scan/review-autopilot-v6/package.json),
nie na wskazanym commicie Git. SHA-256 pakietu:
`c2004f705336276da8ccbb6556819357e2ee6e0a1ed56c950507cbc849e80716`.
Powiązanie kolejnych wydań z jednoznaczną rewizją repozytorium pozostaje
zadaniem P3-B.

Adres lokalnego wydania v6: **http://127.0.0.1:8776** → **Dopasowanie**.
Adres jest dostępny, gdy działa serwer. Uruchomienie istniejącego wydania
z katalogu głównego projektu, jeśli port jest wolny:

```sh
/Users/oleksandr/miniconda3/bin/python3 \
  output/character-scan/runtime-autopilot-v6-reviewed/polpal_face_scan/studio.py serve \
  --project output/character-scan/aiko-pipeline-v2 \
  --model output/character-scan/models/bisenet-resnet18/resnet18.onnx \
  --port 8776 \
  --blender /Applications/Blender.app/Contents/MacOS/Blender
```

Jeden serwer powinien obsługiwać dany projekt. Uruchomienie cyklu Blendera
wymaga włączonego Pythona w AI Bridge. Katalog sprawdzonego wydania jest
punktem odniesienia; rozwój odbywa się w `tools/character-scan/`, a kolejny
pakiet i runtime powstają w nowych katalogach.

Po każdym etapie należy zaktualizować ten plan: oznaczyć wykonane zadania,
dodać identyfikator przebiegu i dowody kontroli oraz zapisać pozostałe ograniczenia.
