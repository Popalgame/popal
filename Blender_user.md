# Blender — przewodnik pracy specjalistycznej dla agentów AI w Polpal

Aktualizacja: 2026-10-31. Zakres: modelowanie, postacie anime, rigowanie,
animacja, materiały, automatyzacja i eksport zasobów do tej gry.

## 1. Obowiązek i sposób korzystania

Przeczytaj cały ten plik przed każdym użyciem Blendera, zgodnie z `AGENTS.md`.
Następnie wybierz procedurę odpowiadającą zadaniu. Ten dokument jest standardem
pracy projektu, nie certyfikatem kompetencji ani gwarancją poprawnego modelu.
Nie określaj siebie jako eksperta tylko dlatego, że go przeczytałeś.

Rozróżniaj trzy rodzaje informacji:

- **Dokumentacja Blendera:** zasady działania funkcji; źródła w sekcji 12.
- **Kontrakt projektu:** formaty, kości, klipy i sposób ładowania zasobów.
- **Zalecenia warsztatowe:** procedury diagnostyki i kontroli jakości przyjęte tutaj.

Przy zmianie wersji Blendera lub nieznanym parametrze sprawdź dokumentację
odpowiadającą zainstalowanej wersji oraz rzeczywiste właściwości API.
Nie kopiuj bez sprawdzenia kodu z innej wersji. Dokumentacja `dev`, `latest`
i starsze poradniki mogą opisywać inne menu, Actions, slots lub opcje eksportu.

## 2. Kontekst projektu i pliki

Aktywna gra to przeglądarkowa PWA wykorzystująca **Three.js r128**.
Katalog `unreal/PolpalUE/` zawiera osobne przygotowania do Unreal;
nie stosuj jego konwencji osi i eksportu do aktywnego webowego runtime.

| Element | Lokalizacja względem repozytorium |
| --- | --- |
| Ładowanie bohatera | `site/src/modules/imported-hero.js` |
| Bohater desktop / mobile | `site/assets/models/hero-rigged.glb`, `hero-mobile.glb` |
| Lokomocja / walka | `site/assets/models/hero-locomotion.glb`, `hero-combat.glb` |
| Kandydat Anime Remaster | `docs/assets/hero-anime-remaster.blend`, `.glb` |
| Opis dotychczasowego modelu | `docs/hero-model.md` |
| Opis kandydata i ograniczeń | `docs/hero-anime-remaster.md` |
| Most do Blendera | `tools/blender-mcp/README.md`, `blender_ai_addon.py` |

Przed modyfikacją potwierdź aktualny kontrakt w kodzie i dokumentacji projektu.
Wersja zgłoszona przez lokalny most podczas tej pracy: Blender 5.2.2 LTS.
To zapis obserwacji, nie założenie dla kolejnych sesji.

**Stan do ponownego sprawdzenia:** po eksporcie Anime Remaster użytkownik
zgłosił kanciasty prawy policzek. Porównanie Rest/Pose wykazało niepożądany
wpływ barku i ramienia na dolną część twarzy. Praca nad wagami w otwartej
scenie została przerwana przed końcową walidacją i ponownym eksportem.
Nie uznawaj wcześniejszego raportu za dowód naprawienia policzka; porównaj
aktualną scenę, zapisany `.blend` i `.glb` przed dalszym działaniem.

## 3. Rozpoczęcie pracy i zarządzanie sceną

1. Ustal cel wizualny, obszar zmiany i docelowy zasób. Przy poprawce policzka
   nie przebudowuj całej postaci ani nie podmieniaj jej w grze bez potrzeby.
2. Po przeczytaniu tego przewodnika odczytaj `blender_scene`; sprawdź ścieżkę
   pliku, scenę, tryb, obiekt aktywny, zaznaczenie, jednostki, kolekcje i profil.
3. Przed Pythonem potwierdź `blender_status`. Jeśli Python jest wyłączony,
   użytkownik musi włączyć `Allow full local Python` w panelu AI Bridge.
   Nie obchodź wyłączenia innym kanałem wykonywania kodu.
