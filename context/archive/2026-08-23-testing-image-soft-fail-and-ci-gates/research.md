---
date: 2026-08-23T13:42:00+02:00
researcher: Cursor Agent
git_commit: 096faac618bcc2f828d1df92713aba46ff5dd913
branch: testing-image-soft-fail0and-ci-gates
repository: kids-time
topic: "Rollout Phase 4 — Image soft-fail (Risk #5) + CI npm test gate"
tags: [research, codebase, storage, events, vitest, ci]
status: complete
last_updated: 2026-08-23
last_updated_by: Cursor Agent
---

# Badanie: Image soft-fail + CI gates (Phase 4)

**Data**: 2026-08-23  
**Badacz**: Cursor Agent  
**Git Commit**: `096faac618bcc2f828d1df92713aba46ff5dd913`  
**Gałąź**: `testing-image-soft-fail0and-ci-gates`  
**Repozytorium**: https://github.com/ghMichal/kids-time.git

## Pytanie badawcze

Ground rollout Phase 4 of `context/foundation/test-plan.md`:

- **Risk #5**: Brak `image_path` → `imageUrl: null`; fail signed URL → lista 200 z null, nie 500. Challenge „signed URL zawsze się uda”. Avoid full e2e upload UI.
- **Cross-cutting**: Wire `npm test` (unit) next to existing lint/build in CI (§5 / §6.5).

## Podsumowanie

Produkcja **już implementuje** soft-fail dla signed URL na warstwie lib: `createEventImageSignedUrl` zwraca `null` przy owner mismatch lub błędzie Storage (nigdy nie rzuca), a `toLibraryEventDto` mapuje brak `image_path` na `imageUrl: null` bez wołania sign. `listOwnLibraryEvents` zwraca `{ events }` o ile SELECT się uda — błąd sign nie produkuje `{ error: "list_failed" }`. `GET /api/events` zwraca 500 tylko przy błędzie DB listy, nie przy `imageUrl: null`.

**Luka testowa**: brak unit testów dla `createEventImageSignedUrl`, `toLibraryEventDto` ani scenariusza „sign fail → lista nadal OK”. Integration (`list-own-events.integration.test.ts`) zawsze seeduje `image_path: null`. CI (`.github/workflows/ci.yml`) nie uruchamia `npm test` — cel Phase 4.

**Najtańsza warstwa**: unit z mockiem klienta Storage (edge mock, nie wholesale Supabase) + jeden krok w `ci.yml`. Public/shared list (`listPublishedEvents`) **nie** zawiera `imageUrl` — Risk #5 dotyczy wyłącznie owner library DTO.

**Weryfikacja guidance test-planu**: potwierdzona — nie trzeba zmieniać §2. Docker/integration gate w CI pozostaje poza minimalnym zakresem user intent (tylko `npm test` unit).

## Szczegółowe ustalenia

### Risk #5 — ścieżka mapowania obrazu

| Zachowanie (oracle)                                          | Status w kodzie   | Kotwica                    |
| ------------------------------------------------------------ | ----------------- | -------------------------- |
| `image_path` null/empty → `imageUrl: null`, bez Storage call | ✓                 | `library-event-dto.ts:49`  |
| Owner mismatch na `image_path` → `imageUrl: null`            | ✓                 | `event-image.ts:166-169`   |
| Storage `createSignedUrl` error → `imageUrl: null`           | ✓                 | `event-image.ts:176-177`   |
| Sukces sign → string URL                                     | ✓                 | `event-image.ts:180`       |
| Lista owner nie pada na sign fail                            | ✓ (brak throw)    | `list-own-events.ts:22-25` |
| API list 200 z `imageUrl: null`                              | ✓ (implikuje lib) | `index.ts:23-28`           |

JSDoc na `createEventImageSignedUrl` explicite: _„Returns null on owner mismatch or Storage failure — callers must not fail the whole list.”_ (`event-image.ts:157-159`).

`toLibraryEventDto` woła sign **tylko gdy** `row.image_path` truthy (`library-event-dto.ts:49`). Brak path = `null` bez async Storage.

`listOwnLibraryEvents` używa `Promise.all(data.map(... toLibraryEventDto))`. Ponieważ sign zwraca `null` zamiast throw, mapowanie kończy się `{ events: [...] }` — **regresja** to zmiana sign na throw lub brak soft-fail w DTO.

Inne call site `toLibraryEventDto`: `create-manual-event.ts`, `update-own-event.ts`, `publish-own-event.ts` — pojedynczy event w odpowiedzi PATCH/POST też dostanie `imageUrl: null` przy fail sign (nie 500), o ile helper DB się uda.

### UI (poza zakresem unit Phase 4)

`EventCard` ma **client-side** fallback: `failedImageUrl` ukrywa `<img>` gdy URL się nie załaduje (`EventCard.tsx:112-115`, `286-291`). To osobna warstwa od server soft-fail; test-plan anti-pattern: pełne e2e upload UI.

### Shared / public list

`listPublishedEvents` select **nie** zawiera `image_path`; `SharedEventDto` nie ma `imageUrl` (`list-published-events.ts:4-16`, `18-37`). Risk #5 w test-planie dotyczy owner preview po create/upload — nie public list.

### Istniejące testy

