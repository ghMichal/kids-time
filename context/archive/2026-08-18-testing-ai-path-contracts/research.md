---
date: 2026-08-18T08:04:29+02:00
researcher: Cursor Agent
git_commit: b6871c6f62133c3db9740a56c83351c7672f965c
branch: testing-ai-path-contracts
repository: kids-time
topic: "Ground rollout Phase 3 — Risk #4 (AI path contracts)"
tags: [research, codebase, ai, openrouter, zod, suggestions, event-summary, contracts]
status: complete
last_updated: 2026-08-18
last_updated_by: Cursor Agent
---

# Badanie: Ground rollout Phase 3 — Risk #4

**Data**: 2026-08-18T08:04:29+02:00
**Badacz**: Cursor Agent
**Git Commit**: `b6871c6f62133c3db9740a56c83351c7672f965c`
**Gałąź**: `testing-ai-path-contracts`
**Repozytorium**: kids-time

## Pytanie badawcze

Ground rollout Phase 3 of `context/foundation/test-plan.md` ("AI path contracts"). Risk #4: verify risk-response guidance (do not blindly accept); ground the real failure path for bad JSON / timeout / missing key → explicit error code, and that create-manual does not depend on AI; challenge “200 z body = dobre summary”; avoid assertions copied from the production prompt. Hot-spot `src/lib/ai` is likelihood evidence, not an anchor. Stack: Vitest ^4.1 unit vs integration; `vi.mock` at the edge for `astro:env/server` / OpenRouter; no e2e UI this phase.

## Podsumowanie

Risk #4 is **real, not speculative**. Production already has a typed `OpenRouterError` taxonomy and two-stage Zod on the model payload. Tests do **not**. The only Vitest AI coverage is **suggestions 401-only** (Phase 1). `POST /api/ai/event-summary`, `openrouter-client`, and both response schemas are untested.

| Claim from test-plan guidance                      | Verdict                   | Grounded fact                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zły JSON → jawny kod błędu                         | **Confirmed**             | `invalid_response` → HTTP **502** `{ error: "invalid_response", message }`                                                                                                                                               |
| Timeout → jawny kod błędu                          | **Confirmed, narrowed**   | Only `DOMException` + `name === "TimeoutError"` → **504** `{ error: "timeout" }`. Other abort/network → **502** `upstream`                                                                                               |
| Brak klucza → jawny kod błędu                      | **Confirmed, renamed**    | Missing `OPENROUTER_API_KEY` or `OPENROUTER_MODEL` → **503** `{ error: "configuration" }`. There is **no** `missing_key` / `invalid_request` code. Present-but-invalid key → **502** `upstream`                          |
| Create manual nie zależy od AI                     | **Confirmed**             | `POST /api/events` never imports AI; `summary` optional/null; Generate is a separate `POST /api/ai/event-summary` button                                                                                                 |
| Challenge „200 z body = dobre summary”             | **Confirmed, split**      | OpenRouter HTTP 200 is **already** Zod-gated in the client (garbage → 502). **Our** API 200 means schema-valid shape, not quality. UI treats `response.ok` + unchecked JSON cast as success and never reads `body.error` |
| Anti-pattern: asercja z promptu                    | **Confirmed**             | Prompt says 3–5 items / ~10 words / Polish facts; Zod allows 1–5 / 100 chars / any 1–200 char string                                                                                                                     |
| Cheapest layer: unit schema/mapper + thin contract | **Confirmed**             | Skip live OpenRouter, JWT integration, and e2e UI                                                                                                                                                                        |
| Hot-spot `src/lib/ai`                              | **Incomplete, not wrong** | Taxonomy **origin** is `openrouter-client` + schemas. HTTP `{ error }` contract lives in `src/pages/api/ai/*`. The “looks like success” assumption lives in React                                                        |

Permanent links (commit `b6871c6`): `https://github.com/ghMichal/kids-time/blob/b6871c6f62133c3db9740a56c83351c7672f965c/<path>#L<line>`.

