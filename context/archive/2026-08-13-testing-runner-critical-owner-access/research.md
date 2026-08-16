---
date: 2026-08-13T08:24:32+02:00
researcher: Cursor Agent
git_commit: 242315b196701ea707bee3f7c75a56571ec91856
branch: testing
repository: kids-time
topic: "Ground rollout Phase 1 — Risks #1 and #3 (owner access + IDOR)"
tags: [research, codebase, vitest, owner-access, idor, events, rls, middleware]
status: complete
last_updated: 2026-08-13
last_updated_by: Cursor Agent
---

# Badanie: Ground rollout Phase 1 — Risks #1 and #3

**Data**: 2026-08-13T08:24:32+02:00
**Badacz**: Cursor Agent
**Git Commit**: `242315b196701ea707bee3f7c75a56571ec91856`
**Gałąź**: `testing`
**Repozytorium**: kids-time

## Pytanie badawcze

Ground rollout Phase 1 of `context/foundation/test-plan.md`. Risks #1 and #3: verify (not blindly accept) risk-response guidance; ground real failure paths in code; locate existing tests; identify cheapest useful test layers; flag speculative risks or misleading hot-spot evidence.

## Podsumowanie

Neither risk is speculative — both map to real dual-layer seams (app `owner_id` filter + Supabase RLS). **Protection exists today**; Phase 1 must lock it against regression and bootstrap Vitest (test base = **none**).

| Risk | Real failure path                                                                                                            | Response guidance                                                                                                    | Cheapest useful layer                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| #1   | `GET /api/events` → `listOwnLibraryEvents` with wrong/missing `.eq("owner_id")` / triage filter, or unauth not returning 401 | **Mostly confirmed**; split “suggestions” from owner library (suggestions are auth-gated but **not** user-DB-scoped) | Integration: auth fixture → own list + 401; unit: `route-access`                 |
| #3   | Session A on B’s id without `.eq("owner_id")` (and/or without RLS) on PATCH/DELETE/publish/image                             | **Confirmed intent**; correct expected status to **404 only** (never 403); body is opaque `{ error: "not_found" }`   | Integration: two JWTs → cross-owner 404; unit: `isOwnerPath` / `assertOwnerPath` |

Challenge assumptions from the plan are **valid**: middleware pass ≠ library correctness; being logged in ≠ ownership. Anti-pattern “mock whole Supabase so RLS disappears” is the main **test-design** hazard for #3.

Permanent links (commit `242315b`): `https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/<path>#L<line>`.

## Szczegółowe ustalenia

### Test base and Vitest status

- **Verdict: `none`.** No `vitest`/`jest`/`playwright` in `package.json`, no `npm test` script, no project `*.test.*` / `*.spec.*` / `vitest.config.*`.
- AGENTS/CLAUDE: “No test runner is configured yet.”
- Closest artifacts: manual scripts `scripts/verify-event-images-rls.ts`, `scripts/smoke-*.ts` (two-user JWT patterns reusable as integration fixtures).
- Phase 1 must bootstrap Vitest **and** land the first owner/IDOR tests.

### Session attachment (shared by both risks)

