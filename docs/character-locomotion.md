# Lokomocja bohatera

## Zasady animacji

Naturalny krok zaczyna się od wiarygodnego kontaktu stopy z podłożem. Klipy
chodu, truchtu i biegu mają wspólną fazę kontaktu: lewa stopa ląduje w fazie 0,
a prawa w 0,5 cyklu. Dzięki temu przejście między tempami zachowuje położenie
kroku, zamiast przeskakiwać do początku animacji. Drzewa mieszania animacji
stosują tę zasadę przez wyrównanie kontaktu w znormalizowanej fazie
([Unity Blend Trees](https://docs.unity3d.com/Manual/class-BlendTree.html)).

Animacje przygotowane w Blenderze zachowują stałą długość kości. Położenie
kolana wylicza analityczne rozwiązanie dwukościowego łańcucha w płaszczyźnie
strzałkowej; skrypt nie używa constraintu IK z pole targetem. To rozróżnienie
jest istotne przy opisie sposobu sterowania płaszczyzną kolana, który Blender
udostępnia w swoim solverze IK
([Blender IK Solver](https://docs.blender.org/manual/en/latest/animation/constraints/tracking/ik_solver.html)).
Klipy są w miejscu: pozycję bohatera nadal wyznacza kontroler gry, a faza
kroku postępuje o przebyty dystans, nie o sam czas. To ogranicza bieg w miejscu
przy zablokowanym ruchu i odpowiada zasadzie dopasowania animacji do pokonanego
dystansu ([Unreal Distance Matching](https://dev.epicgames.com/documentation/unreal-engine/distance-matching-in-unreal-engine)).

## Zasób i odtwarzanie w grze

Skrypt [`scripts/build-hero-locomotion.py`](../scripts/build-hero-locomotion.py)
tworzy klipy `walk`, `jog` i `run` z istniejącego szkieletu, zapisuje projekt
Blendera w [`docs/assets/hero-locomotion.blend`](assets/hero-locomotion.blend)
i eksportuje pakiet animacji do
[`site/assets/models/hero-locomotion.glb`](../site/assets/models/hero-locomotion.glb).
Wynikowe GLB zawiera oryginalny szkielet i trzy akcje; plik raportu
[`hero-locomotion-report.json`](assets/hero-locomotion-report.json) zapisuje
parametry cykli i prędkości nominalne. Klipy wypiekano przy 96 klatkach/s;
pakiet GLB ma około 82,5 KB. Eksport animacji jest wypiekany, a akcje
przygotowuje się osobno, resetując pozę przed każdą z nich — zgodnie z
zaleceniami eksportera glTF dla Blendera ([eksporter glTF](https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html),
[dokumentacja glTF 4.2](https://docs.blender.org/manual/id/4.2/addons/import_export/scene_gltf2.html)).

Moduł `site/src/modules/imported-hero.js` ładuje ten GLB jako opcjonalny pakiet
do używanego w projekcie three.js r128. Prędkość ruchu miesza klipy w ciągły
sposób, a każda instancja postaci ma własny mikser i fazę; podgląd postaci nie
steruje animacją gracza. Akcje `hit` i `throw` zachowują dotychczasowe
nakładanie. Jeśli pakiet jest nieobecny lub nie przejdzie walidacji, pozostają
wbudowane klipy modelu. Odtwarzanie i wagi akcji zapewnia `AnimationAction`
([three.js](https://threejs.org/docs/pages/AnimationAction.html)); projekt nie
importuje wtyczek Unreal.

Prędkości sterowania gry pozostają na poziomie 5 jednostek/s i 8 jednostek/s
([ustawienia sterowania PC w `hero-model.md`](hero-model.md)). Przy krótkiej,
około 0,585-jednostkowej nodze bohatera naturalny chód przy 5 jednostkach/s
wymagałby nierealistycznego kroku. Zasób ma prędkości nominalne `walk` ≈ 0,923,
`jog` ≈ 4,992 i `run` = 8 jednostek/s, więc przy domyślnej prędkości PC
przechodzi w trucht, a przy biegu z Shift — w bieg z krótszym podparciem i fazą
lotu. Runtime odczytuje metadane `speed`; pole raportu `gameTargetSpeed` (dla
chodu 1,8) jest informacyjne i nie steruje animacją.

Weryfikacja surowego GLB obejmowała 240 próbek cyklu oraz 500 próbek centralnej
fazy podparcia na płaskim podłożu. Przy prędkościach nominalnych mediana dryfu
stopy wyniosła 0,00043 dla chodu, 0,0186 dla truchtu i 0,0657 jednostki/s dla
biegu; 90. percentyl odpowiednio 0,00138, 0,0558 i 0,1846 jednostki/s. Test
potwierdził też skierowane do przodu kolana, brak krzyżowania torów stóp i
zachowanie długości kości w próbkach. Są to wyniki samego GLB w warunkach
próbkowania; nie opisują ruchu w runtime ani zachowania na pochyłym terenie,
przy skrętach czy zmianach kierunku.

## Zakres

To proceduralnie przygotowane klipy dla tego konkretnego modelu, nie animacja
mocap ani gwarancja jakości AAA. Dopasowanie kroku do prędkości jest oparte na
przebytym dystansie, ale nie wykonuje osobnej korekty stóp dla pochyłego lub
nierównego terenu; takie podłoże wymaga późniejszego systemu rozmieszczania
stóp. Ograniczanie nadmiernego wydłużania kroku jest znaną techniką retargetingu,
a deformowanie nóg dla terenu pochyłego ma odrębne ograniczenia
([Unreal Pose Warping](https://dev.epicgames.com/documentation/unreal-engine/pose-warping-in-unreal-engine)).

## Sprawdzenie w grze

W przeglądarce PC sprawdzono nowy pakiet, trucht przy zwykłym ruchu, sprint
z Shift, skręt i wygaszenie ruchu po zatrzymaniu. Nagranie z rzeczywistej
sceny znajduje się w `output/playwright/locomotion-gameplay.mp4`.
Pełna kontrola `npm run check`: ESLint i 59 testów zaliczonych. Dodatkowa
kontrola wszystkich faz wyeksportowanej animacji potwierdziła wysokość kostek
powyżej 0,08 jednostki na płaskim podłożu.

Na podłączonym fizycznym Androidzie potwierdzono model `hero-mobile.glb`
i pakiet `hero-locomotion.glb`, powolny ruch joystickiem i trucht. Pojedyncza
30-sekundowa próba RAF w profilu Auto dała 59,80 FPS, p95 16,70 ms,
816 × 310 CSS px, DPR 3. Profil Auto był ustawiany ponownie podczas próby,
więc wynik dotyczy jego bazowej jakości, nie testu adaptacji rozdzielczości.
W osobnej próbie profil 3K (zidentyfikowany przez stan renderera; starszy
rejestrator oznaczył go jako `unknown`) dał 17,84 FPS i p95 124,60 ms przy
904 × 406 CSS px. Różne ustawienia i rozmiary okna nie pozwalają na ścisłe
porównanie. Wynik Auto nie gwarantuje 60 FPS w innych scenach i urządzeniach;
tryb 3K pozostaje zbyt ciężki dla tego telefonu.
