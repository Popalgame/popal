# Character Scan / Scan Studio 2.0 — lokalny przepływ pomiarowy

## Scan Studio 2.0

Uruchomiony projekt Aiko: **http://127.0.0.1:8772**. Laboratorium znanej
geometrii: **http://127.0.0.1:8773**. Serwery działają tylko lokalnie.
Projekt Aiko z workerem v6, automatyczną kamerą, kontekstem broda–szyja i ochroną brody:
**http://127.0.0.1:8776** → **Dopasowanie**.

### Siedem elementów przepływu

1. **Edytor** — pędzel/gumka w pikselach źródła, cofanie, punkty anatomiczne
   z widocznością i σ, otwarte odcinki policzków/żuchwy/podbródka, skala i ROI.
   Każdy zapis tworzy nowy JSON w `revisions/`; historia pozwala przywrócić
   wcześniejszy stan jako kolejną rewizję. Maski mają niezmienne pliki i SHA-256.
2. **Kamery** — dopasowanie ortograficzne lub perspektywiczne do co najmniej
   sześciu niekoplanarnych par 3D/2D; dla perspektywy potrzebna jest macierz K.
   Raport zawiera reprojekcję, RMS, p95, inliers, rangę i lokalną kowariancję.
   Zmiana punktów unieważnia kamerę; sam zapis niezmienionych punktów jej nie usuwa.
3. **Wielowidokowe pomiary** — triangulacja wspólnych, widocznych punktów,
   kontrola bazowej geometrii promieni, jednostek i układu współrzędnych;
   odległości oczu, nosa/wargi, ust, żuchwy, podbródka i uszu, gdy dostępne.
4. **Lokalne AI** — BiSeNet ResNet18 ONNX na CPU, zweryfikowane wagi pobierane
   osobno. Propozycje pozostają osobno od masek pomiarowych aż do jawnego wyboru.
   Model nie ma klas źrenicy/tęczówki/twardówki/rzęs; obsługuje je skaner oczny
   i edytor. Nie używamy płatnych generatorów ani TRELLIS.2.
5. **Odchylenia i niepewność** — rejestracja podobieństwa 2D, odległości
   brzegów, IoU, mapy czerwone (na zewnątrz) / niebieskie (do środka), jawne
   pokrycie pikseli. Sigma segmentacji, kamery i skali są oddzielnymi danymi.
   Entropia/softmax AI to diagnostyka modelu, nie skalibrowana pewność anatomii.
6. **Kontrolowane dopasowanie** — niezmienny snapshot, jawne kierunki i granice
   korekt, chronione wierzchołki, stałe kamery, limit przemieszczenia, kontrola
   odwrócenia trójkątów i regresji każdego widoku. Zapis każdego przyjętego kroku.
   Blender importuje oddzielną, początkowo ukrytą kopię po weryfikacji zadania,
   geometrii źródła, parametrów i położeń wszystkich wierzchołków.
7. **Benchmark** — znana geometria z trzema ujęciami, osobne punkty testowe
   kalibracji, zaszumiona triangulacja, odzyskanie zadanego odkształcenia oraz
   porównanie z adnotacją wykonaną na samym obrazie Aiko.

### Autopilot obrysu twarzy — pierwszy moduł automatyzacji

Zakładka **Dopasowanie → Automatycznie dopasuj obrys twarzy** uruchamia jedną
operacją: skan referencji, przygotowanie siedmiu kontrolek korekty, ograniczoną
optymalizację kopii i ocenę pięciu oddzielnych regionów. Nie wymaga skryptu
modelarskiego pisanego przez agenta dla każdej postaci. Działa lokalnie na CPU.

**Zakres obecnej implementacji:** istniejąca, odrębna, statyczna siatka twarzy
i dopasowana kamera ortograficzna. Rasteryzator optymalizuje rzut siatki.
Opcjonalny worker poniżej automatyzuje snapshot, import, render i ponowny odczyt
pliku Blendera. Jest to moduł obrysu, a nie generator całej postaci.

Jednorazowy kontrakt wejścia:

- snapshot JSON jak dla dotychczasowego dopasowania, z
  `mesh.semantic_role: "isolated_face"`, `frame_id`, `world_unit` i sumą siatki;
- wybrane ujęcie Studio z kamerą przypisaną do SHA-256 tej referencji; przy braku
  kamery automat próbuje ją wyliczyć z istniejących par 3D/2D (wymagania kalibracji
  pozostają takie same, nie wystarczą trzy punkty na froncie);
- widoczne odcinki obu policzków, obu stron żuchwy i brody ze skanera albo
  istniejących adnotacji; brak regionu lub zbyt małe pokrycie zatrzymuje automat;
- `protected_vertices` oznacza twarde blokady. Automat ich nie znosi, aby
  sztucznie uzyskać lepszy wynik; pełną blokadę zgłasza jako konflikt.

Kontrolki są generowane z projekcji i proporcji twarzy: osobno policzek, żuchwa
i narożnik brody po każdej stronie oraz wysokość brody. Zmieniana jest płaszczyzna
obrazu; głębokość wzdłuż osi kamery nie jest odgadywana. Suma ruchu jest ograniczona,
odwrócenie trójkątów odrzuca próbę, a regresja regionu nie może być zamaskowana
poprawą średniej całej twarzy. Końcowe progi średniej i p95 są sprawdzane osobno.

Stany wyniku: `target_met` (próg mierzonego obrysu), `candidate` (poprawa, lecz
próg nieosiągnięty), `partial_candidate` (kandydat z niepełnym konturem),
`stalled`, `rejected`, `blocked`, `failed`. Żaden nie oznacza
zatwierdzonego podobieństwa 3D. Zmiana adnotacji/kamery unieważnia odnośniki do
bieżącego kandydata. Raport i poprzednie pliki zostają w historii.

```sh
python3 tools/character-scan/studio.py autopilot-face \
  --project output/my-scan-project --view front \
  --snapshot output/my-face-snapshot.json
```

CLI zwraca 0 tylko dla `target_met`, 2 dla pozostałych zakończonych stanów.
`runs/<id>/autopilot/` zawiera raport, wygenerowany `fit-job.json`, wynik zgodny
z weryfikatorem importera oraz obrazy przed/po. Nie uruchamiaj CLI równocześnie
z zapisem tego samego projektu przez serwer. UI serializuje operacje serwera.

Testy obejmują m.in. różnicę żuchwy przy zgodnych punktach oczu/brody, blokady,
niepełne kontury, błędną kamerę, zachowanie głębokości i importowalność wyniku.
Laboratorium `output/character-scan/autopilot-lab-v1/` wykorzystuje **syntetyczną
geometrię i dostarczone znane kontury**, nie stanowi oceny podobieństwa Aiko.

Do pełnego autopilota pozostają: automatyczne wiązanie części bazowego modelu,
lepsze wykrywanie konturów stylizowanych twarzy, osobne optymalizatory oczu/włosów/stroju,
ocena podobieństwa materiałów pełnego renderu oraz rig/eksport.
Sterownik powinien prowadzić trwały graf zależności etapów i wznawiać tylko
unieważnione etapy. Model bazowy i priory kształtu muszą być jawne; render własnej
hipotezy nie staje się nową referencją. Agent rozwija oprogramowanie, a nie ustala
ręcznie przesunięcia wierzchołków podczas każdego uruchomienia.

### Automatyczny cykl Blender / worker v6

Po jednorazowym przypisaniu źródła przycisk **Uruchom cykl obrysu** pobiera
snapshot bez wklejania JSON, skanuje referencję, przygotowuje kamerę, dopasowuje geometrię, importuje
wynik, renderuje pary przed/po i ponownie otwiera zapisany plik kandydata.
Worker działa w osobnych procesach Blendera; Python w AI Bridge musi być włączony.
Wykonywany jest stały skrypt, argumenty przekazywane są jako JSON, bez shella.

```sh
python3 tools/character-scan/studio.py bind-blender \
  --project output/my-scan-project --blend /absolute/path/source.blend \
  --object 'Face surface' --frame-id blender-world-mm
python3 tools/character-scan/studio.py serve \
  --project output/my-scan-project --port 8775 \
  --blender /Applications/Blender.app/Contents/MacOS/Blender
```

Alternatywnie ten sam przebieg uruchamia komenda `blender-pipeline` z opcjami
`--project`, `--blender` i `--view front`. Domyślny `--coverage-mode auto` pozwala
dopasować widoczne fragmenty przy częściowo zasłoniętym konturze. Opcja
`--coverage-mode full` (UI: **Wymagaj wszystkich 5 regionów**) zatrzymuje przebieg
przy braku któregokolwiek regionu. Bezpośredni `autopilot-face` ze snapshotem
zachowuje domyślny rygor pełnego pokrycia.

Tryb częściowy nadal wymaga wystarczających obserwacji obu stron żuchwy i brody.
Uruchamia wyłącznie boczne kontrolki wspartych regionów; wyłącza korektę wysokości
i narożników brody. Zachowuje luki między odcinkami i wygasza ruch przy ich końcach
oraz przy chronionych wierzchołkach. Pozostałe wierzchołki są zamrożone. Niezależna
kontrola brzegów poza obserwowanymi rzędami wymaga 0 px zmiany w rasteryzatorze
i maksymalnie 1 px w renderze Blendera. To test stabilności względem źródła,
nie pomiar poprawności ukrytej anatomii.

