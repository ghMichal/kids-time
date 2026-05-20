---
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
---

## Why this stack

A solo builder shipping a 3-week after-hours web MVP with parent auth, per-event images, AI suggestions, and a publish/copy/unpublish lifecycle needs a battle-tested, agent-friendly full-stack starter rather than wiring pieces from scratch. PRD v2 priors (web-app, medium scale, auth + AI must-haves, FR-008/009 publish lifecycle) map to the recommended JavaScript/TypeScript default: 10x Astro Starter with typed UI, auth, database, file storage, and Cloudflare Pages deploy. Payments and realtime are out of scope per the PRD. Deployment is cloudflare-pages; CI is GitHub Actions with auto-deploy on merge. Scaffolding confidence is first-class—smooth bootstrap expected, with occasional manual follow-up for edge-runtime limits on long AI operations.
