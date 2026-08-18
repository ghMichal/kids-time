---
date: 2026-08-16T10:30:48+02:00
researcher: Cursor Agent
git_commit: 3306d246151418d90b0f31144e988fc18788101b
branch: testing-privacy-and-publish-boundaries
repository: kids-time
topic: "Ground rollout Phase 2 — Risks #2 and #3 (privacy & publish boundaries)"
tags: [research, codebase, privacy, publish, rls, idor, shared-events, integration]
status: complete
last_updated: 2026-08-16
last_updated_by: Cursor Agent
---

# Badanie: Ground rollout Phase 2 — Risks #2 and #3

**Data**: 2026-08-16T10:30:48+02:00
**Badacz**: Cursor Agent
**Git Commit**: `3306d246151418d90b0f31144e988fc18788101b`
**Gałąź**: `testing-privacy-and-publish-boundaries`
**Repozytorium**: kids-time

## Pytanie badawcze

Ground rollout Phase 2 of `context/foundation/test-plan.md` ("Privacy & publish boundaries"). Risks #2 and #3: verify risk-response guidance; ground public list vs own list and publish-flag semantics; locate IDOR gaps left after Phase 1; identify cheapest integration layers; challenge "RLS exists ⇒ privacy OK" and "logged in is enough"; avoid unit-only mapper / wholesale Supabase mock anti-patterns.

## Podsumowanie

