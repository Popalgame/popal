# Polpal Blender AI Bridge

Lokalny most między agentem AI a otwartą sceną Blendera. Dodatek komunikuje
się z niezależnym od modelu klientem przez prywatną kolejkę plików. Klient może
udostępniać tę samą funkcjonalność jako serwer MCP albo CLI; do pracy nie jest
potrzebne konkretne API ani dostawca modelu. Domyślnie most nie otwiera portu
sieciowego.

Moduł został sprawdzony w Blenderze 5.2.2 LTS na macOS. Pozostałe wersje
i systemy wymagają osobnej weryfikacji. `uv` uruchamia klienta i serwer MCP
w Pythonie 3.12; interpreter Blendera pozostaje własnym interpreterem Blendera.

## Instalacja

W katalogu głównym repozytorium zainstaluj zależności klienta:

```bash
uv sync --directory tools/blender-mcp --python 3.12
```

Zainstaluj dodatek w preferencjach użytkownika Blendera:

```bash
blender --background --python-exit-code 1 --python tools/blender-mcp/install_addon.py
```

Nie dodawaj `--factory-startup`: instalator zapisuje preferencje użytkownika,
a ustawienia fabryczne mogłyby je zastąpić. Jeśli Blender jest już otwarty,
włącz dodatek w tej sesji po instalacji; w przeciwnym razie uruchom Blendera
ponownie. W otwartym Blenderze znajdź panel **N → AI Bridge** w widoku 3D.
Kliknij **Start**, aby uruchomić most, albo **Stop**, aby go zatrzymać.

`Allow full local Python` jest domyślnie wyłączone. Zwykłe operacje obiektowe
działają bez niego; włączenie tej opcji pozwala na dowolny lokalny kod Pythona
z dostępem do Blendera i komputera, a nie na uruchomienie w piaskownicy.

## Połączenie przez MCP

Dodaj serwer do Codex, podając bezwzględne ścieżki do `uv` i katalogu modułu:

```bash
codex mcp add polpal-blender -- /bezwzgledna/sciezka/do/uv run --frozen --directory /bezwzgledna/sciezka/do/polpal/tools/blender-mcp mcp_server.py
```

Inny klient MCP może użyć neutralnej konfiguracji `stdio`:

```json
{
  "mcpServers": {
    "polpal-blender": {
      "command": "/bezwzgledna/sciezka/do/uv",
      "args": [
        "run", "--frozen",
        "--directory", "/bezwzgledna/sciezka/do/polpal/tools/blender-mcp",
        "mcp_server.py"
      ]
    }
  }
}
```

Serwer udostępnia narzędzia `blender_status`, `blender_scene`,
`blender_profile`, `blender_apply_batch`, `blender_preview`,
`blender_save_copy` i `blender_execute_python`. Najpierw odczytaj scenę,
a następnie używaj zwróconego `scene_id` przy modyfikacji, podglądzie i
zapisie kopii. Zmiana otwartego pliku sceny wymaga ponownego odczytu.

Jeśli nowy serwer nie pojawi się w aktualnej sesji aplikacji AI, uruchom ją
ponownie. Dla renderowania i zapisu większych plików ustaw timeout narzędzi
MCP na co najmniej 180 sekund (`tool_timeout_sec = 180` w sekcji tego serwera
w konfiguracji Codex). Adapter czeka na operację do 120 sekund; timeout nie
przerywa renderu, który Blender już rozpoczął.

`blender_apply_batch` obsługuje tworzenie sześcianu, UV-sfery, walca,
płaszczyzny i pustego obiektu, transformacje, materiały, kamery, światła oraz
ustawienia renderowania. Zmiany wymagają trybu **Object**. Nowe obiekty trafiają
do kolekcji roboczej z profilu.

## Profil i katalog mostu

Ustawienia projektu znajdują się w:

```text
~/.local/share/blender-ai-bridge/profile.json
```

Przykładowy plik jest w [`profile.example.json`](profile.example.json).
`working_collection` wskazuje kolekcję na nowe obiekty; domyślnie jest to
`AI_Work`. Nazwy w `protected_objects` i `protected_collections` chronią
istniejące obiekty i kolekcje przed edycją.

Inny katalog danych mostu można wskazać zmienną `BLENDER_AI_BRIDGE_DIR`.
Ustaw ją na tę samą ścieżkę w środowisku Blendera i klienta, na przykład
przed uruchomieniem Blendera oraz serwera MCP/CLI. W jednym katalogu mostu
może pracować tylko jeden proces Blendera naraz.

## CLI

CLI działa bez MCP i bez dodatkowych zależności. Uruchamiaj je z katalogu
głównego repozytorium:

```bash
uv run --frozen --directory tools/blender-mcp cli.py status
uv run --frozen --directory tools/blender-mcp cli.py scene
```

Najpierw pobierz aktualny `scene_id` poleceniem `scene`, a potem możesz
zastosować przykładowy batch, wyrenderować podgląd lub zapisać kopię:

```bash
uv run --frozen --directory tools/blender-mcp cli.py batch examples/studio.json --scene-id ID
uv run --frozen --directory tools/blender-mcp cli.py preview --scene-id ID
uv run --frozen --directory tools/blender-mcp cli.py save --scene-id ID --label demo
```

Batch przyjmuje plik JSON z listą operacji albo obiekt z polem `operations`.
Opcjonalne polecenie `python FILE --scene-id ID` uruchamia lokalny Python;
wymaga wcześniejszego włączenia `Allow full local Python` w panelu dodatku.

## Zachowanie i ograniczenia

- Każdy batch zapisuje checkpoint przez `save_as_mainfile(copy=True)` w
  podkatalogu `checkpoints`. Nie zmienia to ścieżki otwartego pliku, ale
  wykonanie batcha nie jest transakcyjne i nie ma automatycznego rollbacku;
  po błędzie sprawdź `applied_count` i scenę.
- Po timeout z `may_have_executed: true` odczytaj scenę przed kolejną próbą.
  Żądanie mogło już wykonać część albo całość zmian; nie ponawiaj go w ciemno.
- Podgląd renderuje obraz na głównym wątku Blendera i może blokować interfejs
  do zakończenia renderu. Timer kolejki odpytuje żądania co 50 ms, ale nie
  gwarantuje czasu odpowiedzi.
- Kopia z `save` / `blender_save_copy` trafia do `exports` i również używa
  `copy=True`, więc nie zmienia ścieżki otwartego pliku.

## Testy i przykład wyniku

Testy jednostkowe klienta:

```bash
python3 -m unittest discover -s tools/blender-mcp/tests -p 'test_*.py'
```

Test integracyjny uruchamia rzeczywistego klienta MCP i osobny proces
Blendera w tle. Wymaga dostępnego polecenia `blender` albo zmiennej
`BLENDER_BIN` ze ścieżką do niego:

```bash
uv run --frozen --directory tools/blender-mcp tests/integration.py
blender --background --factory-startup --python-exit-code 1 --python tools/blender-mcp/tests/blender_regressions.py
```

Po udanym przebiegu test zapisuje przykładowe pliki
`output/blender-ai-bridge/demo.png` i `output/blender-ai-bridge/demo.blend`.
