# Blender — przewodnik pracy agenta AI

Aktualizacja: 2026-10-31. Zakres: sposób pracy z Blenderem zgodny z oficjalną
dokumentacją zainstalowanej wersji. Ten plik nie opisuje wymagań konkretnego
zasobu ani nie ustala wartości modelarskich — takie dane należą do dokumentacji
projektu.

## 1. Status dokumentu i hierarchia źródeł

Przeczytaj cały ten plik przed każdym użyciem Blendera, zgodnie z `AGENTS.md`.
Również po wznowieniu zadania lub skróceniu kontekstu. Nie zastępuj lektury
pamięcią wcześniejszej wersji dokumentu.

Dokument jest standardem pracy, nie certyfikatem kompetencji i nie gwarancją
poprawnego modelu. Samo przeczytanie go nie oznacza potwierdzenia jakości
wykonanej pracy.

Rozróżniaj trzy rodzaje informacji:

- **[D] Dokumentacja Blendera** — jak działa funkcja. Źródło: oficjalny manual
  i API dla zainstalowanej wersji (sekcja 12).
- **[Z] Zalecenie warsztatowe** — procedura przyjęta tutaj dla bezpieczeństwa
  i kontroli jakości. Nie jest regułą Blendera.
- **[K] Kontrakt projektu** — wymagania konkretnego zasobu: kości, klipy,
  skala, sposób eksportu. Ten plik go nie zawiera. W tym repozytorium znajduje
  się w [`docs/blender-project-contract.md`](docs/blender-project-contract.md);
  czytaj go tylko wtedy, gdy zadanie dotyczy istniejącego zasobu.

Hierarchia: oficjalna dokumentacja właściwej wersji → zachowanie zainstalowanej
wersji sprawdzone w praktyce → ten przewodnik. Przy sprzeczności wygrywa
dokumentacja i rzeczywiste API; wtedy zaktualizuj ten plik.

Nie polegaj na zapamiętanych nazwach parametrów, wartościach domyślnych,
limitach, nazwach kości ani rozmiarach. Sprawdź je w dokumentacji właściwej
wersji i w działającej aplikacji. Dokumentacja `dev` i `latest` oraz starsze
poradniki mogą opisywać inne menu, Actions, slots lub opcje eksportu.

## 2. Ustalenie stanu przed pracą [Z]

1. Odczytaj wersję Blendera (`bpy.app.version`), ścieżkę pliku, scenę, tryb,
   aktywny obiekt, zaznaczenie, jednostki, kolekcje i profil renderu.
2. Sprawdź dostępność Pythona i potrzebnych dodatków. Jeśli Python jest
   wyłączony, nie obchodź tego innym kanałem wykonania kodu — poproś
   użytkownika o włączenie.
3. Po otwarciu pliku, zmianie sceny lub imporcie odczytaj stan ponownie.
   Nie używaj identyfikatorów ani referencji z poprzedniego stanu.
4. Nie modyfikuj równolegle tej samej sceny z kilku sesji.
5. Stan z poprzedniej sesji nie jest dowodem stanu obecnego.

## 3. Bezpieczeństwo zmian [Z]

- Zachowaj punkt przywracania i pracuj na osobnym kandydacie. Nie nadpisuj
  zatwierdzonego zasobu podczas eksperymentów.
- Zapisz ustawienia zmieniane tymczasowo: klatkę, akcję, slots, wyciszenie NLA,
  Rest/Pose, widoczność, kamerę i parametry renderu. Przywróć je w `try/finally`.
- Po błędzie sprawdź faktyczny stan. Checkpoint nie cofa częściowo wykonanych
  operacji automatycznie.
- Wykonuj małe, odwracalne kroki i porównuj wynik. Nie powtarzaj ślepo całego
  skryptu po niepowodzeniu.
- Proste zmiany grupuj w jedną operację. Do siatki, wag i eksportu używaj
  Pythona, gdy jest dostępny i potrzebny.
- Po zakończeniu pozostaw otwarty właściwy plik roboczy z czytelnym widokiem
  modelu, a nie przypadkową scenę walidacyjną.

## 4. Diagnoza przed poprawką [Z]

Najpierw ustal, **co powoduje widoczny błąd**. Zachowaj porównywalny render
przed zmianą. Oglądaj model w neutralnym oświetleniu z przodu, obu boków,
z tyłu i pod kątem 3/4; dla obszarów o drobnej geometrii dodaj zbliżenie
bez maskującego kadru.

