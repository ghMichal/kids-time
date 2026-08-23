# AI path contracts — Krótki plan

> Pełny plan: `context/changes/testing-ai-path-contracts/plan.md`
> Badania: `context/changes/testing-ai-path-contracts/research.md`

## Co i dlaczego

Phase 3 rolloutu testów (Risk #4): zły JSON / timeout / brak konfiguracji musi wrócić jawnym kodem błędu, a ręczne tworzenie wydarzenia nie może zależeć od AI. Challenge: OpenRouter 200 to nie sukces (Zod w kliencie); nasz API 200 to kształt, nie jakość summary.

## Punkt wyjścia

Vitest unit/integration i cookbook §6.1/§6.2 już są. Jedyny test AI to suggestions 401. `openrouter-client`, schematy odpowiedzi, `event-summary` i create-manual są nieprzetestowane. Taksonomia i dwustopniowy Zod istnieją w produkcji.

## Pożądany stan końcowy

`npm test` blokuje: Zod 1–5 / 1–200, taksonomię klienta (w tym 200+śmieci → `invalid_response`), HTTP map 503/504/502 na obu routach, 401 event-summary, optional summary + `POST /api/events` bez `generateEventSummary`. §6.3 uczy tego wzorca. Bez live modelu i e2e.

## Kluczowe podjęte decyzje

| Decyzja          | Wybór                                             | Dlaczego (1 zdanie)                             | Źródło         |
| ---------------- | ------------------------------------------------- | ----------------------------------------------- | -------------- |
| Layout plików    | Osobne: schematy + client + cienkie routy         | Origin kodów vs HTTP, z którego UI czyta status | Badania / Plan |
| 503 vs 502       | Brak env → 503 bez generate; zły klucz → 502      | Kod rozdziela configuration od upstream         | Badania / Plan |
| Duplikat switcha | Macierz na obu routach, bez ekstrakcji            | Tests-only; rozjazd między plikami to regresja  | Plan           |
| Create ⊥ AI      | Schema + spy na POST `/api/events`                | Łapie przyszłe sprzężenie Save↔Generate bez JWT | Badania / Plan |
| 401 summary      | Cienki twin; suggestions.test.ts nietknięty       | Phase 1 już zablokował suggestions 401          | Badania / Plan |
| Challenge 200    | 200+garbage → invalid_response; 1 karta wbrew 3–5 | Prompt ≠ Zod; jakość nie jest wyrocznią         | Badania / Plan |
| §2 backport nazw | Defer `--refresh`                                 | Nie blokuje Phase 3; §2 bez kotwic              | Badania        |

## Zakres

**W zakresie:** Unit Zod + `openrouter-client` (stub `fetch`); contract HTTP obu `/api/ai/*`; optional summary + POST create spy; cookbook §6.3.

**Poza zakresem:** Live OpenRouter; e2e/jsdom; CI Docker; extract mappera; prompt snapshots; S-01 F5 stale cards; Risk #5; litigowanie suggestions 401.

## Architektura / Podejście

```
Zod schemas (oracle = schema)
  → openrouter-client + stub fetch (taxonomy origin)
  → route contracts ×2 (HTTP status + { error })
  → POST /api/events spy generate* not called
  → test-plan.md §6.3
```

Mock na krawędzi: `astro:env` gettery, `generate*` na routach, `fetch` na kliencie.

## Fazy w skrócie

| Faza      | Co dostarcza                                   | Kluczowe ryzyko                        |
| --------- | ---------------------------------------------- | -------------------------------------- |
| 1. Zod    | Reject złego kształtu; accept 1 karty / 1–200  | Prompt-oracle (3–5, Wikipedia)         |
| 2. Client | Timeout / upstream / invalid_response / config | OpenRouter 200 = sukces; zły klucz=503 |
| 3. Routes | Macierz 503/504/502 ×2 + summary 401           | Rozjazd switchy; instanceof złej klasy |
| 4. Create | Optional summary; generate not called          | Save spięte z Generate                 |
| 5. §6.3   | Cookbook + Phase 3 complete                    | TBD zostaje / sprzeczne wskazówki      |

**Wymagania wstępne:** Phase 1 Vitest unit (`npm test`); brak potrzeby A/B JWT.
**Szacowany wysiłek:** ~1–2 sesje w 5 fazach (testy + cookbook).

## Otwarte ryzyka i założenia

- Gettery na mocku `astro:env` są wymagane, jeśli jeden plik testuje klucz obecny i pusty — literał `vi.mock` tego nie przełączy.
- `OpenRouterError` w teście routy musi być klasą z `vi.mock` factory, bo handler robi `instanceof`.
- 502 `upstream` i 502 `invalid_response` są nieodróżnialne w UI (status only) — contract assertuje **string** `error`.

## Kryteria sukcesu (podsumowanie)

- Zły JSON / timeout / brak env → jawny kod, nigdy ciche 200.
- 1 legalna karta jest 200-kształtem, nie „dobrym summary”.
- Rodzic zapisuje wydarzenie bez Generate / bez summary.
