# PolpalUE — lokalnie przygotowany prototyp

Projekt C++/UE przygotowany lokalnie pod **Unreal Engine 5.8**. Repo zawiera
pipeline Blendera, prototypowe assety oraz źródła runtime i narzędzi edytora.
Pełny plan produkcyjny pozostaje w toku; bez UE nie ma potwierdzonego builda,
zaimportowanych assetów UE ani grywalnego PIE. Aktualny status etapów:
[`Docs/implementation-status.md`](Docs/implementation-status.md); kopia planu:
[`Docs/production-plan.source.md`](Docs/production-plan.source.md).

## Wymagania i stan lokalny

Lokalne generowanie i walidacja assetów wymagają Blendera oraz Pythona 3.
Build i bootstrap projektu wymagają **UE 5.8** oraz SDK wybranej platformy.
Na macOS potrzebne są pełne Xcode i platform SDK; Command Line Tools nie
wystarczą.

Ostatni raport środowiska tego Maca wykazał brak UE5 i pełnego Xcode oraz
około 6,8 GiB wolnego miejsca. Niczego nie instalowano ani nie usuwano. Prace
przygotowawcze obejmują lokalne źródła, generowanie assetów w Blenderze,
kontrole niezależne od UE i archiwum do przeniesienia projektu na komputer
z Unreal.

## Polecenia pipeline'u

Uruchamiaj polecenia z katalogu głównego repozytorium:

```bash
python3 tools/ue5-pipeline/run.py doctor
python3 tools/ue5-pipeline/run.py assets
python3 tools/ue5-pipeline/run.py validate-assets
python3 tools/ue5-pipeline/run.py check
python3 tools/ue5-pipeline/run.py package
python3 tools/ue5-pipeline/run.py status
```

`doctor` zapisuje stan narzędzi w `output/ue5-pipeline/environment.json`.
`assets` generuje i waliduje lokalne pliki Blendera. Po klonowaniu uruchom je,
bo binarne assety w `unreal/PolpalUE/Art/Generated/` są ignorowane przez Git;
generator i manifest pozostają w repo, a generowanie aktualizuje hashe
manifestu. `validate-assets` sprawdza istniejący zestaw bez generowania.
`check` wykonuje testy źródeł niezależne od UE. `package` zapisuje
`output/ue5-pipeline/PolpalUE-local-preparation.zip` ze źródłami, wymaganymi
assetami, indeksem hashy i raportem CRC/SHA. Archiwum jawnie oznacza
`unreal_build_verified: false`. `status` porównuje raporty builda, bootstrapu
i automatyzacji z hashem bieżących źródeł; samo przygotowanie lokalne nie
zamyka planu.

Projekt celuje wyłącznie w UE 5.8. Wskaż instalację zmienną `UE_ROOT` albo
parametrem `--engine-root`:

```bash
export UE_ROOT="/ścieżka/do/UE_5.8"
python3 tools/ue5-pipeline/run.py editor-build
python3 tools/ue5-pipeline/run.py bootstrap
python3 tools/ue5-pipeline/run.py verify-engine
python3 tools/ue5-pipeline/run.py status
```

Odpowiednik z argumentem silnika:

```bash
python3 tools/ue5-pipeline/run.py editor-build --engine-root /ścieżka/do/UE_5.8
python3 tools/ue5-pipeline/run.py bootstrap --engine-root /ścieżka/do/UE_5.8
python3 tools/ue5-pipeline/run.py verify-engine --engine-root /ścieżka/do/UE_5.8
```

`verify-engine` wymaga raportu kompilacji dla bieżącego hasha źródeł i uruchamia
testy automatyzacji UE. Obejmuje tylko zarejestrowane testy automatyczne; nie
potwierdza jakości wizualnej, multiplayera, wydajności ani ukończenia planu.
Zmiana źródeł unieważnia wcześniejsze potwierdzenie builda/automatyzacji.

## Assety

Manifest opisuje jednostki metryczne z `unit_scale: 1.0`. Eksport FBX używa
`FBX_SCALE_UNITS`, skali `1.0`, `axis_forward: -Y` i `axis_up: Z`, bez
dodatkowych kości liści. W Blenderze model jest skierowany przodem w `+Y`;
po konwersji osi oczekiwany przód w Unreal to `+X`, ale musi to potwierdzić
import i kontrola w UE. Bootstrap ustawia jawnie `convert_scene_unit: true`
oraz `import_uniform_scale: 1.0`; zachowaj te wartości także przy imporcie
ręcznym. Standardowy biped ma oczekiwaną wysokość 180 cm po konwersji —
reimport FBX w Blenderze nie potwierdza orientacji ani skali w Unreal.

Zestaw zawiera 144 prototypowe artefakty: 5 plików `.blend`, 30 FBX siatek
(po jednej bazowej, czterech LOD i jednej siatce outline na rig), 85 FBX
animacji, 18 póz Aim Offset dla dwóch bipedów, 5 FBX środowiska oraz jedną
mapę wysokości `505×505 PNG_G16`. Walidacja sprawdza hashe i ponowny import
FBX w Blenderze; nie uruchamia importera Unreal.

Siatki postaci mają rigid weights i służą jako prototypy, nie jako finalna
grafika. Rigi są własnymi archetypami, niezależnymi od UE Mannequin; istniejący
`HeroRig` z gry webowej nie był przerabiany. Teren i elementy otoczenia są
oryginalnymi proceduralnymi prototypami, a nie gotowym realistycznym zestawem
Quixel.

## Projekt i mapa prototypowa

Źródła runtime obejmują gracza, capture, drużynę, zapisy, AI i pracę w bazie.
Moduły `PolpalUEEditor` i `PolpalUEFXEditor` zawierają generatory assetów
AnimBP/AI/mapy i Niagara. Są to źródła przygotowane do uruchomienia przez
bootstrap, a nie potwierdzone assety UE.

`DefaultEngine.ini` celowo nadal wskazuje `/Engine/Maps/Entry`. Builder
edytora ma przygotować `/Game/Core/Maps/L_Prototype` z terenem, Camp, Player
Start, usługami, stanowiskami pracy, pięcioma prototypami Pali i boundsami
nawigacji. Wygenerowaną mapę trzeba otworzyć ręcznie po bootstrapie i sprawdzić
raport `unreal/PolpalUE/Saved/Polpal/bootstrap-report.json`; jeśli builder
zatrzyma się na pozycji `pending` lub zachowa istniejącą mapę, oceń ją w
edytorze przed dalszym użyciem. Mapa zawiera Player Start, a gracza tworzy
rodzimy GameMode — builder nie umieszcza drugiego aktora gracza.

Bootstrap i mapa nie zostały jeszcze uruchomione w UE. Sprawdź osie, wysokość,
kości i sockety po imporcie, a następnie nawigację, animacje, zachowanie
gracza i widok sceny w edytorze/PIE.
