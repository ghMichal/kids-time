# Vitest runner + critical owner access — Krótki plan

> Pełny plan: `context/changes/testing-runner-critical-owner-access/plan.md`
> Badania: `context/changes/testing-runner-critical-owner-access/research.md`

## Co i dlaczego

Bootstrap Vitest (test base = none) i najtańsze testy chroniące Risk #1 (własna biblioteka accepted/maybe + unauth 401) oraz Risk #3 (sesja A na zasób B → `not_found` bez wycieku body). Cel: zablokować regresję istniejącej ochrony app+RLS, nie budować jej od zera.

## Punkt wyjścia

Brak runnera i `npm test`. Ochrona owner/IDOR jest w kodzie (`listOwnLibraryEvents`, `*Own*` helpers, path assert, middleware 401). Skrypty smoke/verify pokazują wzorzec dwóch JWT pod Supabase JS.

## Pożądany stan końcowy

`npm test` (unit) zawsze zielone lokalnie; `npm run test:integration` / `test:all` z lokalnym Supabase pokrywa listę właściciela (w tym brak wycieku cudzego published) i cross-owner PATCH. Cookbook §6 wypełniony. CI Docker + `npm test` — Phase 4 (tu tylko kontrakt pod to).

## Kluczowe podjęte decyzje

| Decyzja               | Wybór                                    | Dlaczego (1 zdanie)                                        | Źródło         |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------- | -------------- |
| Harness integration   | Lib helpers + JWT A/B                    | Zachowuje app+RLS; tanio; jak verify script                | Badania / Plan |
| Docelowe CI           | Docker `supabase start` w Phase 4        | Ostateczna weryfikacja remote; Phase 1 bez wire            | Plan           |
| Layout                | Colocated + `skipIf(!env)`               | Local full possible; unit nie blokuje bez DB               | Plan           |
| IDOR scope            | PATCH + path unit                        | Representative cost × signal                               | Plan           |
| Suggestions w Phase 1 | Cienki 401-only                          | Skorygowana część #1; nie AI contracts                     | Badania / Plan |
| Foreign published     | Jawny seed case                          | Jedyny regres, którego RLS sam nie łapie dla „own library” | Badania / Plan |
| Unauth 401            | route-access + pure guard + handler mock | Bez Astro HTTP / preview                                   | Plan           |
| IDOR status           | Tylko 404 / `not_found`                  | Nigdy 403 w obecnym kodzie                                 | Badania        |

## Zakres

**W zakresie:** Vitest bootstrap; unit auth/path/suggestions-401; integration own list + IDOR PATCH; §6 cookbook.

**Poza zakresem:** CI `npm test`/Docker job; e2e UI; Risk #2 public privacy; AI schema (Phase 3); image soft-fail; pełna macierz DELETE/publish/image; mock całego Supabase.

## Architektura / Podejście

```
npm test (unit)          → pure route-access, unauth guard, suggestions 401, path-owner
npm run test:integration → JWT A/B → listOwnLibraryEvents + updateOwnEvent (real anon client)
npm run test:all         → lokalny pełny pakiet (wymaga supabase + seed)
Phase 4 CI               → Docker = authoritative integration gate
```

## Fazy w skrócie

| Faza                   | Co dostarcza                         | Kluczowe ryzyko                   |
| ---------------------- | ------------------------------------ | --------------------------------- |
| 1. Vitest bootstrap    | Runner, skrypty, projects            | Alias/`@/` źle skonfigurowany     |
| 2. Unit auth           | 401 + route-access + suggestions 401 | Helper rozjechany z middleware    |
| 3. Unit path-owner     | `assertOwnerPath`                    | Fałszywe poczucie „IDOR done”     |
| 4. Integration library | Own/empty/foreign-published          | Skip mylony z pokryciem; zły seed |
| 5. Integration IDOR    | A→B `not_found`                      | Mock klienta; expect 403          |
| 6. Cookbook §6         | Wzorce dla contributorów             | TBD zostaje / sprzeczne wskazówki |

**Wymagania wstępne:** Node 24; do integration lokalnie — `supabase start` + dwa Auth users (env).
**Szacowany wysiłek:** ~1–2 sesje implementacji w 6 fazach (bootstrap + unit szybkie; integration zależne od seed).

## Otwarte ryzyka i założenia

- Seed A/B musi być powtarzalny lokalnie; bez tego integration tylko skip.
- `toLibraryEventDto` + storage: seed bez obrazów, żeby nie wciągać Risk #5.
- Phase 4 musi wymusić integration (nie tylko unit), inaczej „CI authoritative” będzie puste.

## Kryteria sukcesu (podsumowanie)

- Unit zawsze przechodzi bez Dockera.
- Z env: own library nie zawiera cudzego published; cross-owner update → `not_found`.
- §6 uczy tego samego wzorca; CI jeszcze nie blokuje PR brakiem Docker job.