Wynik ma status `partial_candidate`, nigdy `target_met`, nawet gdy wszystkie
widoczne fragmenty osiągną próg. Niewystarczające regiony pozostają `unknown`
bez zastępczego błędu 0. Raport podaje `supported_target_met` i `full_target_met`
osobno. Progi pokrycia nie potwierdzają semantycznej poprawności wykrytego brzegu.

Kamera ujęcia musi być przypisana do
referencji i wyrażona w **mm świata Blendera**. Przy jej braku worker odczytuje
punkty modelu i automatycznie łączy je z aktualnymi obserwacjami referencji:

- Pierwszeństwo mają jednoznaczne obiekty Empty z właściwością
  `scan_studio_landmark`, np. `iris_center_left`, `iris_center_right`, `chin_bottom`.
  Współrzędne pochodzą ze środka Empty w świecie Blendera.
- Wąski adapter bazy odczytuje osobne statyczne siatki `Iris L` / `Iris R`
  oraz dolny centralny brzeg przypisanej siatki twarzy. Kopie z sufiksami
  i niejednoznaczne nazwy nie są automatycznie rozstrzygane.
- Sześć lub więcej par uruchamia pełne dopasowanie pozy, z dotychczasową kontrolą
  niekoplanarności. Nieudane dopasowanie nie przełącza się na łatwiejszy tryb.
- Dla trzech–pięciu par, obejmujących obie tęczówki i brodę, dostępny jest
  `fixed_orientation_alignment`: orientacja pochodzi z kamery ortograficznej
  źródłowego modelu, dopasowywane są tylko skala i dwa przesunięcia. Kontrolujemy
  reprojekcję oraz predykcję każdego punktu po jego pominięciu w dopasowaniu.
  Ten tryb **nie wyznacza obrotu z referencji ani ukrytej głębokości**.
- Brakujące, niewidoczne lub niespójne dane dają `blocked`. Zaimportowane propozycje
  skanera są odświeżane; częściowa tęczówka nie staje się pełnym środkiem oka.

Kamera jest lokalna dla przebiegu, z SHA obrazu i siatki; nie nadpisuje kamery
w projekcie. Raport `automatic-camera.json` i podgląd `camera-overlay.png` są
dostępne w panelu Dopasowanie. `model-landmarks.json` zachowuje pochodzenie punktów.

Źródłem jest zapisany plik, nie niezapisane zmiany otwartej sceny. Binding zawiera
SHA-256; zmieniony plik wymaga ponownego przypisania. Siatka musi być osobną
statyczną twarzą, bez rigu, shape keys i aktywnych modyfikatorów. Grupa
`SCAN_PROTECT` jest przenoszona automatycznie do twardych blokad.

Istniejące zatwierdzone ograniczenia można przenieść bez edycji źródłowego `.blend`
przez `bind-blender --protection manifest.json`. Manifest ma strukturę:

```json
{
  "schema": "polpal.mesh-protection/1",
  "source_blend_sha256": "SHA256_PLIKU_BLEND",
  "source_mesh_sha256": "SHA256_SIATKI_ZE_SNAPSHOTU",
  "object": "Face surface",
  "frame_id": "blender-world-mm",
  "protected_vertices": [12, 13, 14],
  "basis": "Pochodzenie zatwierdzonej blokady"
}
```

Indeksy odnoszą się do dokładnej siatki snapshotu, nie do podobnej geometrii.
Manifest jest zapisany w rewizji bindingu i łączony z `SCAN_PROTECT`. Worker
odrzuca niezgodną siatkę; sterownik sprawdza, czy wszystkie wymagane blokady
trafiły do snapshotu. Ponowne przypisanie bez `--protection` zachowuje poprzedni
manifest i ponownie sprawdza jego zgodność ze źródłem.

Każde `pipeline/<id>/` przechowuje wejściową rewizję, snapshot, zapakowany
checkpoint `input.blend`, zadanie i wynik dopasowania, logi, cztery rendery,
`candidate.blend`, raport ponownego odczytu oraz atomowo zapisywany `state.json`.
UI pokazuje etap, umożliwia zatrzymanie i udostępnia artefakty. Zatrzymanie
przerywa proces Blendera; podczas dopasowania CPU następuje na granicy etapów.
Blokada plikowa dopuszcza jeden przebieg projektu, również między CLI a serwerem.
Restart oznacza niedokończone zadania jako `interrupted`; nowy przebieg dostaje
nowy katalog. Nie ma jeszcze automatycznego wznawiania od środka etapu.

`reference-evidence.json` wyjaśnia brakujące regiony, rzeczywistą długość
pokrycia bez mostkowania luk oraz powody odrzucania próbek (włosy, kadr,
wykluczenia). Te dane są dostępne również dla zablokowanego przebiegu.
Próg regionu pozostaje taki sam: co najmniej trzy próbki i widoczny zakres 0,08
rozstawu oczu. Pełny tryb wymaga pięciu regionów, częściowy — obu żuchw i brody.
Brak policzka nie jest zerowym błędem.

Kontrole obejmują transformację lokalną/świata, UV, przypisania materiałów,
topologię i grupy; zgodność projekcji z `world_to_camera_view`; ponowny odczyt
kandydata oraz pomiary wspartych regionów na alfa **renderu Cycles**. Różnica brzegów
między rasteryzatorem a Blenderem ma limity p95 1,5 px / maksimum 3 px. Kontrola
regresji renderu dopuszcza 1 px szumu rasteryzacji; cel p95 pozostaje bez luzu.
Rendery kontekstowe zachowują te same materiały, światło i kamerę przed/po, ale
nie otrzymują automatycznej oceny podobieństwa materiałów. `target_met` oznacza
wyłącznie osiągnięcie progu obrysu. Edycja projektu w trakcie zadania daje `stale`
i usuwa bieżący odnośnik do kandydata, zachowując historię artefaktów.

Kontrola ponownego odczytu porównuje współrzędne i triangulację wyrenderowanego
kandydata. Blender może zmienić przekątną czworokąta po deformacji; oryginalne
ściany wielokątowe, UV, przypisania materiałów i grupy nadal muszą być identyczne.
Raport zapisuje hash triangulacji kandydata i liczbę zmian względem snapshotu.

Laboratorium `output/character-scan/blender-pipeline-lab-v2/` używa znanej
syntetycznej geometrii z niejednostkową transformacją obiektu, UV i blokadą.
Nie jest wynikiem dopasowania Aiko. Worker jest obecnie lokalny (macOS/Linux,
blokada `fcntl`); wymaga środowiska Python z `requirements-studio.txt`.

Powtarzalny test prawdziwego workera, z pustą kamerą Studio, markerami 3D,
znanymi konturami i kontrolą przenośnych blokad:

```sh
python3 tools/character-scan/tests/run_blender_pipeline.py \
  --out output/character-scan/new-camera-lab \
  --blender /Applications/Blender.app/Contents/MacOS/Blender
```

Przed uruchomieniem obowiązują `Blender_user.md` i kontrakt projektu. Test używa
nowego katalogu i osobnych procesów. Znane kontury/obserwacje 2D są wejściem
testowym; wynik sprawdza mechanikę automatu, nie skuteczność detekcji na Aiko.

Weryfikacja v3: 124 testy jednostkowe/integracyjne Pythona; osobny test prawdziwego
Blendera w `output/character-scan/blender-pipeline-lab-v3-verified/`. Przebieg
`7d42ce5ff685` osiągnął cel obrysu (p95 żuchwy 4 → 1 px). Test dodatkowej blokady
`e72b47ed2e67` zachował oba chronione wierzchołki i zakończył się `candidate`:
blokada policzka ograniczyła dokładność, więc cel całej twarzy nie został zaliczony.

Aiko, przebieg pakietu `91adcc8ba067`: automatyczna kamera RMS 2,174 px,
ochrona 4993 wierzchołków brody przeniesiona z wcześniejszego kontraktu produkcji.
Dopasowanie zatrzymało się przed korektą geometrii: `cheek_right` ma 0/74 próbek
dopuszczonych przez kontrolę bliskości włosów. Pozostałe cztery regiony mają
wystarczające pokrycie. Ten przebieg nie utworzył nowego kandydata Aiko.

Weryfikacja v4: **128 testów Pythona**, kontrola składni JavaScript i prawdziwy
worker w `output/character-scan/blender-pipeline-lab-v4-reopen/`: pełny przebieg
`d5e60359a9f4`, ochrona manifestu `3f2e12ca7105`, częściowy `6c0e5fcca87c`.
Ten ostatni zachował 69 zamrożonych wierzchołków w wyniku optymalizacji i 0 px
zmiany nieobserwowanego konturu renderu; nadal nie osiągnął całego celu.

Aiko v4, `2f82ec466c76`: **`partial_candidate`**, poprawny zapis i ponowny odczyt.
W renderze średni błąd lewego fragmentu policzka zmalał 47,44 → 44,15 px,
prawej żuchwy 7,30 → 7,15 px. P95: policzek 50,5 → 49,7 px, lewa żuchwa
34,5 px, prawa 13,25 px, broda 9,5 px — wszystkie powyżej celu 2,47 px.
Prawy policzek pozostaje `unknown`. Zamrożone 24425 wierzchołków obejmuje 4993
zatwierdzone blokady brody. Ich współrzędne w JSON wyniku są dokładnie zachowane;
konwersja współrzędnych w Blenderze daje maksymalnie 0,000127 mm różnicy.
Obrys poza wspartymi rzędami renderu: 0 px zmiany po obu stronach.

