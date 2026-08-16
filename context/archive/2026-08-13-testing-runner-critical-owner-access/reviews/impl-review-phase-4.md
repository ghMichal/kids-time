<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Vitest runner + critical owner access

- **Plan**: context/changes/testing-runner-critical-owner-access/plan.md
- **Zakres**: Faza 4 z 6
- **Data**: 2026-08-16
- **Werdykt**: APPROVED
- **Ustalenia**: 0 krytycznych 2 ostrzeżenia 2 obserwacje
- **Commit**: 03fcc1b

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | PASS    |
| Bezpieczeństwo i jakość | WARNING |
| Architektura            | PASS    |
| Spójność wzorców        | PASS    |
| Kryteria sukcesu        | PASS    |

## Ustalenia

### F1 — wipeOwnEvents kasuje wszystkie eventy A/B bez straży URL

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/events/**test**/supabase-jwt-fixture.ts:90-95
- **Szczegóły**: wipeOwnEvents usuwa wszystkie events ownera A/B; przy cloud URL + tych samych USER\_\* ryzyko kasacji prawdziwych danych.
- **Poprawka A ⭐ Zalecana**: Dokumentuj local+disposable A/B + refuse non-localhost (INTEGRATION_ALLOW_REMOTE=1 escape).
- **Poprawka B**: Tylko dokumentacja.
- **Decyzja**: FIXED via Fix A

### F2 — afterEach delete ignoruje error

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/events/list-own-events.integration.test.ts:46-50
- **Szczegóły**: Per-id delete w afterEach nie sprawdzał { error }.
- **Poprawka**: Rzuć przy błędzie delete (jak wipeOwnEvents).
- **Decyzja**: FIXED

### F3 — Soft drift: brak asercji kształtu DTO

- **Ważność**: ℹ️ OBSERVATION
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/lib/events/list-own-events.integration.test.ts (own-list it)
- **Szczegóły**: Plan wspomina pola DTO bez cudzych id; test asertuje id/length/triage, nie pełny kształt DTO.
- **Poprawka**: Zostaw (koszt × sygnał) albo dodaj expect.objectContaining.
- **Decyzja**: SKIPPED

### F4 — hydrateEnvFromLocalFiles vs skrypt verify

- **Ważność**: ℹ️ OBSERVATION
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/events/**test**/supabase-jwt-fixture.ts:19-43
- **Szczegóły**: Fixture hydruje .env/.dev.vars; verify-event-images-rls wymaga shell env.
- **Poprawka**: Nota w **test**/README.md.
- **Decyzja**: FIXED