**Do not re-litigate suggestions 401.** Phase 1 already locked it. Phase 3 may add the same 401 pattern for **event-summary** (missing today) without expanding into schema.

## Szczegółowe ustalenia

### 1. End-to-end call graphs

Two product paths share `requestChatCompletionContent` in `src/lib/ai/openrouter-client.ts`. They diverge at the route and UI.

**Path A — suggestions (FR-001)**

```
SuggestionsPage.handleSubmit
  POST /api/ai/suggestions
    middleware → unauth: 401 { error: "unauthorized" }
    POST suggestions.ts: request Zod → env check → generateSuggestions
      buildSuggestionPrompt → fetch OpenRouter (25s) → parse envelope → parse content JSON
      suggestionResponseFromModelSchema → suggestionResponseSchema
    enrichSuggestionImages (allSettled; OG fail does not throw)
    200 { suggestions: EnrichedSuggestionItem[] }
  UI: if !response.ok → mapApiError(status); else cast JSON and render cards
  triage (independent): POST /api/events/triage → createEventFromSuggestion
```

**Path B — manual summary (FR-003 / S-03)**

```
ManualEventForm.handleGenerate  (type="button", not submit)
  POST /api/ai/event-summary
    same taxonomy as suggestions
    generateEventSummary → eventSummaryResponseFromModelSchema → eventSummaryResponseSchema
    200 { summary: string }
  UI: if !response.ok → mapSummaryApiError(status); else setForm.summary

ManualEventForm.handleSave  (form submit) — SEPARATE fetch
  POST /api/events  (manualEventCreateSchema; summary optional)
  does not call OpenRouter
```

### 2. Error taxonomy (canonical codes)

There is **no** `AiError` type. Discriminant:

```22:31:src/lib/ai/openrouter-client.ts
export type OpenRouterErrorCode = "configuration" | "upstream" | "timeout" | "invalid_response";

export class OpenRouterError extends Error {
  readonly code: OpenRouterErrorCode;
  // ...
}
```

Shared route mapper (suggestions and event-summary are identical):

```43:56:src/pages/api/ai/suggestions.ts
    if (error instanceof OpenRouterError) {
      switch (error.code) {
        case "configuration":
          return jsonResponse({ error: "configuration", message: error.message }, 503);
        case "timeout":
          return jsonResponse({ error: "timeout", message: error.message }, 504);
        case "upstream":
        case "invalid_response":
          return jsonResponse({ error: error.code, message: error.message }, 502);
      }
    }

    return jsonResponse({ error: "internal", message: "Unexpected error." }, 500);
```

| Scenario                                               | Origin                       | HTTP | JSON `{ error }`          | Notes                                                                                         |
| ------------------------------------------------------ | ---------------------------- | ---- | ------------------------- | --------------------------------------------------------------------------------------------- |
| No session                                             | middleware **or** route      | 401  | `"unauthorized"`          | Phase 1 already tests suggestions; event-summary handler has the same check, **no test file** |
| Not JSON Content-Type                                  | route                        | 400  | `"invalid_content_type"`  |                                                                                               |
| Body not JSON                                          | route                        | 400  | `"invalid_json"`          |                                                                                               |
| Request Zod fail                                       | route                        | 400  | `"validation"` + `issues` | Summary request is `.strict()`; suggestions request is not                                    |
| Missing `OPENROUTER_API_KEY` or `OPENROUTER_MODEL`     | route **before** client      | 503  | `"configuration"`         | Message: `"OpenRouter is not configured."`                                                    |
| Same missing env if client reached                     | `assertOpenRouterConfigured` | 503  | `"configuration"`         | Longer message mentioning both env names                                                      |
| `AbortSignal.timeout` → `TimeoutError`                 | client                       | 504  | `"timeout"`               | 25_000 ms; **only** this abort shape                                                          |
| Other fetch throw (network, non-Timeout abort)         | client                       | 502  | `"upstream"`              | Message: `"Failed to reach OpenRouter."`                                                      |
| OpenRouter HTTP any non-OK (401/400/429/5xx)           | client                       | 502  | `"upstream"`              | Provider status **discarded**. Invalid key that _is_ set → our **502**, not 401/503           |
| HTTP 200, envelope not JSON                            | client                       | 502  | `"invalid_response"`      | `"OpenRouter returned invalid JSON."`                                                         |
| HTTP 200, empty / missing `choices[0].message.content` | client                       | 502  | `"invalid_response"`      |                                                                                               |
| HTTP 200, `content` not JSON                           | client                       | 502  | `"invalid_response"`      |                                                                                               |
| Content JSON fails **fromModel** schema                | client                       | 502  | `"invalid_response"`      | `"…does not match expected shape."`                                                           |
| fromModel OK, **normalized** Zod fail                  | client                       | 502  | `"invalid_response"`      | Suggestions vs summary have distinct messages                                                 |
| Anything else thrown                                   | route catch                  | 500  | `"internal"`              |                                                                                               |

