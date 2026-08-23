<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Image soft-fail + CI test gates

- **Plan**: context/changes/testing-image-soft-fail-and-ci-gates/plan.md
- **Tryb**: Głęboki
- **Data**: 2026-08-23
- **Werdykt**: SOUND (po sortowaniu; przed: REVISE)
- **Ustalenia**: 0 krytycznych 4 ostrzeżenia 0 obserwacji

## Werdykty

| Wymiar                       | Werdykt |
| ---------------------------- | ------- |
| Zgodność ze stanem końcowym  | PASS    |
| Oszczędne wykonanie          | WARNING |
| Dopasowanie architektoniczne | PASS    |
| Martwe punkty                | WARNING |
| Kompletność planu            | WARNING |

Po sortowaniu wszystkie WARNING naprawione w planie → wymiary PASS.

## Ugruntowanie

Ugruntowanie: 5/5 ścieżek ✓ (3 nowe testy jeszcze nie istnieją — OK), 3/3 symboli ✓, brief brak (N/A)

## Ustalenia

### F1 — „missing signedUrl” może rzucić, a plan zakazuje zmian prod

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Analiza stanu + Faza 1 (1.2)
- **Szczegóły**: Warunek `if (error || !data.signedUrl)` rzuca TypeError gdy error jest falsy i `data === null`. Progress 1.2 prowokował ten mock. Plan zabraniał zmian produkcyjnych.
- **Poprawka A ⭐ Zalecana**: Przypnij kształty mocka w Fazie 1.2 — `{ error, data: null }` oraz `{ error: null, data: {} }` / pusty signedUrl. Nie testuj `{ data: null, error: null }`.
  - Siła: Lock regresji bez ruszania prod.
  - Kompromis: JSDoc „never throws” nadal szersze niż kod.
  - Pewność: HIGH — short-circuit i missing URL na non-null `data` są bezpieczne.
  - Martwy punkt: Live klient Storage przy `data === null` bez error nie mierzony.
- **Poprawka B**: Jedna linia w prod: `if (error || !data?.signedUrl)`
  - Siła: JSDoc i 1.2 stają się prawdziwe.
  - Kompromis: Łamie „zero zmian produkcyjnych”.
  - Pewność: HIGH — optional chaining usuwa TypeError.
  - Martwy punkt: throw sieci nadal nie złapany.
- **Decyzja**: FIXED — Naprawiono za pomocą poprawki A

### F2 — Faza 3 nie podaje przepisu na thenable chain Supabase

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 — listOwnLibraryEvents.test.ts
- **Szczegóły**: `from().select().eq().in().order()` musi być thenable. Brak precedensu w unitach; plan zostawiał „chain LUB mock DTO”.
- **Poprawka A ⭐ Zalecana**: Wpisz konkretny stub thenable w Fazie 3 + `vi.mock` sign helper. Zostaw test listy.
  - Siła: Wyrocznia agregacji z end-state; wzorzec do cookbook §6.4.
  - Kompromis: Kilka linii boilerplate.
  - Pewność: HIGH — łańcuch w `list-own-events.ts:11-16` zamknięty.
  - Martwy punkt: Brak znaczących
- **Poprawka B**: Usuń Fazę 3; end-state na Fazach 1–2
  - Siła: Research nazywał list unit opcjonalnym.
  - Kompromis: Znika bezpośredni dowód „nie list_failed”.
  - Pewność: MEDIUM
  - Martwy punkt: GET 200 bez lib-list testu
- **Decyzja**: FIXED — Naprawiono za pomocą poprawki A

### F3 — Invalid triage w kontrakcie Fazy 2, poza #5 i poza Progress

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Oszczędne wykonanie
- **Lokalizacja**: Faza 2 — Kontrakt
- **Szczegóły**: Invalid `triage_status` nie jest Risk #5 i nie miało checkboxa 2.x.
- **Poprawka**: Wyrzuć ten bullet z kontraktu Fazy 2.
- **Decyzja**: FIXED — Naprawiono w planie

### F4 — §5 i §6.2 test-planu zostaną kłamliwe po Fazie 5

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 5 + test-plan.md §5 / §6.2
- **Szczegóły**: Cookbook unit-only + Phase 4 complete, bez korekty §5 („unit + integration (`npm test`)”) i §6.2 (Docker gate = Phase 4).
- **Poprawka A ⭐ Zalecana**: W Fazie 5 popraw też wiersz §5 i zdanie w §6.2 na unit CI only.
  - Siła: Docs = `package.json` + user intent.
  - Kompromis: Szerszy diff docs w Fazie 5.
  - Pewność: HIGH
  - Martwy punkt: Brak znaczących
- **Poprawka B**: Docker `test:integration` w CI
  - Siła: Literalnie spełnia stary §5.
  - Kompromis: Łamie zakres Phase 4.
  - Pewność: HIGH
  - Martwy punkt: Koszt Docker w Actions
- **Decyzja**: FIXED — Naprawiono za pomocą poprawki A
