---
change_id: testing-privacy-and-publish-boundaries
title: Privacy and publish boundary integration tests
status: archived
created: 2026-08-16
updated: 2026-08-18
archived_at: 2026-08-18T05:22:58Z
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Privacy & publish boundaries".
Risks covered: #2, #3. Test types planned: integration.
Risk response intent: #2 — Event is_published=false must not appear in another user's public list; challenge "RLS exists ⇒ privacy OK"; avoid unit-only mapper without DB/RLS. #3 — Session A on id/path B → 404 { error: "not_found" } (not 403), no body leak; challenge "logged in is enough"; avoid mocking the whole Supabase client so RLS/owner filters disappear.
After creating the folder, follow the downstream continuation rule.

Plan decisions (2026-08-16): lib `listPublishedEvents` + RLS probe + self-exclude; publish IDOR on B unpublished + already-published; image IDOR lib + dummy Blob; cookbook §6.2 as final phase. No HTTP/e2e, no CI wire.

Plan review (2026-08-16): REVISE → SOUND after triage. Fixed CHECK vs triage wording; Faza 1 Meta regression honesty; Progress 3.3 image_path-only. Report: `reviews/plan-review.md`.
Phase 2 impl review (2026-08-17): APPROVED, 0 findings. Report: `reviews/impl-review-phase-2.md`.
Full impl review (2026-08-17): APPROVED, 1 observation (FIXED). Report: `reviews/impl-review.md`.
