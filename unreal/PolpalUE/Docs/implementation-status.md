# Stan implementacji lokalnego projektu UE

## Zakres i środowisko

Lokalna część przygotowań jest rozwinięta, lecz **pełny plan pozostaje
w toku**. Projekt wskazuje UE 5.8. Ostatni raport `doctor` nie wykrył UE5 ani
pełnego Xcode na tym Macu; dostępne było około 6,8 GiB wolnego miejsca. Niczego nie
instalowano ani nie usuwano. Edytor UE, UHT, kompilacja modułów, bootstrap,
PIE i multiplayer nie zostały uruchomione. Najbliższą bramką jest komputer
z UE 5.8 i wymaganymi SDK.

## Status etapów

| Etap | Przygotowane lokalnie | Nadal wymagane |
|---|---|---|
| 1. Pipeline i projekt | Skrypty pipeline'u, projekt UE 5.8, manifest, pakowanie i raportowanie oparte na hashach źródeł. Lokalne kontrole i przenośne reguły C++ można wykonać bez silnika. | Build edytora i wygenerowanie aktualnych raportów w UE. `verify-engine` wymaga aktualnego build receipt i nie zastępuje wizualnej, multiplayerowej ani wydajnościowej akceptacji. |
| 2. Rigi i assety | Blender 5.2.2 zweryfikował 5 plików `.blend`, 30 FBX siatek/LOD/outline, 85 FBX animacji, 18 póz Aim Offset, 5 FBX środowiska i mapę wysokości G16 — łącznie 144 artefakty z manifestu. | Import UE i kontrola skali, osi, socketów, animacji i LOD w edytorze; prototypy wymagają dalszego modelowania i polishu artystycznego. |
| 3. Import i animacja | Bootstrap i moduł Editor zawierają importera, buildery BlendSpace 1D, Aim Offset dla dwóch bipedów, warstwowego AnimBP, jump/fall/land, montaży i notifies przekazywanych przez natywny interfejs runtime. Runtime ma natywne grafy IK dla stóp (biped i quadruped, z korektą miednicy) oraz dłoni. | Całość nie została skompilowana ani wygenerowana w UE. Prawdziwy asset/graph Control Rig nadal nie jest zaimplementowany; ustawienie socketów, rezultat wizualny, animacje i przejścia wymagają kontroli w PIE. |
| 4. Rdzeń rozgrywki | Źródła opisują widoczną, replikowaną kulę capture, atak gracza na RMB, fizyczne pociski umiejętności Pali, obrażenia autorytatywne po stronie serwera, drużynę do pięciu stworzeń oraz poziomy, umiejętności i pasywy. Party i Camp mają rekordy zapisu v2 z `FGuid`, transformacją i `SourceActorPath`. | UHT i kompilacja w UE, uruchomienie capture/ataku/zapisu/odczytu w PIE oraz weryfikacja replikacji. Test przenośnych reguł C++ nie kompiluje modułów Unreal. |
| 5. AI i baza | Runtime ma rezerwacje Feed/Bed/HotSpring, zapas jedzenia i odzyskiwanie needs; zadania bazowe z priorytetami; serwerowe Blackboard/Behavior Tree i natywne EQS SingleResult odświeżane nie częściej niż raz na sekundę. W trybie abstrakcyjnym produkcja jest naliczana co 5 s. | W PIE sprawdzić nawigację i AI. Nieposiadane Pali są zapisywane do rekordów, niszczone w oddalonym trybie i odtwarzane po powrocie. Posiadane aktory pozostają ukryte z wyłączonym brain/tick zamiast być niszczone; to odstępstwo od pełnej wirtualizacji wymaga akceptacji i profilowania. |
| 6. Materiały, FX i środowisko | Bootstrap ma źródła generatorów M_PalToon/M_PalOutline, instancji kolorów, species assets, outline followers i prototypowej mapy/landscape. `PolpalUEFXEditor` buduje osiem systemów Niagara CPU z rendererem sprite, modułem spawn rate i kontrolą kompilacji. | Żaden generator UE nie był uruchomiony; shadery i API silnika nie są zweryfikowane. FX są prototypami sprite — ElectricArc nie jest finalnym ribbonem/efektem błyskawicy. Teren i środowisko są stylizowane/proceduralne; docelowy art direction i polish nadal są otwarte. |
| 7. Sieć i wydajność | Źródła stosują autorytet serwera, replikację stanu oraz snapshot drużyny widoczny tylko właścicielowi; istnieją LOD-y i przełączanie trybu abstrakcyjnego. | Wymagane są testy serwer + dwóch klientów w PIE, weryfikacja replikacji i cyklu aktorów, URO oraz profilowanie. Testy lokalne nie są dowodem działania sieci ani wydajności w UE. |