4. Korzystaj z aktualnego `scene_id`. Po otwarciu pliku lub zmianie sceny
   odczytaj scenę ponownie. Nowe obiekty umieszczaj w kolekcji roboczej profilu.
5. Zachowaj punkt przywracania. Pracuj na osobnym kandydacie; nie nadpisuj
   zatwierdzonego modelu gry podczas eksperymentów.
6. Zapisz ustawienia, które tymczasowo zmieniasz: klatkę, akcję, slots,
   wyciszenie NLA, Rest/Pose, widoczność, kamerę i parametry renderu.
7. Po błędzie sprawdź faktyczny stan. Checkpoint nie oznacza automatycznego
   wycofania częściowo wykonanych operacji. Nie powtarzaj ślepo całego skryptu.

Proste zmiany grupuj w `blender_apply_batch`. Do siatki, wag i eksportu używaj
Pythona, gdy jest dostępny i potrzebny. Nie zmieniaj równolegle jednej sceny
przez kilku agentów. Po zakończeniu pozostaw otwarty właściwy plik roboczy,
z czytelnym widokiem postaci, a nie przypadkową scenę walidacyjną.

## 4. Diagnostyka przed poprawianiem

Najpierw ustal, **co powoduje widoczny błąd**. Zachowaj porównywalny render
przed zmianą. Oglądaj model w neutralnym oświetleniu z przodu, obu boków,
z tyłu i pod kątem 3/4; dla twarzy dodaj zbliżenie bez uciętej żuchwy.

| Objaw | Pierwsza kontrola | Dalsze działanie |
| --- | --- | --- |
| Policzek poprawny w Rest, zły w Pose | Wagi Head/Neck/Shoulder/Arm, Armature, aktywne akcje | Napraw skinning; nie rzeźbuj deformacji animacyjnej |
| Występ również w Rest | Siatka bazowa, przekroje, normalne, modyfikatory | Lokalna korekta kształtu/topologii |
| Szczeliny po wygładzaniu | Rozdzielone wierzchołki, granice siatki, różne wagi | Ustal przyczynę; nie stosuj globalnego Merge by Distance |
| Plamy na włosach lub skórze | Base Color, UV, przypisania materiałów, normal map | Oddziel błąd tekstury od błędu powierzchni |
| Blender wygląda dobrze, GLB źle | Eksportowana scena, bind pose, mapy i wspierane shadery | Reimport i podgląd w docelowym rendererze |
| Model wygląda jak dwie nałożone postacie | Lista scen i węzłów eksportu | Usuń z eksportu modele porównawcze i inne sceny |

Przełączaj Rest Position / Pose Position świadomie. Edit Mode pokazuje bazowy
szkielet; zmiana w tym trybie może zmienić jego definicję, nie tylko bieżącą
pozę. Zasada rozróżnienia pozycji: [Armature Properties][armature].

Przy deformacjach sprawdź też, czy kilka akcji/NLA nie działa jednocześnie,
czy obiekt nie ma dwóch modyfikatorów Armature i czy wierzchołki nie mają
przypadkowych grup deformujących. Zachowaj pomiar przed i po poprawce.

## 5. Modelowanie postaci anime

Zacznij od sylwetki, proporcji głowy i ciała oraz wyrazu twarzy. Oceniaj postać
zarówno z bliska, jak i w docelowej wielkości na ekranie gry. Zachowaj uzgodnioną
tożsamość: fryzurę, duże oczy, kurtkę, plecak i charakter postaci.

Przy twarzy kontroluj łuk policzka, płynne przejście do żuchwy, podbródek,
usta, powieki i osadzenie uszu. Sprawdzaj obie strony, ale nie narzucaj pełnej
symetrii fryzurze ani zamierzonemu wyrazowi twarzy. Nie maskuj złej anatomii
ustawieniem kamery, włosami lub światłem.