| Objaw | Pierwsza kontrola | Dalsze działanie |
| --- | --- | --- |
| Poprawny w Rest, zły w Pose | Wagi i kości odpowiedzialne za obszar, Armature, aktywne akcje | Napraw skinning; nie rzeźb deformacji animacyjnej |
| Występuje również w Rest | Siatka bazowa, przekroje, normalne, modyfikatory | Lokalna korekta kształtu lub topologii |
| Szczeliny po wygładzaniu | Rozdzielone wierzchołki, granice siatki, różne wagi | Ustal przyczynę; nie stosuj globalnego Merge by Distance |
| Plamy na teksturze | Base Color, UV, przypisania materiałów, normal map | Oddziel błąd tekstury od błędu powierzchni |
| Blender wygląda dobrze, eksport źle | Eksportowana scena, bind pose, mapy, wspierane shadery | Reimport i podgląd w docelowym rendererze |
| Model wygląda jak dwie nałożone postacie | Lista scen, kolekcji i zakres eksportu | Usuń z eksportu modele porównawcze i inne sceny |

Przełączaj Rest Position i Pose Position świadomie. Edit Mode pokazuje bazowy
szkielet; zmiana w tym trybie może zmienić jego definicję, nie tylko bieżącą
pozę.

Przy deformacjach sprawdź, czy kilka akcji lub NLA nie działa jednocześnie,
czy obiekt nie ma dwóch modyfikatorów Armature i czy wierzchołki nie mają
przypadkowych grup deformujących. Zachowaj pomiar przed i po poprawce.

## 5. Modelowanie [D/Z]

Zacznij od sylwetki, proporcji i czytelności formy. Oceniaj model zarówno
z bliska, jak i w docelowej wielkości na ekranie. Tożsamość wizualną — fryzurę,
strój, wyposażenie i wyraz — określa dokumentacja projektu; nie wymyślaj jej
w trakcie pracy.

Gdy potrzebna jest zmiana topologii, planuj przepływ krawędzi pod deformacje
w obszarach, które będą się zginać. Automatyczny remesh nie zastępuje
przemyślanej topologii animowanego modelu.

Nie traktuj zwiększenia liczby wielokątów ani rozdzielczości obrazu jako
samodzielnego dowodu poprawy jakości. Subdivision nie odzyska brakujących
detali źródła. Smooth Shading poprawia interpolację normalnych, nie obrys
formy. Decimate redukuje geometrię i może zmienić sylwetkę; parametr Ratio
odnosi się do trójkątów, a maski grup wpływają na rozkład redukcji. Wynik
zawsze obejrzyj, nie oceniaj wyłącznie liczby.

Na modelu z UV i rigiem nie uruchamiaj globalnego remeshu, spawania ani
wygładzania bez planu zachowania lub odtworzenia UV, wag i materiałów.
Wierzchołki o zbliżonej pozycji mogą należeć do różnych powierzchni. Wykonuj
małe, odwracalne operacje i porównuj ich wynik.

## 6. Rigowanie i wagi [D/Z]

Nazwy kości i suma wag nie dowodzą poprawnej deformacji. Oceniaj ruch, nie
tylko dane liczbowe.

Procedura diagnostyczna:

1. Odtwórz objaw w konkretnej pozie i porównaj ją z Rest.
2. Wypisz wpływy kości na problematyczne wierzchołki i ich otoczenie.
3. Wyznacz obszar anatomiczny na podstawie geometrii, materiałów i sąsiedztwa.
   Nie wybieraj go wyłącznie według wysokości, koloru tekstury lub odległości
   od kości — można objąć sąsiednie części ubrania.
4. Usuń niezamierzone wpływy kości z obszaru, który nie powinien się deformować.
5. Sprawdź granicę poprawki i zduplikowane wierzchołki szwów. Identyczne
   pozycje z różnymi wagami mogą rozchodzić się w animacji.
6. Przetestuj ruch pojedynczych kości i łańcuchów. Sprawdź, czy sąsiednie
   obszary nie są ciągnięte i czy granice nie pękają.
7. Odtwórz wszystkie klipy, których dotyczy zmiana, i oceń też szyję, ubranie
   i włosy, nie tylko fragment wskazany przez użytkownika.

Narzędzia Normalize All oraz Limit Total służą do porządkowania wag;
normalizacja pojedynczej grupy nie jest tym samym co normalizacja sumy
wpływów. Uwzględniaj grupy zablokowane. Transfer wag jest punktem wyjścia
do kontroli, nie automatycznym zatwierdzeniem skinningu.

Liczbę wpływów na wierzchołek i sposób normalizacji określa format docelowy.
Sprawdź jego specyfikację i wymagania projektu; nie zakładaj wartości z pamięci.

