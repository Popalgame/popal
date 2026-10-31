# Character Scan

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
- podaje linię oczu, rozstaw źrenic i rozmiar tęczówki w pikselach
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