Gdy potrzebna jest zmiana topologii, planuj przepływ krawędzi pod deformacje
wokół oczu, ust, barków, łokci i kolan. Automatyczny remesh nie zastępuje
przemyślanej topologii animowanej postaci: [Remeshing i retopologia][retopo].

Nie traktuj zwiększenia liczby wielokątów ani rozdzielczości obrazu jako
samodzielnego dowodu poprawy jakości. Subdivision nie odzyska brakujących
detali źródła. Smooth Shading poprawia interpolację normalnych, nie obrys
policzka. Decimate redukuje geometrię i może zmienić sylwetkę; parametr Ratio
odnosi się do trójkątów, a maski grup wpływają na rozkład redukcji
([Decimate][decimate]). Wynik zawsze obejrzyj, nie oceniaj wyłącznie liczby.

Na modelu z UV i rigiem nie uruchamiaj globalnego remeshu, spawania ani
wygładzania bez planu zachowania lub odtworzenia UV, wag i materiałów.
Wierzchołki o zbliżonej pozycji mogą należeć do różnych powierzchni. Wykonuj
małe, odwracalne operacje i porównuj ich wynik.

## 6. Rigowanie i naprawa wag

Nazwy kości i suma wag nie dowodzą poprawnej deformacji. Dla tego bohatera
utrzymuj maksymalnie cztery wpływy deformujących kości na wierzchołek,
nieujemne skończone wartości i sumę bliską 1. To kontrakt obecnego eksportu
projektu, a nie uniwersalny limit Blendera.

Narzędzia Normalize All oraz Limit Total służą do uporządkowania wag;
Normalize pojedynczej grupy nie jest tym samym co normalizacja sumy wpływów.
Uwzględniaj grupy zablokowane. Transfer wag jest punktem wyjścia do kontroli,
nie automatycznym zatwierdzeniem skinningu ([Weight Paint][weights]).

Procedura poprawki policzka, ucha lub podbródka:

1. Odtwórz objaw w konkretnej pozie i porównaj ją z Rest.
2. Wypisz wpływy kości na problematyczne wierzchołki i ich otoczenie.
3. Wyznacz obszar anatomiczny. Nie wybieraj go wyłącznie według wysokości Z,
   koloru tekstury lub odległości od kości: można objąć również kołnierz.
4. Usuń niezamierzone wpływy barków/rąk z twarzy. Przy obecnym prostym rigu
   powierzchnia głowy powinna podążać za Head; przejście do szyi wymaga
   świadomego rozkładu wag. Nie przenoś całej kurtki do Head.
5. Sprawdź granicę poprawki i zduplikowane wierzchołki szwów. Identyczne
   pozycje z różnymi wagami mogą rozchodzić się w animacji.
6. Przetestuj ruch samych ramion przy nieruchomej głowie: policzki nie powinny
   się rozciągać. Następnie obróć głowę: żuchwa i uszy mają podążać za nią,
   bez ciągnięcia barków i rozrywania kołnierza.
7. Odtwórz klipy obejmujące idle, chód, bieg, atak i rzut. Oceń również szyję,
   ubranie i włosy, nie tylko fragment wskazany przez użytkownika.

Nie normalizuj wag pomocniczych masek modelowania tak, jakby były kośćmi.
Nie stosuj Apply Transforms ani zmiany rest pose na gotowym rigu bez kontroli
macierzy wiązania, parent inverse i skutków dla animacji.

## 7. Materiały, UV i prezentacja

Rozdziel problem UV, tekstury, normalnych i oświetlenia. Korzystaj z materiałów
obsługiwanych przez eksport glTF i używaną wersję Three.js. Efekt toon widoczny
w Blenderze może wymagać osobnego shadera w grze; nie obiecuj jego przeniesienia
wyłącznie przez zapis GLB.