Nie stosuj Apply Transforms ani zmiany rest pose na gotowym rigu bez kontroli
macierzy wiązania, parent inverse i skutków dla animacji.

## 7. Materiały, UV i prezentacja [D/Z]

Rozdziel problem UV, tekstury, normalnych i oświetlenia. Korzystaj z materiałów
obsługiwanych przez eksport i docelowy renderer. Efekt toon widoczny
w Blenderze może wymagać osobnego shadera w silniku gry — nie obiecuj jego
przeniesienia wyłącznie przez zapis pliku.

Materiały przypisuj na podstawie rzeczywistych powierzchni, nie wyłącznie
położenia lub wysokości. Maska „wszystko powyżej określonego poziomu" może
objąć również podniesione elementy wyposażenia. Sprawdź wynik z każdej strony.

Oceniaj Base Color bez światła oraz finalny materiał pod neutralnym światłem.
Kontroluj szwy UV, rozciągnięcia, artefakty atlasu, normal map i roughness.
Nie usuwaj wszystkich detali mapy tylko po to, żeby zakryć lokalny błąd.

Porównania przed/po muszą używać tej samej pozy, kamery, światła, ekspozycji
i transformacji widoku. Zarządzanie kolorami wpływa na prezentację tonów
i jasnych kolorów; render studyjny nie jest dowodem zgodnego wyglądu
w silniku docelowym.

## 8. Python i API [D/Z]

Przed użyciem operatora sprawdź tryb, aktywny obiekt, zaznaczenie i scenę.
Gdy to wystarcza, operuj na danych zamiast polegać na stanie interfejsu.
Nie uruchamiaj równoległych wątków modyfikujących dane Blendera. Dokumentacja
ostrzega o problemach kontekstu, trybów i referencji do danych.

Reguły skryptowania:

- Po zastosowaniu modyfikatora, dołączeniu siatek lub przeładowaniu pliku
  pobierz ponownie potrzebne obiekty i grupy. Nie używaj starej referencji RNA.
- Nazwa z sufiksem `.001` nie jest dowodem tożsamości obiektu. Po imporcie
  filtruj obiekty według typu, sceny, powiązanego rigu i oczekiwanych danych.
  Import może utworzyć pomocnicze siatki kształtów kości.
- Rozróżniaj lokalne `vertex.co` i współrzędne świata przez `matrix_world`.
  Nie używaj współrzędnych zdeformowanej pozy do edycji siatki bazowej bez
  poprawnego przeliczenia.
- Dla evaluated mesh używaj dependency graph i zwalniaj wynik `to_mesh()`
  przez `to_mesh_clear()` po pomiarze.
- Zmiany tymczasowych ustawień przywracaj w `try/finally`. Skrypt powinien
  wykrywać ponowne uruchomienie albo jasno deklarować, że jest jednorazowy.
- Zapisuj raporty do plików, ale nie nazywaj ich „passed", jeśli nie wykonano
  odpowiedniej kontroli. Zachowuj informację o wersji badanego artefaktu.

## 9. Eksport [D/Z]

1. Sprawdź dokumentację eksportera dla zainstalowanej wersji. Nazwy i znaczenie
   opcji zmieniają się między wersjami — nie kopiuj ich z innej wersji ani
   z poradników.
2. Ustal zakres eksportu: zaznaczenie, aktywna scena, kolekcje. Sprawdź, co
   faktycznie zostanie zapisane i czy w pliku nie znajdą się lampy, kamery,
   modele porównawcze ani nieoskórowana kopia.
3. Dobierz ustawienia skinningu i animacji zgodnie z dokumentacją formatu
   i wymaganiami projektu.
4. Odczytaj zapisany plik: liczbę scen, siatek, materiałów, skinów, kości,
   klipów, atrybutów JOINTS/WEIGHTS, rozmiar i trójkąty. Porównaj z zamierzeniem,
   nie z liczbą z pamięci.
5. Zaimportuj plik do osobnej sceny i przeprowadź kontrole z sekcji 10.

Podziały UV i normalnych mogą zwiększyć liczbę wierzchołków względem Blendera.
Nie traktuj samej różnicy liczby jako błędu. Materiały i animacje mają
ograniczenia formatu — sprawdź specyfikację i zachowanie docelowego modułu
importującego.

## 10. Kryteria odbioru [Z]

Kontrole dopasuj do zmiany; nie powtarzaj niepowiązanych pełnych zestawów
bez powodu. Wymagane są:

