---
project: kids-time MVP
researched_at: 2026-05-20T00:00:00Z
recommended_platform: Cloudflare Workers + Pages
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript / JavaScript
  framework: Astro 6 + React islands
  runtime: Cloudflare Workers (via @astrojs/cloudflare ^13.5; wrangler ^4.90; nodejs_compat enabled in wrangler.jsonc)
  database: Supabase (external)
  external_services:
    - Supabase (auth / data / storage patterns)
    - OpenRouter (AI provider; called over HTTP from the app)
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

The repository is already wired for this path: `output: "server"` with `adapter: cloudflare()` and `wrangler.jsonc` using `@astrojs/cloudflare/entrypoints/server` plus `nodejs_compat`. That removes adapter migration risk at a 3-week MVP pace. Interview answers reinforced the choice: **no** need for persistent processes, **comfort with Cloudflare**, **Supabase + OpenRouter** as external providers (fine with edge `fetch`), and **single-region** users (global edge is a nice extra, not the core win). Operationally, Cloudflare scores well on CLI-driven deploys, managed serverless, agent-readable docs (`llms.txt`), and published MCP servers.

## Platform Comparison

Scores use **Pass / Partial / Fail** against the five agent-friendly criteria (CLI-first, managed/serverless, agent-accessible docs, stable deploy API, MCP/integration). “Total” counts **Pass** as 1, **Partial** as ½.

| Platform       | CLI-first | Managed / serverless | Agent-readable docs | Stable deploy API | MCP / integration | Total  |
| -------------- | --------- | -------------------- | ------------------- | ----------------- | ----------------- | ------ |
| **Cloudflare** | Pass      | Pass                 | Pass                | Pass              | Pass              | **5**  |
| **Vercel**     | Pass      | Pass                 | Pass                | Pass              | Partial           | **4½** |
| **Netlify**    | Pass      | Pass                 | Pass                | Pass              | Pass              | **5**  |
| **Fly.io**     | Pass      | Pass                 | Pass                | Pass              | Partial           | **4½** |
| **Railway**    | Pass      | Pass                 | Pass                | Pass              | Partial           | **4½** |
| **Render**     | Pass      | Pass                 | Pass                | Partial           | Partial           | **3½** |

