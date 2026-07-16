<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: AI activity suggestions (S-01)

- **Plan**: context/changes/ai-activity-suggestions/plan.md
- **Tryb**: Głęboki
- **Data**: 2026-06-22
- **Werdykt**: SOUND (po poprawkach)
- **Ustalenia**: 0 krytycznych 3 ostrzeżeń 1 obserwacja

## Werdykty

| Wymiar                       | Werdykt (przed) | Werdykt (po) |
| ---------------------------- | --------------- | ------------ |
| Zgodność ze stanem końcowym  | PASS            | PASS         |
| Oszczędne wykonanie          | WARNING         | PASS         |
| Dopasowanie architektoniczne | PASS            | PASS         |
| Martwe punkty                | WARNING         | PASS         |
| Kompletność planu            | WARNING         | PASS         |

## Ugruntowanie

Ugruntowanie: 5/5 ścieżek ✓, 4/4 symbole ✓, brief↔plan ✓

## Ustalenia

### F1 — Sekcja Progress nie pokrywa wszystkich kryteriów ręcznych

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Progress + Faza 1 / Faza 3 kryteria ręczne
- **Szczegóły**: Faza 1 miała 5 punktów weryfikacji ręcznej, Progress tylko 1.2. Brakowało kroków dla walidacji inline, redirectu niezalogowanego i linku Topbar.
- **Poprawka**: Dodaj 1.3, 1.4, 3.4 (później 3.4 → 3.3 po reorganizacji Fazy 3) do sekcji Progress.
- **Decyzja**: FIXED — Naprawiono w planie

### F2 — Mapowanie błędu 401 w Fazie 1, zanim middleware to wspiera

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Oszczędne wykonanie
- **Lokalizacja**: Faza 1 (SuggestionsPage) vs Faza 3 (middleware)
- **Szczegóły**: Kontrakt Fazy 1 wymagał mapowania 401, ale middleware zwracał 302 HTML do Fazy 3. Obsługa 401 była martwym kodem.
- **Poprawka A ⭐ Zalecana**: Przenieś middleware JSON 401 do Fazy 1 (przed pierwszym fetch z UI)
  - Siła: Od razu testowalne mapowanie błędów.
  - Kompromis: Faza 3 się kurczy (zostaje README + smoke + handler guard).
  - Pewność: HIGH — blast radius = tylko `/api/ai/suggestions`.
  - Martwy punkt: Brak znaczących
- **Poprawka B**: Zostaw kolejność faz, usuń 401 z kontraktu Fazy 1
- **Decyzja**: FIXED — Naprawiono za pomocą poprawki A

### F3 — childAge jako number vs FormField ze stringiem

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 — SuggestionsPage.tsx
- **Szczegóły**: Plan wymagał `childAge: number` w JSON, ale `FormField` przyjmuje tylko string.
- **Poprawka**: W kontrakcie Fazy 1 dopisz parsowanie `childAge` ze stringa do number (0–18) przed POST.
- **Decyzja**: FIXED — Naprawiono w planie

### F4 — CPU Worker przy parsowaniu OG HTML

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🔎 MEDIUM — warto się zatrzymać przy implementacji enrichera
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 — enrich-suggestion-images.ts
- **Szczegóły**: Parsowanie HTML 5 stron OG jest CPU-bound na Cloudflare Workers. Plan nie ograniczał rozmiaru pobranego HTML.
- **Poprawka**: Limit pobrania (pierwsze 256 KB) + parser regex-only na meta tagi.
- **Decyzja**: FIXED — Naprawiono w planie
