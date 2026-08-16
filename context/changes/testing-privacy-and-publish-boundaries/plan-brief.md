# Privacy & publish boundaries — Krótki plan

> Pełny plan: `context/changes/testing-privacy-and-publish-boundaries/plan.md`
> Badania: `context/changes/testing-privacy-and-publish-boundaries/research.md`

## Co i dlaczego

Additive integration tests for rollout Phase 2: prove foreign unpublished events never appear on another user’s shared list (Risk #2), and finish the IDOR matrix for publish + image upload with opaque `404 not_found` (Risk #3). Locks existing dual-layer app+RLS protection — does not rebuild it.

## Punkt wyjścia

Phase 1 already shipped Vitest, JWT A/B fixture, own-library (#1), and PATCH/DELETE IDOR. Gaps: `listPublishedEvents`, `publishOwnEvent`, `uploadOwnEventImage`. Cookbook §6.2 privacy line is still TBD.

## Pożądany stan końcowy

With env A/B: shared-list privacy (absent/present + RLS probe + self-exclude) and publish/image cross-owner deny are green under `npm run test:integration`. Without env: skip, exit 0. §6.2 documents the patterns; CI Docker gate remains Phase 4.

## Kluczowe podjęte decyzje

| Decyzja             | Wybór                                  | Dlaczego (1 zdanie)                               | Źródło         |
| ------------------- | -------------------------------------- | ------------------------------------------------- | -------------- |
| Warstwa #2          | Lib `listPublishedEvents`              | Ten sam harness co Phase 1; filtr jest w helperze | Badania / Plan |
| RLS probe           | Tak — raw SELECT unpublished → null    | Rozdziela warstwy; broni „RLS ⇒ privacy OK”       | Badania / Plan |
| Self-exclude `.neq` | Tak — osobny `it` w tym samym pliku    | Tani UX invariant                                 | Plan           |
| Image IDOR          | Lib + dummy Blob, assert przed storage | Zero Storage I/O na deny; typ wymaga Blob         | Badania / Plan |
| Publish matrix      | B unpublished + B already-published    | Łapie błędny `already_published` dla cudzego      | Badania / Plan |
| HTTP / e2e          | Nie                                    | Cost × signal; unauth 401 już Phase 1             | Plan           |
| CI wire             | Nadal Phase 4                          | Bez zmiany vs Phase 1                             | Plan           |

## Zakres

**W zakresie:** Trzy pliki integration (#2 shared list, #3 publish, #3 image); §6.2 cookbook + §3 status latch.

**Poza zakresem:** Vitest bootstrap; CI/Docker; e2e UI; HTTP shared/image routes; unit mapper privacy; own happy-path publish/upload; PATCH/DELETE redo; AI / soft-fail phases.

## Architektura / Podejście

```
reuse createJwtClientsAB + wipeOwnEvents
  → listPublishedEvents(B)  [#2 privacy + probe + self-exclude]
  → publishOwnEvent(A, idB) [#3 ×2 seeds]
  → uploadOwnEventImage(A, idB, Blob) [#3 early not_found]
  → fill test-plan.md §6.2
```

## Fazy w skrócie

| Faza                        | Co dostarcza                                      | Kluczowe ryzyko                         |
| --------------------------- | ------------------------------------------------- | --------------------------------------- |
| 1. Shared-list privacy (#2) | Absent/present + RLS probe + self-exclude         | Tautologia bez positive control / probe |
| 2. Publish IDOR (#3)        | `not_found` for unpublished + already-published B | Expect 403 / `already_published`        |
| 3. Image upload IDOR (#3)   | Early `not_found`, no `imagePath`                 | Mock client / Storage e2e creep         |
| 4. Cookbook §6.2 + status   | Patterns + Phase 2 complete                       | TBD zostaje / sprzeczne wskazówki       |

**Wymagania wstępne:** Phase 1 harness + lokalny Auth A/B (`__test__/README.md`).
**Szacowany wysiłek:** ~1 sesja w 4 fazach (trzy pliki test + cookbook).

## Otwarte ryzyka i założenia

- Bez lokalnego seed A/B integration tylko skip — nie mylić z pokryciem.
- Przy poprawnym RLS drop samego app filtra może nadal „przejść” absent-id — stąd probe + positive control są obowiązkowe w Fazie 1.

## Kryteria sukcesu (podsumowanie)

- Z env: prywatne A nie na liście B; publish/image A→B → `not_found` only.
- §6.2 uczy tego samego wzorca; CI nadal bez Docker integration gate.