Both risks map to **real dual-layer seams** (app filters + Supabase RLS). Protection exists today; Phase 2 must lock **shared-list privacy (#2)** and finish the **publish/image IDOR matrix (#3)** that Phase 1 deferred. Reuse the Phase 1 JWT A/B harness — do not bootstrap a new runner.

| Risk | Real failure path                                                                                                                               | Response guidance                                                                      | Cheapest useful layer                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| #2   | `GET /api/events/shared` → `listPublishedEvents` missing `.eq("is_published", true)` and/or RLS widened so foreign `is_published=false` appears | **Confirmed**; challenge "RLS exists ⇒ privacy OK" is valid — layers are complementary | Integration: JWT A/B → seed A unpublished (+ published positive control) → `listPublishedEvents(B)`          |
| #3   | Session A on B’s id for **publish** / **image** (PATCH/DELETE already covered) without owner filter                                             | **Confirmed**; expect **404** `{ error: "not_found" }` only — never 403; no body leak  | Integration: same A/B clients → `publishOwnEvent` / `uploadOwnEventImage`; path helpers already unit-covered |

Permanent links (commit `3306d24`): `https://github.com/ghMichal/kids-time/blob/3306d246151418d90b0f31144e988fc18788101b/<path>#L<line>`.

## Szczegółowe ustalenia

### Test base after Phase 1 (reuse, do not re-bootstrap)

- Vitest projects: `unit` (`npm test`) vs `integration` (`npm run test:integration`); `fileParallelism: false` for integration.
- Fixture: [`src/lib/events/__test__/supabase-jwt-fixture.ts`](https://github.com/ghMichal/kids-time/blob/3306d246151418d90b0f31144e988fc18788101b/src/lib/events/__test__/supabase-jwt-fixture.ts) — `hasIntegrationEnv`, `createJwtClientsAB`, wipe-by-owner, local-URL guard.
- Existing integration: `list-own-events.integration.test.ts` (Risk #1), `update-own-event.integration.test.ts` (Risk #3 PATCH/DELETE).
- **No** tests yet for `listPublishedEvents`, `publishOwnEvent`, `uploadOwnEventImage`, or `GET /api/events/shared`.
- Cookbook §6.2: “Privacy / public-list patterns (Risk #2): TBD — see §3 Phase 2” — Phase 2 must fill this after implement.

### Session / auth (unchanged from Phase 1)

Middleware attaches `locals.user` only; handlers recreate cookie Supabase client and pass `locals.user.id` as `ownerId` / `viewerId`. RLS uses JWT `auth.uid()`. Both must agree. Unauth `/api/*` → 401 `{ error: "unauthorized" }`.

### Risk #2 — Private event on another user’s public list

#### Grounded call chain (shared / public list)

```
SharedEventsPage
  → GET /api/events/shared
  → listPublishedEvents(supabase, locals.user.id)
  → .eq("is_published", true).neq("owner_id", viewerId)
  → SharedEventDto[]
```

Key code:

```11:26:src/pages/api/events/shared.ts
export const GET: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  // ...
  const result = await listPublishedEvents(supabase, locals.user.id);
  // ...
  return jsonResponse({ events: result.events }, 200);
};
```

```40:56:src/lib/events/list-published-events.ts
export async function listPublishedEvents(
  client: SupabaseClient<Database>,
  viewerId: string,
): Promise<{ events: SharedEventDto[] } | { error: "list_failed" }> {
  const { data, error } = await client
    .from("events")
    .select(LIST_COLUMNS)
    .eq("is_published", true)
    .neq("owner_id", viewerId)
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false });
  // ...
}
```

| Filter  | Shared list                                         | Own library (`listOwnLibraryEvents`)              |
| ------- | --------------------------------------------------- | ------------------------------------------------- |
| Owner   | `.neq("owner_id", viewerId)` (cudze only)           | `.eq("owner_id", ownerId)`                        |
| Publish | `.eq("is_published", true)`                         | **not** filtered (owner sees private + published) |
| Triage  | **none**                                            | `accepted` \| `maybe`                             |
| DTO     | Slim `SharedEventDto` (no triage/description/image) | Full library DTO + signed image                   |

Own library intentionally includes unpublished for the owner. Shared must never include foreign unpublished.

#### Publish-flag semantics

| Fact                  | Evidence                                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creates start private | `is_published: false` on manual / suggestion create                                                                                                                                                                                                               |
| Publish flips columns | `publishOwnEvent` sets `is_published: true` + `published_at` ISO ([`publish-own-event.ts:12-23`](https://github.com/ghMichal/kids-time/blob/3306d246151418d90b0f31144e988fc18788101b/src/lib/events/publish-own-event.ts#L12-L23))                                |
| Guards                | owner + triage ∈ `{accepted,maybe}` + currently unpublished; else `already_published` (409) or `not_found` (404)                                                                                                                                                  |
| CHECK                 | `is_published = false OR published_at IS NOT NULL` ([`20260526120000_events_schema_and_rls.sql:40-42`](https://github.com/ghMichal/kids-time/blob/3306d246151418d90b0f31144e988fc18788101b/supabase/migrations/20260526120000_events_schema_and_rls.sql#L40-L42)) |
| PATCH cannot publish  | update schema `.strict()` — no `is_published` / `published_at`                                                                                                                                                                                                    |
| Unpublish             | **No app path**                                                                                                                                                                                                                                                   |
| Visibility predicate  | `is_published=true` only; `published_at` is sort + CHECK, not a separate SELECT gate                                                                                                                                                                              |

#### RLS SELECT (defense-in-depth)

```74:78:supabase/migrations/20260526120000_events_schema_and_rls.sql
CREATE POLICY events_select_own_or_published
ON public.events
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR is_published = true);
```

Under a correct user JWT, **foreign unpublished rows are invisible even if the app `.eq("is_published")` were removed**. App filter is still required if RLS is widened/disabled or a privileged client is used. Conversely, SELECT RLS is **wider than “my library”** (foreign published visible) — that is Risk #1 / Phase 1, already covered.

#### Challenge: “RLS exists ⇒ privacy OK”

**Must challenge — confirmed valid.**

| Layer alone     | Insufficient for…                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS only        | Product “own library” (mixes foreign published); DTO column minimization; publish eligibility / triage; Storage path↔event bind; opaque `not_found` API shape |
| App filter only | Direct JWT client bypassing API (RLS still blocks unpublished foreign SELECT and foreign UPDATE/DELETE); CHECK on `published_at`                              |

**Nuance for #2 tests:** With current correct RLS, dropping only the app `.eq("is_published", true)` does **not** leak foreign private rows to a JWT client. A test that only asserts “private id absent” may still pass if it never exercises a path that would fail when RLS is the sole remaining gate — or when RLS is the layer that actually hides the row. Prefer:

1. Call real `listPublishedEvents` with JWT B (product path).
2. Seed unpublished A **and** published A (positive control — proves the list can see foreign published when intended).
3. Optional raw RLS probe: `b.client.from("events").select("id").eq("id", unpublishedAId).maybeSingle()` → `data === null`.

Unit-only `toSharedEventDto` **cannot** prove privacy (pure field copy — [`list-published-events.ts:18-37`](https://github.com/ghMichal/kids-time/blob/3306d246151418d90b0f31144e988fc18788101b/src/lib/events/list-published-events.ts#L18-L37)).

#### Cheapest Risk #2 assertion

Reuse A/B fixture; call lib directly:

1. Seed A: accepted, `is_published: false`, `published_at: null`.
2. Seed A: accepted, `is_published: true`, `published_at: now()` (CHECK-valid positive control).
3. As B: `listPublishedEvents(b.client, b.userId)`.
4. Assert unpublished A id **absent**; published A id **present**.
5. Optional: A’s own published absent from A’s shared list (`.neq` UX — not Risk #2 core).
6. Optional: raw SELECT probe for unpublished as B → null.

### Risk #3 — Session A on id/path B (Phase 2 remainder)

#### Gap matrix after Phase 1

| Surface                            | Owner gate                                          | Deny contract                                | Phase 1        | Phase 2                                |
| ---------------------------------- | --------------------------------------------------- | -------------------------------------------- | -------------- | -------------------------------------- |
| `updateOwnEvent` / PATCH           | `.eq("id").eq("owner_id")`                          | `{ error: "not_found" }` → HTTP 404          | Integration ✓  | Done                                   |
| `deleteOwnEvent` / DELETE          | fetch + delete owner-scoped                         | same                                         | Integration ✓  | Done                                   |
| `publishOwnEvent` / POST publish   | update + lookup both `.eq("owner_id")`              | same (never `already_published` for foreign) | Deferred       | **Need**                               |
| `uploadOwnEventImage` / POST image | select then update `.eq("owner_id")` before storage | same; no `imagePath`                         | Path unit only | **Need**                               |
| GET-by-id                          | —                                                   | Route **does not exist**                     | —              | Nothing for #3                         |
| `isOwnerPath` / `assertOwnerPath`  | path segment 1                                      | throw / false                                | Unit ✓         | Keep; not enough alone for upload IDOR |

#### Publish IDOR

```12:52:src/lib/events/publish-own-event.ts
  // update ... .eq("owner_id", ownerId) ...
  // lookup ... .eq("owner_id", ownerId) ...
  // foreign → not_found (lookup miss); never already_published for B's row
```

Handler: [`publish.ts:27-33`](https://github.com/ghMichal/kids-time/blob/3306d246151418d90b0f31144e988fc18788101b/src/pages/api/events/%5Bid%5D/publish.ts#L27-L33) — 404 / 409 opaque JSON. Assert: `expect(result).toEqual({ error: "not_found" })`; `not.toHaveProperty("event")`; B row still unpublished.

#### Image upload IDOR

```21:34:src/lib/events/upload-own-event-image.ts
  const { data: existing, error: fetchError } = await client
    .from("events")
    .select("id, image_path")
    .eq("id", input.eventId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  // ...
  if (!existing) {
    return { error: "not_found" };
  }
```

Owner row gate runs **before** storage upload. Storage RLS is folder = `auth.uid()` only ([`20260622120000_event_images_storage.sql`](https://github.com/ghMichal/kids-time/blob/3306d246151418d90b0f31144e988fc18788101b/supabase/migrations/20260622120000_event_images_storage.sql)) — does not bind `event_id` to row. No published-image public Storage read (shared list omits images). Assert: `{ error: "not_found" }`; no `imagePath`; B `image_path` unchanged.

#### Challenge: “logged in is enough”

**Valid challenge; not a current production gap** on these surfaces — every id-scoped mutate passes session `ownerId` into `*Own*` helpers. Tests must prove the owner filter, not merely auth. Middleware session alone is insufficient by design.

#### Anti-pattern: mock whole Supabase client

Would erase both app `.eq("owner_id")` empty-row behavior **and** RLS. Matches test-plan §2/#3 and §4 — forbidden for this phase’s integration claims.

### Response guidance — verify / correct

| Plan cell                                                          | Verdict                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| #2 Prove `is_published=false` absent from other user’s public list | **Keep** — ground at `listPublishedEvents`                       |
| #2 Challenge “RLS exists ⇒ privacy OK”                             | **Keep** — complementary layers; see nuance above                |
| #2 Layer: integration two-user fixtures                            | **Keep** — reuse Phase 1 harness                                 |
| #2 Anti-pattern unit-only mapper                                   | **Keep**                                                         |
| #3 Prove A on B → 404 `not_found`, no body                         | **Keep** — status is **404 only** (already corrected in Phase 1) |
| #3 Challenge “logged in enough”                                    | **Keep**                                                         |
| #3 Layer: integration (+ unit path helpers)                        | **Keep** — path units done; add publish + image integration      |
| #3 Anti-pattern mock whole Supabase                                | **Keep**                                                         |

No guidance corrections required beyond Phase 1’s 404-not-403 wording (already backported).

### Speculative vs real

| Item                                                                        | Class                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Drop app `is_published` filter + widen/disable RLS → private on shared list | **Real** dual-layer regression                                                                               |
| Drop only app `is_published` under correct RLS                              | Private still hidden; product path still wrong if RLS later changes — cover with helper + optional RLS probe |
| Publish / image IDOR if `*Own*` owner filter removed                        | **Real** if filters regress                                                                                  |
| Unpublish / anon published browse                                           | Out of scope (no surfaces)                                                                                   |
| Published image Storage read for shared browse                              | Deliberately not shipped — not Phase 2                                                                       |
| service_role misconfig                                                      | Speculative config; out of default test path                                                                 |

## Odniesienia do kodu

- `src/pages/api/events/shared.ts:11-26` — shared list entry + 401
- `src/lib/events/list-published-events.ts:40-56` — publish + exclude-self filters
- `src/lib/events/list-published-events.ts:18-37` — mapper (no privacy logic)
- `src/lib/events/list-own-events.ts:7-26` — own library contrast
- `src/lib/events/publish-own-event.ts:5-53` — publish + IDOR/already_published
- `src/pages/api/events/[id]/publish.ts:27-33` — 404/409 mapping
- `src/lib/events/upload-own-event-image.ts:17-34` — owner fetch before storage
- `src/pages/api/events/[id]/image.ts:56-59` — image 404 mapping
- `src/lib/events/update-own-event.integration.test.ts` — Phase 1 IDOR pattern to mirror
- `src/lib/events/__test__/supabase-jwt-fixture.ts` — A/B harness
- `supabase/migrations/20260526120000_events_schema_and_rls.sql:40-42,70-97` — CHECK + events RLS
- `supabase/migrations/20260622120000_event_images_storage.sql` — private bucket, folder RLS

## Wnioski architektoniczne

1. **Shared browse ≠ own library** — opposite owner predicates; only shared filters `is_published`.
2. **Publish is intentional and one-way** in app (dedicated POST; no unpublish; PATCH cannot flip flags).
3. **RLS SELECT is intentionally broad** (`own OR published`) — privacy of unpublished is strong at DB; product surfaces still need app filters for correct UX and defense if RLS regresses.
4. **IDOR deny is always opaque 404** — publish/image must match PATCH/DELETE assertions.
5. **Phase 2 is additive tests on existing harness** — not a new stack; fill §6.2 cookbook after ship.
6. **Cost × signal** — lib-level JWT integration beats e2e SharedEventsPage; unit mapper alone is insufficient for #2.

## Kontekst historyczny (z poprzednich zmian)

- `context/archive/2026-05-26-event-schema-rls/` — SELECT own-or-published; manual JWT privacy scenarios; warn against service-role “tests.”
- `context/archive/2026-07-24-my-events-library/` — mandatory app `.eq("owner_id")` on own list because RLS returns foreign published.
- `context/archive/2026-08-04-publish-shared-event/` — dedicated publish POST; shared = cudze published only; cross-user mutate → `404 not_found`; unpublished must not leak.
- `context/archive/2026-06-22-event-image-storage/` — Storage RLS = first path segment; no published-image public read (deferred).
- `context/archive/2026-08-13-testing-runner-critical-owner-access/` — Phase 1: Vitest + #1 library + #3 PATCH/DELETE; deferred publish IDOR + Risk #2 public-list to Phase 2.

## Powiązane badania

- `context/archive/2026-08-13-testing-runner-critical-owner-access/research.md`
- `context/archive/2026-08-04-publish-shared-event/research.md`
- `context/archive/2026-07-24-my-events-library/research.md`
- `context/foundation/test-plan.md` §2 Risks #2/#3, §3 Phase 2, §6.2 TBD

## Otwarte pytania

1. Should Phase 2 include the optional raw RLS SELECT probe alongside `listPublishedEvents`, or is the helper + published positive control enough for cost × signal?
2. Image IDOR: assert lib-only (no real Blob upload needed if `not_found` returns before storage) — confirm plan prefers zero Storage I/O on deny path.
3. Whether to assert `.neq("owner_id")` (own published absent from own shared list) as a secondary case in the same file, or keep Phase 2 strictly to Risk #2/#3 core.
4. Backport of any Phase 2 cookbook §6.2 text into `test-plan.md` happens at implement epilogue / `/10x-test-plan` latch — not a research blocker.
