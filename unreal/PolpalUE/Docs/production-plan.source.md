# Kompleksowy Plan Realizacji Gry w Stylu Palworld (Pipeline: Blender -> Unreal Engine 5)

Dokument stanowi techniczny plan wdrożenia architektury, systemu animacji oraz designu wzorowanego na grze *Palworld*. Plan zakłada wykorzystanie **Blendera** jako głównego narzędzia DCC (Digital Content Creation) oraz **Unreal Engine 5 (C++ / Blueprints)** jako silnika docelowego.

---

## Etap 1: Konfiguracja Środowiska i Pipeline'u (Blender $\leftrightarrow$ UE5)

Zanim powstanie pierwszy model, konieczne jest ujednolicenie przestrzeni roboczej, aby uniknąć błędów ze skalą, rotacją kości i importem animacji.

### 1.1. Konfiguracja Blendera pod Unreal Engine 5
* **Jednostki i Skala:** Ustawienie w Blenderze *Unit System* na `Metric` oraz *Unit Scale* na `0.01` (lub pozostawienie `1.0` przy ścisłym pilnowaniu opcji eksportu FBX: *Apply Scalings: FBX Units Scale*).
* **Orientacja Osi:** Przy eksportowaniu z Blendera do UE5 obowiązuje konwencja: **Forward: `-Y`**, **Up: `Z`** (dla modeli statycznych i szkieletowych).
* **Narzędzia wspomagające (Add-ons):**
  * Instalacja wtyczki **Send to Unreal** (oficjalne narzędzie od Epic Games) lub **Better FBX Exporter** dla automatyzacji procesów eksportu.
  * Instalacja **Rigify** lub **Auto-Rig Pro** (ARP posiada dedykowany preset eksportu pod szkielet *UE5 Mannequin*, co radykalnie przyspiesza późniejszy *IK Retargeting*).

### 1.2. Fundamenty Projektu w Unreal Engine 5
* **Inicjalizacja projektu:** Utworzenie projektu typu *Third Person* ze wsparciem dla **C++** (nawet jeśli początkowo większość logiki powstanie w Blueprintach, C++ będzie niezbędny w Etapie 4 i 5).
* **Struktura katalogów:**
  * `/Content/Core` (GameModes, PlayerController, GameState)
  * `/Content/Characters/Human` (Gracz, NPC)
  * `/Content/Characters/Pals/[Archetyp]` (Podział na archetypy szkieletowe)
  * `/Content/Buildings` (Struktury bazy)
  * `/Content/VFX` i `/Content/Materials` (Shadery Cel-Shading i środowisko)

---

## Etap 2: Kierunek Artystyczny, Modelowanie i Rigging w Blenderze

Kluczem do optymalizacji czasu pracy w *Palworld* jest kategoryzacja stworzeń i kontrast stylistyczny (stylizowane postacie na realistycznym tle).

### 2.1. Tworzenie Modeli i Przygotowanie pod Cel-Shading (Blender)
* **Modelowanie postaci i Pali:** Projektowanie czytelnych sylwetek z wyraźnym kodowaniem kolorystycznym odpowiadającym żywiołom (np. ogień = czerwień/pomarańcz, woda = błękit).
* **Korekta Normalnych (Normal Editing):** Aby uzyskać czysty cień w stylu anime (bez brzydkich artefaktów na twarzy/pyszczku), w Blenderze należy użyć modyfikatora **Data Transfer** lub ręcznie wyprostować wektory normalne twarzy (*Custom Split Normals Data*).
* **Vertex Painting (Malowanie Wierzchołków):** Wykorzystanie kolorów wierzchołków (Vertex Color) w Blenderze jako masek dla shadera w UE5:
  * Kanał **R (Czerwony):** Maska stałego zacienienia (np. pod brodą, wewnątrz uszu).
  * Kanał **G (Zielony):** Kontrola szerokości obrysu (Outline) lub specularity.

