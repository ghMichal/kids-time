---
change_id: testing-runner-critical-owner-access
title: Vitest runner and critical owner-access coverage
status: planned
created: 2026-08-13
updated: 2026-08-13
archived_at: null
---

## Notes

Rollout Phase 1 of context/foundation/test-plan.md: "Runner + critical owner access".
Risks covered: #1, #3. Test types: unit + integration.
Decisions: Vitest bootstrap; lib+JWT integration (Docker CI later in Phase 4); colocated + skipIf; representative IDOR (PATCH + path unit); suggestions 401-only; foreign-published leak seed; unauth via route-access + pure guard + handler mock.
Plan: context/changes/testing-runner-critical-owner-access/plan.md
Brief: context/changes/testing-runner-critical-owner-access/plan-brief.md
Research: context/changes/testing-runner-critical-owner-access/research.md
