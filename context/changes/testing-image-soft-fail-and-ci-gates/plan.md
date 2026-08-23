# Plan wdrożenia: Image soft-fail + CI test gates

## Przegląd

Phase 4 zamyka Risk #5 (brak obrazu / fail signed URL nie wywraca listy wydarzeń) oraz cross-cutting gate: `npm test` w CI obok lint/build. Warstwa to **unit** na mapperze URL + **jeden krok CI**. Bez e2e upload UI, bez live Storage, bez Docker integration job w tej fazie.

## Analiza stanu obecnego

- Phase 1–3 shipped: Vitest unit/integration, cookbook §6.1–§6.3. **66** unit testów w **11** plikach; `npm test` zielone bez Dockera.
- Produkcja ma soft-fail: `createEventImageSignedUrl` → `null` on mismatch/error (`event-image.ts:157-181`); `toLibraryEventDto` → `imageUrl: null` gdy brak path lub sign fail (`library-event-dto.ts:49-64`); `listOwnLibraryEvents` nie mapuje sign fail na `{ error: "list_failed" }`.
- **Brak** unit testów dla signed URL / DTO image mapping. Integration list seeduje zawsze `image_path: null`.
- CI: `.github/workflows/ci.yml` — sync, lint, build; **brak** `npm test` (świadomie odłożone od Phase 1).
- Public list (`listPublishedEvents`) nie ma `imageUrl` — poza zakresem #5.

## Pożądany stan końcowy

- `npm test` dowodzi:
  - brak / null `image_path` → `imageUrl: null` bez wołania sign;
  - owner mismatch na path → `imageUrl: null`;
  - Storage sign error → `imageUrl: null` (nie throw);
  - sign success → non-null URL string;
  - `listOwnLibraryEvents` z wierszem + fail sign → `{ events: [...] }` z `imageUrl: null`, **nie** `{ error: "list_failed" }`.
- `.github/workflows/ci.yml` uruchamia `npm test` po lint, przed build (unit only, bez Supabase secrets).
- `context/foundation/test-plan.md` §6.4 + §6.5 wypełnione; §5 gate + §6.2 zdanie o CI zsynchronizowane z `npm test` = unit only; §3 Phase 4 → `complete` gdy Progress w pełni `[x]`.
- Brak pełnego e2e upload UI; brak obowiązkowego Docker integration w Actions.

### Kluczowe odkrycia:

- Soft-fail contract w JSDoc + implementacji: `createEventImageSignedUrl` returns `null` on mismatch / `{ error }` / missing `signedUrl` on a non-null `data` object (`research.md` §Szczegółowe ustalenia). **Nie** lock `{ data: null, error: null }` — `!data.signedUrl` then TypeError; out of scope (no prod change)
- List oracle: `Promise.all` + null return — regresja = throw z sign (`list-own-events.ts:22-25`)
- GET API 500 tylko na DB `list_failed`, nie na null imageUrl (`index.ts:23-28`)
- Wzorzec colocated unit: `event-image-path.test.ts`
- Mock edge: partial Supabase client `{ storage: { from: () => ({ createSignedUrl }) } }` — nie wholesale client
- `npm test` = `--project unit` only (`package.json:15`)

## Czego NIE robimy

- Pełne e2e upload UI / Playwright (test-plan §7, anti-pattern)
- Live Supabase Storage / signed URL integration w unit
- Docker job + `npm run test:integration` w CI (poza minimalnym user intent §6.5)
- Wholesale mock `@supabase/supabase-js` w testach list
- Testowanie `EventCard` client `failedImageUrl` (React UI layer)
- `listPublishedEvents` / shared DTO image (brak pola)
- Re-bootstrap Vitest / zmiana `vitest.config.ts` / nowych skryptów npm
- Migracje SQL / zmiany produkcyjnej logiki soft-fail (już istnieje — tylko lock regresji)
- Risk #1–#4 re-test (pokryte Phase 1–3)

