# Instrukcje projektu Polpal

## Obowiązkowy przewodnik Blendera

Przed **każdym użyciem Blendera** agent AI musi odczytać w całości plik
[`Blender_user.md`](Blender_user.md) w katalogu głównym tego repozytorium
oraz zastosować opisane w nim zasady do bieżącego zadania.

Gdy zadanie dotyczy istniejącego zasobu lub eksportu do gry, agent musi
odczytać również [`docs/blender-project-contract.md`](docs/blender-project-contract.md).
Przewodnik opisuje sposób pracy, a kontrakt — konkretne wymagania projektu:
kości, klipy, skalę, wagi i ustawienia eksportu.

Dotyczy to każdego wywołania narzędzia `blender_*`, pracy przez interfejs
Blendera, uruchomienia Blendera z CLI oraz wykonania skryptu korzystającego
z `bpy`. Odczyt wykonaj przed wywołaniem, również po wznowieniu zadania lub
skróceniu kontekstu; nie zastępuj go pamięcią wcześniejszej wersji dokumentu.
Przekazując pracę subagentowi, przekaż również ten obowiązek i ścieżki obu
plików.

Jeżeli któregokolwiek z tych plików nie da się odczytać, najpierw przywróć
dostęp do instrukcji; nie wykonuj operacji Blendera bez ich znajomości.
Samo przeczytanie dokumentów nie oznacza potwierdzenia jakości wykonanej
pracy — obowiązują opisane w nich kontrole wizualne, techniczne i uczciwe
raportowanie wyników.
