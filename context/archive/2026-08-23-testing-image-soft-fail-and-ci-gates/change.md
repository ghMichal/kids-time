---
change_id: testing-image-soft-fail-and-ci-gates
title: Image soft-fail and CI test gates
status: archived
created: 2026-08-23
updated: 2026-08-23
archived_at: 2026-08-23T12:45:39Z
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Image soft-fail + CI gates".

Risks covered: #5 (after create/upload the owner loses image preview, or a signed-URL failure takes down the whole event list) + cross-cutting CI npm test gate.

Test types planned: unit + gates.

Risk response intent:

- #5 — prove missing image_path maps to imageUrl null, and a sign failure still returns list 200 with null (not 500); challenge "signed URL always succeeds"; avoid full e2e upload UI.
- Cross-cutting — wire npm test next to existing lint/build in CI (see §5 / §6.5).