**Cloudflare:** `wrangler` covers deploy/logs/rollback; Workers/Pages are fully managed; docs expose `llms.txt` and markdown-oriented flows; deployment is deterministic from CI or CLI; Cloudflare publishes MCP servers for docs/bindings/observability ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Pages Functions pricing note](https://developers.cloudflare.com/pages/functions/pricing), [Workers llms.txt](https://developers.cloudflare.com/workers/llms.txt), [mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare)).

**Vercel:** Excellent Astro story and Hobby tier includes substantial serverless headroom ([Astro on Vercel](https://vercel.com/docs/frameworks/frontend/astro), [Hobby limits](https://vercel.com/docs/accounts/plans/hobby)); MCP integration exists but treat vendor MCP offerings as evolving (**Partial** until you confirm the exact OAuth/beta posture you want).

**Netlify:** Strong Astro SSR adapter path ([Netlify Astro guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/astro/)); official MCP positioning is strong; **credit-based plans** from Sep 2025 make metering explicit ([credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).

**Fly.io:** Containers/`flyctl` suit Node-heavy workloads ([pricing](https://fly.io/pricing)); more moving parts than serverless for a stateless SSR MVP.

**Railway:** Usage-based billing with a **Hobby minimum** (~$5/mo cited in Railway docs at research time) — fine for MVPs but not the cheapest idle cost ([Railway pricing](https://docs.railway.com/pricing)).

**Render:** Free tier **spindown** after inactivity hurts first-impression latency for low-traffic MVPs ([Render free tier](https://render.com/docs/free)).

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

Wins on **repo fit** (`@astrojs/cloudflare` already integrated), **operator familiarity**, and **agent-friendly surfaces** (CLI + `llms.txt` + MCP), while keeping Supabase/OpenRouter as separate HTTP-backed services.

#### 2. Vercel

Strong if the team prioritized **Vercel-native** iteration and accepted switching from `@astrojs/cloudflare` to `@astrojs/vercel` and re-validating SSR/API behavior.

#### 3. Netlify

Credible Astro + MCP path; runner-up primarily because this codebase is **already** optimized for Cloudflare’s entrypoint/wrangler layout and Netlify would force an **adapter migration** plus new billing mental model under credits.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. **CPU time per invocation** can cap in-process work on the **free** Workers plan; AI calls to OpenRouter need disciplined **timeout/streaming** and may push you to **paid Workers** for headroom ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
2. **Workers are not Node** — packages that assume implicit Node built-ins may fail until `nodejs_compat` + `node:*` import patterns line up ([Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)).
3. **Bundle and platform limits** (worker size, subrequest constraints) can fail late in **build/deploy** rather than in local dev ([Workers limits](https://developers.cloudflare.com/workers/writing-workers/resource-limits)).
4. **Two operational planes** — Cloudflare (HTTP/edge app) + Supabase (data/auth) increases the number of dashboards and failure domains you must monitor.
5. **Single-region users** reduces the marginal value of edge; the decision is mostly **execution fit + cost envelope + existing config**, not worldwide latency optimization.

### Pre-Mortem — How This Could Fail

The team shipped on Cloudflare because the starter already targeted it. Early traffic looked fine: static assets were fast and Supabase owned persistence. Then more **AI orchestration** moved into Astro server routes running on Workers. Latency became spiky and occasional **timeouts** appeared. Logs showed requests brushing **CPU limits** and long-lived **upstream** calls to OpenRouter without a clear streaming strategy. Fixing it required refactoring to **stream** responses, tightening **timeouts**, and sometimes **offloading** work from the hot path. Separately, a dependency upgrade pulled a package that relied on **implicit Node APIs**; production builds broke until `nodejs_compat` boundaries were fixed or the dependency was replaced. Six months later, “small” edge-specific decisions made **migrating** to a vanilla Node host feel expensive — not because Cloudflare was wrong, but because edge constraints were treated as implementation details instead of **product architecture** inputs.

### Unknown Unknowns

- **AI boundary design** — Retries, idempotency keys, and token/cost accounting for OpenRouter often need explicit policy; “it’s just `fetch`” hides failure modes under load.
- **Environment parity** — Astro `astro:env` secrets, local `.dev.vars`, and Cloudflare **secrets** must stay aligned; naming drift causes silent misconfig between local and prod.
- **Supabase SSR + edge** — Session/cookie flows must match how the Worker handles headers and redirects; assumptions from long-lived Node servers do not always transfer.
- **Preview vs production data** — Branch previews easily point at the wrong Supabase project or secrets if not standardized in CI.

## Operational Story

Concrete day-to-day actions (tune to your org’s access model).

- **Preview deploys**: Connect the Git repo to **Cloudflare Pages** (or Workers Builds) so **branch/PR previews** get unique URLs; protect previews if sensitive (e.g., Cloudflare Access) — fork PR secrets policies vary by provider setup.
- **Secrets**: Production secrets via **`wrangler secret put <NAME>`** or the dashboard; local secrets via **`.dev.vars`** per README; Astro declares **`SUPABASE_URL`** / **`SUPABASE_KEY`** as server secrets in `astro.config.mjs` — treat rotation as **dual-update** (Cloudflare secret + any CI vars).
- **Rollback**: Use **`wrangler rollback`** (Workers) or revert/trigger a prior **Pages deployment** in the dashboard; **database migrations** (Supabase) do not automatically roll back with the Worker.
- **Approval**: Gate **production** deploys behind branch protection / manual promotion if desired; restrict **secret writes** and **domain changes** to humans; agents can safely run **read-only** tails and scripted deploys only with scoped tokens.
- **Logs**: **`npx wrangler tail`** against the target worker/environment; combine with Cloudflare observability dashboards for request traces ([Workers observability](https://developers.cloudflare.com/workers/observability/)).

## Risk Register

| Risk                                                       | Source                        | Likelihood | Impact | Mitigation                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AI routes exceed Worker **CPU/time** budgets               | Devil's advocate / Pre-mortem | M          | H      | Stream responses; keep orchestration shallow; move heavy post-processing behind shorter steps; upgrade Workers plan if sustained CPU is needed. |
| Dependency assumes **Node APIs** incompatible with Workers | Devil's advocate / Research   | M          | M      | Prefer edge-safe libs; enforce `nodejs_compat` discipline; pin and CI-build against Workers runtime.                                            |
| **Secrets mismatch** between local, CI, and prod           | Unknown unknowns              | M          | H      | Single source of truth for names; documented rotation checklist; smoke test prod config after secret changes.                                   |
| **Supabase session** bugs specific to SSR at the edge      | Unknown unknowns              | L          | M      | Follow `@supabase/ssr` patterns; add minimal integration tests for auth cookie flows on deployed previews.                                      |
| **Vendor billing surprises** from egress or paid Workers   | Devil's advocate              | L          | M      | Monitor dashboards; set billing alerts; keep AI payloads concise per PRD guardrails.                                                            |

## Getting Started

Steps aligned with **pinned** repo tooling (**Astro ^6.3**, **`@astrojs/cloudflare` ^13.5**, **`wrangler` ^4.90**) and existing **`wrangler.jsonc`** (`nodejs_compat`, Astro server entry).

1. Install deps and verify a production build: `npm ci` then `npm run build` (requires Supabase-related env where the build validates them — match README `.dev.vars` / CI secrets pattern).
2. Authenticate Wrangler once per machine/CI: `npx wrangler login` (interactive) or use an API token in CI per Cloudflare docs.
3. Deploy the Worker bundle produced by Astro’s Cloudflare adapter: `npx wrangler deploy` (uses `wrangler.jsonc`; rename `name` from the starter default when you claim your production Worker name).
4. Upload runtime secrets Cloudflare needs for SSR/API routes: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (names must match `astro:env` usage).
5. Optional but typical for MVP iteration: connect **GitHub → Cloudflare Pages/Workers** for automatic builds and **preview deployments** on branches; mirror the same secret names per environment.

Local fidelity: README indicates **`npm run dev`** targets the Cloudflare runtime (`workerd`) — prefer that over guessing Node-only behavior before relying on edge semantics.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (beyond naming Wrangler/Git integration as the likely path)
- Production-scale architecture (multi-region HA, formal DR, enterprise SLAs)
