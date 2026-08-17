# Plan wdrożenia: Privacy & publish boundaries

## Przegląd

Phase 2 zamyka Risk #2 (prywatne wydarzenie nie pojawia się na shared list innego usera) oraz dokańcza Risk #3 (publish + image IDOR → 404 `not_found`, bez wycieku body). Budujemy wyłącznie **additive integration** na istniejącym harnessie JWT A/B z Phase 1 — bez nowego runnera, bez CI wire, bez e2e UI.

## Analiza stanu obecnego

- Phase 1 shipped: Vitest projects, `supabase-jwt-fixture`, own-library (#1), PATCH/DELETE IDOR (#3), path-owner units, cookbook §6.1/§6.2 (privacy line nadal TBD).
- Shared list: `GET /api/events/shared` → `listPublishedEvents` z `.eq("is_published", true)` + `.neq("owner_id", viewerId)`; RLS SELECT = `own OR published`.
- Publish: one-way `publishOwnEvent` sets `is_published` + `published_at`; PATCH cannot publish; no unpublish path.
- Brak testów dla `listPublishedEvents`, `publishOwnEvent`, `uploadOwnEventImage`, `GET /api/events/shared`.
- Dual-layer nuance (#2): przy poprawnym RLS sam drop app `.eq("is_published")` nie wycieka foreign unpublished do JWT client — stąd positive control + opcjonalny raw RLS probe.

## Pożądany stan końcowy

- `npm run test:integration` (z env A/B) dowodzi:
  - cudze `is_published=false` **nie** w `listPublishedEvents(B)`; cudze published **tak** (positive control);
  - raw SELECT unpublished A as B → `data === null`;
  - własne published nie w own shared list (`.neq`);
  - A→`publishOwnEvent` na B (unpublished + already-published) → `{ error: "not_found" }` only; B unchanged;
  - A→`uploadOwnEventImage` + dummy Blob → `{ error: "not_found" }`; no `imagePath`; B `image_path` unchanged.
- Bez env: integration skip, exit 0; `npm test` (unit) nietknięty.
- `test-plan.md` §6.2 privacy/public-list patterns wypełnione; §3 Phase 2 → `complete` po pełnym Progress.

### Kluczowe odkrycia:

- `listPublishedEvents` — `.eq("is_published", true).neq("owner_id", viewerId)` (`src/lib/events/list-published-events.ts:44-50`); mapper `toSharedEventDto` to pure field copy (nie dowód prywatności)
- RLS: `events_select_own_or_published` — `owner_id = auth.uid() OR is_published = true` (migration `20260526120000`)
- `publishOwnEvent` — update + lookup `.eq("owner_id")`; foreign → `not_found`, nigdy `already_published` (`src/lib/events/publish-own-event.ts`)
- `uploadOwnEventImage` — owner select **przed** storage; early `not_found` nie woła upload (`src/lib/events/upload-own-event-image.ts:21-34`); typ wymaga `file: Blob`
- Wzorzec IDOR asercji: `update-own-event.integration.test.ts` — `toEqual({ error: "not_found" })`, `not.toHaveProperty("event")`, re-read as B
- Fixture: `createJwtClientsAB` / `wipeOwnEvents` / `hasIntegrationEnv` — reuse only

## Czego NIE robimy

- Re-bootstrap Vitest / zmiana `vitest.config.ts` / nowych skryptów npm
- Wire `npm test` w CI / Docker job (Phase 4)
- Pełne e2e SharedEventsPage / Playwright
- HTTP smoke `GET /api/events/shared` lub multipart POST image jako główny harness (lib-first, jak Phase 1)
- Unit-only `toSharedEventDto` jako dowód prywatności
- Mock całego klienta Supabase w integration
- Own happy-path publish / successful image upload (poza Risk #2/#3 boundary)
- Unpublish, anon published browse, public Storage read published images
- AI contracts (Phase 3), image signed-URL soft-fail (Phase 4 / Risk #5)
- PATCH/DELETE IDOR, own-library, path-owner units (już Phase 1)
- Kotwice `file:line` w §2 Risk Map test-planu

## Podejście do implementacji

Koszt × sygnał, priorytet ryzyka:

1. Shared-list privacy (#2) — nowa klasa regresji, najwyższy wpływ wycieku.
2. Publish IDOR (#3) — lustrzane do PATCH; dwa seed cases (unpublished + already-published).
3. Image upload IDOR (#3) — ten sam deny; dummy Blob, zero Storage I/O na deny path.
4. Cookbook §6.2 + status latch.

Harness: lib helpers + JWT A/B (nie Astro SSR client, nie wholesale mock). Oracle z zachowania ryzyka / research, nie z kopiowania SQL produkcyjnego helpera do expectów.

## Krytyczne szczegóły implementacji

- **Czas i cykl życia:** Reuse `fileParallelism: false` + wipe A/B w `beforeEach`; throw on cleanup delete errors (jak Phase 1). Seed published: `is_published=true` **i** `published_at` ISO (**CHECK** `events_published_at_consistency`); triage ∈ `{accepted, maybe}` osobno — konwencja app/test (nie constraint DB; potrzebne dla semantyki publish / positive control).
- **Sekwencjonowanie:** Faza 1 (privacy) przed IDOR — niezależne pliki, ale privacy ugruntowuje shared vs own kontrast przed mutate publish.
- **Debugowanie:** Skip bez env musi logować jedną linię + pointer do `src/lib/events/__test__/README.md` (nie mylić skip z „przetestowane”).

---

## Faza 1: Integration — shared-list privacy (Risk #2)

### Przegląd

Udowodnić, że prywatne wydarzenie A nie pojawia się w `listPublishedEvents` dla B, przy positive control (published A widoczne) oraz raw RLS probe. Dodać secondary self-exclude (`.neq`).

### Wymagane zmiany:

#### 1. Shared-list integration test

**Plik**: `src/lib/events/list-published-events.integration.test.ts`

**Cel**: Lock privacy + product filters na najtańszej warstwie (lib + JWT), bez HTTP i bez unit-mapper tautologii.

**Kontrakt**:

- `describe.skipIf(!hasIntegrationEnv())`; reuse `createJwtClientsAB` / `wipeOwnEvents`
- Seed A: accepted, `is_published: false`, `published_at: null`
- Seed A: accepted, `is_published: true`, `published_at: now()` (CHECK-valid positive control)
- `listPublishedEvents(b.client, b.userId)` → unpublished A id **absent**; published A id **present**
- Raw probe: `b.client.from("events").select("id").eq("id", unpublishedAId).maybeSingle()` → `data === null`
- Secondary `it`: `listPublishedEvents(a.client, a.userId)` → własne published A id **absent**
- Brak asercji na mapper field-copy alone; brak wholesale Supabase mock

### Meta:

| Pole                 | Treść                                                                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior asserted    | Cudze unpublished nie na shared list B; cudze published tak; RLS ukrywa unpublished SELECT; własne published nie na own shared list                                                                                              |
| Regression caught    | Widen RLS (probe); drop `.neq("owner_id")` (self-exclude); seed bez positive control → fałszywy zielony. Drop samego app `.eq("is_published")` przy intaktnym RLS — poza zasięgiem tej suite (warstwa redundantna; zob. Analiza) |
| Research source      | `research.md` Risk #2 call chain + challenge „RLS ⇒ privacy OK”; `list-published-events.ts:44-50`; archive publish-shared-event                                                                                                  |
| Edge/error/boundary  | CHECK `published_at`; empty shared list vs „only foreign published”; self-exclude ≠ privacy leak                                                                                                                                 |
| Anti-pattern avoided | Unit-only `toSharedEventDto`; e2e SharedEventsPage; mock klienta; asercja bez positive control / bez rozróżnienia warstw                                                                                                         |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Bez env: plik skip, `npm run test:integration` exit 0
- Z env: unpublished absent + published present + RLS probe null + self-exclude
- `npm test` (unit) nadal zielone bez tego pliku

#### Weryfikacja ręczna:

- Seed published ma `published_at` + triage accepted/maybe (inaczej positive control nie działa)
- Brak `vi.mock` całego Supabase w pliku

**Uwaga implementacyjna**: Po Fazie 1 zatrzymaj się na potwierdzenie ręczne przed Fazą 2.

---

## Faza 2: Integration — publish IDOR (Risk #3)

### Przegląd

Session A na event id B → `publishOwnEvent` → `{ error: "not_found" }` dla B unpublished **i** B already-published; nigdy `already_published` / body `event`; wiersz B bez zmian.

### Wymagane zmiany:

#### 1. Publish cross-owner integration

**Plik**: `src/lib/events/publish-own-event.integration.test.ts`

**Cel**: Dokończyć macierz IDOR mutate dla publish (PATCH/DELETE już Phase 1).

**Kontrakt**:

- Seed B: accepted, unpublished; seed B: accepted, already published (`published_at` set)
- `publishOwnEvent(a.client, a.userId, foreignId)` → `expect(result).toEqual({ error: "not_found" })`
- `expect(result).not.toHaveProperty("event")`
- Re-read as B: unpublished nadal unpublished; published nadal published / te same flagi
- **Nie** expectować 403; **nie** expectować `already_published` dla foreign
- Mirror lifecycle / wipe z `update-own-event.integration.test.ts`

### Meta:

| Pole                 | Treść                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Behavior asserted    | A na id B → `not_found` only (unpublished + already-published); brak body; B unchanged                         |
| Regression caught    | Drop `.eq("owner_id")` na publish/lookup; foreign published zwraca `already_published`; wyciek DTO             |
| Research source      | `research.md` Risk #3 gap matrix + publish IDOR; `publish-own-event.ts`; challenge „wystarczy być zalogowanym” |
| Edge/error/boundary  | 404-not-403; foreign already-published ≠ 409; opaque JSON                                                      |
| Anti-pattern avoided | Mock całego Supabase; expect 403; tylko unpublished case; own happy-path publish jako jedyny test              |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Z env: oba foreign cases → `not_found`
- Unit-only `npm test` bez env nadal zielone

#### Weryfikacja ręczna:

- Potwierdzenie re-read B: flagi publish nie zmienione przez deny A

---

## Faza 3: Integration — image upload IDOR (Risk #3)

### Przegląd

Session A na event id B → `uploadOwnEventImage` early `not_found` przed storage; brak `imagePath`; `image_path` B bez zmian.

### Wymagane zmiany:

#### 1. Image upload cross-owner integration

**Plik**: `src/lib/events/upload-own-event-image.integration.test.ts`

**Cel**: Udowodnić owner gate przed Storage (path units Phase 1 nie wystarczą same).

**Kontrakt**:

- Seed B event (any triage accepted/maybe; `image_path: null` OK)
- Call `uploadOwnEventImage` with `ownerId: a.userId`, `eventId: bEventId`, `file: new Blob([])` (typ wymaga Blob; storage nie wołany na deny)
- `expect(result).toEqual({ error: "not_found" })`; `not.toHaveProperty("imagePath")`
- Re-read as B: `image_path` nadal null / unchanged
- Brak assertów na Storage RLS folder (poza zakresem deny-path); brak HTTP multipart harness

### Meta:

| Pole                 | Treść                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Behavior asserted    | A→upload na id B → `not_found`; no `imagePath`; B `image_path` unchanged; gate przed storage                       |
| Regression caught    | Drop owner select przed upload; upload mimo braku wiersza; wyciek `imagePath`                                      |
| Research source      | `research.md` image IDOR + storage folder RLS note; `upload-own-event-image.ts:21-34`; archive event-image-storage |
| Edge/error/boundary  | Dummy Blob spełnia typ; zero Storage I/O na deny; 404-not-403 shape                                                |
| Anti-pattern avoided | Mock całego Supabase; path-unit as sole IDOR proof; full multipart e2e; successful upload happy-path               |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Z env: cross-owner upload → `not_found` bez `imagePath`
- `npm test` unit bez env zielone

#### Weryfikacja ręczna:

- Re-read B: `image_path` nadal null / unchanged (weryfikowalny sanity). Early return przed storage = nota implementacyjna (`upload-own-event-image.ts`), nie osobny assert Storage/bucket.

---

## Faza 4: Cookbook §6.2 + status sync

### Przegląd

Wypełnić privacy/public-list + publish/image IDOR patterns w `test-plan.md` §6.2; nota §6.6; §3 Phase 2 → `complete` gdy Progress full.

### Wymagane zmiany:

#### 1. §6.2 Privacy / public-list + remaining IDOR

**Plik**: `context/foundation/test-plan.md` (§6.2)

**Cel**: Zastąpić „Privacy / public-list patterns (Risk #2): TBD — see §3 Phase 2” konkretnymi bulletami z Faz 1–3.

**Kontrakt** (treść do wklejenia przy implementacji):

- Shared list: `listPublishedEvents` + JWT viewer; seed unpublished + published positive control; assert absent/present
- Optional/required-in-phase: raw RLS SELECT probe + self-exclude `.neq`
- Publish/image IDOR: mirror PATCH — `not_found`, never 403 / `already_published` / `imagePath`; re-read victim row
- Image deny: dummy Blob OK; no Storage I/O expected on deny
- Anti-patterns: unit-only mapper; mock whole Supabase; e2e „to be safer”
- Przykładowe pliki: `list-published-events.integration.test.ts`, `publish-own-event.integration.test.ts`, `upload-own-event-image.integration.test.ts`

#### 2. §6.6 notes + §3 status latch

**Plik**: `context/foundation/test-plan.md`

**Cel**: Krótka nota Phase 2 shipped; Status → `complete` dopiero gdy Progress w pełni `[x]` (`/10x-implement` / latch).

**Kontrakt**: Nie dodawać file:line anchors do §2 Risk Map. Nie zmieniać §1–§5 strategy poza Status/Change-folder i cookbook §6.

### Meta:

| Pole              | Treść                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| Behavior asserted | Contributor wie jak dodać privacy/shared-list i publish/image IDOR test |
| Regression caught | Powrót do TBD Phase 2 / sprzeczne wskazówki (expect 403, unit mapper)   |
| Research source   | Decyzje planu + `research.md`                                           |
| Edge              | Local skip vs CI force nadal Phase 4                                    |
| Anti-pattern      | Kotwice plików w §2; e2e zamiast lib integration                        |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- §6.2 nie zawiera „TBD — see §3 Phase 2” po tej fazie
- Istnieją trzy pliki `*.integration.test.ts` z Faz 1–3

#### Weryfikacja ręczna:

- §6 zgodne z faktycznymi asercjami (positive control, RLS probe, dual publish seed, dummy Blob)

---

## Strategia testowania

### Testy jednostkowe:

- Brak nowych unit w Phase 2 (path-owner / auth już Phase 1). Nie dodawać unit-only mapper privacy.

### Testy integracyjne:

- `listPublishedEvents`: unpublished absent, published present, RLS probe, self-exclude
- `publishOwnEvent`: A→B unpublished + already-published → `not_found`
- `uploadOwnEventImage`: A→B → `not_found`, no `imagePath`
- Gate: `skipIf(!hasIntegrationEnv())`

### Kroki testowania ręcznego:

1. `npm test` bez Supabase → zielone (unit unchanged)
2. `supabase start` + istniejący seed A/B → `npm run test:integration` / `test:all` → nowe cases zielone
3. Świadomie: brak mocka całego klienta; brak e2e SharedEventsPage
4. Potwierdź CI nadal bez Docker integration gate (Phase 4)

## Uwagi dotyczące wydajności

Trzy pliki integration, minimal seed (2–4 wiersze na describe). `fileParallelism: false` już ustawione. Nie dodawać pełnego scan tabel ani Storage upload na deny path.

## Uwagi dotyczące migracji

Brak migracji schematu. Auth A/B seed z Phase 1 (`src/lib/events/__test__/README.md`) wystarczy — nie tworzyć nowych użytkowników.

## Referencje

- Badania: `context/changes/testing-privacy-and-publish-boundaries/research.md`
- Test plan: `context/foundation/test-plan.md` §2 #2/#3, §3 Phase 2, §6.2 TBD
- Phase 1 wzorce: `context/archive/2026-08-13-testing-runner-critical-owner-access/plan.md`
- Fixture: `src/lib/events/__test__/supabase-jwt-fixture.ts`
- Archive: `2026-08-04-publish-shared-event`, `2026-05-26-event-schema-rls`, `2026-06-22-event-image-storage`
- AI-native: none (dated 2026-08-16 — brak browser/vision MCP w sesji; nie dodajemy)

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Integration — shared-list privacy (Risk #2)

#### Automatyczne

- [x] 1.1 Bez env: integration skip, exit 0 — 578424b
- [x] 1.2 Z env: unpublished A absent z `listPublishedEvents(B)` — 578424b
- [x] 1.3 Z env: published A present (positive control) — 578424b
- [x] 1.4 Z env: raw RLS SELECT unpublished A as B → null — 578424b
- [x] 1.5 Z env: self-exclude — własne published absent z list A — 578424b
- [x] 1.6 `npm test` (unit) zielone bez env — 578424b

#### Ręczne

- [x] 1.7 Seed published ma `published_at` + triage accepted/maybe; brak wholesale Supabase mock — 578424b

### Faza 2: Integration — publish IDOR (Risk #3)

#### Automatyczne

- [x] 2.1 Z env: A→publish B unpublished → `not_found`, no `event` — caa65f2
- [x] 2.2 Z env: A→publish B already-published → `not_found` (nie `already_published`) — caa65f2
- [x] 2.3 Unit-only `npm test` nadal zielone bez env — caa65f2

#### Ręczne

- [x] 2.4 Re-read B: flagi publish nie zmienione po deny A — caa65f2

### Faza 3: Integration — image upload IDOR (Risk #3)

#### Automatyczne

- [x] 3.1 Z env: A→uploadOwnEventImage B + dummy Blob → `not_found`, no `imagePath`
- [x] 3.2 `npm test` unit bez env zielone

#### Ręczne

- [x] 3.3 B `image_path` unchanged / null po deny (early-return przed storage — nota w kodzie, nie assert bucketa)

### Faza 4: Cookbook §6.2 + status sync

#### Automatyczne

- [ ] 4.1 §6.2 nie zawiera „TBD — see §3 Phase 2”
- [ ] 4.2 Trzy pliki integration z Faz 1–3 istnieją

#### Ręczne

- [ ] 4.3 Przegląd cookbook: positive control, RLS probe, dual publish seed, dummy Blob; §3 Phase 2 → complete
