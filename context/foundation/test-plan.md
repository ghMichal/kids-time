# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-08-12

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/lib`, `src/pages`, `src/components`, `src/middleware.ts`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                | Impact | Likelihood | Source (evidence — not anchor)                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Zalogowany rodzic nie widzi własnych wydarzeń ani propozycji AI                                                                        | High   | High       | interview Q1; PRD Access Control / US-01; hot-spot dir `src/lib/events` (19 commits/30d), `src/components/events` (11)                    |
| 2   | Prywatne (nieopublikowane) wydarzenie pojawia się na liście publicznej innego rodzica                                                  | High   | Medium     | PRD NFR-02 / Guardrails; archive `event-schema-rls`, `publish-shared-event`; roadmap S-05                                                 |
| 3   | Obcy użytkownik odczytuje lub zmienia cudze wydarzenie albo obraz mimo posiadania sesji                                                | High   | Medium     | abuse lens (auth + user input); archive F-04 (storage RLS = owner path segment only); hot-spot dir `src/pages/api/events` (7 commits/30d) |
| 4   | Ścieżka AI (suggestions / summary) zwraca zły kształt lub mapuje błąd tak, że UI wygląda na sukces albo blokuje Save wbrew kontraktowi | Medium | Medium     | PRD FR-001, FR-003, NFR-03; archive F-02 / S-01 / S-03; hot-spot dir `src/lib/ai` (3 commits/30d)                                         |
| 5   | Po create/upload właściciel nie dostaje podglądu obrazu albo fail signed URL wywraca całą listę wydarzeń                               | Medium | Medium     | PRD FR-002 / FR-003; archive F-04 / S-03; hot-spot dir `src/lib/storage` (2 commits/30d)                                                  |

### Risk Response Guidance

| Risk | What would prove protection                                                                       | Must challenge                               | Context `/10x-research` must ground                      | Likely cheapest layer                          | Anti-pattern to avoid                          |
| ---- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| #1   | Zalogowany owner dostaje poprawną listę własnych accepted/maybe i propozycji; niezalogowany → 401 | „middleware przepuszcza ⇒ biblioteka działa” | entry list/suggestions API + session; filtr triage/owner | integration (API + auth fixture)               | happy-path-only bez 401 / empty-list failure   |
| #2   | Event `is_published=false` nie pojawia się w public list innego usera                             | „RLS istnieje ⇒ prywatność OK”               | public list vs own list; semantyka publish flag          | integration (dwa user fixtures)                | tylko unit mapper bez DB/RLS                   |
| #3   | Żądanie z sesją A na id/path B → 404/403; brak wycieku body                                       | „wystarczy być zalogowanym”                  | owner check vs storage path; IDOR na PATCH/DELETE/image  | integration                                    | mock całego klienta Supabase tak, że RLS znika |
| #4   | Zły JSON / timeout / brak klucza → jawny kod błędu; create manual nie zależy od AI                | „200 z body = dobre summary”                 | OpenRouter error taxonomy; Zod response schema           | unit (schema/mapper) + cienki contract klienta | asercja skopiowana z promptu produkcyjnego     |
| #5   | Brak `image_path` → `imageUrl: null`; fail sign → lista 200 z null, nie 500                       | „signed URL zawsze się uda”                  | list DTO + signed URL soft-fail                          | unit/integration na mapperze URL               | pełne e2e upload UI                            |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                     | Goal (one line)                                                                       | Risks covered      | Test types         | Status      | Change folder |
| --- | ------------------------------ | ------------------------------------------------------------------------------------- | ------------------ | ------------------ | ----------- | ------------- |
| 1   | Runner + critical owner access | Uruchomić Vitest i bronić regresji dostępu właściciela (#1+#3) na najtańszej warstwie | #1, #3             | unit + integration | not started | —             |
| 2   | Privacy & publish boundaries   | Udowodnić brak wycieku prywatnych wydarzeń i intentional publish                      | #2, #3             | integration        | not started | —             |
| 3   | AI path contracts              | Schema i taxonomy błędów suggestions/summary bez pełnego e2e UI                       | #4                 | unit + contract    | not started | —             |
| 4   | Image soft-fail + CI gates     | Soft-fail signed URL oraz `npm test` w CI (bez pełnego e2e UI)                        | #5 + cross-cutting | unit + gates       | not started | —             |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session. If a useful docs
or search MCP such as Context7 or Exa.ai is not available, say that instead
of assuming access.

| Layer              | Tool                      | Version                   | Notes                                                                       |
| ------------------ | ------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| unit + integration | Vitest                    | none yet — see §3 Phase 1 | Brak runnera w `package.json` / AGENTS.md; bootstrap w Fazie 1              |
| API mocking        | none yet — see §3 Phase 1 | —                         | Prefer mock tylko na krawędzi HTTP (OpenRouter), nie wewnętrznych modułów   |
| e2e                | celowo pominięte na start | —                         | interview Q5: bez pełnego e2e całego UI; re-evaluate przy `--refresh`       |
| accessibility      | none yet                  | —                         | Poza zakresem pierwszego wdrożenia                                          |
| AI-native          | none                      | n/a                       | Brak Playwright/browser MCP w sesji; nie dodajemy warstwy vision „na zapas” |

**Stack grounding tools (current session):**

- Docs: Context7 — available for Vitest/Astro docs during Phase 1 planning; checked: 2026-08-12
- Search: not available in current session; checked: 2026-08-12
- Runtime/browser: not available in current session; checked: 2026-08-12
- Provider/platform: not available as MCP (CI/Supabase via repo configs); checked: 2026-08-12

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase \<N\>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                         | Where      | Required?                 | Catches                             |
| -------------------------------------------- | ---------- | ------------------------- | ----------------------------------- |
| lint + typecheck (astro sync + lint + build) | local + CI | required (already wired)  | syntactic / type drift              |
| unit + integration (`npm test`)              | local + CI | required after §3 Phase 4 | logic / owner / privacy regressions |
| e2e on full UI                               | —          | not planned               | excluded per interview Q5           |
| post-edit hook                               | —          | not planned               | no AI-native phase in this rollout  |
| visual diff / multimodal review              | —          | not planned               | cost × signal; no browser MCP       |
| pre-prod smoke                               | manual     | optional                  | environment-specific failures       |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase \<N\>."

### 6.1 Adding a unit test

- TBD — see §3 Phase 1 for owner-access / schema unit pattern.

### 6.2 Adding an integration test

- TBD — see §3 Phase 1 (owner access) and §3 Phase 2 (privacy/publish).

### 6.3 Adding a test for AI contracts

- TBD — see §3 Phase 3 for suggestions/summary schema + error taxonomy pattern.

### 6.4 Adding a test for image URL soft-fail

- TBD — see §3 Phase 4 for signed-URL null-on-fail without failing the list.

### 6.5 Wiring CI test gate

- TBD — see §3 Phase 4 — add `npm test` alongside existing lint/build in CI.

### 6.6 Per-rollout-phase notes

(Optional. Filled by `/10x-implement` after each phase lands.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Pełne e2e całego UI** — za drogie względem sygnału na start; najpierw unit/integration na API i kontraktach. Re-evaluate jeśli krytyczna ścieżka UI będzie regularnie regressed mimo warstwy API. (Source: Phase 2 interview Q5.)
- **AI-native vision / multimodal review** — brak browser MCP i brak uzasadnienia cost × signal w briefie.
- **Rate-limit / kosztowe nadużycie OpenRouter** — poza top-5; dodać przy `--refresh` jeśli stanie się top-3.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-08-12
- Stack versions last verified: 2026-08-12
- AI-native tool references last verified: 2026-08-12

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