Pierwszy przebieg v4 `6337ce7155b6` zachowano jako `failed`: kontrola odczytu
myliła zmianę przekątnej jednego czworokąta z uszkodzeniem topologii. Naprawiona
kontrola porównuje triangulację zapisanego i wyrenderowanego kandydata, przy
niezmiennym kontrakcie ścian wielokątowych i atrybutów.

Oględziny porównywalnego frontu pokazują jedynie drobną korektę. Krótki lewy
fragment policzka leży przy włosach i wymaga dalszej weryfikacji semantycznej;
pokrycie skanera nie dowodzi, że jest to zewnętrzna sylwetka całej siatki twarzy.
Różnice kształtu, oczu i włosów pozostają wyraźne. Podobieństwo niezatwierdzone,
ukryta geometria i jakość z boków nie zostały potwierdzone przez ten test frontu.

### V5 — wiarygodność granic i automatyczna diagnoza

`contour_evidence.py` sprawdza kandydatów obrysu w oryginalnym obrazie przed
kalibracją kamery i optymalizacją. Dla boków bada paski w poziomie, dla brody
w pionie, zgodnie z osią pomiaru. Pas zewnętrzny ma długość około 0,10 rozstawu
oczu, a nie tylko dawną strefę bliskości włosów 0,025 rozstawu.

Odrzucenia mają jawne powody:

- `outward_hair_contact`: wykryte włosy w pasie na zewnątrz brzegu;
- `illumination_like_transition`: podobna chromatyczność przy spadku jasności,
  czyli niejednoznaczność cienia;
- `skin_continues_outward`: maska skóry kontynuuje się poza przejściem, np. szyja
  pod brodą lub granica wewnątrz powierzchni;
- słaby kontrast, brak wsparcia skóry od środka, niepełny pas obrazu/alfa;
- za krótki ciągły fragment po usunięciu niepewnych próbek.

Odrzucone punkty pozostają w `scan/boundary-evidence.json`; nakładka
`boundary-evidence-overlay.png` pokazuje je na czerwono, zachowane na zielono.
Usuniętych odcinków nie łączymy przez luki. Odrzucona centralna broda nie zasila
automatycznej kamery ani przekrojów powyżej brody. Adnotacje źródłowo zgodne
zachowują jawne pochodzenie; raport pokazuje także ostrzeżenia heurystyki dla
tych adnotacji. Automat nie przedstawia ich jako własnego wykrycia.

To konserwatywne reguły obrazu, **nie wyuczony klasyfikator anatomii**. Mogą
odrzucić prawdziwy brzeg, np. brodę na tle szyi, albo przepuścić niewykryte włosy
i cienie o innej barwie. `contrast_boundary_candidate` oznacza jedynie brak
wykrytego powodu odrzucenia. Dokładność semantyczna na zbiorze niezależnych
referencji pozostaje niezmierzona. Próg koloru to heurystyka, nie pewność.

`fit_diagnosis.py` zapisuje `diagnosis.json` również dla przerwanego lub
zablokowanego przebiegu. UI pokazuje **Diagnoza / następny krok** oraz nakładkę
**Granice przyjęte i odrzucone**. Diagnoza rozróżnia:

- niejednoznaczną referencję i niewystarczające pokrycie;
- brak kamery wynikający z odrzuconej brody, błąd reprojekcji i orientację z bazy;
- problem źródła/konfiguracji oraz pełną blokadę kontrolek;
- rzeczywiste odrzucenia prób: limit ruchu, orientacja trójkątów, ruch poza
  obserwacją lub regresja regionu;
- kontrolki na granicach zakresu i pozostały błąd obserwowanych fragmentów.

Optymalizator zapisuje powód każdej próby, rzeczywisty powód zatrzymania,
końcowy krok i liczbę iteracji. Są to obserwacje procesu wyszukiwania — duży
błąd obrysu sam nie identyfikuje przyczyny jako kształtu, kamery czy detektora.
Automat wybiera dopuszczalne fragmenty oraz stan zatrzymania; diagnoza wskazuje
dalszą czynność bez samoczynnego zdejmowania blokad i zwiększania siły korekty.

Weryfikacja v5: **140 testów Pythona**, składnia JavaScript oraz prawdziwy Blender
w `output/character-scan/blender-pipeline-lab-v5-evidence/`: pełny przebieg
`01611ba0b2e1` (`target_met`), ochrona `5c4a711aa3ee` (`candidate`), niepełny
kontur `36b5d5e28add` (`partial_candidate`). Kontury w laboratorium są jawnie
dostarczone; ten wynik sprawdza mechanikę, a nie skuteczność semantyczną.

Aiko `c1ddc27d999a`: **`blocked` na etapie kamery**. Nowe reguły odrzuciły
17/17 wcześniejszych próbek lewego policzka z powodu włosów w zewnętrznym pasie.
Z żuchwy pozostało 19 próbek po lewej i 35 po prawej. 74 próbki brody wskazały
kontynuację skóry na zewnątrz; pozostałe 32 nie tworzyły wystarczającego fragmentu
centralnego. To zgłoszenie niejednoznaczności broda/szyja, nie dowód braku
prawdziwej granicy brody. Odrzucony punkt nie zasilił ponownie kamery z zapisanej
propozycji skanera. Diagnoza: `resolve_boundary_evidence`.

Ten przebieg nie wykonał korekty ani nowego renderu Aiko. Kandydat v4 pozostaje
w historii; źródło i 4993 blokady brody zostały zachowane. Kolejny etap wymaga
lepszego rozróżnienia styku broda/szyja od cienia wewnątrz twarzy i walidacji
detektora na niezależnych referencjach, przed zwiększeniem siły optymalizacji.

### V6 — kontekst broda–szyja i zakres kontrolek

`chin_neck_context()` analizuje już zmierzony centralny łuk. Kontekst może
rozstrzygnąć tylko lokalne `skin_continues_outward` i
`illumination_like_transition`, gdy jednocześnie:

- łuk jest ciągły, gładki, wypukły w dół i obejmuje oś twarzy;
- oba końce łączą się z lokalnie wspartymi fragmentami żuchwy;
- przekroje maski skóry poniżej tworzą stabilny, wyraźnie węższy pas szyi.

Dopasowana parabola służy wyłącznie pomiarowi spójności. Punkty wejściowe
pozostają niezmienione; nie interpolujemy luk. Włosy, słaby kontrast, brak
pikseli i nieciągłość uniemożliwiają przyjęcie przez kontekst. Wynik
`chin_neck_contact_candidate` jest hipotezą, nie potwierdzoną anatomią.
Malowany wzór o tej samej geometrii i kolorze może być nierozróżnialny od styku.

`boundary-evidence.json` przechowuje `chin_context`, metryki łuku, punkty
przyłączenia żuchwy, przekroje skóry oraz oryginalne `local_reasons` i
`local_classification`. Nakładka oznacza próbki kontekstowe **cyjanem**;
zielony nadal oznacza lokalnego kandydata/adnotację, a czerwony — odrzucenie.
Diagnoza podaje liczbę kontekstowo wspartych próbek.

`control_support` w zadaniu i raporcie dopasowania podaje liczbę ruchomych
wierzchołków i maksymalny rzutowany ruch na jednostkę parametru, po zastosowaniu
ochrony. Diagnoza zgłasza `fully_locked_controls` i `subpixel_control_range`.
To pomiar dostępnego ruchu, nie dowód osiągalności celu ani globalnego optimum.

#### Oddzielny zbiór proceduralny

`tests/boundary_cases.py` dostarcza etykiety, znane maski i rejestrację.
`tests/run_boundary_benchmark.py` porównuje v6 z wariantem bez analizy kontekstu.
Zbiór rozwojowy ma ziarna 3/17/29; osobny zbiór oceny 103/107/109/127.
Obejmuje granicę zewnętrzną, styk broda–szyja, dwa rodzaje cienia, włosy,
brak kontrastu i płaską brodę. To test wnioskowania przy znanych maskach,
**nie niezależna walidacja semantyczna rzeczywistych zdjęć**.

Zamrożona ocena: `output/character-scan/boundary-benchmark-v6-heldout/`.
28 przypadków: **TP 8, TN 16, FP 0, FN 4**, czułość 66,7% wobec 33,3%
bez kontekstu. Wszystkie cztery płaskie brody pozostały fałszywymi odrzuceniami;
konserwatywne założenie wypukłości ich nie obsługuje. Brak FP w tym małym zbiorze
nie ustala skuteczności na rzeczywistych referencjach. Progi nie były dostrajane
do zakończonej oceny. `benchmark.json` zapisuje hashe detektora i generatora.
Wynik rozwojowy pochodzi ze starszej rewizji generatora, sprzed rozróżnienia
obu klas cienia; nie należy łączyć jego metryk z końcowym zbiorem oceny.

```sh
python3 tools/character-scan/tests/run_boundary_benchmark.py \
  --split heldout --out output/character-scan/new-boundary-evaluation
```

#### Wynik rzeczywistego przebiegu v6