Timeout implementation:

```73:79:src/lib/ai/openrouter-client.ts
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new OpenRouterError("timeout", "OpenRouter request timed out.");
    }
    throw new OpenRouterError("upstream", "Failed to reach OpenRouter.");
```

Missing-key short-circuit (no OpenRouter call):

```35:37:src/pages/api/ai/suggestions.ts
  if (!OPENROUTER_API_KEY || !OPENROUTER_MODEL) {
    return jsonResponse({ error: "configuration", message: "OpenRouter is not configured." }, 503);
  }
```

Failed OpenRouter HTTP does **not** leak provider text (`responseText` unused after `!ok`):

```82:86:src/lib/ai/openrouter-client.ts
  const responseText = await response.text();

  if (!response.ok) {
    throw new OpenRouterError("upstream", "OpenRouter request failed.");
  }
```

Archive F-02 impl-review F1 (leak `payload.error.message` / parse-before-ok) is **stale vs current code**. `ChatCompletionResponse.error` is declared and **never read**; a 200 envelope with `{ error, choices: [] }` becomes empty content → `invalid_response`.

UI never reads `body.error`. It branches on **HTTP status only** (`mapApiError` / `mapSummaryApiError`). Therefore **502 `upstream` and 502 `invalid_response` are indistinguishable in the UI**. Explicit codes exist for the **HTTP/JSON contract**, not for client branching. Contract tests should assert status + `{ error: "<code>" }`, not Polish copy.

### 3. Zod response schemas (the real “200 ≠ good” gate)

Two-stage parse in both `generateSuggestions` and `generateEventSummary`:

```114:124:src/lib/ai/openrouter-client.ts
  const fromModel = suggestionResponseFromModelSchema.safeParse(parsed);
  if (!fromModel.success) {
    throw new OpenRouterError("invalid_response", "OpenRouter response does not match expected shape.");
  }

  const normalized = suggestionResponseSchema.safeParse(fromModel.data);
  if (!normalized.success) {
    throw new OpenRouterError("invalid_response", "Suggestions failed validation.");
  }

  return normalized.data;
```

Product schema (NFR-03 conciseness, not quality):

```3:20:src/lib/ai/suggestion-response.schema.ts
export const suggestionItemSchema = z.object({
  title: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(200),
  sourceUrl: z
    .string()
    .optional()
    .transform(...)
    .refine((value) => value === undefined || z.url().safeParse(value).success, {
      message: "Invalid URL",
    }),
});

export const suggestionResponseSchema = z.object({
  suggestions: z.array(suggestionItemSchema).min(1).max(5),
});
```

```3:12:src/lib/ai/event-summary-response.schema.ts
export const eventSummaryResponseSchema = z.object({
  summary: z.string().trim().min(1).max(200),
});

export const eventSummaryResponseFromModelSchema = z.object({
  summary: z.string(),
});
```