| Plik                                         | Co pokrywa                | Luka względem #5                   |
| -------------------------------------------- | ------------------------- | ---------------------------------- |
| `event-image-path.test.ts`                   | Path ownership (#3)       | Brak signed URL                    |
| `list-own-events.integration.test.ts`        | Owner filter, triage (#1) | Zawsze `image_path: null` w seed   |
| `upload-own-event-image.integration.test.ts` | IDOR upload (#3)          | Nie testuje list preview po upload |
| `index.test.ts`                              | POST create, spy AI       | Brak GET list / imageUrl           |

Stan unit: **11 plików**, **66 testów**, `npm test` exit 0 (2026-08-23).

### CI gate (cross-cutting)

`.github/workflows/ci.yml`: `npm ci` → `npx astro sync` → `npm run lint` → `npm run build` (secrets Supabase). **Brak** `npm test`.

`package.json`: `"test": "vitest run --project unit"` — tylko unit, bez Dockera. Integration wymaga env A/B (`vitest.config.ts`, `hasIntegrationEnv()`).

Phase 1 archive świadomie odłożył CI test; Phase 3 plan też: „CI Docker (Phase 4)”. User intent i §6.5 mówią wyłącznie o **`npm test` obok lint/build** — interpretacja: **unit gate w Actions**, nie obowiązkowy Docker integration job w tej fazie (§6.2 nadal opisuje integration jako lokalne / optional CI later).

Kolejność rekomendowana: po `lint`, przed `build` — szybszy fail na regresji logiki bez pełnego build.

### Wzorce mockowania (z Phase 3)

- Mock **na krawędzi** Storage API, nie całego `@supabase/supabase-js`.
- `vi.mock` modułu `@/lib/storage/event-image` dopuszczalny w testach `library-event-dto` / `list-own-events` gdy testujemy warstwę wyżej.
- Anti-pattern: wholesale Supabase mock (test-plan §6.2).

## Odniesienia do kodu

- `src/lib/storage/event-image.ts:157-181` — `createEventImageSignedUrl` soft-fail contract
- `src/lib/events/library-event-dto.ts:40-65` — `image_path` → `imageUrl` mapping
- `src/lib/events/list-own-events.ts:7-26` — list aggregation
- `src/pages/api/events/index.ts:13-28` — GET list HTTP (500 tylko na `list_failed`)
- `src/lib/storage/event-image-path.test.ts` — istniejący wzorzec colocated unit
- `.github/workflows/ci.yml:18-24` — brak test step
- `package.json:15-17` — skrypty test
- `vitest.config.ts:15-43` — projects unit vs integration

## Wnioski architektoniczne

1. **Soft-fail jest w lib, nie w route** — testy powinny trzymać oracle na `createEventImageSignedUrl` + `toLibraryEventDto` + opcjonalnie cienki `listOwnLibraryEvents` z mock DB row + mock sign.
2. **Wyrocznia z test-planu**, nie z implementacji: „lista 200 z null” = `{ events: [{ ..., imageUrl: null }] }` lub brak `{ error }` — nie asercja na konkretny signed URL string.
3. **Challenge „signed URL always succeeds”**: test musi **wymusić** `{ error }` / `{ data: null }` z mock Storage i assert `imageUrl === null` oraz brak throw z list helper.
4. **CI**: minimalny diff — jedna linia `- run: npm test` w istniejącym jobie; bez nowych secrets (unit nie potrzebuje Supabase).

## Kontekst historyczny

- `context/archive/2026-06-22-event-image-storage/plan.md` — F-04 bucket, path `{owner_id}/{event_id}/{filename}`, private RLS; scaffold bez test runnera.
- `context/archive/2026-08-13-testing-runner-critical-owner-access/plan.md` — Vitest bootstrap; integration seed bez `image_path`; CI test → Phase 4.
- `context/archive/2026-08-18-testing-ai-path-contracts/plan.md` — wzorzec faz planu + cookbook §6.3; explicit „Risk #5 signed-URL (Phase 4)”.
- `context/foundation/test-plan.md` §2 #5, §3 Phase 4, §6.4/§6.5 TBD.

## Korekty / potwierdzenia względem test-planu

| Guidance                                             | Werdykt                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| missing path → null                                  | Potwierdzone w kodzie; brak testu                                                                                          |
| sign fail → list OK, not 500                         | Potwierdzone w kodzie; brak testu                                                                                          |
| Cheapest: unit on URL mapper                         | Zgodne — bez integration upload                                                                                            |
| Avoid e2e upload UI                                  | Zgodne                                                                                                                     |
| Wire npm test in CI                                  | Potwierdzony gap w `ci.yml`                                                                                                |
| §5 „unit + integration (npm test)” vs `package.json` | **Niespójność dokumentacji**: `npm test` = unit only; integration = `test:integration`. Phase 4 user intent = unit CI gate |

Brak korekt do backportu w §2 (hot-spot `src/lib/storage` nadal trafny jako likelihood evidence).

## Otwarte pytania

1. **Cienki GET `/api/events` contract** — opcjonalny (mock `listOwnLibraryEvents`); research rekomenduje minimum lib unit; route test redundantny jeśli list + DTO pokryte.
2. **Docker integration w CI** — poza minimalnym §6.5; można dodać w `--refresh` jeśli zespół chce `test:integration` w Actions.