## Podejście do implementacji

Koszt × sygnał:

1. Unit `createEventImageSignedUrl` — origin soft-fail (mismatch, error, success).
2. Unit `toLibraryEventDto` — null path + delegacja sign (mock modułu storage lub client).
3. Unit `listOwnLibraryEvents` — jeden wiersz z path + mock sign fail → events OK.
4. CI wire `npm test`.
5. Cookbook §6.4 + §6.5 + status §3.

Oracle z test-plan Risk #5: `imageUrl: null` + brak `{ error }` na liście — nie konkretny URL string z produkcji.

## Krytyczne szczegóły implementacji

- **Wyrocznia**: assert `imageUrl === null` / `typeof url === 'string'`. Wymuś fail **tylko** tymi kształtami: `{ error: { message: '...' }, data: null }` (error short-circuit) oraz `{ error: null, data: {} }` albo `{ error: null, data: { signedUrl: '' } }` (missing/empty URL). **Nie** mockuj `{ data: null, error: null }` — to TypeError na `data.signedUrl`, a prod guard jest poza zakresem.
- **Mock scope**: w `event-image.test.ts` — minimalny client; w `library-event-dto.test.ts` — `vi.mock("@/lib/storage/event-image")` z factory OK; w list test — **tylko** partial client + `vi.mock` sign helper (przepis w Fazie 3). Nie mockuj `toLibraryEventDto` ani `@supabase/supabase-js`.
- **Sekwencjonowanie**: najpierw sign helper (zero DTO), potem DTO, potem list, potem CI (fail-fast na brak testów).
- **CI**: jedna linia w istniejącym jobie; unit nie wymaga `SUPABASE_*`.

---

## Phase 1: Unit — createEventImageSignedUrl soft-fail

### Przegląd

Zablokować kontrakt sign: null on fail, string on success. Challenge „signed URL always succeeds”.

### Wymagane zmiany:

#### 1. Signed URL helper tests

**Plik**: `src/lib/storage/event-image.test.ts`

**Cel**: Lock `createEventImageSignedUrl` behavior per JSDoc.

**Kontrakt**:

- `imagePath` z owner mismatch (path segment ≠ `ownerId`) → `null`, `createSignedUrl` **not** called
- `createSignedUrl` → `null` for `{ error, data: null }` **and** for `{ error: null, data: {} }` / `{ signedUrl: '' }`. Do **not** use `{ data: null, error: null }`
- Happy path → returns `data.signedUrl` string
- Użyj stałych UUID jak w `event-image-path.test.ts` (`OWNER_A`, `EVENT_ID`, valid path)
- Minimal mock client — tylko `storage.from(EVENT_IMAGES_BUCKET).createSignedUrl`

### Meta:

| Pole                 | Treść                                                 |
| -------------------- | ----------------------------------------------------- |
| Behavior asserted    | Sign fail / mismatch → null; success → URL            |
| Regression caught    | Throw on sign error; propagate Storage error to list  |
| Research source      | `research.md` Risk #5 table; `event-image.ts:157-181` |
| Edge/error/boundary  | Owner mismatch; empty signedUrl; error object         |
| Anti-pattern avoided | Live Storage; assert hardcoded production URL         |

---

## Phase 2: Unit — toLibraryEventDto image mapping

### Przegląd

Mapowanie row → DTO: null path bez sign; path invokes sign; sign null → DTO null imageUrl.

### Wymagane zmiany:

#### 1. Library event DTO tests

**Plik**: `src/lib/events/library-event-dto.test.ts`

**Cel**: Lock `image_path` → `imageUrl` bez polegania na live sign.

**Kontrakt**:

- Row z `image_path: null` → `imageUrl: null`; `createEventImageSignedUrl` **not** called (`vi.mock`)
- Row z path + mock sign returns URL → `imageUrl` equals mock URL
- Row z path + mock sign returns `null` → `imageUrl: null`, DTO otherwise populated
- Fixture row: minimal valid `LibraryEventRow` (accepted/maybe)