W tym projekcie wyznaczaj materiały włosów, skóry, kurtki i butów na podstawie
rzeczywistych powierzchni. Maska „wszystko powyżej określonego Z to włosy” może
pomalować również podniesioną broń. Sprawdź wynik z każdej strony.

Oceniaj Base Color bez światła oraz finalny materiał pod neutralnym światłem.
Kontroluj szwy UV, rozciągnięcia, artefakty atlasu, normal map i roughness.
Nie usuwaj wszystkich detali mapy tylko po to, żeby zakryć lokalny błąd.

Porównania przed/po muszą używać tej samej pozy, kamery, światła, ekspozycji
i transformacji widoku. AgX wpływa na prezentację tonów i jasnych kolorów;
render studyjny nie jest dowodem zgodnego wyglądu w silniku
([Color Management][color]).

## 8. Python i narzędzia bez przypadkowych skutków

Przed użyciem operatora sprawdź tryb, aktywny obiekt, zaznaczenie i scenę.
Gdy to wystarcza, operuj na danych zamiast polegać na stanie interfejsu.
Nie uruchamiaj równoległych wątków modyfikujących dane Blendera.
Dokumentacja ostrzega o problemach kontekstu, trybów i referencji do danych:
[Python API — Gotchas][api].

Projektowe reguły skryptowania:

- Po zastosowaniu modyfikatora, dołączeniu siatek lub przeładowaniu pliku
  pobierz ponownie potrzebne obiekty/grupy. Nie używaj starej referencji RNA.
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
- Zapisuj raporty do plików, ale nie nazywaj ich „passed”, jeśli nie wykonano
  odpowiedniej kontroli. Zachowuj informację o wersji badanego artefaktu.

## 9. Kontrakt eksportu do gry

Obecny bohater używa 22 kości z nazwami `mixamorig:*`. Zachowaj ich hierarchię,
transformacje bazowe oraz połączenie z wagami. Główny model ma klipy
`idle`, `walk`, `run`, `swim`, `hit`, `throw`, `jump`. Pakiety lokomocji i walki
mają dodatkowe wymagania opisane w kodzie importera; ich zgodność wymaga
porównania nazw i typów ścieżek animacji.

Dla istniejącego pipeline: wysokość około 1,8 jednostki, stopy przy Y=0
w glTF, kierunek twarzy glTF +Z. Blender używa Z jako osi wysokości;
nie dopisuj dodatkowego obrotu bez sprawdzenia konwersji eksportera.
Zachowaj kości dłoni i poprawne mocowanie wyposażenia.

Procedura eksportu kandydata:

1. Zapisz edytowalny `.blend` oraz zapakuj wymagane tekstury.
2. Eksportuj wyłącznie model i rig z właściwej sceny. W używanej tutaj wersji
   sprawdzone parametry to `use_selection=True` i `use_active_scene=True`.
   Samo zaznaczenie nie ochroni przed obiektami zaznaczonymi w innej scenie.
3. Sprawdź ustawienia skórowania i animacji. W tej sesji używano GLB,
   `export_skins=True`, `export_all_influences=False` oraz trybu NLA_TRACKS.
   Nie zmieniaj sposobu eksportu akcji bez sprawdzenia dostępnych opcji.
4. Odczytaj zapisany GLB: liczba scen, siatek, materiałów, skinów, kości,
   klipy, atrybuty JOINTS/WEIGHTS, rozmiar pliku i trójkąty. Nie eksportuj
   lamp, kamer, modeli porównawczych ani nieoskórowanej kopii bohatera.
5. Zaimportuj GLB do osobnej sceny, przeprowadź sekcję 10 i obejrzyj wynik.

W glTF podziały UV i normalnych mogą zwiększyć liczbę wierzchołków względem
Blendera. Nie traktuj samej różnicy liczby jako błędu. Materiały i animacje
mają ograniczenia formatu: [glTF 2.0][gltf].

## 10. Kryteria odbioru

Kontrole dopasuj do zmiany; nie powtarzaj niepowiązanych pełnych zestawów
bez powodu. Dla poprawki twarzy wymagane są:

- Porównanie zbliżenia przed/po, front, obie strony i 3/4 bez maskującego kadru.
- Rest i Pose oraz ruchy ramion i głowy izolujące źródło deformacji.
- Oględziny granic poprawki, szyi i kołnierza: brak nowych szczelin, ostrych
  klinów, zapadnięć i rozciągnięć.
- Znormalizowane wagi, poprawne grupy kości, zgodność bazowego szkieletu.
- Kontrola po reimporcie GLB, w tym próbkowanie istotnych chwil animacji;
  minimum początek, środek i koniec każdego zachowanego klipu. Jeśli problem
  pojawia się pomiędzy próbkami, zagęść kontrolę i obejrzyj pełny ruch.
- Odświeżenie renderów i raportu dla **ostatniego** eksportu, nie dla wersji
  sprzed poprawki. W raporcie zapisz SHA-256 badanego pliku.

Skończone współrzędne, ograniczone bounds i zgodne nazwy klipów są kontrolami
technicznymi. Nie potwierdzają prawidłowej anatomii, braku przenikania ani
jakości ruchu. Render po reimporcie i oględziny są osobnymi wymaganiami.

Przy integracji z grą dodatkowo sprawdź rzeczywisty GLTFLoader, wyposażenie,
animacje, światło i cienie w runtime. Zmierz czas ładowania, pamięć i płynność
na docelowych urządzeniach. Nie wnioskuj o FPS z liczby trójkątów.
Wariant desktop i mobile oceniaj osobno. Aktualizacja ścieżek i cache service
workera należy do wdrożenia, nie do samego przygotowania kandydata.

## 11. Zakończenie i przekazanie pracy

Zapisz końcowy `.blend`, eksport i podglądy w uzgodnionym miejscu. Sprawdź,
czy użytkownik ogląda wersję odpowiadającą zapisanym plikom. Nie kasuj cudzych
materiałów, scen ani wcześniejszych zatwierdzonych zasobów w ramach porządków.

Raportuj konkretnie: przyczynę błędu, zakres zmiany, pliki, wykonane kontrole
i pozostałe ograniczenia. Rozróżniaj „kandydat wyeksportowany”, „sprawdzony
w Blenderze”, „sprawdzony w grze” oraz „wdrożony”. Nie nazywaj poprawki gotową,
jeżeli znany błąd nadal występuje lub końcowy eksport nie został sprawdzony.

## 12. Oficjalne materiały do nauki i sprawdzania szczegółów

Punktem wejścia jest [Blender Manual](https://docs.blender.org/manual/en/latest/).
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

Źródła wyszukano 2026-10-31. Część bezpośrednich odczytów dokumentacji była
niedostępna; wykorzystano dostępne indeksowane treści oficjalnych stron.
Linki poniżej wskazują odnalezione wydania, w tym starsze i rozwojowe.
Nie wszystkie opisują lokalne 5.2.2: przed użyciem szczegółów API wybierz
w dokumentacji właściwą wersję i sprawdź parametry w działającym Blenderze.
Pozostałe procedury tego pliku są regułami projektu i wnioskami z lokalnej
pracy, a nie cytatem ani obietnicą autorów Blendera.

[retopo]: https://docs.blender.org/manual/en/dev/modeling/meshes/retopology.html
[decimate]: https://docs.blender.org/manual/en/2.90/modeling/modifiers/generate/decimate.html
[armature]: https://docs.blender.org/manual/ar/4.0/animation/armatures/properties/introduction.html
[weights]: https://docs.blender.org/manual/id/5.1/sculpt_paint/weight_paint/editing.html
[gltf]: https://docs.blender.org/manual/en/4.1/addons/import_export/scene_gltf2.html
[color]: https://docs.blender.org/manual/en/dev/render/color_management/displays_views.html
[api]: https://docs.blender.org/api/current/info_gotcha.html?highlight=gotcha