**143 testy Pythona** i składnia JavaScript przeszły. Integracja w prawdziwym
Blenderze: `output/character-scan/blender-pipeline-lab-v6-context/` — pełny
`5acb522ba940` (`target_met`), ochrona `3aabde4810ca` (`candidate`), częściowy
`1816b48a7eed` (`partial_candidate`). Zapis, rendery i ponowny odczyt są sprawdzone
na geometrii laboratoryjnej; nie jest to walidacja podobieństwa postaci.

Aiko `716bc5786c78`: **`stalled` na etapie dopasowania**, zero zaakceptowanych
kroków. Kontekst przyjął 106 zmierzonych próbek brody, zachowując 19 próbek
lewej i 35 prawej żuchwy. Łuk ma p95 odchylenia od paraboli 0,956 px, odległości
przyłączenia żuchwy 1 i 1,414 px oraz stosunek szerokości szyja/twarz 0,339.
Automatyczna kamera ponownie powstała (RMS 2,174 px), nadal z orientacją bazy.
Oba policzki pozostają `unknown`.

4993 źródłowe blokady brody wchodzą do 25042 zamrożonych wierzchołków. Lewa
kontrolka żuchwy ma 0 ruchomych wierzchołków, prawa 73 i maksymalny ruch 0,402 px
na jednostkę parametru. Spośród 28 prób 27 nie poprawiało celu, a jedna
poruszała nieobserwowany obrys. P95 pozostało: lewa żuchwa 36,5 px, prawa
14,8 px, broda 10,5 px przy celu 2,468 px. To pomiary rasteryzatora dopasowania;
przebieg zatrzymał się przed importem, renderem Blendera i zapisem kandydata.

**Widoczna poprawa Aiko nie została osiągnięta.** Współrzędne wyniku są identyczne
ze snapshotem, źródło, zatwierdzone brwi i wcześniejszy kandydat v4 pozostają
zachowane. Dalszy rozwój wymaga danych dla rzeczywiście widocznych fragmentów
policzków oraz analizy zakresu kontrolek przy zachowanych blokadach. Samo
zwiększanie liczby iteracji nie usuwa tych ograniczeń. Walidacja semantyczna na
niezależnie opisanych rzeczywistych obrazach i obsługa płaskich styków pozostają
otwarte; nie należy dostrajać progów do już ocenionych ziaren.

### Instalacja i uruchomienie

```sh
python3 -m pip install -r tools/character-scan/requirements-studio.txt
python3 tools/character-scan/semantic_scan.py install output/character-scan/models/bisenet-resnet18
python3 tools/character-scan/studio.py init --project output/my-scan-project --image reference.png --id front
python3 tools/character-scan/studio.py add-view --project output/my-scan-project --image side.png --id side --label 'Side reference'
python3 tools/character-scan/studio.py serve --project output/my-scan-project --model output/character-scan/models/bisenet-resnet18/resnet18.onnx --port 8772
```

`init` i `add-view` przyjmują również `--report ścieżka/face-scan.json`.
Źródło obrazu musi mieć SHA zgodne z raportem. Wagi modelu są opcjonalne;
bez `--model` nadal działają edytor, skaner, kamery, pomiary i dopasowanie.
W tym środowisku używamy `/Users/oleksandr/miniconda3/bin/python3`.

Gotowy projekt: `output/character-scan/aiko-studio-2.0/project.json`.
Laboratorium: `output/character-scan/benchmark-2.0-final/studio-project/`.
Plik `fit-job.json` laboratorium można wczytać w zakładce Dopasowanie.

### Blender: snapshot → dopasowanie → osobna kopia

Panel **Character Scan 2.0** ma adres Studio, ścieżkę zadania i wyniku.
Wyeksportuj zaznaczoną statyczną siatkę bez aktywnych modyfikatorów/rigowania.
Grupy `SCAN_FIT_X`, `SCAN_FIT_Y`, `SCAN_FIT_Z` definiują wagę kierunków
przesunięcia w osiach świata (domyślnie 1 mm na jednostkę parametru).
`SCAN_PROTECT` przypina wierzchołki. Dla bardziej złożonych korekt jawnie podaj
`controls[].offsets` w JSON. Kontrole muszą zawierać stan oryginalny przy zerze.

Dodaj `views`: stałą kamerę `P` w tym samym `frame_id` i `world_unit`, rozmiar
obrazu `size`, binarną maskę celu `mask` i jej `mask_sha256`. W Studio ścieżki
masek są względem katalogu projektu. Snapshot Blendera jest w **mm świata,
Z do góry**; macierz kamery przekształca go na obraz X w prawo / Y w dół.
Samo nazwanie różnych układów identycznym `frame_id` nie kalibruje ich.

```sh
python3 tools/character-scan/mesh_fit.py project/fit-job.json --out project/new-fit-run
python3 -m unittest discover -s tools/character-scan/tests -v
python3 tools/character-scan/benchmark.py --out output/new-accuracy-run \
  --reference output/character-scan/reference.png \
  --scan output/character-scan/aiko-shape-1.3-reviewed/face/face-scan.json \
  --annotations tools/character-scan/examples/aiko-independent-annotations.json
```

Import wymaga dokładnie zadania, którego użyto do obliczenia wyniku. Zachowuje
topologię, UV i materiały kopiowanej siatki. Oryginał pozostaje punktem odniesienia.
Kontrola orientacji trójkątów nie wykrywa wszystkich samoprzecięć ani błędów
anatomii; konieczne są oględziny kandydata. Złożone deformacje animowanego rigu
nie są obsługiwane przez ten importer statycznego snapshotu.

### Wyniki i zakres walidacji

`output/character-scan/benchmark-2.0-final/accuracy-report.json` rozdziela
syntetyczne testy od oceny rzeczywistego obrazu. Dla szumu 0,5 px błąd RMS
projekcji punktów testowych wyniósł 0,040 px (ortho) i 0,208 px (perspektywa).
Średni błąd triangulacji: 0,173 mm w syntetycznej skali. Zadana korekta 1,6 mm
została odzyskana, z poprawą wszystkich trzech sylwetek.

Adnotacje Aiko zostały wykonane przez agenta z obrazu źródłowego, osobno od
automatu; **nie są niezależnym badaniem z udziałem człowieka**. Średnie
odchylenia masek tęczówek od tych obrysów to 1,49 / 5,76 px; p95 prawej to
23,22 px. Szczególnie prawa maska pigmentu, przerwana odblaskiem, nie odtwarza
całego obrysu optycznego tęczówki. Wynik nie jest procentem podobieństwa.
Adnotacja ma oszacowane σ 2 px, bez walidacji między anotatorami.

Monte Carlo triangulacji uwzględnia szum punktów przy **stałych kamerach**.
Lokalna kowariancja kamery jest raportowana osobno; niepewność geometrii 3D,
intrinsics i błędy systematyczne nie są włączone do przedziałów triangulacji.
Udział pokrycia w porównaniu masek oznacza poprawne piksele porównania,
nie procent poznanej anatomii. Aiko ma jedną referencję: jej prawdziwa
głębokość, tył i dokładność 1 mm pozostają nieustalone. Rendery modelu nie
są dodatkowymi obserwacjami postaci z referencji.

Snapshot twarzy Aiko w projekcie Studio zachowuje bieżący evaluated mesh
jako osobne studium. Walidacja automatycznego dopasowania używa jawnie
oznaczonej geometrii testowej; nie oznacza ukończenia modelowania Aiko.

### Obsługa

- Kółko: zoom wokół kursora; Przesuń: panoramowanie; Dopasuj kadr / Cały obraz.
- Punkt: ustawianie i przeciąganie, sigma i opcjonalne współrzędne modelu.
- Obrys: klikaj po widocznym brzegu, Enter zamyka **odcinek**, nie pętlę.
- ⌘/Ctrl+S: zapis; ⌘/Ctrl+Z: cofanie na płótnie. Zmiana warstwy zapisuje edycję.
- Historia: podgląd JSON oraz przywrócenie bez usuwania dawnych rewizji.
- Wyniki przy dolnej krawędzi płótna: nakładki, raporty, punkty 3D i mapy błędów.
- Jedna instancja serwera na projekt; konflikty rewizji wymagają przeładowania
  po zachowaniu lokalnej edycji. Projekty zachowują też nieużyte propozycje AI.

## Geometria obrysu twarzy i podbródka (1.3)

`face_shape` zawiera oddzielne, otwarte krzywe widocznych fragmentów policzków,
żuchwy i centralnego podbródka. Fragmenty przy włosach, granicy kadru i
w obszarach wykluczonych pozostają przerwami. Nie łączymy ich w wymyśloną
pełną sylwetkę. Automatyczny podbródek jest kandydatem przejścia kontrastu
pod skórą, ograniczonym do ciągłego odcinka przecinającego oś twarzy; odłączony
brzeg kołnierza nie może zastąpić centralnego podbródka.

Raport obejmuje punkty px/mm, długości łuków, nachylenia cięciw fragmentów,
odchylenie od cięciwy (opis wygięcia, zależny od długości widocznego fragmentu),
dolny punkt przy osi twarzy i jego wysokość względem oczu. Dostępne przekroje
podają szerokość twarzy, przesunięcie środka oraz szerokość 5%, 10% i 20%
rozstawu oczu powyżej kandydata dolnego punktu. Przekrój wymaga obu widocznych
krawędzi na danej wysokości; brak danych nie jest uzupełniany symetrią.