OpenRouter `json_schema` is **looser** than Zod: strings unbounded, no `maxLength` / URL format (archive F-02 impl-review F2 still accurate). That mismatch is a **real cause of 502 `invalid_response`**, not of fake 200. Routes do **not** re-parse the success body with Zod; they trust the client return.

Enricher cannot turn a valid AI payload into a request failure: OG fetch returns `undefined` on error; `Promise.allSettled` swallows rejects (`src/lib/suggestions/enrich-suggestion-images.ts:117-130`).

### 4. Challenge: “200 z body = dobre summary”

**Split verdict:**

| Layer               | 200 means                                                                                       | Challenge still needed?                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenRouter HTTP 200 | Not treated as success. Envelope JSON + nonempty content + inner JSON + two Zod parses required | **Already challenged in client.** Tests must lock this, not invent a missing gate                                                                     |
| Our API 200         | Schema-valid `{ suggestions: [...] }` or `{ summary: string }` after Zod                        | **Shape, not quality.** Hallucinated HTTPS URLs that pass `z.url()`, generic Polish, 1 suggestion though the prompt asked 3–5 — all look like success |
| React               | `response.ok` + `as { summary: string }` / `as { suggestions: ... }`                            | **Yes.** No client Zod. `body.error` ignored. Empty `suggestions` would render silent success if the server gate were skipped                         |

UI success paths:

```152:164:src/components/suggestions/SuggestionsPage.tsx
      if (!response.ok) {
        setServerError(mapApiError(response.status));
        return;
      }

      const data = (await response.json()) as { suggestions: EnrichedSuggestionItem[] };
      setSuggestions(
        data.suggestions.map((suggestion) => ({
```

```291:297:src/components/events/ManualEventForm.tsx
      if (!response.ok) {
        setGenerateError(mapSummaryApiError(response.status));
        return;
      }

      const data = (await response.json()) as { summary: string };
      setForm((prev) => ({ ...prev, summary: data.summary }));
```

**Do not claim** “there is no Zod on the response.” There is, in `openrouter-client`. **Do claim** “UI does not re-validate,” so tests of the client + routes catch the mapping; tests that only hit `res.ok` would miss taxonomy.

On `!response.ok`, `SuggestionsPage` does **not** clear previous cards (S-01 impl-review F5 still true). Mixed error-banner + stale triageable cards is a UX gap, not “Save blocked by contract.” Out of Phase 3 unless cheap to note; do not promote to e2e.

### 5. Create-manual independence from AI — proved in code, untested

S-03 historical decision (still true in current code): Generate is a separate button; AI fail must not block Save; summary optional.

```11:16:context/archive/2026-08-10-manual-event-ai-summary/plan.md
| Moment AI         | Osobny „Generuj” przed Save; user widzi/edytuje summary | Kontrola rodzica; Save niezależny od AI                        | Plan   |
| AI fail           | Błąd widoczny; Save z pustym lub ręcznym summary        | Tworzenie wydarzenia nie zależy od OpenRouter                  | Plan   |
```

`POST /api/events` imports `createManualEvent` only — no `@/lib/ai`:

```31:67:src/pages/api/events/index.ts
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  // content-type / JSON / Zod ...
  const result = await createManualEvent(supabase, {
    ownerId: locals.user.id,
    ...parsed.data,
  });
  // ...
  return jsonResponse({ event: result.event }, 201);
};
```

Insert stamps `origin: "manual"`, `summary: input.summary ?? null` (`src/lib/events/create-manual-event.ts:10-26`). Schema allows omitted / `null` / `""` → `null` (`src/lib/events/manual-event-create.schema.ts:3-23`).

UI Save never fetches `/api/ai/*`:

```320:325:src/components/events/ManualEventForm.tsx
      const createResponse = await fetch("/api/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
```

