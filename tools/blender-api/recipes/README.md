# Receptury Blendera

Biblioteka **wykonanych przepisów** — małych skryptów z warunkami wejścia,
kodem i samodzielną kontrolą wyniku. Receptura nie jest dokumentacją: jest
przepisem, który dał się uruchomić w konkretnej wersji Blendera i który można
powtórzyć.

## Format

Każda receptura to samodzielny skrypt dla `blender -b --factory-startup`:

- nagłówek dokumentacji: `requires`, `inputs`, `steps`, `checks`,
- buduje własną scenę testową (nie dotyka cudzych plików),
- zapisuje artefakty w `output/blender-api/recipe-artifacts/<nazwa>/`,
- na końcu wypisuje JSON z blokiem `checks` i zwraca kod 0/1.

## Stan walidacji (Blender 5.2.2 LTS, 2026-10-31)

| Receptura | Co robi | Kontrole | Wynik |
| --- | --- | --- | --- |
| `render_orthographic_views.py` | 4 kamery ortofitowane do bounds, render z alfa | pliki istnieją, sylwetka obecna, nie dotyka krawędzi, widoki się różnią | przechodzi |
| `export_glb_contract.py` | eksport GLB wg kontraktu (zaznaczenie, NLA_TRACKS) + reimport | 1 scena, siatka+rig, animacja obecna, ≤4 wpływy, sumy wag, brak obcych obiektów | przechodzi |
| `measure_evaluated_bounds.py` | świat vs lokal, evaluated mesh przez depsgraph | obrót zmienia bounds świata, subsurf zwiększa liczbę wierzchołków, `to_mesh_clear()` bezpieczne | przechodzi |

Receptury wykonywano ręcznie w tej wersji; po aktualizacji Blendera uruchom je
ponownie, zanim użyjesz ich wzorców.

## Zasady

1. **Uruchom, zanim udostępnisz.** Receptura bez wykonania to przypuszczenie.
2. **Jedna receptura = jeden wzorzec.** Łączenie kilku pomysłów utrudnia
   diagnozę, gdy coś się wysypie.
3. **Kontekst deklaruj w `requires`.** Wiele operatorów wymaga trybu,
   zaznaczenia albo aktywnego obiektu.
4. **Kontrola w kodzie, nie w oku.** `checks` musi dać się policzyć; ocenę
   wizualną dodaje się osobnym renderem, nie zamiast kontroli.

## Uruchomienie

```bash
blender -b --factory-startup --python-exit-code 1 \
  --python tools/blender-api/recipes/render_orthographic_views.py

blender -b --factory-startup --python-exit-code 1 \
  --python tools/blender-api/recipes/export_glb_contract.py

blender -b --factory-startup --python-exit-code 1 \
  --python tools/blender-api/recipes/measure_evaluated_bounds.py
```