### 2.2. System Archetypów Szkieletowych (Rigging w Blenderze)
Zamiast tworzyć unikalne animacje dla 100 stworzeń, stwórz w Blenderze **5-6 bazowych szkieletów (Master Rigs)**:
1. `Rig_Biped_Standard` (Gracz, humanoidalne Pale).
2. `Rig_Biped_Chibi` (Małe, dwunożne stworki o dużych głowach i krótkich kończynach).
3. `Rig_Quadruped` (Wilki, jelenie, czworonogi).
4. `Rig_Avian` (Ptaki i stworzenia skrzydlate).
5. `Rig_Blob` (Proste stworzenia-kulki, oparte na 3-4 kościach typu *Squash & Stretch*).

* **Zasady nazywania kości:** Zachowaj spójną hierarchię i nazewnictwo we wszystkich archetypach (np. `root` $\rightarrow$ `pelvis` $\rightarrow$ `spine_01` $\rightarrow$ `head`, `hand_l`, `hand_r`). Kość `root` zawsze musi znajdować się w punkcie $(0, 0, 0)$ z rotacją $(0, 0, 0)$.
* **Socket Bones (Kości pomocnicze w Blenderze):** Do każdego szkieletu dodaj dedykowane kości pod interakcję: `weapon_r`, `weapon_l` (w dłoniach/łapach lub przy pyszczku dla czworonogów) oraz `mount_socket` na grzbiecie (dla stworzeń, na których można jeździć).

### 2.3. Tworzenie Bazowych Animacji (Blender Action Editor / NLA)
Dla każdego archetypu stwórz w Blenderze zestaw podstawowych akcji (Actions) i wyeksportuj je jako oddzielne pliki FBX (sam szkielet z klatkami kluczowymi, tzw. *Baked Animation*):
* **Lokomocja:** `Idle`, `Walk_Fwd`, `Run_Fwd`, `Jump_Start`, `Fall_Loop`, `Land`.
* **Praca (Uniwersalne pętle):** `Work_Hammering` (uniwersalna budowa/naprawa), `Work_Mining` (uderzanie ciałem lub narzędziem), `Work_Watering` (plucie wodą z pyszczka), `Work_Carrying_Idle` / `Work_Carrying_Walk`.
* **Walka i Interakcja:** `Attack_Melee`, `Attack_Cast_Skill`, `Hit_React`, `Stunned_Loop`, `Captured_Struggle`, `Sleep`.

---

## Etap 3: Zaawansowany System Animacji w Unreal Engine 5

Po zaimportowaniu modeli i animacji z Blendera, cała magia łączenia ruchów odbywa się w UE5.

### 3.1. Współdzielenie Animacji (IK Rig & IK Retargeter)
* Stwórz **IK Rig** dla bazowego szkieletu (np. `Rig_Biped_Standard`) i zdefiniuj łańcuchy kinematyczne (*Retarget Chains*): Kręgosłup, Lewa Ręka, Prawa Ręka, Lewa Noga, Prawa Noga, Głowa.
* Stwórz **IK Rig** dla zmodyfikowanego modelu (np. niższego lub szerszego Pala tego samego archetypu).
* Użyj **IK Retargeter**, aby przemapować animacje z jednego modelu na drugi w czasie rzeczywistym lub wygenerować zduplikowane pliki animacji dopasowane do nowych proporcji.

### 3.2. Budowa Animation Blueprint (AnimGraph)
Dla postaci gracza i Pali zbuduj modularny **AnimBlueprint**:
* **Lokomocja (Lower Body):** Wykorzystaj **Blend Space 1D/2D**, który płynnie miesza `Idle` $\rightarrow$ `Walk` $\rightarrow$ `Run` na podstawie zmiennych `Speed` oraz `Direction`.
* **Celowanie (Aim Offset):** Stwórz *Aim Offset* z klatek pozowanych w Blenderze (patrzenie w górę, dół, lewo, prawo), aby głowa i tułów podążały za kamerą gracza lub celem AI.
* **Warstwowe Mieszanie (Layered Blend per Bone):**
  * Węzeł ten dzieli szkielet na pół (zazwyczaj na kości `spine_01`).
  * Dolna połowa odtwarza ruch nóg z *Blend Space*.
  * Górna połowa odtwarza animację trzymania karabinu, rzucania kulą lub niesienia przedmiotu.

