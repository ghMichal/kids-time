<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Manual event + AI summary (S-03)

- **Plan**: `context/changes/manual-event-ai-summary/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-08-10
- **Werdykt**: REVISE → SOUND (po sortowaniu)
- **Ustalenia**: 1 krytyczne 2 ostrzeżenia 1 obserwacja

## Werdykty

| Wymiar                       | Werdykt |
| ---------------------------- | ------- |
| Zgodność ze stanem końcowym  | PASS    |
| Oszczędne wykonanie          | PASS    |
| Dopasowanie architektoniczne | WARNING |
| Martwe punkty                | WARNING |
| Kompletność planu            | FAIL    |

## Ugruntowanie

Ugruntowanie: 10/10 ścieżek ✓, symbole ✓, brief↔plan ✓

## Ustalenia

### F1 — Sekcja postępu ma `## Postęp` zamiast `## Progress`

- **Waga**: ❌ CRITICAL
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: ## Postęp (koniec planu)
- **Szczegóły**: `/10x-implement` wymaga kanonicznego nagłówka `## Progress`. Archiwalne plany używają `## Progress` + `### Faza N:`; ten plan miał `## Postęp`.
- **Poprawka**: Zmień `## Postęp` → `## Progress` (zostaw `### Faza N:`).
- **Decyzja**: FIXED — Naprawiono w planie

### F2 — `imageUrl` w DTO bez pełnego blast radius update/publish

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 2 — List DTO + signed image URL
- **Szczegóły**: `toLibraryEventDto` jest w trzech kopiach (list/update/publish). EventCard robi full replace stanu z PATCH i publish — bez signed `imageUrl` podgląd znika. DELETE zwraca 204 bez body.
- **Poprawka A ⭐ Zalecana**: SELECT `image_path` + signed `imageUrl` w list, update i publish; popraw mylące „DELETE DTO”.
- **Poprawka B**: Tylko lista podpisuje URL; EventCard merge’uje stare `imageUrl` gdy nowe jest null.
- **Decyzja**: FIXED — Poprawka A

### F3 — Multipart upload przez Worker odwraca decyzję F-04 bez smoke

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 1 §6 + weryfikacja ręczna
- **Szczegóły**: F-04 unikał proxy multipart; tu reverse jest uzasadniony (brak browser client), ale w API jest tylko FormData tekstowe. Brakowało jawnego smoke File na adapterze.
- **Poprawka**: Dopisz `formData()` → `File`/`Blob` → `uploadEventImage` + smoke ~1–5 MB lokalnie przed Fazą 3.
- **Decyzja**: FIXED — Naprawiono w planie

### F4 — Nota po Fazie 3 myli kolejność workflow

- **Waga**: ℹ️ OBSERVATION
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 — Uwaga implementacyjna
- **Szczegóły**: „potem `/10x-plan-review`” — review ma być przed implementacją, nie po Fazie 3.
- **Poprawka**: Zamień na smoke S-03 → `/10x-impl-review` / `/10x-archive`.
- **Decyzja**: FIXED — Naprawiono w planie