Empty summary is allowed (`summary: summary.length > 0 ? summary : null` at line 230). Generate errors **explicitly** tell the user they can save without a summary (502/503/504/default/network — lines 62–70, 299–300). `handleSave` **clears** `generateError` (line 317).

**Transient coupling (not “AI failure blocks Save”):** `busy = generatePending || savePending || retryPending` (line 128) disables the form **while Generate is in flight** (OpenRouter timeout 25s). `finally` always clears `generatePending` (301–302). After a failed generate, Save works.

Middleware: `/api/events` and `/api/ai/*` share **auth** fate (`/api/` → JSON 401), not OpenRouter fate. Missing OpenRouter env → summary 503; create still inserts.

**Not this path:** `createEventFromSuggestion` copies `suggestion.summary` with `origin: "ai_suggested"` (S-02 triage). Do not treat that as S-03 manual create.

### 6. Existing tests and gaps

Vitest `^4.1.10`. Projects: `unit` (`npm test`, `src/**/*.test.ts` excluding `*.integration.test.ts`) vs `integration` (`npm run test:integration`). Node environment; **no jsdom**, no `*.test.tsx`.

| File                                        | What it asserts                                                                          | Risk #4                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/api/ai/suggestions.test.ts`      | `locals.user = null` → 401 `{ error: "unauthorized" }`; `generateSuggestions` not called | Auth only (Phase 1). **Must not expand this file into the whole taxonomy if that duplicates 401.** Extend **or** add a sibling for error mapping |
| `src/lib/route-access.test.ts`              | `requiresAuth("/api/ai/suggestions") === true`                                           | Path protected. Not taxonomy. `/api/ai/event-summary` is **not** named                                                                           |
| `src/lib/unauthenticated-api-guard.test.ts` | `/api/ai/suggestions` → `json_401`                                                       | Same; event-summary still matches `/api/` prefix                                                                                                 |

**Missing:** `event-summary` tests; `openrouter-client` tests; schema unit files; `manualEventCreateSchema` / `createManualEvent` tests; any `vi.stubGlobal("fetch")`. Integration suite is owner/privacy/IDOR only. Smoke scripts `scripts/smoke-openrouter.ts` and `scripts/smoke-suggestions-enriched.ts` hit live OpenRouter and **reimplement** fetch (archive F-02 F3) — not the Phase 3 contract layer.

Existing mock recipe to reuse (do **not** mock the whole client when testing the client itself):

```4:26:src/pages/api/ai/suggestions.test.ts
vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: "test-key",
  OPENROUTER_MODEL: "test-model",
}));

vi.mock("@/lib/ai/openrouter-client", () => ({
  generateSuggestions,
  OpenRouterError: class OpenRouterError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
```

Cookbook already documents `vi.mock("astro:env/server")` before importing the handler (`test-plan.md` §6.1). §6.3 is still TBD — Phase 3 implement must fill it.

### 7. Cheapest useful test layer (cost × signal)

Phase 3 already forbids e2e UI. Do not add jsdom/RTL this phase.