### 3.3. Proceduralność (Control Rig) i Montaże (Anim Montages)
* **Foot IK (Control Rig):** Na końcu *AnimGraphu* podepnij węzeł **Control Rig**, który puszcza promienie (*Sphere Trace*) z kostek nóg w dół i przesuwa kości nóg oraz miednicy tak, aby postać nie lewitowała na schodach i stokach.
* **Hand IK:** Użyj dwukościowego IK (*Two Bone IK*), aby lewa dłoń postaci zawsze przyciągała się do uchwytu broni trzymanej w prawej dłoni (nawet jeśli animacja była robiona w Blenderze pod inny rozmiar karabinu).
* **Animation Montages & Notifies:** Spakuj ataki i rzemiosło w *Montages*. Dodaj na osi czasu **Anim Notifies**:
  * `AN_SpawnProjectile` (moment wystrzału ognistej kuli).
  * `AN_PlayWorkVFX` (wyzwolenie iskier i dźwięku uderzenia młotkiem).
  * `AN_ToggleHitbox` (włączenie kolizji dla ataku wręcz).

---

## Etap 4: Architektura Rdzenia Gry (C++ & Blueprints)

Ten etap definiuje strukturę danych, dzięki której gra jest skalowalna i łatwa w balansowaniu.

### 4.1. Architektura Danych (Data-Driven Design)
Zamiast wpisywać statystyki na sztywno w kodzie każdego Pala, stwórz w C++ strukturę `FPalSpeciesData` dziedziczącą po `FTableRowBase` lub wykorzystaj **Primary Data Assets**:
* Pola danych: `PalName`, `ElementType` (Enum), `BaseStats` (HP, Attack, Defense, WorkSpeed), `WorkSuitability` (Mapa: Typ Pracy $\rightarrow$ Poziom 1-4), `SkeletalMesh`, `AnimBlueprintClass`.
* Oddzielna struktura dla konkretnej instancji złapanego Pala (`UPalInstanceData`), przechowująca jego aktualny poziom, głód (*Hunger*), poczytalność (*SAN*), wyuczone ataki i cechy pasywne (*Passives*).

### 4.2. System Łapania i Zarządzania Stworzeniami
* **Mechanika Kuli (Pal Sphere):**
  * Rzut fizycznym obiektem (Projectile Movement Component).
  * Po trafieniu w Pala: ukrycie modelu Pala (*Set Actor Hidden In Game*) lub odtworzenie materiału rozpuszczania (Dissolve Shader), zamiana kuli w stan testu szansy na złapanie.
  * Algorytm szansy (w C++):
    $$P_{\text{capture}} = \text{ clamp}\left( \frac{\text{SpherePower} \cdot \left(1 - \frac{\text{HP}_{\text{current}}}{\text{HP}_{\text{max}}}\right) \cdot \text{StatusBonus}}{\text{PalRarityFactor}}, 0.01, 1.0 \right)$$
* **Komponent Drużyny (`UPartyComponent`):** Przypięty do `APlayerState` lub `APlayerController`, przechowujący tablicę do 5 instancji `UPalInstanceData` oraz referencję do aktualnie przywołanego w świecie aktora Pala.

---

## Etap 5: Sztuczna Inteligencja i Automatyzacja Bazy (Core Loop)

Najtrudniejszy architektonicznie element *Palworld*: zarządzanie dziesiątkami stworzeń pracujących w bazie.

