---
change_id: ai-suggestion-scaffold
title: AI suggestion scaffold
status: preparing
created: 2026-05-26
updated: 2026-05-26
archived_at: null
roadmap_id: F-02
---

## Notes

**Roadmap:** [F-02](../../foundation/roadmap.md) — fundament AI; **F-01 done**, **F-03 done**; równolegle z F-04 (storage); odblokowuje **S-01** (north star) i **S-03**.

**Outcome (foundation):** serwerowa ścieżka wywołująca model AI z kryteriami (miejsce, czas, wiek, indoor/outdoor) i zwracająca zwięzły zestaw propozycji — bez UI produktowego (to S-01).

**PRD:** FR-001 (propozycje AI według kryteriów), NFR-03 (jakość / zwięzłość odpowiedzi AI).

**Baseline (2026-05-26):** brak kodu AI w `src/`; wzorce API w `src/pages/api/auth/*`; klient Supabase w `src/lib/supabase.ts`; schemat `events` + RLS (F-01). Stack: Astro SSR na Cloudflare Workers, OpenRouter jako dostawca AI ([infrastructure.md](../../foundation/infrastructure.md), [tech-stack.md](../../foundation/tech-stack.md) `has_ai: true`).

**Decyzje do planu / research:**

- [Open question #2](../../foundation/roadmap.md#open-roadmap-questions): OpenRouter + który model na MVP — wymaga decyzji użytkownika przed implementacją.
- JWT vs `service_role`: F-01 zakłada anon key + JWT rodzica; plan-review F-01 sugeruje JWT wystarczy dla MVP (batch bez sesji poza scope).
- Cloudflare Workers: timeout/CPU przy długich wywołaniach OpenRouter — streaming i jawne limity czasu ([infrastructure.md](../../foundation/infrastructure.md)).

**Zakres F-02 (nie S-01):** scaffold serwerowy (route API, env secret, klient OpenRouter, prompt/response shape) — bez pełnego flow UI, triage ani zapisu propozycji do DB (S-01 / S-02).

**Następny krok:** badania wewnętrzne (repo) w [research.md](./research.md) → `/10x-plan`. Pass Context7 (zewnętrzne): **done** 2026-05-26.

**Po zakończeniu:** zaktualizować status F-02 w roadmapie (`/10x-archive`); odblokować S-01 po F-04.
