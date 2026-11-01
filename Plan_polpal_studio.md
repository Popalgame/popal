# Plan Polpal Studio

**Stan dokumentu:** 1 listopada 2026 r.

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

- [ ] Dodać nakładkę pokazującą osobno: ochronę użytkownika, zamrożenie przez
  brak danych, wygaszanie na końcach fragmentów i efektywny wpływ kontrolek.
- [ ] Sprawdzić, które wierzchołki rzeczywiście tworzą mierzony obrys oraz
  czy dostępne kontrolki mogą poruszyć właśnie ten brzeg.
- [ ] Rozdzielić wkład kamery, niepewności referencji i zakresu deformacji
  poprzez kontrolowane eksperymenty z zachowanymi źródłami.
- [ ] Sprawdzić uogólnione sposoby budowania kontrolek dla krótkich fragmentów,
  z uwzględnieniem sąsiedztwa siatki i łagodnego przejścia do blokad.
- [ ] Przy braku dopuszczalnej korekty podać konkretny brak danych lub konflikt
  wymagań, zamiast ponawiać tę samą optymalizację.

**Kryterium ukończenia:** raport wskazuje, dlaczego lewa kontrolka nie działa
i co ogranicza prawą. Ewentualna zmiana algorytmu działa również na oddzielnych
przypadkach testowych i respektuje ochronę zatwierdzonej geometrii.

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

- [ ] Dodać kontrolę samoprzecięć, gwałtownych zmian normalnych, lokalnego
  rozciągania i granic między ruchomymi a chronionymi obszarami.
- [ ] Rozwijać regularizację deformacji, która ogranicza artefakty bez
  wygładzania zatwierdzonych cech postaci.
- [ ] Dodać stały zestaw neutralnych ujęć kontrolnych i czytelne porównanie przed/po.
- [ ] Rozdzielić statusy jakości technicznej, dopasowania obserwowanego obrysu
  i zatwierdzenia wyglądu.

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
  rewizji kodu, z zachowaniem innych trwających prac.

**Kryterium ukończenia:** zadanie można przerwać i odtworzyć bez utraty źródeł
oraz bez mylenia częściowych artefaktów ze zweryfikowanym kandydatem.

## 6. Zalecana kolejność najbliższych prac

1. **Diagnoza kontrolek i blokad Aiko — P0-A.** Ustalić osiągalny zakres
   korekty, zanim zmienimy siłę optymalizacji.
2. **Nowe dane i walidacja detektora — P0-B.** Rozstrzygnąć widoczne fragmenty,
   zachowując uczciwe luki danych; można prowadzić równolegle z punktem 1.
3. **Nowy kandydat i oględziny — P0-C.** Dopiero po wykazaniu dopuszczalnej zmiany.
4. **Jakość powierzchni i adapter bazy — P1-A/P1-C.** Utrwalić rozwiązanie
   jako funkcję programu, nie jednorazową poprawkę Aiko.
5. **Wiele ujęć — P1-B**, gdy dostępne będą odpowiednie referencje.
6. **Rysy twarzy → włosy → sylwetka i strój → materiały — P2.**
7. **Automatyczny rig/eksport — P3-A**, po uzyskaniu właściwego wyglądu.

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