### 5.1. Centralny Menedżer Bazy (`ABaseCampManager` w C++)
Zamiast pozwalać każdemu Palowi przeszukiwać cały świat w poszukiwaniu pracy (co zabiłoby procesor), zastosuj wzorzec **Tablicy Ogłoszeń (Blackboard / Task Queue)**:
1. Gracz stawia strukturę centralną (odpowiednik *Palboxa*), która tworzy sferyczną strefę bazy (`UBaseCampComponent`).
2. Każdy budynek w tej strefie (np. piec, pole uprawne, kamieniołom) oraz każdy leżący na ziemi surowiec rejestruje w `ABaseCampManager` obiekt zadania (`FWorkTask`).
3. `FWorkTask` zawiera: `Location`, `RequiredWorkType` (np. *Kindling*), `RequiredLevel`, `AssignedPal` (wskaźnik).
4. `ABaseCampManager` sortuje zadania według priorytetu i przydziela je wolnym Palom znajdującym się w bazie.

### 5.2. Drzewa Zachowań (Behavior Trees) i EQS
Dla AI Pali stwórz jeden główny **Behavior Tree** podzielony na gałęzie (sterowane przez *Blackboard*):
* **Gałąź 1: Stan Krytyczny (Najwyższy Priorytet):**
  * Jeśli `Hunger < 20%` $\rightarrow$ Znajdź najbliższe koryto z jedzeniem (`Feed Box`), idź tam, odtwórz animację jedzenia.
  * Jeśli `IsNight == true` (lub `SAN < 15%`) $\rightarrow$ Idź do łóżka lub gorącego źródła, odtwórz animację snu/relaksu.
* **Gałąź 2: Walka (Wykryto wroga w bazie lub na świecie):**
  * Użyj **EQS (Environment Query System)**, aby znaleźć pozycję z czystą linią strzału do wroga, utrzymując optymalny dystans zależny od wybranego skilla.
  * Odtwórz *Anim Montage* ataku $\rightarrow$ nałóż *Cooldown*.
* **Gałąź 3: Praca w Bazie:**
  * Pobierz `CurrentTask` z `ABaseCampManager`.
  * Użyj `Move To` po siatce **NavMesh** (z włączonym *Runtime Generation: Dynamic Modifiers Only*, aby AI omijało nowo postawione przez gracza ściany).
  * Po dotarciu do budynku: obróć się w stronę obiektu, odtwórz uniwersalną animację pracy (np. `Work_Hammering`) i w pętli zwiększaj zmienną `WorkProgress` budynku.
* **Gałąź 4: Bezczynność (Wander):**
  * Losowy spacer w promieniu kilku metrów + losowe animacje `Idle`.

---

## Etap 6: Shaders, VFX i Środowisko (Kontrast Wizualny)

### 6.1. Shader Postaci (Cel-Shading w UE5)
* Stwórz w UE5 **Post Process Material** lub dedykowany materiał oświetlenia (*Shading Model: Unlit* lub zmodyfikowany *Default Lit*).
* Oblicz iloczyn skalarny wektora normalnej powierzchni ($\vec{N}$) oraz wektora głównego światła kierunkowego ($\vec{L}$):
  $$I = \vec{N} \cdot \vec{L}$$
* Przepuść wynik przez funkcję schodkową (`Step` lub teksturę `Curve Atlas` / `Color Ramp`), aby uzyskać ostre przejście między strefą oświetloną a cieniem (2 lub 3 tony).
* Pomnóż wynik przez kanał R z **Vertex Color** wyeksportowanego z Blendera, aby wymusić stałe cienie pod szyją i w zagłębieniach modelu.
* Dodaj obrys (Outline) za pomocą odwróconej siatki z Blendera (*Inverted Hull Method*) lub filtra głębi sceny (*Scene Depth / Custom Stencil*) w Post-Processie.

