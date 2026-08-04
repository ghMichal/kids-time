---
change_id: publish-shared-event
title: Publish shared event
status: implementing
created: 2026-08-04
updated: 2026-08-04
archived_at: null
roadmap_id: S-05
---

## Notes

**Roadmap:** [S-05](../../foundation/roadmap.md) — Publikacja dla innych rodziców; prerequisite **S-04 done** (`context/archive/2026-07-24-my-events-library/`); PRD US-01, FR-006.

**Outcome:** Rodzic może świadomie opublikować wydarzenie tylko do odczytu dla innych rodziców.

**Baseline:** S-04 daje bibliotekę `/events` (list/edit/delete własnych accepted/maybe). Kolumna `is_published` + RLS SELECT own/published już z F-01; brak UI/API publish. Akceptacja triage bez publikacji pozostaje prywatna.

**Risk (roadmap):** Ostatni krok must-have z US-01.

**Out of scope (na razie):** unpublish / copy (prd-v2 FR-008/009 — otwarte pytanie roadmapy); published image read (dług F-04).

**Plan decisions:** `/events/shared` (tylko cudze); `POST /api/events/[id]/publish`; badge + ukryj Opublikuj; inline confirm; 409/404; `SharedEventCard` (bez reuse EventCard).
