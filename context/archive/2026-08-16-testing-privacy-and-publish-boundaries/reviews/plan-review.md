<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Privacy & publish boundaries

- **Plan**: `context/changes/testing-privacy-and-publish-boundaries/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-08-16
- **Werdykt**: REVISE → SOUND (po sortowaniu)
- **Ustalenia**: 0 krytycznych 2 ostrzeżenia 1 obserwacja

## Werdykty

| Wymiar                       | Werdykt                            |
| ---------------------------- | ---------------------------------- |
| Zgodność ze stanem końcowym  | PASS                               |
| Oszczędne wykonanie          | PASS                               |
| Dopasowanie architektoniczne | PASS                               |
| Martwe punkty                | WARNING → PASS (F2 naprawione)     |
| Kompletność planu            | WARNING → PASS (F1, F3 naprawione) |

## Ugruntowanie

Ugruntowanie: 7/7 ścieżek ✓, 8/8 symboli ✓, brief↔plan ✓

Potwierdzone w kodzie: `listPublishedEvents` filtry; RLS `events_select_own_or_published`; `publishOwnEvent` / `uploadOwnEventImage` → `not_found` dla foreign; early gate przed storage; wzorzec IDOR z `update-own-event.integration.test.ts`; `fileParallelism: false`.

## Ustalenia

### F1 — Triage błędnie oznaczone jako CHECK

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Krytyczne szczegóły + Faza 1 (seed published)
- **Szczegóły**: Plan wrzucał triage ∈ `{accepted, maybe}` pod „(CHECK)”. W migracji jedyny CHECK to `events_published_at_consistency`. Triage to konwencja app/test.
- **Poprawka**: Rozdziel: `published_at` = CHECK; triage = konwencja semantyki / positive control / publish IDOR.
- **Decyzja**: FIXED — Naprawiono w planie

### F2 — Meta obiecuje regresję, której suite nie złapie

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Analiza stanu obecnego ↔ Faza 1 Meta „Regression caught”
- **Szczegóły**: Przy intaktnym RLS sam drop app `.eq("is_published")` nie psuje absent/present; Meta tego nie powinna obiecywać.
- **Poprawka A ⭐ Zalecana**: Popraw Meta — widen RLS / drop `.neq` / brak positive control; drop samego `.eq` poza zasięgiem suite.
- **Poprawka B**: Osobny test warstwy app (service-role / osłabienie RLS).
- **Decyzja**: FIXED — Naprawiono za pomocą poprawki A

### F3 — „Brak Storage I/O” vs weryfikowalny sanity check

- **Waga**: 👁 OBSERVATION
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 / Progress 3.3
- **Szczegóły**: Progress 3.3 wymagał „brak Storage I/O”, a ręczne kryterium to `image_path` null — I/O bez listowania bucketa niesprawdzalne.
- **Poprawka**: 3.3 = `image_path` unchanged; early-return jako nota, nie assert bucketa.
- **Decyzja**: FIXED — Naprawiono w planie