Nowe pliki: `face-shape-overlay.png`, `face-shape-widths.csv`,
`face-shape-points.csv`. Kolory: błękitne policzki, złota żuchwa, zielony
kandydat podbródka, różowe przekroje. Prowadnice Blendera `shape.*` są
otwartymi krzywymi; przycisk **Read face / chin / spacing / profile** zapisuje
również te pomiary do bloku Text.

Porównanie dwóch skanów dodaje `face_shape.regions` oraz plik obok JSON:
`NAZWA.face-shape.png`. Po rejestracji względem osi twarzy, linii oczu i ich
rozstawu liczymy symetryczne odchylenia najbliższych punktów: średnią, p95
i maksimum. Wyniki są w jednostkach rozstawu oczu i opcjonalnie w mm skali
referencji. **To nie przemieszczenie w przestrzeni świata**. Udział pokrycia
jest podany osobno dla obu obrazów; zakresy bez odpowiadającego widocznego
odcinka nie uczestniczą w pomiarze. Zero błędu na części punktów nie oznacza
100% podobieństwa całej twarzy.

### Dokładne, źródłowo sprawdzone krzywe

Gdy kolor skóry, cień lub szyja utrudnia automat, można podać `face_outline`
w podpowiedziach twarzy (`face.face_outline` w pełnym skanie):

```json
{
  "face_outline": {
    "source_sha256": "SHA256_ORIGINAL_REFERENCE",
    "segments": [
      {"region": "chin", "status": "partial", "points_px": [[570, 906], [580, 909], [590, 908]]}
    ]
  }
}
```

Regiony: `cheek_left/right`, `jaw_left/right`, `chin`. Każdy odcinek ma co
najmniej trzy punkty: od góry do dołu dla boków, od lewej do prawej dla
podbródka. Duże przerwy trzeba rozdzielić na osobne odcinki. Dostarczone
regiony zastępują odpowiedni automat; pozostałe nadal są analizowane.
Adnotacja pozostaje jawnym źródłem, nie automatycznym wykryciem.

**Nie deklarujemy „100% trafienia”.** Cała powierzchnia 3D, wysunięcie
podbródka, głębokość policzków, fragmenty pod włosami i dokładność skali
nie wynikają z pojedynczego frontu. `accuracy_100_percent_verified=false`.
Pomiary pozwalają kolejno zmniejszać widoczne różnice; zatwierdzony szerszy
podbródek pozostaje decyzją modelarską, a narzędzie nie zmienia siatki samo.

## Rozstaw rysów, uszy, detale twarzy i profil głowy (1.2)

`facial_layout.relations` mierzy oddzielnie **odległość środków ciężkości masek**
i **przerwę między rzutowanymi krawędziami ich prostokątów**:

- `nose_mouth_vertical`: nos → usta, pionowo;
- `eyes_horizontal`: lewe → prawe oko, poziomo;
- `brows_horizontal`: lewa → prawa brew, poziomo;
- `brow_eye_left_vertical`, `brow_eye_right_vertical`: brew → oko, pionowo.

Lewo/prawo oznacza stronę obrazu. Współrzędne px rosną w prawo i w dół.
Przerwa to odległość **krawędzi komórek pikseli**, nie odległość centrów pikseli
brzegowych; może być ujemna przy nakładających się rzutach. To nie najkrótsza
odległość po skórze ani odległość 3D. Status `partial` propaguje się z masek;
`unknown` nie dostaje zastępczej wartości 0. Pomiary mm dziedziczą kalibrację
i ograniczenia dokładności z części ocznej.

Automatyczny nos/usta nadal są **kandydatami plam kontrastu**, nie wiarygodnymi
punktami anatomicznymi (np. podstawa nosa i górna warga). Można zastąpić je
maskami `feature_masks.nose` i `.mouth` na tych samych zasadach kontroli SHA-256
co oczy. Raport zachowuje definicję punktów; nie nazywa odległości między
plamami kontrastu długością rynienki podnosowej.

### Uszy i położenie względem głowy

`ear_left`, `ear_right` szukają bocznych wysp koloru skóry w osobnych pasach,
także poza głównym ROI twarzy. Komponent połączony w poziomie z policzkiem
jest odrzucany. Komponent kontynuujący się w dół może zawierać kołnierz;
skaner zachowuje tylko fragment pasa i jawnie oznacza go `partial`.
Granica pasa **nie jest rozpoznaną granicą ucha**. Rozmiary, pole i kontury
opisują wyłącznie kandydata widocznego fragmentu.

`facial_layout.ears` zapisuje przesunięcie środka względem osi twarzy i linii
oczu. Opcjonalne `head_roi: [x0,y0,x1,y1]` w podpowiedziach twarzy daje
dodatkowo pozycję UV oraz proporcje szerokości/wysokości ucha względem
wskazanego obszaru głowy. Bez niego proporcje są `unknown`; ROI twarzy nie
jest automatycznie uznawane za rozmiar czaszki. Region głowy to jawna
adnotacja, która może obejmować włosy.

Można podać `regions.ear_left/right` oraz źródłowo sprawdzone
`feature_masks.ear_left/right`. Maski uszu muszą leżeć w ich pasie wyszukiwania
(lub dostarczonym regionie), pozostałe maski nadal w ROI twarzy. Nie odtwarzamy
ukrytych części ucha. Automatyczne etykiety uszu wymagają kontroli podglądu.

### Linie, zmarszczki i cienie pod oczami

`facial_details.observations` zapisuje drobne linie i szersze obszary ciemnego
kontrastu, ich obrysy, pozycje i rozmiary px/mm oraz strefę: okolica oczodołu,
pod okiem lub powierzchnia twarzy. Znane oczy/brwi/usta/nos/włosy/piegi są
wyłączane z poszukiwań. Pas twarzy ogranicza przypadkowe detekcje szyi.
To heurystyka, nie semantyczny klasyfikator zmarszczek. Linie powiek, pigment,
tekstura, cień od włosów i kompresja mogą dawać taki sam sygnał. Głębokość
zapadnięcia pozostaje `unknown`; brak wykrycia nie potwierdza gładkiej skóry.

### Referencja boczna i proporcje głębokości

Panel 1.2 przyjmuje **Side reference spec JSON**; oba polecenia `scan`
przyjmują `--side-profile /path/profile.json`. Alternatywnie ten sam obiekt
można umieścić jako `side_profile` w podpowiedziach twarzy (w pełnym skanie:
`face.side_profile`). Podawaj go tylko raz.

```json
{
  "image": "/absolute/path/head-side.png",
  "source_sha256": "SHA256_SIDE_IMAGE",
  "view": "right-facing",
  "head_roi": [20, 20, 220, 280],
  "mask": "/absolute/path/visible-head-mask.png",
  "scope": "head_surface",
  "status": "partial",
  "calibration": {"mm_per_px": 0.5, "basis": "independent side-view calibration"}
}
```

`view`: `left-facing` lub `right-facing`, głowa ustawiona pionowo; orientacja
jest deklaracją wejścia, nie wynikiem estymacji pozy kamery.
`scope`: `head_surface` lub `hair_envelope`. Maska jest opcjonalna, binarna
0/255, rozmiaru obrazu, bez przezroczystych pikseli i poza-ROI. Bez maski
używamy alfa/jednolitego tła w regionie; wynik zawsze `partial` (może zawierać
szyję). Dotknięcie brzegu ROI również wymusza `partial`.

`head_profile.depth_height_ratio` to poziomy rozmiar maski / jej wysokość.
Obejmuje nos, jeżeli maska obejmuje nos; włosy nie są głębokością czaszki.
Kalibracja boku jest **niezależna** od przodu i może być pominięta (tylko px
i proporcje). Porównania skanów zwracają różnicę proporcji wyłącznie dla
zgodnych `scope`; ujemna różnica oznacza płytszy widoczny profil względem
wysokości. Nie stosujemy arbitralnej „prawidłowej” proporcji głowy Aiko.
Bez dwóch użytecznych profili ocena spłaszczenia pozostaje nieustalona.
Źródło i maska profilu mają SHA-256, kontrolowane ponownie przy wczytaniu.

### Pliki i Blender

- `facial-spacing.csv`, `ear-measurements.csv` — pomiary i statusy;
- `facial-layout-overlay.png` — kontury nosa/ust/uszu i numerowane przerwy;
- `facial-details-overlay.png` — kandydaci kontrastu, różowy kolor;
- `head-profile-overlay.png` — tylko po dostarczeniu bocznego wejścia;
- `facial-layout-report.md`, `face-scan.json` — definicje, pochodzenie i wyniki.

W pełnym pakiecie te pliki leżą w `face/` i są objęte sumami kontrolnymi.
Przycisk **Read spacing / ears / head profile** zapisuje wyniki do bloku Text.
Prowadnice zawierają przerwy, obrysy fragmentów uszu i kandydatów detalu.
Porównanie dodaje `facial_spacing` i `head_profile`, zachowując niepełność.

## Pomiary oczu, źrenic, białek, rzęs i brwi (1.1)

Każda strona obrazu ma osobne maski `eye` (widoczny otwór oka), `sclera`
(białko), `iris` (kolor tęczówki), `pupil` (ciemny obszar źrenicy), `lash`
(górna sylwetka rzęs/eyelinera) i `brow` (widoczny fragment brwi).
Backend `eye_scan.py` jest lokalną heurystyką dla palety Aiko.

Raport `features.*.geometry_2d` zawiera:

- szerokość, wysokość, pole, środek prostokąta i środek ciężkości maski;
- dokładne kontury komórek pikseli, otwory oraz osobne rozłączone fragmenty;
- przebiegi wszystkich fragmentów w rzędach, bez wypełniania tęczówki białkiem;
- oś główną i osie momentów maski (opis kształtu, nie odtworzona elipsoida oka);
- wymiary, położenia X/Z i wszystkie kontury w mm po podaniu skali;
- dla brwi/rzęs także dotychczasową grubość kolumnową rzutowaną względem
  dopasowanego nachylenia, końce widocznego fragmentu i kąt wzniosu.

`ocular_metrology.relations` podaje przesunięcia i proporcje źrenicy względem
tęczówki/oka, tęczówki względem oka, brwi i rzęs względem oka.
`left_right` podaje rozstaw środków masek — osobno źrenic, tęczówek itd.
Środek ciężkości widocznej maski nie musi być anatomicznym środkiem zasłoniętej części.

**Milimetry wymagają kalibracji.** Pełny skan dziedziczy skalę i początek
z rejestracji sylwetki; samodzielny skan twarzy przyjmuje:

```bash
python3 tools/character-scan/face_scan.py scan output/character-scan/reference.png \
  --out output/character-scan/new-eye-measurements \
  --mm-per-px 1.0152284263959392 --origin-px 580 1973
```

Bez kalibracji wynik zawiera tylko piksele. Przy tej skali Aiko **1 px ≈ 1,015 mm**.
Pół piksela granicy to ok. 0,508 mm, ale to wyłącznie ograniczenie próbkowania,
nie łączny błąd pomiaru. Segmentacja, perspektywa i założona wysokość wnoszą
nieznaną niepewność. `accuracy_1mm_verified=false`; trzy miejsca po przecinku
nie są deklaracją dokładności. Dla nowych automatycznych masek raport zawiera
zakres zmian wymiarów przy trzech pobliskich progach (`threshold_sensitivity`),
nie statystyczny przedział ufności. Opcjonalna kalibracja w podpowiedziach
twarzy przyjmuje `mm_per_px`, `origin_px`, `basis`, `scale_relative_uncertainty`;
nie podawaj jej drugi raz przez CLI lub pełny skan.

Nowe pliki: `ocular-overlay.png` (sześć osobnych podglądów),
`ocular-measurements.csv` (px/mm i pozycje), `ocular-report.md`.
Pełny skan zapisuje je w `face/` i obejmuje sumami kontrolnymi pakietu.
Porównanie pełnych skanów zawiera teraz również porównanie twarzy.
`ocular_visible_fragments` porównuje także fragmenty `partial`, jawnie zachowując
ich status; nie traktuje ich jako rozmiarów całych części.

Panel **Character Scan 1.1** ma skalę samodzielnego skanu twarzy (0 = brak
kalibracji) i **Read eye / lash / brow measurements**, zapisujące tabelę
do nowego bloku Text w Blenderze. **Create reference + measured curves**
tworzy także dokładne kontury oczu/białek/źrenic/rzęs, wraz z otworami.

### Korekta granic do precyzyjnego dopasowania

Automatyczny kandydat wymaga obejrzenia. Dla ręcznie poprawionych konturów
można podać binarną maskę PNG (0/255, rozmiar oryginalnego obrazu):

```json
{
  "feature_masks": {
    "pupil_left": {
      "path": "/absolute/path/pupil-left.png",
      "source_sha256": "SHA256_ORIGINAL_REFERENCE",
      "status": "partial"
    }
  }
}
```

W pełnym skanie ten obiekt trafia do `face`. Maska zastępuje tylko wskazaną
cechę; nie zmienia automatycznie pozostałych. Zapisujemy jej pochodzenie i hash,
odrzucamy niezgodny obraz źródłowy, rozmiar, przezroczyste piksele i wyjście poza
ROI. Wynik pozostaje jawną adnotacją użytkownika, nie automatycznym wykryciem.

Ograniczenia: cień i blik mogą zasłaniać granicę źrenicy; jasna skóra może być
podobna do białka; rzęsy i eyeliner tworzą wspólną ciemną sylwetkę. Kolorystyczna
maska tęczówki może zawierać podobnie zabarwione piksele źrenicy, więc nie jest
rozłącznym podziałem semantycznym. Obrys otworu oka wykorzystuje roboczą
maskę tęczówki z domknięciem jednopikselowych przerw i wypełnieniem otworów.
To hipoteza segmentacji, nie pomiar brakujących fragmentów. Ukryte końce brwi,
pojedyncze włoski rzęs i głębokość gałki ocznej pozostają nieustalone.

## Pełny skan: od referencji do prowadnic Blendera

Wersja 1.0 łączy sylwetkę, twarz, włosy, kontrolę zasłonięć, fragmenty stroju,
widocznej skóry i wyposażenia oraz lokalny kontrast detali powierzchni.
Panel Blendera: **View3D → N → Character Scan**. Nazwa modułu instalacyjnego
pozostaje `polpal_face_scan`, aby zachować ustawienia wcześniejszych wersji.

```bash
python3 -m pip install -r tools/character-scan/requirements.txt
python3 tools/character-scan/character_scan.py scan output/character-scan/reference.png \
  --out output/character-scan/new-full-scan --profile aiko-front --height-mm 1800 \
  --hints tools/character-scan/examples/aiko-registration.json
```

Ostatni argument rejestruje obraz do istniejącego studium Aiko. Dla innego modelu
pomiń go albo ustaw własną rejestrację. `--profile silhouette-only` wyłącza
hipotezy części Aiko; nadal analizuje sylwetkę i próbuje rozpoznać twarz/włosy.
Nie nadpisujemy katalogu wynikowego — za każdym razem podaj nowy.

### Moduły i zakres

| Moduł | Wynik |
| --- | --- |
| `body_scan.py` | Alfa/jednolite tło, rzeczywiste przebiegi pikseli w rzędach, przekroje, skala umowna, przycięcie kadru |
| `face_scan.py` | Tęczówki, fragmenty brwi, kontur skóry, kandydaci ust/nosa/piegów |
| `hair_scan.py`, `occlusion.py` | Maska kandydatów włosów i wykluczenia przy dopasowaniu twarzy |
| `part_scan.py` | Hipotezy kurtki, kołnierza, topu, szortów, skarpet, butów, skóry dłoni/brzucha/nóg i wyposażenia |
| `character_scan.py` | Wspólny raport, mapy lokalnego kontrastu ubrań, zestawienie wyników i porównanie dwóch skanów |
| `character_geometry.py` | Kontrola schematu, sum kontrolnych i rejestracji, dane prowadnic |

Profil `aiko-front` zawiera jawne przedziały wyszukiwania względem sylwetki
i palety kolorów. To **hipotezy dopasowane do referencji Aiko**, nie wyuczony
uniwersalny segmentator. Części są oznaczane `partial`, a przy braku pasujących
pikseli — `unknown`. Podobne kolory, cień, skóra/szorty lub pasy mogą się mieszać.
Konflikty klasyfikacji zostają nieprzypisane; wynik nie zgaduje zwycięskiej etykiety.

Raport nie odtwarza głębokości, anatomii pod ubraniem, ukrytych powierzchni,
indywidualnych pasm, palców, szwów ani materiałowego albedo. Mapa kontrastu
może zawierać pikowanie, fakturę, szwy lub oświetlenie — nie jest mapą głębokości.
Prowadnice i fragmenty 2D nie stanowią gotowego modelu do gry.

### Wyniki pełnego skanu

- `character-scan.json`: wspólny raport, źródła hipotez, podpowiedzi, statusy,
  rejestracja oraz sumy SHA-256 artefaktów;
- `overview.jpg`, `parts-overlay.png`, `body-overlay.png`, `unresolved-overlay.png`;
- `masks/`: sylwetka, części, konflikty, nieprzypisane piksele i lokalny kontrast;
- `evidence/`: przezroczyste obrazy widocznych fragmentów części;
- `face/`: pełny wynik wcześniejszych modułów twarzy/włosów, jeśli lokalizacja się udała;
- `width-profile.csv`, `report.md`, `modelling-evidence.json` z pomiarami oraz
  jawną listą wymiarów wymagających interpretacji modelarskiej.

Brak twarzy nie blokuje analizy sylwetki i części. Błędne jawne podpowiedzi
przerywają skan zamiast zostać ukryte pod statusem `unknown`. Zmieniony obraz
lub brakujący/uszkodzony artefakt uniemożliwia import nieaktualnego pakietu.

### Panel i instalacja

```bash
python3 tools/character-scan/package_addon.py output/character-scan/polpal-character-scan-1.1.0.zip
```

Zainstaluj ZIP przez Preferences → Add-ons → Install from Disk i włącz
**Polpal Character Scan**. Zewnętrzny Python musi mieć biblioteki z `requirements.txt`.

1. Wskaż referencję, zewnętrzny Python, katalog wyjściowy i profil.
2. **Scan whole character locally** uruchamia pełny przepływ; **Scan face only**
   pozostawia dostęp do samodzielnego skanu twarzy. Esc anuluje proces.
3. Pełny raport ustawia rejestrację. Sprawdź ją przed tworzeniem prowadnic.
4. **Create full-character evidence guides** tworzy referencję odsuniętą do
   porównania, przekroje i przełączane warstwy w `AI_Work`. Obrazy są pakowane
   w `.blend`. Warstwy części/klasyfikacji są początkowo ukryte — włączaj je
   w Outlinerze. To geometria prezentacyjna i obserwacje 2D, nie rekonstrukcja.