| Layer                                          | What to lock                                                                                                                                                                                                                   | Cost                                              | Signal                                    | Verdict                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Unit Zod schemas**                           | `suggestionResponseFromModelSchema` / `suggestionResponseSchema` / `eventSummaryResponseSchema`: reject empty, missing field, too long, non-string, bad URL; accept 1–5 items; empty `sourceUrl` → omitted; summary trim+1–200 | Very low                                          | Direct “bad JSON → fail validation”       | **Do first.** Oracle = schema, not prompt                                                           |
| **Unit `openrouter-client` + stubbed `fetch`** | `!ok` → `upstream`; `TimeoutError` → `timeout`; invalid envelope / non-JSON content / Zod fail → `invalid_response`; empty env → `configuration`                                                                               | Low (`astro:env` mock + `vi.stubGlobal("fetch")`) | Taxonomy source of truth                  | **Do.** This is the real `src/lib/ai` hot-spot                                                      |
| **Thin route contract**                        | Authenticated POST: throw mocked `OpenRouterError(code)` → 503/504/502 + `{ error: code }`; empty env → 503 **without** calling generate; same matrix for **event-summary**                                                    | Low (reuse 401 mock style)                        | HTTP contract the UI keys off             | **Do.** Mock OpenRouter **at the client function edge** here; do not mock it inside the client test |
| **Create ⊥ AI**                                | `manualEventCreateSchema` accepts omitted/null/`""` summary; `POST /api/events` never calls `generateEventSummary`                                                                                                             | Very low                                          | Locks independence at persist/API         | **Do.** Stronger than UI e2e                                                                        |
| **401 event-summary**                          | Same pattern as suggestions 401                                                                                                                                                                                                | Very low                                          | Closes the missing twin                   | **Do, thin only**                                                                                   |
| Extract React `mapApiError`                    | Polish copy table                                                                                                                                                                                                              | Requires production refactor                      | Weak vs HTTP codes                        | **Skip.** Do not extract mappers just to snapshot UI strings                                        |
| Live OpenRouter / JWT integration              | Real model                                                                                                                                                                                                                     | High, flake, cost                                 | Weak for JSON/timeout                     | **Skip this phase**                                                                                 |
| e2e UI                                         | Click Generate/Save                                                                                                                                                                                                            | Forbidden                                         | Cost ≫ signal once schemas + routes exist | **Out of scope**                                                                                    |

**Oracle for contract tests:** HTTP status + `{ error: "<code>" }` (+ `message` where routes set it), Zod `safeParse` on **fixture JSON**, create with `summary: null` still 201. Never `expect(result.summary).toMatch(/rodzic/)` or snapshot `build-*-prompt.ts` system text.

### 8. Prompt content tests MUST NOT copy as oracle

**Suggestions** (`src/lib/ai/build-suggestion-prompt.ts:21-30`): “Podaj od 3 do 5”, “max ~10 słów”, “Nie wymyślaj adresów URL”, “preferuj … pl.wikipedia.org”. **Conflicts with Zod:** `min(1).max(5)`, title max **100 chars**, `sourceUrl` optional after empty string, any `z.url()`.

**Summary** (`src/lib/ai/build-event-summary-prompt.ts:35-39`): “1–2 zdania, konkretne, po polsku”, “Nie wymyślaj faktów”. Zod only enforces a non-empty string ≤200.

JSON-schema `description` strings (Wikipedia / 200 znaków) are prompt-adjacent — do not assert fixture URLs are `pl.wikipedia.org`.

### 9. Speculative vs real

**Real (lock these):**

1. Bad / empty / non-JSON model output → `invalid_response` → 502.
2. Timeout (`TimeoutError`) → 504 `timeout`.
3. Missing env → 503 `configuration`.
4. Invalid/expired key → 502 `upstream`, not 503/401.
5. All OpenRouter HTTP errors collapsed; status and body discarded.
6. UI collapses 502 upstream vs invalid_response; never reads `error` string.
7. UI type-assertion; no client Zod.
8. Manual Save not gated on generate success; summary optional.
9. JSON schema looser than Zod → extra `invalid_response` 502s.
10. Test hole: only suggestions 401; no taxonomy; no event-summary tests.

**Speculative (do not treat as current bugs):**

- “Our API 200 can return an empty summary” — Zod forbids it.
- “UI shows success on 502 because it ignores status” — it checks `response.ok` first.
- “Save is disabled after AI error” — only while `generatePending`.
- “Middleware maps AI errors” — auth 401 only.
- “Provider error messages leak” — **fixed** vs old impl-review F1.
- “Any abort becomes 504” — only `TimeoutError`.
- “OG enricher failing fails the whole AI request” — `allSettled`.
- Rate-limit / cost abuse of OpenRouter — test-plan §7, out of top-5.

