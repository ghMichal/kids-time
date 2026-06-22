<!-- PLAN-REVIEW-REPORT -->

# Plan Review: ai-suggestion-scaffold (F-02)

- **Plan**: `context/changes/ai-suggestion-scaffold/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-27
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 0 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | FAIL    |

## Grounding

Grounding: 10/10 paths ✓, symbols ✓ (`requiresAuth`, `context.locals.user`, `astro:env/server`, `envField`, `APIRoute`, missing direct `zod` dependency), brief↔plan ✓.

Checked paths:

- `package.json`
- `astro.config.mjs`
- `.env.example`
- `README.md`
- `src/lib/config-status.ts`
- `src/lib/supabase.ts`
- `src/middleware.ts`
- `src/lib/route-access.ts`
- `src/types.ts`
- `wrangler.jsonc`

## Findings

### F1 — `## Postęp` does not match the `/10x-implement` mechanical contract

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `plan.md` Progress section
- **Detail**: The plan uses Polish mechanical headings (`## Postęp`, `### Faza N`) while the local `/10x-implement` skill and `references/progress-format.md` parse the English mechanical contract: `## Progress`, `## Phase N:` and `### Phase N:`. The phase names also do not match exactly between the main phase headers and progress entries, for example `Faza 1: Zależności, sekrety i status konfiguracji` versus `Faza 1: Env i Zod`. Archived plans in this repository use the English mechanical contract, so leaving this as-is risks `/10x-implement` failing to identify phases or next pending steps.
- **Fix**: Change mechanical headings to `## Phase N: ...` and `## Progress` / `### Phase N: ...`, with identical phase names between phase blocks and Progress. Descriptive prose can remain in Polish.

### F2 — Malformed JSON can bypass validation and become an unhandled error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Route handler
- **Detail**: The route contract says to require `Content-Type: application/json`, then run `request.json()` and `suggestionRequestSchema.safeParse`. If the client sends malformed JSON with the correct content type, `request.json()` can throw before Zod sees the body. Without an explicit `try/catch`, this can become an unhelpful 500 instead of the promised safe client error.
- **Fix**: Add route contract text: malformed JSON returns `400 { error: "invalid_json" }`; check content type with `includes("application/json")` rather than strict equality.

### F3 — AI spend control is documented as optional rather than a release gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — README/env docs; Phase 4 — preview/deploy smoke
- **Detail**: The endpoint performs a paid OpenRouter request for every authenticated POST. The plan mentions setting a credit limit on the OpenRouter key as optional README guidance, but it is not a required manual/deploy check nor an explicitly accepted risk. For a public authenticated endpoint, the first MVP deployment should not depend only on memory to cap external AI spend.
- **Fix ⭐ Recommended**: Keep app-level rate limiting out of F-02, but make an OpenRouter key credit limit a required manual/deploy check before preview/production smoke. Leave per-user rate limiting for a later slice if usage patterns require it.
  - Strength: Caps external spend without adding application complexity to this scaffold.
  - Tradeoff: Still does not prevent a logged-in user from burning through the configured key budget.
  - Confidence: MEDIUM — enough for MVP scaffold; product-level quota policy is not yet designed.
  - Blind spot: OpenRouter account/project key limit behavior should be verified in the UI before deploy.

## Recommendation

Revise before `/10x-implement`. F1 is the blocker because it affects the automation contract for execution. F2 and F3 are small plan edits worth making before implementation starts.