### Meta:

| Pole                 | Treść                                            |
| -------------------- | ------------------------------------------------ |
| Behavior asserted    | Missing path → null; sign fail → null in DTO     |
| Regression caught    | Skip soft-fail; call sign when path null         |
| Research source      | `library-event-dto.ts:45-64`                     |
| Edge/error/boundary  | null path vs path + null sign                    |
| Anti-pattern avoided | Mirror implementation without independent oracle |

---

## Phase 3: Unit — listOwnLibraryEvents survives sign fail

### Przegląd

Prove list aggregation does not return `{ error: "list_failed" }` when sign soft-fails.

### Wymagane zmiany:

#### 1. List helper test with mocked Supabase

**Plik**: `src/lib/events/list-own-events.test.ts`

**Cel**: One event row with `image_path` set; sign returns null; result is `{ events: [ { imageUrl: null, ... } ] }`.

**Kontrakt**:

- `vi.mock("@/lib/storage/event-image")` — `createEventImageSignedUrl` resolves `null`. Import real `listOwnLibraryEvents` (real `toLibraryEventDto`).
- Partial client, **not** `vi.mock("@supabase/supabase-js")`. Cast `as unknown as SupabaseClient<Database>`.
- Thenable query stub — each of `select` / `eq` / `in` / `order` returns the same builder; the object is thenable (has `then`) so `await client.from(...).select(...).eq(...).in(...).order(...)` resolves:

  `from("events")` → `select(LIBRARY_EVENT_SELECT_COLUMNS)` → `eq("owner_id", ownerId)` → `in("triage_status", ["accepted", "maybe"])` → `order("updated_at", { ascending: false })` → `{ data: [row], error: null }`

  `row` = one accepted `LibraryEventRow` with non-null `image_path` (same UUID constants as Phase 1).

- Expect `not.toHaveProperty("error")`; `events[0].imageUrl === null`
- Optional 3.2: same builder, last thenable resolves `{ data: null, error: { message: "db" } }` → `{ error: "list_failed" }`

### Meta:

| Pole                 | Treść                                                     |
| -------------------- | --------------------------------------------------------- |
| Behavior asserted    | Sign fail → list success with null imageUrl               |
| Regression caught    | Whole list 500 / list_failed on sign error                |
| Research source      | `list-own-events.ts:22-25`; test-plan #5                  |
| Edge/error/boundary  | Single row; sign null vs DB error                         |
| Anti-pattern avoided | Integration upload; wholesale Supabase mock hiding filter |

---

## Phase 4: CI — npm test gate

### Przegląd

Wire unit test gate in GitHub Actions per §5 / §6.5.

### Wymagane zmiany:

#### 1. CI workflow

**Plik**: `.github/workflows/ci.yml`

**Cel**: Run `npm test` on every PR/push alongside lint/build.

**Kontrakt**:

- Add step `- run: npm test` after `npm run lint`, before `npm run build`
- No new env vars (unit project only)
- Existing Node 24 + `npm ci` unchanged

### Meta:

| Pole                 | Treść                                     |
| -------------------- | ----------------------------------------- |
| Behavior asserted    | CI fails when unit tests fail             |
| Regression caught    | Merging without running Vitest            |
| Research source      | `ci.yml`; test-plan §5, §6.5              |
| Edge/error/boundary  | n/a                                       |
| Anti-pattern avoided | Docker integration scope creep in same PR |

---

## Phase 5: Cookbook §6.4 + §6.5 + test-plan status

### Przegląd

Document patterns; mark Phase 4 complete in test-plan.

### Wymagane zmiany:

#### 1. Test plan cookbook

**Plik**: `context/foundation/test-plan.md`

**Cel**: Replace §6.4 and §6.5 TBD with shipped patterns.

**Kontrakt**:

- §6.4: colocate `event-image.test.ts`, `library-event-dto.test.ts`, `list-own-events.test.ts`; mock Storage edge; oracle null-on-fail; thenable query stub from Phase 3; anti-pattern e2e upload
- §6.5: CI step `npm test` after lint; unit only; integration remains local/`test:integration`
- §5 Quality Gates: zmień wiersz `unit + integration (\`npm test\`)` → unit (`npm test`) required in CI; integration stays local / `test:integration` (not an Actions gate)
- §6.2: zastąp „Authoritative CI + Docker gate = §3 Phase 4” — CI odpala tylko unit; Docker/integration nadal lokalne
- §3 Phase 4 Status → `complete`
- §6.6 note for Phase 4 date + change id
- §8 freshness ledger line if applicable

### Meta:

| Pole                 | Treść                                 |
| -------------------- | ------------------------------------- |
| Behavior asserted    | Docs match repo                       |
| Regression caught    | TBD stubs mislead future contributors |
| Research source      | test-plan template §6                 |
| Edge/error/boundary  | n/a                                   |
| Anti-pattern avoided | File anchors in §2                    |

---

## Strategia testowania

| Layer       | Command                    | Phase 4                           |
| ----------- | -------------------------- | --------------------------------- |
| Unit        | `npm test`                 | Required locally + CI             |
| Integration | `npm run test:integration` | Unchanged; not CI gate            |
| Lint/build  | existing CI                | Unchanged order after test insert |

## Uwagi dotyczące migracji

Brak migracji i zmian produkcyjnych poza testami + CI YAML + test-plan docs.

## Referencje

- Badania: `context/changes/testing-image-soft-fail-and-ci-gates/research.md`
- Test plan: `context/foundation/test-plan.md` §2 #5, §3 Phase 4, §5, §6.2, §6.4–§6.5
- Wzorzec unit: `src/lib/storage/event-image-path.test.ts`
- Archive: `2026-06-22-event-image-storage`, `2026-08-13-testing-runner-critical-owner-access`, `2026-08-18-testing-ai-path-contracts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Add ` — <commit sha>` when landed.

### Phase 1: Unit — createEventImageSignedUrl soft-fail

#### Automated

- [x] 1.1 Owner mismatch → null, sign not called
- [x] 1.2 Storage `{ error, data: null }` and missing/empty `signedUrl` on non-null `data` → null (not `{ data: null, error: null }`)
- [x] 1.3 Success → returns signed URL string
- [x] 1.4 `npm test` exit 0

#### Manual

- [x] 1.5 No live Storage / network

### Phase 2: Unit — toLibraryEventDto image mapping

#### Automated

- [ ] 2.1 `image_path` null → `imageUrl` null, sign not called
- [ ] 2.2 Path + sign null → `imageUrl` null
- [ ] 2.3 Path + sign URL → `imageUrl` set
- [ ] 2.4 `npm test` exit 0

#### Manual

- [ ] 2.5 Oracle from test-plan #5, not copied signed URL from prod

### Phase 3: Unit — listOwnLibraryEvents survives sign fail

#### Automated

- [ ] 3.1 Row with path + sign fail → `{ events }` with `imageUrl: null`
- [ ] 3.2 (Optional) DB error → `{ error: "list_failed" }` distinct from sign soft-fail
- [ ] 3.3 `npm test` exit 0

#### Manual

- [ ] 3.4 No integration upload / Docker

### Phase 4: CI — npm test gate

#### Automated

- [ ] 4.1 `ci.yml` runs `npm test` after lint, before build
- [ ] 4.2 Local `npm test` still green

#### Manual

- [ ] 4.3 CI job does not require Supabase secrets for test step

### Phase 5: Cookbook §6.4 + §6.5 + test-plan status

#### Automated

- [ ] 5.1 §6.4 / §6.5 no longer TBD; §5 + §6.2 say unit CI only
- [ ] 5.2 Test files from Phases 1–3 exist

#### Manual

- [ ] 5.3 §3 Phase 4 → `complete`; §6.6 rollout note