**Misleading hot-spot:** citing only `src/lib/ai` understates user-visible Risk #4. Likelihood evidence (3 commits/30d) remains valid. Failure **location** for HTTP codes is `src/pages/api/ai/{suggestions,event-summary}.ts`; for “looks like success” it is `SuggestionsPage` / `ManualEventForm`. Research is ground truth (§1 principle #3).

`src/pages/api/ai/event-summary.ts` has `export const prerender = false`; `suggestions.ts` does not. With `output: "server"` both are SSR — inconsistency, not a proven Risk #4 bug. Do not expand Phase 3 into prerender cleanup.

### 10. Guidance corrections for `/10x-plan` (and optional test-plan backport)

Guidance **stands**. Refinements to consume in the plan (do **not** add file anchors to §2):

1. Name codes: `configuration` / `timeout` / `invalid_response` / `upstream` — not `missing_key` or `invalid_request`.
2. Split the 200-challenge: lock client Zod (OpenRouter 200 ≠ success) **and** do not treat our 200 as quality.
3. Create independence is a **server** fact; optional form-level fetch mock is not required if schema + `POST /api/events` never call AI.
4. Do not re-test suggestions 401 except as a regression already shipped; add event-summary 401 twin.
5. Fill cookbook §6.3 with the schema + taxonomy + create-optional-summary pattern.

These are **not** “risk is speculative / remove #4.” Optional in-place §2 edit: replace “brak klucza” with “brak konfiguracji (`configuration`)” in the response-guidance cell. Defer to `--refresh` if not worth a test-plan edit before planning.

## Odniesienia do kodu

- `src/lib/ai/openrouter-client.ts:22-31` — `OpenRouterErrorCode` union
- `src/lib/ai/openrouter-client.ts:44-50` — `assertOpenRouterConfigured`
- `src/lib/ai/openrouter-client.ts:53-105` — fetch, timeout, parse, `invalid_response`
- `src/lib/ai/openrouter-client.ts:107-145` — `generateSuggestions` / `generateEventSummary` two-stage Zod
- `src/lib/ai/suggestion-response.schema.ts:3-37` — product vs from-model schemas; `min(1).max(5)`
- `src/lib/ai/event-summary-response.schema.ts:3-12` — summary `trim().min(1).max(200)`
- `src/lib/ai/build-suggestion-prompt.ts:21-30` — prompt (anti-oracle)
- `src/lib/ai/build-event-summary-prompt.ts:35-39` — prompt (anti-oracle)
- `src/pages/api/ai/suggestions.ts:13-56` — request validation + HTTP map
- `src/pages/api/ai/event-summary.ts:14-57` — twin map; `prerender = false`
- `src/pages/api/ai/suggestions.test.ts:33-44` — 401-only existing test
- `src/pages/api/events/index.ts:31-67` — create without AI
- `src/lib/events/create-manual-event.ts:10-26` — `origin: "manual"`, nullable summary
- `src/lib/events/manual-event-create.schema.ts:3-23` — optional summary
- `src/components/events/ManualEventForm.tsx:56-70, 128, 238-332` — Generate vs Save
- `src/components/suggestions/SuggestionsPage.tsx:39-53, 152-164` — `res.ok` success
- `src/lib/suggestions/enrich-suggestion-images.ts:117-130` — OG soft-fail
- `src/lib/unauthenticated-api-guard.ts:9-12` — `/api/*` → JSON 401
- `vitest.config.ts:13-43` — unit vs integration projects

GitHub (commit `b6871c6f62133c3db9740a56c83351c7672f965c`):

