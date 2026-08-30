---
change_id: ci-auto-deploy-on-merge
title: Auto-deploy Worker on merge to main
status: implementing
created: 2026-08-30
updated: 2026-08-30
archived_at: null
---

## Notes

Roadmap parked item: **Pełny pipeline deploy (auto-deploy on merge)** — `context/foundation/roadmap.md` (Parked; trigger was „po pierwszym slice'u produktowym”; F-01–S-05 are done). Tech-stack `ci_default_flow: auto-deploy-on-merge`. Plan: `context/deployment/deploy-plan.md` Faza 4 pkt 1.

**Outcome:** Po zielonym jobie `ci` na `push` do `main`, GitHub Actions wdraża Cloudflare Worker `kids-time-mvp` (`npx wrangler deploy` / `cloudflare/wrangler-action`). PR-y tylko lint+test+build — bez deployu.

**Prerequisites (done 2026-08-30):** Faza 2/3 smoke w przeglądarce przeszedł; CI na `main` zielone; sekrety repo `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` dodane. Runtime `SUPABASE_*` / `OPENROUTER_*` zostają na Workerze (`wrangler secret put`), nie w YAML.

**Out of scope:** preview branches / osobny Supabase; `supabase db push` z Actions; `wrangler pages deploy`; Cloudflare Workers Builds jako zamiennik bramki CI.

**Decyzje z rozmowy:** drugi job w istniejącym `.github/workflows/ci.yml` (`needs: ci`, `if: push && main`); nie drugi niezależny workflow. Lokalne `npm run deploy` zostaje jako awaryjne.