5. W sekcji twarzy pozostają krzywe, fragmenty brwi i dopasowanie kopii twarzy
   z pomijaniem odrzuconych odcinków.
6. **Candidate full scan → Compare full scans** porównuje dwa pakiety. Również CLI:

```bash
python3 tools/character-scan/character_scan.py compare reference/character-scan.json \
  candidate/character-scan.json --out comparison.json
```

IoU dotyczy wyłącznie wyrównanej sylwetki 2D. Różnice rozmiarów części dotyczą
widocznych fragmentów i są zależne od światła oraz zasłonięć. Używaj tej samej
pozy i widoku. Wynik nie jest oceną podobieństwa twarzy ani jakości modelu 3D.

### Podpowiedzi dla pełnego skanu

Plik JSON ma pola `face` (dotychczasowe podpowiedzi twarzy), `registration`,
`parts` i `notes`. Przykład własnej hipotezy fragmentu wyposażenia:

```json
{
  "parts": {
    "prop_fragment": {
      "group": "equipment",
      "polygon_px": [[20, 800], [150, 820], [140, 920], [25, 900]],
      "palette": "object"
    },
    "held_equipment": {"disabled": true}
  },
  "notes": "Przykładowy region; dopasuj współrzędne do oryginalnego obrazu"
}
```

Można podać `region_px: [x0,y0,x1,y1]` zamiast wielokąta. Palety: `teal`,
`light`, `brown`, `warm`, `skin`, `object` (wszystkie piksele pierwszego planu
w regionie). Grupy: `body`, `clothing`, `equipment`. Nazwy istniejących części
nadpisują ich hipotezę; nowe nazwy dodają część. Podpowiedzi pozostają w raporcie
jako dane wejściowe. Wielokąt nie potwierdza automatycznie poprawności etykiety.

### Kontrole wydania

`tests/test_character_scan.py` sprawdza m.in. brak twarzy, przezroczystość,
konflikty bez priorytetów, luki między nogami, podpowiedzi, skalę, integralność
pakietu, porównania i kompletność ZIP. `tests/blender_character_scan.py` sprawdza
import całości na osobnej kopii Aiko, zachowanie istniejących siatek, pakowanie
obrazów i rejestrację prowadnic; zapisuje render diagnostyczny.

## Starszy CLI sylwetki (`scan.py`)

Pomiar widocznej sylwetki postaci z jednego obrazu — najczęściej z widoku
z przodu. Narzędzie liczy szerokości co do piksela, przelicza je na milimetry
przy podanej wysokości odniesienia i zapisuje punkty pomiarowe, proporcje,
paletę kolorów oraz podgląd z naniesionymi liniami.

To **nie jest** rekonstrukcja 3D. Pojedynczy obraz nie zawiera tyłu, głębokości
ani ukrytych powierzchni, więc pomiar opisuje wyłącznie widok z przodu. Może
służyć jako wymaganie dla modelu i punkt odniesienia przy porównywaniu kolejnych
renderów.

## Wymagania

- Python 3.10 lub nowszy,
- `numpy`,
- `Pillow`.

```bash
python3 -m pip install numpy Pillow
```

Narzędzie nie korzysta z Blendera, sieci ani GPU.

## Pomiar referencji

```bash
python3 tools/character-scan/scan.py scan output/character-scan/reference.png \
  --out output/character-scan/aiko --height-mm 1800
```

`--height-mm` to założona wysokość postaci. Wszystkie wymiary w milimetrach
zależą od tej wartości; obraz nie niesie własnej skali. Dla referencji Aiko
(`1773 px`) i `1800 mm` skala wynosi `1.0152 mm/px`.

W katalogu wynikowym powstają:

| Plik | Zawartość |
| --- | --- |
| `measurements.json` | pełny wynik: skala, bbox, punkty pomiarowe, proporcje, symetria, paleta, ostrzeżenia |
| `width-profile.csv` | szerokość sylwetki w każdym rzędzie: `y`, `y_ratio`, `left`, `right`, `width_px` |
| `overlay.png` | referencja z liniami pomiarowymi i opisami |
| `report.md` | czytelne podsumowanie tabelaryczne |

Punkty pomiarowe:

- `top_of_head` — czubek sylwetki (włosów lub głowy),
- `head_max` — największa szerokość w górnych 32% wysokości,
- `arm_span` — największa szerokość całej sylwetki,
- `waist` — najwęższy przekrój torsu między ramionami a krokiem,
- `hip` — najszerszy przekrój między talią a krokiem,
- `crotch` — pierwszy rząd z rozdzieleniem nóg,
- `lower_leg_min` — najwęższy przekrój nóg,
- `ground` — maksymalna szerokość w ostatnim 1% wysokości.

Sekcja `face` (opcjonalna, gdy na obrazie widać parę tęczówek i skórę twarzy):

- wykrywa dwa turkusowe/niebieskie plamy tęczówek w górnej części postaci
  (podobny rozmiar, podobna wysokość, symetria względem osi),
- mierzy widoczną skórę twarzy (HSV: ciepłe, mało nasycone plamy), jej
  najszerszy przekrój, brodę i wysokość widocznej twarzy,
- podaje linię oczu, rozstaw wykrytych plam tęczówek (nie źrenic) i rozmiar tęczówki w pikselach
  i milimetrach,
- **szerokość twarzy to skóra (zwykle z uszami), nie objętość włosów** —
  `head_max` obejmuje włosy, `face.face_width_mm` nie,
- brak pary oczu oznacza `face: null`; narzędzie nie zgaduje twarzy.

Wymaga `scipy` (etykietowanie komponentów). Bez `scipy` sekcja `face`
nie powstaje, reszta pomiaru działa jak dotąd.

## Porównanie z renderem

```bash
python3 tools/character-scan/scan.py compare \
  output/character-scan/reference.png render-front.png \
  --out output/character-scan/compare
```

Wynik zawiera `compare.json` oraz `compare.png` (referencja na czerwono,
kandydat na niebiesko, część wspólna na fioletowo). `silhouette_iou` to
stosunek części wspólnej do sumy sylwetek po unormowaniu wysokości.
Sylwetki są **wyrównane po osi postaci** (nie po środku kadru), więc
referencja z rekwizytami po jednej stronie nie przesuwa kandydata.
Raport podaje też szerokości względne w dziewięciu punktach wysokości —
liczone jako suma przebiegów w oknie ±6% wysokości wokół osi, dzięki czemu
młot trzymany w dłoni nie zawyża pomiaru torsu.

Warunki sensownego porównania:

- ten sam widok i ta sama poza (np. T-pose lub A-pose),
- kamera ortograficzna z przodu, bez perspektywy,
- cała postać w kadrze, bez przycięcia,
- przezroczyste tło albo jednolite tło różniące się od postaci,
- brak rekwizytów, które w referencji i renderze są inne.

Porównanie normalizuje wysokość, więc ocenia proporcje, a nie bezwzględną
skalę. Nie ocenia głębokości, tyłu, topologii, UV, tekstur ani animacji.

## Jak wyznaczana jest maska

- Jeżeli obraz ma kanał alfa i co najmniej 0,5% pikseli jest przezroczystych,
  maską jest `alpha > 127`.
- W przeciwnym razie tło jest szacowane z czterech narożników, a maską są
  piksele różniące się od niego o więcej niż 12 w dowolnym kanale RGB.
- Render zapisany jako RGBA, ale w pełni nieprzezroczysty, automatycznie
  przechodzi na tryb tła.

## Ograniczenia i typowe pułapki

- **Jedna perspektywa.** Brakuje głębokości i ukrytych powierzchni; nie da się
  z tego odtworzyć modelu „co do milimetra” w 3D.
- **Przycięty kadr.** Jeśli sylwetka dotyka lewej lub prawej krawędzi,
  rozpiętość ramion jest tylko dolną granicą. Narzędzie zgłasza to
  w `warnings`.
- **Włosy i rekwizyty.** Mogą scalać się z sylwetką i zawyżać szerokość głowy,
  bioder lub rozpiętości. `arm_span` bywa szerszy niż same ręce.
- **Heurystyki.** Talia, biodra i krok są wykrywane z profilu szerokości.
  Przy nietypowej pozie lub szerokich spodniach wynik może wymagać korekty.
- **Paleta.** K-means na pikselach sylwetki daje przybliżone kolory regionów,
  a nie materiały ani tekstury.
- **Milimetry.** Są wynikiem założonej wysokości, nie pomiarem z obrazu.
- **Brak oceny 3D.** Narzędzie nie sprawdza riggingu, wag, klipów ani
  poprawności siatki.

## Współpraca z Forge i Blenderem

1. Zmierz referencję i zachowaj `measurements.json`.
2. Wygeneruj lub zbuduj kandydata (np. przez
   [Polpal Forge](../blender-forge/README.md)).
3. Wyrenderuj go z przodu kamerą ortograficzną, w tej samej pozie, z alfa lub
   jednolitym tłem.
4. Uruchom `compare` i obejrzyj `compare.png` oraz różnice szerokości.
5. Popraw proporcje, powtórz render i porównanie. Dla pełnej oceny dodaj
   osobno widok z boku i z tyłu — ten skaner ich nie zastępuje.

