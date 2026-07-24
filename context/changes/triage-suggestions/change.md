---
change_id: triage-suggestions
title: Triage suggestions
status: implemented
created: 2026-07-16
updated: 2026-07-24
archived_at: null
roadmap_id: S-02
---

## Notes

**Roadmap:** [S-02](../../foundation/roadmap.md) — Decyzje o propozycjach; prerequisites **S-01 done**; PRD US-01, FR-005.

**Outcome:** Rodzic może zaakceptować, odrzucić lub oznaczyć propozycję AI jako „może później”; decyzja zapisana w `events`.

**Baseline (research 2026-07-16):** S-01 = transient `/suggestions` → karty bez triage. Schema `events.triage_status` + RLS gotowe (F-01); brak API/UI zapisu. Publish = S-05.

**Plan decisions:** INSERT od razu ze statusem; reject też zapisuje; `either` → NULL; time w `description`; bez uploadu obrazów; karta znika + inline feedback; `POST /api/events/triage`.

**Plan-review (2026-07-24):** F1 clientId UUID; F2 503 gdy `createClient` null. Werdykt SOUND.
