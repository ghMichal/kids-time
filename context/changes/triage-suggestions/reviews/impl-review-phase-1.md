<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Triage suggestions (S-02)

- **Plan**: `context/changes/triage-suggestions/plan.md`
- **Zakres**: Faza 1 z 3
- **Data**: 2026-07-24
- **Werdykt**: APPROVED
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 2 obserwacje
- **Commit**: `7872fa4`

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

### F1 — Brak logowania błędów INSERT po stronie serwera

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/events/create-event-from-suggestion.ts:52
- **Szczegóły**: Błędy Supabase (RLS, constraint, transient DB) są zwijane do `{ error: "insert_failed" }` / klient dostaje `{ error: "internal" }` bez logu serwerowego — trudniejszy ops debugging.
- **Poprawka**: Loguj `error.message` / `error.code` po stronie serwera (np. `console.warn`), zostaw generic 500 dla klienta (zgodnie z planem).
- **Decyzja**: PENDING

### F2 — Brak idempotencji na POST triage

- **Ważność**: OBSERVATION
- **Wpływ**: 🏃 LOW
- **Wymiar**: Architektura
- **Lokalizacja**: src/pages/api/events/triage.ts
- **Szczegóły**: Powtórny POST tworzy kolejny wiersz. Zgodne z planem (disable UI w Fazie 2). Nie wymaga akcji w Fazie 1.
- **Poprawka**: Brak — zaakceptowane w zakresie S-02; dedup opcjonalnie w późniejszym slice.
- **Decyzja**: PENDING

### F3 — Brak top-level try/catch w handlerze

- **Ważność**: OBSERVATION
- **Wpływ**: 🏃 LOW
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/api/events/triage.ts
- **Szczegóły**: `suggestions.ts` owija zewnętrzne wywołania w try/catch; triage polega na `{ error }` z Supabase. Ryzyko nieobsłużonego throw niskie.
- **Poprawka**: Opcjonalnie owiń handler w try/catch jak w `suggestions.ts`.
- **Decyzja**: PENDING
