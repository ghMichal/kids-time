<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Vitest runner + critical owner access

- **Plan**: `context/changes/testing-runner-critical-owner-access/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-08-16
- **Werdykt**: REVISE → SOUND (po sortowaniu)
- **Ustalenia**: 1 krytyczne 2 ostrzeżenia 2 obserwacje — wszystkie FIXED

## Werdykty

| Wymiar                       | Werdykt (po poprawkach) |
| ---------------------------- | ----------------------- |
| Zgodność ze stanem końcowym  | PASS                    |
| Oszczędne wykonanie          | PASS                    |
| Dopasowanie architektoniczne | PASS                    |
| Martwe punkty                | PASS                    |
| Kompletność planu            | PASS                    |

## Ugruntowanie

Ścieżki produkcyjne i symbole ✓; nowe pliki test/config = CREATE; brief↔plan ✓. Ryzykowne twierdzenia zweryfikowane podagentem (suggestions astro:env, published_at CHECK, updateOwn not_found, glob exclude).

## Ustalenia

### F1 — Suggestions POST nie załaduje się w Vitest bez mocka astro:env

- **Waga**: ❌ CRITICAL
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność ze stanem końcowym / Martwe punkty
- **Lokalizacja**: Faza 2 — Suggestions handler 401-only
- **Szczegóły**: Top-level `astro:env/server` w suggestions + openrouter-client; early 401 nie ratuje loadu w Vitest.
- **Poprawka A ⭐ Zalecana**: `vi.mock("astro:env/server")` lub pure extract auth check
- **Decyzja**: FIXED (Poprawka A) — kontrakt Fazy 2 + Progress 2.3

### F2 — Seed „foreign published” pomija published_at; myli triage z RLS

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty / Kompletność planu
- **Lokalizacja**: Faza 4 — Own library integration
- **Szczegóły**: RLS SELECT nie filtruje triage; CHECK wymaga published_at przy is_published=true.
- **Poprawka**: Seed: is_published + published_at + triage accepted/maybe; rozdziel wording RLS vs triage
- **Decyzja**: FIXED — kontrakt punktu 3 + Progress 4.5

### F3 — Brak konkretnej ścieżki seedu Auth users A/B

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 4 fixture + migracje
- **Szczegóły**: Env A/B zakładane bez instrukcji utworzenia → local full puste.
- **Poprawka A ⭐ Zalecana**: Udokumentowane kroki supabase start + dwóch Auth users
- **Decyzja**: FIXED (Poprawka A) — Faza 4 + §6 + Progress 4.6

### F4 — Literówka zakresu: „Phase 5 / Risk #5”

- **Waga**: 📝 OBSERVATION
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Czego NIE robimy
- **Szczegóły**: Image soft-fail to §3 Phase 4.
- **Poprawka**: Zamień na „§3 Phase 4 / Risk #5”
- **Decyzja**: FIXED

### F5 — Glob `*.test.ts` złapie `*.integration.test.ts` bez exclude

- **Waga**: 📝 OBSERVATION
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 — vitest.config
- **Szczegóły**: Exclude w kontrakcie, brak w kryteriach sukcesu.
- **Poprawka**: Kryterium auto + Progress 1.4: unit nie uruchamia integration files
- **Decyzja**: FIXED — Progress 1.4 auto, ręczne przenumerowane na 1.5