1. Middleware builds cookie client, `getUser()`, sets `locals.user` only — **does not** attach Supabase to locals ([`src/middleware.ts:5-15`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/middleware.ts#L5-L15)).
2. Unauthenticated `/api/*` (except `/api/auth`) → **401** `{ error: "unauthorized" }` ([`src/middleware.ts:17-24`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/middleware.ts#L17-L24)).
3. Handlers re-check `locals.user`, recreate `createClient(request.headers, cookies)`, pass `locals.user.id` as `ownerId` into lib.
4. RLS uses JWT `auth.uid()` on that client; app filters use the explicit `ownerId` argument. Both must agree.

### Risk #1 — Logged-in parent does not see own events / suggestions

#### Grounded call chain (library list)

```
GET /api/events
  → middleware auth gate
  → src/pages/api/events/index.ts GET (re-check locals.user)
  → listOwnLibraryEvents(supabase, locals.user.id)
  → events WHERE owner_id = ? AND triage_status IN (accepted, maybe)
  → toLibraryEventDto (drops non-accepted/maybe)
  → { events }
```

Key code:

```13:28:src/pages/api/events/index.ts
export const GET: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  // ...
  const result = await listOwnLibraryEvents(supabase, locals.user.id);
  // ...
  return jsonResponse({ events: result.events }, 200);
};
```

```11:16:src/lib/events/list-own-events.ts
  const { data, error } = await client
    .from("events")
    .select(LIBRARY_EVENT_SELECT_COLUMNS)
    .eq("owner_id", ownerId)
    .in("triage_status", ["accepted", "maybe"])
    .order("updated_at", { ascending: false });
```

DTO belt-and-suspenders ([`library-event-dto.ts:45-47`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/lib/events/library-event-dto.ts#L45-L47)): non-accepted/maybe → `null` → filtered out.

RLS SELECT also allows **others’ published** rows (`owner_id = auth.uid() OR is_published = true` — [`20260526120000_events_schema_and_rls.sql:74-78`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/supabase/migrations/20260526120000_events_schema_and_rls.sql#L74-L78)). Archive S-04 already noted: **without** app `.eq("owner_id")`, the library would mix in foreign published events. That is a **real** Risk #1 regression mode (wrong list), distinct from empty list.

#### Unauthenticated vs empty authenticated

| Case                      | Status / body                   | Where                                 |
| ------------------------- | ------------------------------- | ------------------------------------- |
| No session                | 401 `{ error: "unauthorized" }` | middleware + handler defense-in-depth |
| Auth, zero accepted/maybe | 200 `{ events: [] }`            | `list-own-events.ts`                  |
| Auth, DB error            | 500 `{ error: "internal" }`     | handler                               |

UI (`EventsLibraryPage`) distinguishes 401 copy vs empty-state — not the failure owner; it renders the API array as-is.

#### Suggestions path (guidance correction)

`POST /api/ai/suggestions` is auth-gated ([`suggestions.ts:13-16`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/pages/api/ai/suggestions.ts#L13-L16)) but `generateSuggestions(parsed.data)` uses **body criteria only** — no `user.id`, no DB owner scope ([`suggestions.ts:40`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/pages/api/ai/suggestions.ts#L40)). Persistence into the library is via `POST /api/events/triage` → `createEventFromSuggestion(..., ownerId: locals.user.id)`.

**Correction:** Risk #1 “own accepted/maybe **and** suggestions” conflates two surfaces. Prove (a) own library list + triage filter + 401, and (b) suggestions 401 when unauthenticated. Do **not** treat “I don’t see suggestions” as an owner-filter failure.

#### Challenge: “middleware passes ⇒ library works”

**Must challenge — confirmed.** Middleware only proves a non-null `locals.user`. It does not prove owner/triage filters, insert `owner_id` stamping, empty vs error taxonomy, or JWT/`ownerId` agreement with RLS.

#### Hot-spot evidence for #1

| Dir                     | Likelihood signal | Failure-path accuracy                                                                                |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `src/lib/events`        | Strong            | **Accurate** — `list-own-events`, create/triage helpers                                              |
| `src/pages/api/events`  | Strong            | Accurate for entry + 401; thin wrappers                                                              |
| `src/components/events` | Churn only        | **Misleading as anchor** — no client-side owner/triage filter that could hide a correct API response |

### Risk #3 — Foreign user reads/mutates another’s event or image with a session

#### Grounded surfaces (no GET-by-id)

| Endpoint                        | Ownership                                                | Cross-owner response             |
| ------------------------------- | -------------------------------------------------------- | -------------------------------- |
| `PATCH /api/events/[id]`        | `updateOwnEvent(..., locals.user.id, id)`                | **404** `{ error: "not_found" }` |
| `DELETE /api/events/[id]`       | `deleteOwnEvent` (fetch + delete both `.eq("owner_id")`) | **404** same                     |
| `POST /api/events/[id]/publish` | `publishOwnEvent`                                        | **404** same                     |
| `POST /api/events/[id]/image`   | `uploadOwnEventImage({ ownerId })`                       | **404** same                     |
| `GET /api/events/[id]`          | **does not exist**                                       | —                                |

Example owner filter:

```39:52:src/lib/events/update-own-event.ts
  const { data, error } = await client
    .from("events")
    .update(payload)
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .select(LIBRARY_EVENT_SELECT_COLUMNS)
    .maybeSingle();
  // ...
  if (!data) {
    return { error: "not_found" };
  }
```

Handler maps `not_found` → 404 opaque JSON ([`[id].ts:45-48`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/pages/api/events/%5Bid%5D.ts#L45-L48)). **No 403** on these routes. Success bodies only after owner-filtered write returns a row — **no body leak** on deny.

Intentional cross-user read: `GET /api/events/shared` (published subset only) — Risk #2 / Phase 2, not Phase 1 mutate IDOR.

#### Storage path ownership

Path shape `{ownerId}/{eventId}/{filename}` ([`event-image-path.ts:84-92`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/lib/storage/event-image-path.ts#L84-L92)); `isOwnerPath` / `assertOwnerPath` ([`113-121`](https://github.com/ghMichal/kids-time/blob/242315b196701ea707bee3f7c75a56571ec91856/src/lib/storage/event-image-path.ts#L113-L121)). Storage RLS: first folder segment = `auth.uid()` (`20260622120000_event_images_storage.sql`); **does not** bind `event_id` segment to `events` row (app must — F-04 archive). Pure path helpers are cheap unit targets.

#### Challenge: “being logged in is enough”

**Not a current production gap** — every id-scoped mutate/upload passes session `ownerId` into `*Own*` helpers. Middleware session alone is **insufficient** by design; tests must prove the owner filter, not merely 401-when-logged-out.

If app `.eq("owner_id")` were dropped but RLS remained, mutate would still fail (empty/error under RLS) — opaque 404 path might change. If **both** were dropped (or tests mock the client to always return a row), IDOR succeeds. Protection today = **app + RLS**.

#### Hot-spot evidence for #3

`src/pages/api/events` is valid entry-point likelihood evidence, but **ownership logic lives in `src/lib/events/*-own-*.ts` + storage path helpers**. Citing only the API dir understates lib as the regression surface.

### Response guidance — verify / correct

| Risk                                               | Plan cell          | Verdict                                                                                    |
| -------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| #1 Prove owner list + unauth 401                   | Keep               | Confirmed                                                                                  |
| #1 “and suggestions”                               | **Correct**        | Suggestions: prove 401 only; not an owner-scoped list                                      |
| #1 Challenge middleware ⇒ library                  | Keep               | Confirmed necessary                                                                        |
| #1 Layer: integration + auth fixture               | Keep               | Confirmed; add cheap `route-access` unit while bootstrapping Vitest                        |
| #1 Anti-pattern happy-path-only                    | Keep               | Must include 401 **and** empty-list / wrong-list (foreign published leaking without `.eq`) |
| #3 Prove session A on id B → 404/403, no body leak | **Correct status** | Expect **404** only; never 403 in current code                                             |
| #3 Challenge “logged in enough”                    | Keep               | Valid challenge; gap is not present in prod code                                           |
| #3 Layer: integration                              | Keep               | Required; unit path helpers complementary                                                  |
| #3 Anti-pattern mock whole Supabase                | Keep               | Critical — would erase both app filter and RLS proof                                       |

### Speculative vs real

| Item                                                                    | Class                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Drop `.eq("owner_id")` on list → foreign published leak / wrong library | **Real** regression (RLS alone insufficient for “own library”) |
| Drop triage `.in(...)` → rejected appear or accepted missing            | **Real**                                                       |
| Unauth not 401                                                          | **Real** if middleware/handler gates regress                   |
| JWT vs `ownerId` drift empty list while middleware passed               | Speculative seam; worth integration coverage                   |
| Session alone authorizes mutate by id                                   | **Not** current gap; **real** if `*Own*` filters removed       |
| Storage RLS unbound `event_id` segment                                  | Residual (own-folder orphans); not foreign-owner IDOR          |
| service_role misconfig                                                  | Speculative config bug; out of default test path               |

## Odniesienia do kodu

- `src/middleware.ts:5-28` — session attach + API 401 + page redirect
- `src/lib/route-access.ts:6-18` — public vs requiresAuth (unit candidate)
- `src/pages/api/events/index.ts:13-28` — GET own library entry
- `src/lib/events/list-own-events.ts:7-25` — owner + triage filter
- `src/lib/events/library-event-dto.ts:45-47` — triage DTO guard
- `src/pages/api/events/[id].ts:13-79` — PATCH/DELETE + 404 mapping
- `src/lib/events/update-own-event.ts:39-52` — owner-scoped update
- `src/lib/events/delete-own-event.ts:10-49` — owner-scoped fetch+delete
- `src/pages/api/events/[id]/publish.ts` / `publish-own-event.ts` — publish IDOR surface
- `src/pages/api/events/[id]/image.ts` / `upload-own-event-image.ts` — image IDOR surface
- `src/lib/storage/event-image-path.ts:84-121` — path build + owner assert
- `src/pages/api/ai/suggestions.ts:13-40` — auth gate, no user DB scope
- `supabase/migrations/20260526120000_events_schema_and_rls.sql:70-97` — events RLS
- `supabase/migrations/20260622120000_event_images_storage.sql` — storage folder RLS
- `scripts/verify-event-images-rls.ts` — manual two-user storage check (fixture pattern)

## Wnioski architektoniczne

1. **Default-deny pages, API JSON 401** via middleware; handlers always re-check `locals.user`.
2. **Ownership is explicit `ownerId` arguments**, not “whatever the session implies for queries.”
3. **RLS SELECT is broader than “own library”** (includes published) → app filter is mandatory for Risk #1 correctness.
4. **IDOR deny is 404-not-403** with opaque error — tests must assert status **and** body shape (no event fields).
5. **Defense in depth (app + RLS)** means integration tests need a real (or carefully faked-at-HTTP-edge) Supabase path; wholesale client mocks invalidate #3 claims.
6. **Vitest bootstrap is a Phase 1 deliverable**, not a prerequisite already present.

## Kontekst historyczny (z poprzednich zmian)

- `context/archive/2026-05-26-event-schema-rls/` — atomic schema+RLS; manual JWT scenarios; warn against service-role “tests.”
- `context/archive/2026-05-25-app-route-auth-guards/` — `route-access` flagged as pure unit candidate when runner lands.
- `context/archive/2026-06-22-event-image-storage/` — storage RLS = first path segment only; app must bind event ownership (F-04).
- `context/archive/2026-07-24-my-events-library/research.md` — library **must** `.eq("owner_id")` because SELECT RLS returns others’ published rows.
- `context/archive/2026-08-04-publish-shared-event/` — shared browse separate from own list; cross-user mutate → `404 not_found`.

## Powiązane badania

- `context/archive/2026-07-24-my-events-library/research.md`
- `context/archive/2026-08-04-publish-shared-event/research.md`
- `context/archive/2026-06-22-event-image-storage/` (plan + research)
- `context/foundation/test-plan.md` §2 Risks #1/#3, §3 Phase 1

## Otwarte pytania

1. Integration harness preference for Phase 1: call lib helpers with real local Supabase JWT clients vs HTTP against `astro` preview? (Both valid; scripts already use direct Supabase JWT.)
2. Whether Phase 1 should include a minimal suggestions **401-only** case under Risk #1, or defer suggestions entirely to Phase 3 (AI contracts) aside from auth gate.
3. Backport of guidance/status wording into `test-plan.md` §2 (see corrections above) — product decision for `/10x-test-plan` latch, not blockers for `/10x-plan`.