- Porównanie przed/po z tych samych ujęć, bez maskującego kadru.
- Rest i Pose oraz ruchy izolujące źródło deformacji.
- Oględziny granic poprawki, sąsiedztwa i szwów: brak nowych szczelin, ostrych
  klinów, zapadnięć i rozciągnięć.
- Wagi uporządkowane zgodnie z wymaganiami formatu i projektu; poprawny zestaw
  grup kości i spójny szkielet bazowy.
- Kontrola po reimporcie, w tym próbkowanie istotnych chwil animacji: minimum
  początek, środek i koniec każdego zachowanego klipu. Jeśli problem pojawia
  się pomiędzy próbkami, zagęść kontrolę i obejrzyj pełny ruch.
- Odświeżenie renderów i raportu dla **ostatniego** eksportu, nie dla wersji
  sprzed poprawki. W raporcie zapisz sumę kontrolną badanego pliku.

Skończone współrzędne, ograniczone bounds i zgodne nazwy klipów są kontrolami
technicznymi. Nie potwierdzają prawidłowej anatomii, braku przenikania ani
jakości ruchu. Render po reimporcie i oględziny są osobnymi wymaganiami.

Przy integracji z aplikacją lub silnikiem sprawdź rzeczywisty loader,
wyposażenie, animacje, światło i cienie. Zmierz czas ładowania, pamięć
i płynność na docelowych urządzeniach. Nie wnioskuj o FPS z liczby trójkątów.
Warianty jakościowe i urządzenia oceniaj osobno. Aktualizacja ścieżek i cache
należy do wdrożenia, nie do samego przygotowania kandydata.

## 11. Zakończenie i przekazanie pracy [Z]

Zapisz końcowy `.blend`, eksport i podglądy w uzgodnionym miejscu. Sprawdź,
czy użytkownik ogląda wersję odpowiadającą zapisanym plikom. Nie kasuj cudzych
materiałów, scen ani wcześniejszych zatwierdzonych zasobów w ramach porządków.

Raportuj konkretnie: przyczynę błędu, zakres zmiany, pliki, wykonane kontrole
i pozostałe ograniczenia. Rozróżniaj „kandydat wyeksportowany", „sprawdzony
w Blenderze", „sprawdzony w aplikacji" oraz „wdrożony". Nie nazywaj poprawki
gotową, jeżeli znany błąd nadal występuje lub końcowy eksport nie został
sprawdzony.

## 12. Oficjalne źródła [D]

Punktem wejścia jest [Blender Manual 5.2 LTS](https://docs.blender.org/manual/en/5.2/).
Czytaj tematy w kolejności: topologia → rig i wagi → materiały → animacje →
eksport → Python. Przy konkretnej naprawie zacznij od rozdziału diagnostycznego.

| Materiał | Do czego go używać |
| --- | --- |
| [Remeshing i retopologia][retopo] | Dobór topologii do rzeźbienia i deformacji |
| [Decimate][decimate] | Redukcja geometrii i wpływ masek |
| [Armature Properties][armature] | Rozróżnienie Rest/Pose |
| [Weight Paint — edycja][weights] | Normalize All, transfer i ograniczanie wpływów |
| [glTF 2.0][gltf] | Eksport materiałów, skórowania i animacji |
| [Color Management][color] | Interpretacja wyglądu podglądu |
| [Python API — Gotchas][api] | Kontekst, tryby i bezpieczne referencje do danych |

Źródła zweryfikowano 2026-10-31: wszystkie linki prowadzą do angielskiej
dokumentacji **5.2 LTS** i zwracają stronę o oczekiwanym tytule. To gałąź
odpowiadająca lokalnemu Blenderowi 5.2.2, ale dokumentacja opisuje wydanie,
nie konkretny build — parametr i tak sprawdź w działającej aplikacji.
Pozostałe procedury tego pliku są zaleceniami warsztatowymi, a nie cytatem
ani obietnicą autorów Blendera.

[retopo]: https://docs.blender.org/manual/en/5.2/modeling/meshes/retopology.html
[decimate]: https://docs.blender.org/manual/en/5.2/modeling/modifiers/generate/decimate.html
[armature]: https://docs.blender.org/manual/en/5.2/animation/armatures/properties/introduction.html
[weights]: https://docs.blender.org/manual/en/5.2/sculpt_paint/weight_paint/editing.html
[gltf]: https://docs.blender.org/manual/en/5.2/addons/import_export/scene_gltf2.html
[color]: https://docs.blender.org/manual/en/5.2/render/color_management/displays_views.html
[api]: https://docs.blender.org/api/5.2/info_gotcha.html
