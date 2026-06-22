---
change_id: ai-activity-suggestions
title: AI activity suggestions
status: implementing
created: 2026-06-22
updated: 2026-06-22
last_research: 2026-06-22
last_frame: 2026-06-22
last_plan: 2026-06-22
archived_at: null
roadmap_id: S-01
---

## Notes

**Roadmap:** [S-01](../../foundation/roadmap.md) — **north star** (gwiazda przewodnia); prerequisites **F-01 done**, **F-02 done**, **F-03 done**, **F-04 done**; odblokowuje **S-02** (triage).

**Outcome:** Rodzic po zalogowaniu podaje miejsce, czas, wiek dziecka i indoor/outdoor — dostaje kilka zwięzłych propozycji AI, każda z co najwyżej jednym obrazem i linkiem do źródła.

**PRD:** US-01, FR-001 (kryteria → propozycje AI), FR-002 (zwięzłe propozycje z obrazem i linkiem).

**Baseline (2026-06-22):** F-02 — `generateSuggestions` + OpenRouter (`src/lib/ai/*`), API `POST /api/ai/suggestions`; F-01 — tabela `events` + RLS; F-03 — auth guards; F-04 — bucket `event-images`, `src/lib/storage/*`. Brak UI produktowego ani zapisu propozycji do `events` (triage → S-02).

**Zakres S-01 (nie S-02):** end-to-end flow „formularz kryteriów → propozycje AI z obrazem i linkiem” — bez pełnego triage (accept/reject/maybe).

**Ryzyko:** Pierwszy slice widoczny dla użytkownika; integruje AI + storage + events — warto trzymać MVP wąsko (wyświetl propozycje, opcjonalnie zapis draftów bez triage UI).