### 6.2. Otoczenie i Efekty (Lumen + Niagara)
* **Świat:** Zbuduj teren używając **UE5 Landscape** oraz gotowych, fotorealistycznych zasobów roślinności i skał (np. Quixel Megascans). Włącz oświetlenie **Lumen**, aby uzyskać realistyczne odbicia w wodzie i miękkie cienie drzew kontrastujące z rysunkowymi postaciami.
* **VFX (Niagara):** Stwórz efekty cząsteczkowe dla każdego żywiołu (ogień, woda, błyskawice) oraz uniwersalne efekty pracy (dym przy budowie, iskry przy uderzaniu kilofem, krople potu nad głową zmęczonego Pala).

---

## Etap 7: Optymalizacja i Architektura Sieciowa (Co-op / Multiplayer)

*Palworld* jest projektowany od podstaw z myślą o grze wieloosobowej, co wymaga dyscypliny w przesyłaniu danych.

### 7.1. Replikacja (Client-Server Model)
* **Autorytet Serwera:** Cała logika `ABaseCampManager`, obliczenia obrażeń, szansy na złapanie Pala oraz stan ekwipunku muszą wykonywać się wyłącznie po stronie serwera (`HasAuthority()`).
* **Odciążenie sieci przy animacjach:** Nie replikuj klatek animacji ani pozycji kości! Serwer replikuje jedynie zmienną stanu (np. `ReplicatedUsing = OnRep_CurrentWorkState`) oraz prędkość ruchu. Klient odbiera informację `State == Working_Mining` i lokalnie w swoim *AnimBlueprint* uruchamia odpowiednią pętlę animacji wyeksportowaną z Blendera.

### 7.2. Optymalizacja Tłumu (Mass AI / Tick Optimization)
* **Animation Sharing & Update Rate Optimization (URO):** Włącz w komponentach `SkeletalMeshComponent` opcję *Enable Update Rate Optimizations*. Im dalej Pal znajduje się od kamery gracza, tym rzadziej odświeżana jest jego animacja (np. spadek z 60 FPS do 15 FPS na dużym dystansie) oraz wyłączane jest obliczanie *Foot IK* w Control Rigu.
* **LODs (Level of Detail w Blenderze/UE5):** Wykorzystaj narzędzia wbudowane w UE5 do automatycznego generowania poziomów szczegółowości (LOD0 $\rightarrow$ LOD3) dla siatek `Skeletal Mesh` wyeksportowanych z Blendera, redukując liczbę trójkątów o 50-80% dla oddalonych stworzeń.
* **Symulacja Bazy w Tle (Abstract Tick):** Gdy żaden gracz nie znajduje się w promieniu 200 metrów od bazy, zniszcz wizualne aktory Pali (`AActor`), a produkcję surowców w `ABaseCampManager` przełącz na czysty wzór matematyczny wykonywany co 5 sekund w C++:
  $$\Delta \text{Resource} = \sum_{i=1}^{N} (\text{PalWorkSpeed}_i \cdot \text{BuildingEfficiency}) \cdot \Delta t$$

---

## Podsumowanie Kolejności Prac (Checklista Wdrożeniowa)

1. **[Tydzień 1-2]** Konfiguracja pipeline'u Blender $\leftrightarrow$ UE5. Stworzenie modelu gracza i 1 testowego Pala (archetyp *Biped*) z podstawowymi animacjami w Blenderze.
2. **[Tydzień 3-4]** Wdrożenie *AnimBlueprint*, *Layered Blend per Bone*, *Control Rig (Foot IK)* oraz shadera *Cel-Shading* w UE5.
3. **[Tydzień 5-6]** Programowanie w C++/BP: Struktury danych Pali, rzucanie kulą, system łapania i przywoływania stworzenia.
4. **[Tydzień 7-9]** Budowa systemu bazy: stawianie budynków, `ABaseCampManager`, kolejka zadań oraz *Behavior Tree* dla pracującego Pala.
5. **[Tydzień 10-12]** Rozbudowa w Blenderze: dodanie kolejnych archetypów szkieletowych (*Quadruped*, *Avian*), skonfigurowanie *IK Retargetera* w UE5 i spięcie walki oraz efektów Niagara.