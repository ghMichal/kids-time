---
change_id: testing-privacy-and-publish-boundaries
title: Privacy and publish boundary integration tests
status: new
created: 2026-08-16
updated: 2026-08-16
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Privacy & publish boundaries".
Risks covered: #2, #3. Test types planned: integration.
Risk response intent: #2 — Event is_published=false must not appear in another user's public list; challenge "RLS exists ⇒ privacy OK"; avoid unit-only mapper without DB/RLS. #3 — Session A on id/path B → 404 { error: "not_found" } (not 403), no body leak; challenge "logged in is enough"; avoid mocking the whole Supabase client so RLS/owner filters disappear.
After creating the folder, follow the downstream continuation rule.