- https://github.com/ghMichal/kids-time/blob/b6871c6f62133c3db9740a56c83351c7672f965c/src/lib/ai/openrouter-client.ts
- https://github.com/ghMichal/kids-time/blob/b6871c6f62133c3db9740a56c83351c7672f965c/src/pages/api/ai/suggestions.ts
- https://github.com/ghMichal/kids-time/blob/b6871c6f62133c3db9740a56c83351c7672f965c/src/pages/api/ai/event-summary.ts
- https://github.com/ghMichal/kids-time/blob/b6871c6f62133c3db9740a56c83351c7672f965c/src/pages/api/events/index.ts
- https://github.com/ghMichal/kids-time/blob/b6871c6f62133c3db9740a56c83351c7672f965c/src/components/events/ManualEventForm.tsx

## Wnioski architektoniczne

- One OpenRouter helper, two product routes, duplicated HTTP `switch`. Tests should lock the **shared discriminant → status** table twice (or extract later — extraction is not required to get signal).
- Error codes are a **server contract**. UI is status-bucketed Polish copy. Phase 3 oracles the server contract.
- NFR-03 is length/count via Zod + prompt, not a quality metric. Tests that assert “good summary” from prompt text would be tautological (test-plan anti-pattern / oracle problem).
- Create and Generate are **intentionally split HTTP calls**. Coupling them in a future refactor would be the regression this phase exists to catch.
- Mock **at the edge**: `astro:env/server` for any module that imports it; mock `generate*` when testing routes; stub `fetch` when testing `openrouter-client`. Never wholesale-mock Supabase on this path (unused). Never live-call OpenRouter.

## Kontekst historyczny (z poprzednich zmian)

- `context/archive/2026-05-26-ai-suggestion-scaffold/` (F-02) — intended 503 `configuration`, 502/504 upstream/timeout, Zod 1–5 / title≤100 / summary≤200, timeout 25s, `json_schema` strict. Auth was originally 302 HTML; S-01 changed unauth API to JSON 401.
- `context/archive/2026-06-22-ai-activity-suggestions/` (S-01) — enricher adds optional `imageUrl`; OG fail must not fail the request. UI maps 400/401/502/503/504. Stale cards on error (F5 PENDING).
- `context/archive/2026-08-10-manual-event-ai-summary/` (S-03) — “Tworzenie wydarzenia nie zależy od OpenRouter”; no `research.md`; plan is the source. PRD FR-003 still says “with one image and get a short AI summary”; S-03 made both **optional**.
- `context/archive/2026-08-13-testing-runner-critical-owner-access/` — suggestions are **auth-gated, not owner-scoped**. Phase 1 plan: “AI schema/error taxonomy poza 401 (Phase 3).”
- `context/foundation/prd-v2.md` FR-001 / FR-003 / unlabeled NFR “few concise proposals” (test-plan NFR-03). PRD has **no** HTTP error taxonomy.
- `context/foundation/lessons.md` — no AI/prompt-oracle lesson; anti-pattern lives in the test-plan.

## Powiązane badania

- `context/archive/2026-08-13-testing-runner-critical-owner-access/research.md` — suggestions 401 + “not owner-scoped”
- `context/archive/2026-05-26-ai-suggestion-scaffold/research.md` — original OpenRouter/Zod/timeout design
- `context/archive/2026-08-16-testing-privacy-and-publish-boundaries/research.md` — Phase 2 format; unrelated to AI contracts

## Otwarte pytania

1. Extend `suggestions.test.ts` with the taxonomy matrix vs add a dedicated `openrouter-client` unit file plus a thin route file — **plan decision**. Research recommends **both**: client+fetch for taxonomy origin, route+mocked generate for HTTP map; keep the existing 401 test as-is.
2. Whether to add `requiresAuth("/api/ai/event-summary")` as a one-liner in `route-access.test.ts` — cheap, not the Risk #4 core.
3. Optional test-plan §2 backport of code names (`configuration` not “brak klucza”) — not a planning blocker.
4. Stale suggestion cards on error (S-01 F5) — real UX, not cheapest Phase 3 signal; leave unless a unit of a extracted mapper appears.
5. json_schema still lacks `maxLength` — product gap, not a test gap; tests should expect Zod-after-the-fact 502, not assert the provider schema grew maxLength.