## Testy

```bash
python3 -m unittest discover -s tools/character-scan/tests -p 'test_*.py'
```

Testy używają wyłącznie syntetycznych sylwetek: sprawdzają maskę alfa i tło,
punkty pomiarowe, przeliczanie milimetrów, przycięcie kadru oraz porównanie
identycznych i przeskalowanych obrazów.

## Face Scan — moduł szczegółowych obserwacji twarzy (prototyp)

`face_scan.py` analizuje twarz, a `blender_face_scan.py` udostępnia panel
**View3D → Sidebar → Face Scan**. Jest to pierwszy etap rozpoznawania postaci:
obserwacje 2D → krzywe pomiarowe → edytowalne fragmenty brwi / dopasowanie kopii
twarzy. Pełna generacja postaci, ubrań i włosów nie jest jeszcze zaimplementowana.

### Zakres bieżącego backendu

- tęczówki: maski, położenie, rozmiar i obserwowane kolory;
- brwi: widoczne fragmenty, linia środkowa, grubość i nachylenie;
- skóra: maska i profil szerokości widocznego obszaru poniżej oczu;
- usta i nos: kandydaci znalezieni na podstawie lokalnego kontrastu;
- piegi: kandydaci drobnych ciemnych plamek, z położeniem i powierzchnią;
- paleta dla poszczególnych masek, w przestrzeni sRGB.

To jawne heurystyki dla ciepłej skóry, turkusowych tęczówek i różowych brwi,
**nie uniwersalny model rozpoznawania semantycznego**. Różowe włosy przy brwiach
powodują oznaczenie brwi jako niepełnych. Kolory zawierają wpływ oświetlenia.
Maska skóry może obejmować szyję i pomijać cień; nie jest gotowym obrysem czaszki.
Nie udajemy odzyskania niewidocznego podbródka ani anatomii spod włosów.

Statusy danych: `candidate` (obserwacja wymagająca oceny), `partial` (fragment),
`unknown` (brak wyniku). Brak kalibrowanej pewności procentowej. Pochodzenie
podpowiedzi i hash obrazu są zapisane w raporcie. Lewo/prawo oznacza strony obrazu.

### Uruchomienie lokalne

Zewnętrzny Python potrzebuje `numpy`, `Pillow` i `scipy`:

```bash
python3 tools/character-scan/face_scan.py scan output/character-scan/reference.png \
  --out output/character-scan/face-new
```

Katalog wyjściowy musi być nowy. Wyniki: `face-scan.json`, `overlay.png`,
`face-overlay.png`, `masks/*.png`, `report.md`. Wszystkie współrzędne odnoszą się
do **oryginalnego obrazu**, bez niezależnego przeskalowywania części twarzy.

Przy niewykrytej parze oczu można podać `--hints hints.json`:

```json
{
  "eye_centers_px": [[505, 765], [670, 765]],
  "roi": [381, 600, 794, 938],
  "notes": "Ręcznie wskazane środki obszarów wyszukiwania oczu"
}
```

Opcjonalne `regions` zawiera prostokąty `[x0,y0,x1,y1]` (koniec wyłączny)
dla `iris_left`, `iris_right`, `brow_left`, `brow_right`, `skin`, `nose`, `mouth`,
`freckles`. Regiony muszą leżeć w ROI. Podpowiedź lokalizuje wyszukiwanie,
ale nie zmienia brakujących pikseli w pomiary.

### Porównanie skanów

```bash
python3 tools/character-scan/face_scan.py compare reference/face-scan.json \
  candidate/face-scan.json --out comparison.json
```

Wynik porównuje położenia w jednostkach rozstawu oczu, grubość i nachylenie
kompletnych kandydatów. Pomija `partial` i `unknown`. Nie produkuje pojedynczej
liczby „zgodności postaci” i nie ocenia geometrii 3D.

### Panel Blendera

Dodatek można uruchomić z repozytorium (`blender_face_scan.py` w Text Editor →
Run Script) albo zainstalować archiwum z katalogiem `polpal_face_scan`, zawierającym:
`__init__.py` (treść `blender_face_scan.py`), `face_scan.py`, `face_geometry.py`,
`scan.py`, `hair_scan.py`, `occlusion.py`. W preferencjach: Add-ons → Install from Disk,
następnie włącz dodatek.

1. Wybierz obraz i **zewnętrzny Python** z wymaganymi bibliotekami. Skan działa
   w osobnym procesie; Esc przerywa go, a log pozostaje obok wyników.
2. **Load scan registration** wczytuje istniejący JSON i ustawia początkową
   rejestrację. Wskaż `Scanner script`, jeśli dodatek został przeniesiony sam.
3. Dopasuj `Scene units / pixel`, `Image x at world x=0`, `Image y at world z=0`.
   Domyślna rejestracja po wczytaniu służy samodzielnym prowadnicom, nie zakłada
   dopasowania do dowolnego modelu. Dla obecnego Aiko: `1.8/1773`, `580`, `1973`.
4. **Create reference + measured curves** tworzy referencję i krzywe w `AI_Work`.
5. **Generate observed brow fragments** tworzy płaskie siatki wyłącznie widocznych
   fragmentów. Dopasowanie głębokości do czoła jest osobnym krokiem modelarskim.
6. **Create hair evidence image** dodaje przezroczysty obraz pikseli-kandydatów
   włosów, zarejestrowany tak jak referencja. To prowadnica 2D, nie model fryzury.
7. **Fit a copy of selected face** dopasowuje szerokość niezrigowanej siatki
   do wskazanego przedziału widocznego konturu. Wymaga poprawnej rejestracji.
   Ogranicza przesunięcie, zachowuje głębokość, wysokość i środek twarzy. Kopia
   jest odsunięta do porównania; źródłowa siatka pozostaje nienaruszona.

### Wersja 0.2 — moduły włosów i zasłonięć

`hair_scan.py` wyszukuje grube różowe obszary powyżej oczu i połączone z nimi
różowe/turkusowe piksele w obszarze głowy. Pomija maski tęczówek i widocznych
fragmentów brwi. Raport zawiera części maski, ich pola, prostokąty i kolor.
To backend kolorystyczny dla Aiko: ciemne/neutralne pasma, odłączone końcówki
i nakładające się podobne kolory pozostają ograniczeniem. Maska może być niepełna
również wtedy, gdy nie dotyka krawędzi obszaru wyszukiwania.

`occlusion.py` oznacza próbki konturu **oddzielnie dla każdej strony**:
bliskość włosów, krawędź kadrowania i ręcznie wykluczony obszar. Powody są w
`rows[].fit_checks`, a podsumowanie w `occlusion_guard` i panelu dodatku.
„Eligible” oznacza brak wykrytego wykluczenia, a nie potwierdzoną anatomię.
Maska skóry nadal może obejmować szyję i granicę cienia — zakres dopasowania
trzeba wybrać na podglądzie.

Nowe pliki wynikowe:
- `hair-overlay.png`: obszar głowy z niebieskim zaznaczeniem kandydatów włosów;
- `hair-evidence.png`: pełnowymiarowa przezroczysta prowadnica do Blendera;
- `occlusion-overlay.png`: zbliżenie twarzy; czerwone próbki są pomijane,
  zielone nie mają wykrytych wykluczeń.

Dopasowanie używa wyłącznie ciągłych odcinków liczących co najmniej 8 wierszy,
osobno po obu stronach. Nie dopasowuje ani nie interpoluje przez luki i próbki
odrzucone; wygasza przesunięcie na obu końcach każdego odcinka. Wykluczone
pomiary nie wpływają na krzywą celu. Krótkie odcinki mają dodatkowo zmniejszony
limit przesunięcia (kwadrat długości względem rozstawu oczu), aby nie tworzyć
lokalnych wałków skóry. Raporty 0.1 można oglądać, ale przed
dopasowaniem trzeba wykonać nowy skan z kontrolą zasłonięć.

Dodatkowe opcjonalne podpowiedzi JSON (w pikselach oryginalnego obrazu):

```json
{
  "hair_roi": [120, 150, 1080, 1100],
  "exclude_fit_regions": [[400, 760, 470, 850]],
  "notes": "Przykład ręcznego wykluczenia obszaru; współrzędne dobierz do obrazu"
}
```

`hair_roi` jest niezależne od ROI twarzy. `exclude_fit_regions` wyklucza próbki
konturu w prostokątach — pozwala wskazać np. ciemne włosy pominięte przez paletę.
Nie oznacza wykrycia włosów ani nie uzupełnia niewidocznej twarzy. Wszystkie
podpowiedzi zachowywane są w raporcie.

Przy zmianie obrazu po skanowaniu dodatek wymaga nowego skanu. Wszystkie wyniki
są studiami modelarskimi. Moduł nie integruje modeli z grą.

### Kontrole nowego modułu

`tests/test_face_scan.py`: znana syntetyczna geometria i kolory, kierunek/grubość
brwi, zasłonięcie włosami, przezroczystość, brak cech, błędne podpowiedzi,
porównanie po zmianie skali, ograniczenia dopasowania i zachowanie luk.

`tests/blender_face_scan.py`: integracja panelu na kopii istniejącego Aiko,
tworzenie prowadnic i fragmentów brwi, ograniczone dopasowanie kopii twarzy,
zachowanie źródła i współrzędnych głębokości/wysokości. Nie zastępuje oględzin.
