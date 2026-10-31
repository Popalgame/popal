# Blender API Index

Lokalny, wersjonowany indeks API zainstalowanego Blendera. Agent przed
napisaniem kodu sprawdza w nim nazwy operatorów, parametry, typy RNA,
właściwości i funkcje modułów Pythona — zamiast polegać na pamięci.

Szersza architektura pętli agenta: [Blender jako mózg agenta](../../docs/blender-brain.md).

Indeks jest generowany z **działającego Blendera**, więc opisuje dokładnie tę
wersję, która jest zainstalowana. Dla Blendera 5.2.2 zawiera:

- 2 498 operatorów `bpy.ops.*`,
- 4 012 typów `bpy.types.*`,
- 22 328 metod typów RNA (`Object.to_mesh`, `Armature.edit_bones` itd.),
- 10 158 właściwości zdefiniowanych bezpośrednio na typach,
- 101 funkcji modułów (`bpy.path`, `bpy.utils`, `mathutils`, `bmesh` itd.).

Łącznie 39 116 rekordów. To nie jest dokumentacja manuala ani gwarancja, że
operator zadziała w danym kontekście. Indeks mówi **co istnieje i jakie ma
parametry**; zachowanie nadal sprawdza się w scenie.

## Zbudowanie indeksu

Zrzut wykonuje się wewnątrz Blendera. `--factory-startup` dotyczy tylko tego
procesu i nie zapisuje preferencji użytkownika.

```bash
blender -b --factory-startup --python-exit-code 1 \
  --python tools/blender-api/dump_api.py -- \
  --out output/blender-api/api.jsonl

python3 tools/blender-api/blender_api.py build \
  --input output/blender-api/api.jsonl \
  --db output/blender-api/api.sqlite
```

Pliki wynikowe są w `output/`, więc nie trafiają do repozytorium. Indeks dla
5.2.2 ma około 30 MB JSONL i 65 MB SQLite.

Po aktualizacji Blendera powtórz oba polecenia. Stary indeks nie opisuje
nowego API.

## Wyszukiwanie

```bash
python3 tools/blender-api/blender_api.py query "bevel modifier width"
python3 tools/blender-api/blender_api.py query "armature bone parent" --kind type
python3 tools/blender-api/blender_api.py query "export gltf animation" --limit 5
```

Wynik zawiera ścieżkę, rodzaj rekordu, sygnaturę i opis. Wyszukiwarka:

- rozbija CamelCase i podkreślenia (`ShaderNodeBsdfPrincipled` →
  `Shader Node Bsdf Principled`, `primitive_cube_add` → `primitive cube add`),
- obsługuje prefiksy (`primitive_cube` znajdzie `primitive_cube_add`),
- rankinguje według FTS5 BM25,
- pozwala filtrować po `operator`, `type`, `property`, `function` lub `class`.

Pełny rekord, w tym listę parametrów i wartości enum:

```bash
python3 tools/blender-api/blender_api.py show bpy.ops.mesh.primitive_cube_add --summary
python3 tools/blender-api/blender_api.py show bpy.ops.export_scene.gltf --summary
python3 tools/blender-api/blender_api.py show bpy.types.BevelModifier
```

`show` przyjmuje pełną ścieżkę albo końcówkę, np. `BevelModifier.width`.
Bez `--summary` wypisuje cały JSON rekordu.

## Jak agent ma tego używać

Przed każdą operacją Blenderową:

1. **Znajdź API** — `query` opisuje operator/typ i jego parametry.
2. **Sprawdź kontekst** — `blender_scene` lub `bpy.context`; indeks nie wie,
   czy jesteś w Edit Mode, czy operator wymaga zaznaczenia.
3. **Wykonaj mały krok** — `blender_execute_python` albo `blender_apply_batch`.
4. **Sprawdź wynik** — render, inspekcja sceny, pomiar; nie ufaj samemu
   brakowi wyjątku.
5. **Zapisz, czego użyto** — przy powtarzalnych zadaniach dodaj przepis do
   biblioteki receptur.

Przykładowy dialog z indeksem:

```text
agent: query "add cube mesh"
indeks: bpy.ops.mesh.primitive_cube_add(size, calc_uvs, enter_editmode,
        align, location, rotation, scale)
agent: show bpy.ops.mesh.primitive_cube_add --summary
agent: sprawdź scenę i tryb, potem wykonaj operator z jawnymi parametrami
```

## Czego indeks nie zastępuje

- **Kontekstu.** Wiele operatorów działa tylko w określonym trybie, area type
  i przy właściwym zaznaczeniu. To sprawdza się w żywej scenie.
- **Zachowania.** Opis parametru nie gwarantuje, że wynik będzie poprawny
  wizualnie. Konieczny jest render i porównanie.
- **Manuala.** Pojęcia, przepływy pracy i ostrzeżenia opisuje oficjalna
  dokumentacja 5.2 LTS; indeks jest do niej uzupełnieniem.
- **Węzłów shaderowych.** Gniazda (`inputs`/`outputs`) są właściwościami
  instancji węzła, a nie typów RNA. Sprawdzaj je w żywym drzewie węzłów.
- **Dodatków.** Indeks obejmuje moduły dostępne w `--factory-startup`. API
  dodatków (np. Forge) trzeba dodać osobno.

## Testy

```bash
python3 -m unittest discover -s tools/blender-api/tests -p 'test_*.py'
```

Testy budują indeks z syntetycznych rekordów i sprawdzają wyszukiwanie,
filtrowanie, aliasy CamelCase, dokładny podgląd i przebudowę bazy. Nie uruchamiają
Blendera.