Raport assetów (`output/ue5-pipeline/validation.json`) potwierdza hashe i
ponowny import FBX w Blenderze, nie w Unreal. Blender wyeksportował model
skierowany w `+Y`; po konwersji oczekiwany przód w UE to `+X`. Oczekiwane
180 cm dla standardowego bipedu również wymaga pomiaru po imporcie w UE.

## Mapa, wejścia i animacja

Builder edytora ma tworzyć `/Game/Core/Maps/L_Prototype`: teren G16 `505×505`
ze spacingiem `200 cm`, oryginalne środowisko, Camp, Player Start, punkty
Feed/Bed/HotSpring, stanowiska, prototypy pięciu Pali i `NavMeshBoundsVolume`
z geometrią `UCubeBuilder`. `DefaultEngine.ini` celowo pozostaje na
`/Engine/Maps/Entry`; po bootstrapie mapę prototypową należy otworzyć ręcznie.
Builder nie umieszcza aktora gracza: GameMode tworzy postać z natywnym
appearance, co ma zapobiec podwójnemu graczowi. To zachowanie wymaga runtime
kontroli w PIE.

Źródłowe mapowania wejścia: WASD i mysz, Space — skok, LMB — kula capture,
RMB — atak, Q — przywołanie, R — odwołanie. Sterowanie nie zostało sprawdzone
w działającym PIE. Builder animacji przygotowuje cztery fazy lokomocji,
warstwę od `spine_01`, Aim Offset z 9 pozami dla każdego z dwóch bipedów oraz
montaże z notifies; strafe/backward i finalne timing notifies nadal wymagają
pracy.

## Następna kolejność po uzyskaniu UE 5.8

1. Uruchomić `check`, skompilować edytor, wykonać `bootstrap` i przejrzeć
   raporty oraz wszystkie pozycje `pending`.
2. Otworzyć `/Game/Core/Maps/L_Prototype` lub ręcznie naprawić/utworzyć poziom
   i podłączyć Camp; sprawdzić import, przód osi, standardowe 180 cm, kości,
   sockety, animacje i LOD.
3. Dokończyć rzeczywisty Control Rig oraz zweryfikować grafy animacji, EQS,
   Behavior Tree, usługi bazy, landscape i FX na assetach UE.
4. Uruchomić single-player capture, atak, drużynę, potrzeby, zapis/odczyt
   i pracę w Camp.
5. Uruchomić serwer i dwóch klientów w PIE; sprawdzić autorytet, replikację,
   zapisy, wirtualizację Camp i powrót aktorów.
6. Na końcu wykonać kontrolę stylu wizualnego oraz profilowanie wielu aktorów,
   URO i trybu abstrakcyjnego; dopiero dowody tych kontroli mogą domknąć plan.

Po zmianie źródeł najpierw odśwież build receipt przez `editor-build`, a potem
uruchom `verify-engine` i `status`; raporty z innym hashem nie potwierdzają
aktualnej wersji projektu.

Ostatnie lokalne kontrole zakończyły się powodzeniem: 15 testów Pythona,
przenośne reguły C++20 (w tym AddressSanitizer i UndefinedBehaviorSanitizer)
oraz walidacja 144 artefaktów Blendera. Żadna z tych kontroli nie uruchamia UE.

Pełny plan źródłowy: [`production-plan.source.md`](production-plan.source.md).
