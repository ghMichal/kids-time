---
change_id: testing-runner-critical-owner-access
title: Vitest runner and critical owner-access coverage
status: preparing
created: 2026-08-13
updated: 2026-08-13
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Runner + critical owner access".
Risks covered: #1, #3. Test types planned: unit + integration.
Risk response intent: #1 prove logged-in owner gets correct list of own accepted/maybe and suggestions, unauthenticated → 401; #3 prove request with session A on id/path B → 404/403 with no body leak.
After creating the folder, follow the downstream continuation rule.
