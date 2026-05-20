---
bootstrapped_at: 2026-05-20T05:30:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: kids-time-mvp
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: kids-time-mvp
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

## Why this stack

A solo builder shipping a 3-week after-hours web MVP with parent auth, per-event images, AI suggestions, and a publish/copy/unpublish lifecycle needs a battle-tested, agent-friendly full-stack starter rather than wiring pieces from scratch. PRD v2 priors (web-app, medium scale, auth + AI must-haves, FR-008/009 publish lifecycle) map to the recommended JavaScript/TypeScript default: 10x Astro Starter with typed UI, auth, database, file storage, and Cloudflare Pages deploy. Payments and realtime are out of scope per the PRD. Deployment is cloudflare-pages; CI is GitHub Actions with auto-deploy on merge. Scaffolding confidence is first-class—smooth bootstrap expected, with occasional manual follow-up for edge-runtime limits on long AI operations.

## Pre-scaffold verification

| Signal      | Value   | Severity | Notes                               |
| ----------- | ------- | -------- | ----------------------------------- |
| npm package | not run | —        | git-clone starter                   |
| GitHub repo | not run | —        | `gh` CLI unavailable in environment |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone (fresh bootstrap into mostly empty cwd)

**Exit code**: 0

**Files moved**: 31440 (includes `node_modules`)

**Conflicts (.scaffold siblings)**: 2 — `.github/workflows/ci.yml.scaffold`, `.husky/pre-commit.scaffold` (leftover dirs from a prior partial bootstrap)

**.gitignore handling**: moved silently

**.bootstrap-scaffold cleanup**: deleted

**Note**: Use Node 22+ locally (`nvm use` per `.nvmrc`; Astro 6 requires `>=22.12.0`). Bootstrap install ran on Node 20 with engine warnings.

## Post-scaffold audit

**Tool**: npm audit --json

**Summary**: 0 CRITICAL, 1 HIGH, 10 MODERATE, 0 LOW

#### HIGH findings

- **devalue** (transitive) — GHSA-77vg-94rm-hx3p — fix available

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps:

- Remove `.github/workflows/ci.yml.scaffold` and `.husky/pre-commit.scaffold` if the canonical files look correct (or diff first).
- `nvm use` → `npm run dev`
- Copy `.env.example` → `.env` and configure Supabase per README.
- Product docs remain in `context/foundation/` (`prd-v2.md`, `shape-notes.md`, `tech-stack.md`).
