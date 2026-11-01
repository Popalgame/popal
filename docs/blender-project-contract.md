# Kontrakt Blendera dla zasobów Polpal

Ten plik zawiera wymagania konkretnego projektu. Przewodnik
[`Blender_user.md`](../Blender_user.md) opisuje **sposób pracy**; ten dokument
mówi, **co ma spełniać zasób**. Aktualizuj go razem z kodem importu i dokumentacją
modelu.

## Runtime

- Aktywna gra to przeglądarkowa PWA wykorzystująca Three.js r128.
- Modele ładuje `site/vendor/GLTFLoader.js` wraz z `SkeletonUtils.js`.
- Katalog `unreal/PolpalUE/` to osobne przygotowanie do Unreal. Nie stosuj jego
  konwencji osi i eksportu do aktywnego runtime webowego.

## Pliki

| Element | Lokalizacja względem repozytorium |
| --- | --- |
| Ładowanie bohatera | `site/src/modules/imported-hero.js` |
| Bohater desktop / mobile | `site/assets/models/hero-rigged.glb`, `hero-mobile.glb` |
| Lokomocja / walka | `site/assets/models/hero-locomotion.glb`, `hero-combat.glb` |
| Kandydat Anime Remaster | Polpal Studio, katalog roboczy: `candidates/hero-anime-remaster/` (`.blend`, `.glb`) |
| Opis modelu | `docs/hero-model.md` |
| Opis kandydata | Polpal Studio: [`docs/hero-anime-remaster.md`](https://github.com/Popalgame/polpal-studio/blob/main/docs/hero-anime-remaster.md) |
| Most do Blendera | Polpal Studio: [`blender-mcp/`](https://github.com/Popalgame/polpal-studio/tree/main/blender-mcp) (`README.md`, `blender_ai_addon.py`) |
| Cel wizualny Aiko i sposób pracy | Polpal Studio: [`docs/aiko-cel-wizualny.md`](https://github.com/Popalgame/polpal-studio/blob/main/docs/aiko-cel-wizualny.md) |
| Połączenie ze Studio | [`polpal-game.json`](../polpal-game.json), [`polpal-studio.md`](polpal-studio.md) |

## Rig i animacje

- Bohater używa 22 kości z nazwami `mixamorig:*`. Zachowaj hierarchię,
  transformacje bazowe i połączenie z wagami.
- Główny model ma klipy: `idle`, `walk`, `run`, `swim`, `hit`, `throw`, `jump`.
- Pakiety lokomocji i walki mają dodatkowe wymagania opisane w kodzie importera;
  ich zgodność wymaga porównania nazw i typów ścieżek animacji.
- Zachowaj kości dłoni i poprawne mocowanie wyposażenia.

## Wagi

- Maksymalnie cztery wpływy deformujących kości na wierzchołek.
- Wartości nieujemne i skończone, suma bliska 1.
- To kontrakt obecnego eksportu projektu, a nie uniwersalny limit Blendera.

## Skala i orientacja

- Wysokość około 1,8 jednostki.
- Stopy przy Y=0 w glTF.
- Kierunek twarzy w glTF: +Z.
- Blender używa Z jako osi wysokości. Nie dopisuj dodatkowego obrotu bez
  sprawdzenia konwersji eksportera.

## Eksport

**Integracja z grą wyłącznie po osobnej decyzji użytkownika.** Generowanie,
walidacja i zapisywanie kandydatów nie upoważnia do podmiany modeli w `site/`,
zmiany importera ani wdrożenia. Polecenie „kontynuuj” nie zmienia tej zasady.

Procedura dla obecnego pipeline'u, sprawdzona w tej sesji:

1. Zapisz edytowalny `.blend` i zapakuj wymagane tekstury.
2. Eksportuj wyłącznie model i rig z właściwej sceny:
   `use_selection=True`, `use_active_scene=True`. Samo zaznaczenie nie ochroni
   przed obiektami zaznaczonymi w innej scenie.
3. Ustaw skórowanie i animacje: `export_skins=True`,
   `export_all_influences=False`, tryb NLA_TRACKS.
4. Odczytaj zapisany GLB: sceny, siatki, materiały, skiny, kości, klipy,
   atrybuty JOINTS/WEIGHTS, rozmiar i trójkąty. Bez lamp, kamer i modeli
   porównawczych.
5. Zaimportuj GLB do osobnej sceny i przeprowadź kontrole z sekcji 10
   przewodnika.

## Stan prac

- Otwarty problem kanciastego prawego policzka po eksporcie Anime Remaster
  opisuje sekcja [`Status prac`](https://github.com/Popalgame/polpal-studio/blob/main/docs/hero-anime-remaster.md#status-prac) w Polpal Studio.
- Nie uznawaj wcześniejszego raportu za dowód naprawienia policzka. Porównaj
  aktualną scenę, zapisany `.blend` i `.glb` przed dalszym działaniem.
