---
change_id: manual-event-ai-summary
title: Manual event ai summary
status: impl_reviewed
created: 2026-08-10
updated: 2026-08-10
archived_at: null
---

## Notes

Roadmap **S-03** / PRD **FR-003**: rodzic dodaje ręcznie wydarzenie z opcjonalnym jednym obrazem i krótkim AI summary.

Prerequisites: F-01, F-02, F-03, F-04 (done). Parallel with S-04 (done). Supports secondary metric „75% wydarzeń z pomocą AI”.

Decisions (plan): optional image; Generate-before-Save (editable optional summary); text-only AI; `triage_status: accepted`; fields match EventCard (no `starts_at`); AI fail does not block Save; create + owner image preview only (no replace in edit).

Plan review (2026-08-10): REVISE → fixed F1–F4 (Progress header, DTO blast radius list/update/publish, multipart smoke, workflow note).
