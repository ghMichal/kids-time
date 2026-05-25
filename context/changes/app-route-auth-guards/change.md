---
change_id: app-route-auth-guards
title: Require logged-in parent on product routes, not only /dashboard
status: implemented
created: 2026-05-25
updated: 2026-05-25
archived_at: null
roadmap_id: F-03
prd_refs: Access Control, US-01
---

## Notes

Fundament **F-03** z [roadmapy](../../foundation/roadmap.md).

**Outcome:** zalogowany rodzic jest wymagany na trasach produktowych (nie tylko `/dashboard`); niezalogowany trafia na logowanie.

**Baseline (2026-05-25):** `src/middleware.ts` chroni wyłącznie `/dashboard` (`PROTECTED_ROUTES`); sesja Supabase i `context.locals.user` już działają.

**Odblokowuje:** S-01, S-02, S-03, S-04, S-05.

**Zależności:** brak prerequisites; równolegle z F-01, F-02.

**Ryzyko (roadmap):** niskie — rozszerzenie ochrony tras przy istniejącym middleware.

**Status w roadmapie:** ready — gotowe do `/10x-plan`.

**Sugerowany issue (backlog handoff):** Expand auth route guards.
