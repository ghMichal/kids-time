---
change_id: ai-suggestion-scaffold
title: AI suggestion scaffold
status: implementing
created: 2026-05-26
updated: 2026-06-22
archived_at: null
roadmap_id: F-02
---

## Notes

**Roadmap:** [F-02](../../foundation/roadmap.md) — fundament AI; **F-01 done**, **F-03 done**; równolegle z F-04 (storage); odblokowuje **S-01** (north star) i **S-03**.

**Outcome (foundation):** serwerowa ścieżka wywołująca model AI z kryteriami (miejsce, czas, wiek, indoor/outdoor) i zwracająca zwięzły zestaw propozycji — bez UI produktowego (to S-01).

**PRD:** FR-001 (propozycje AI według kryteriów), NFR-03 (jakość / zwięzłość odpowiedzi AI).

**Baseline (2026-05-26):** brak kodu AI w `src/`; wzorce API w `src/pages/api/auth/*`; klient Supabase w `src/lib/supabase.ts`; schemat `events` + RLS (F-01). Stack: Astro SSR na Cloudflare Workers, OpenRouter jako dostawca AI ([infrastructure.md](../../foundation/infrastructure.md), [tech-stack.md](../../foundation/tech-stack.md) `has_ai: true`).

**OpenRouter (F-02):**

- **Model (potwierdzony):** `OPENROUTER_MODEL=openai/gpt-4o-mini` — decyzja użytkownika 2026-05-26; `structured_outputs` na [openrouter.ai/models/openai/gpt-4o-mini](https://openrouter.ai/models/openai/gpt-4o-mini). Koszt orientacyjny OpenRouter: ~$0,15/1M tokenów wejścia, ~$0,60/1M wyjścia.
- Zmiana modelu w przyszłości: tylko env + smoke (bez refactoru architektury).
- Projekt szkoleniowy: opcjonalny **credit limit** na kluczu API w [Settings → Keys](https://openrouter.ai/settings/keys).

**Decyzje do planu / research:**

- JWT vs `service_role`: F-01 zakłada anon key + JWT rodzica; plan-review F-01 sugeruje JWT wystarczy dla MVP (batch bez sesji poza scope).
- Cloudflare Workers: timeout/CPU przy długich wywołaniach OpenRouter — streaming i jawne limity czasu ([infrastructure.md](../../foundation/infrastructure.md)).

**Zakres F-02 (nie S-01):** scaffold serwerowy (route API, env secret, klient OpenRouter, prompt/response shape) — bez pełnego flow UI, triage ani zapisu propozycji do DB (S-01 / S-02).

**Plan:** [plan.md](./plan.md) (brief: [plan-brief.md](./plan-brief.md)). Research: [research.md](./research.md) — **done** 2026-05-26.

**Następny krok:** `/10x-implement ai-suggestion-scaffold phase 1` (kod — nie wdrażany automatycznie z planu).

**Po zakończeniu:** zaktualizować status F-02 w roadmapie (`/10x-archive`); odblokować S-01 po F-04.
