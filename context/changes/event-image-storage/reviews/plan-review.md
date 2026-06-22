<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Event image storage (F-04)

- **Plan**: context/changes/event-image-storage/plan.md
- **Tryb**: Głęboki
- **Data**: 2026-06-22
- **Werdykt**: REVISE → SOUND (po sortowaniu)
- **Ustalenia**: 1 krytyczne, 3 ostrzeżenia, 1 obserwacja

## Werdykty

| Wymiar                       | Werdykt |
| ---------------------------- | ------- |
| Zgodność ze stanem końcowym  | PASS    |
| Oszczędne wykonanie          | PASS    |
| Dopasowanie architektoniczne | PASS    |
| Martwe punkty                | WARNING |
| Kompletność planu            | WARNING |

## Ugruntowanie

Ugruntowanie: 6/6 ścieżek ✓, 3/3 symboli ✓, brief↔plan ✓

## Ustalenia

### F1 — Brak pozycji Progress dla ręcznej weryfikacji Fazy 2

- **Waga**: ❌ CRITICAL
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Phase 2 — Kryteria sukcesu / sekcja Progress
- **Szczegóły**: Faza 2 ma punkt pod „Weryfikacja ręczna” (opcjonalny smoke `buildEventImagePath`), ale w `## Progress` brakowało `2.2`.
- **Poprawka**: Dodać `- [ ] 2.2 (opcjonalnie) buildEventImagePath zwraca oczekiwany kształt` w Progress Fazy 2.
- **Decyzja**: FIXED (Napraw w planie)

### F2 — Replace nie gwarantuje jednego obiektu przy zmianie rozszerzenia

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Phase 2 — `replaceEventImage` / Krytyczne szczegóły
- **Szczegóły**: `upsert: true` nadpisuje tylko ten sam klucz; przy zmianie rozszerzenia stary plik zostawał, jeśli brak starego `imagePath`.
- **Poprawka A ⭐ Zalecana**: W `replaceEventImage` zawsze `list` + `remove` wszystkich obiektów pod `{ownerId}/{eventId}/` przed uploadem.
- **Decyzja**: FIXED (Poprawka A)

### F3 — Błędny „Następny krok” w kontrakcie change.md (Faza 3)

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Phase 3 — punkt 3 change.md
- **Szczegóły**: Kontrakt wskazywał `/10x-implement event-image-storage phase 1` zamiast fazy 4.
- **Poprawka**: Zmieniono na `/10x-implement event-image-storage phase 4`.
- **Decyzja**: FIXED (Napraw w planie)

### F4 — Smoke script: niejasny flow auth i nazwy env

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Phase 3 — `scripts/smoke-event-image.ts`
- **Szczegóły**: Brak nazw env i kroku `signInWithPassword` w kontrakcie smoke script.
- **Poprawka**: Doprecyzowano env `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` i flow auth.
- **Decyzja**: FIXED (Napraw w planie)

### F5 — Storage RLS nie wiąże `event_id` z tabelą `events`

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Phase 1 — polityki storage / README
- **Szczegóły**: RLS storage sprawdza tylko segment właściciela; upload do dowolnego `event_id` w ścieżce jest możliwy bez rekordu w DB.
- **Poprawka**: Dodano notatki w kontrakcie migracji SQL i README (odpowiedzialność warstwy aplikacji).
- **Decyzja**: FIXED (Napraw w planie)
