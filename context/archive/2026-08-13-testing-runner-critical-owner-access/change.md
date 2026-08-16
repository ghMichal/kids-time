---
change_id: testing-runner-critical-owner-access
title: Vitest runner and critical owner-access coverage
status: archived
created: 2026-08-13
updated: 2026-08-16
archived_at: 2026-08-16T08:21:42Z
---

## Notes

Rollout Phase 1 of context/foundation/test-plan.md: "Runner + critical owner access".
Risks covered: #1, #3. Test types: unit + integration.
Decisions: Vitest bootstrap; lib+JWT integration (Docker CI later in Phase 4); colocated + skipIf; representative IDOR (PATCH + path unit); suggestions 401-only; foreign-published leak seed; unauth via route-access + pure guard + handler mock.
Plan-review 2026-08-16: F1–F5 FIXED (astro:env mock, published_at seed, Auth A/B docs, Phase 4 typo, vitest glob exclude). Verdict SOUND.
Impl-review Phase 4 2026-08-16: APPROVED; F1 FIXED (local URL guard + docs), F2 FIXED (cleanup delete errors), F3 SKIPPED (DTO shape), F4 FIXED (hydrate note). Reviews: reviews/impl-review-phase-4.md
Phase 5 2026-08-16: updateOwnEvent (+ deleteOwnEvent) IDOR integration; integration fileParallelism false for shared A/B. Commit f0797f5.
Phase 6 2026-08-16: test-plan §6.1/§6.2 cookbook + §3 Phase 1 complete. Commit 9a340d8.
Plan: context/changes/testing-runner-critical-owner-access/plan.md
Brief: context/changes/testing-runner-critical-owner-access/plan-brief.md
Research: context/changes/testing-runner-critical-owner-access/research.md
Review: context/changes/testing-runner-critical-owner-access/reviews/plan-review.md
