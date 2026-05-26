---
change_id: event-schema-rls
title: Event schema and RLS
status: archived
created: 2026-05-26
updated: 2026-05-26
archived_at: 2026-05-26T17:05:52Z
roadmap_id: F-01
---

## Notes

**Roadmap:** [F-01](../../foundation/roadmap.md) — fundament danych; równolegle z F-02; **F-03 done**; blokuje **F-04** i wszystkie slice'y S-01…S-05 zapisujące stan wydarzeń.

**Outcome (foundation):** tabela wydarzeń (+ pola potrzebne kryteriom i cyklowi prywatny → publikacja), migracje w `supabase/migrations/` (`YYYYMMDDHHmmss_description.sql`), RLS — właściciel (`auth.uid()`) widzi i modyfikuje tylko swoje rekordy; inni rodzice tylko odczyt opublikowanych (FR-006), bez wycieku decyzji prywatnych (NFR-02 / Access Control w [prd.md](../../foundation/prd.md)).

**Baseline (2026-05-26):** klient Supabase w `src/lib/supabase.ts`; `supabase/config.toml` jest, **brak** `supabase/migrations/` i `seed.sql` (roadmap Baseline). Brak API domenowych — ten change to wyłącznie warstwa DB + polityki, bez UI.

**PRD v1 (planowany zakres roadmapy):** FR-004 (CRUD własnych), FR-005 (accept / reject / maybe), FR-006 (publish read-only dla innych); pola pod kryteria z FR-001 (miejsce, czas, wiek, indoor/outdoor) — nawet jeśli pierwszy slice to S-01, schemat powinien pomieścić triage i bibliotekę bez kolejnej migracji „ratunkowej”.

**Decyzja do planu — PRD v2:** [Open question w roadmapie](../../foundation/roadmap.md#open-roadmap-questions) — czy w F-01 uwzględnić od razu FR-008/009 ([prd-v2.md](../../foundation/prd-v2.md): unpublish, kopia z provenance), czy minimalny model pod v1 i rozszerzenie w S-05 / osobnym change. Domyślnie: nie rozpychać F-01 bez jawnej decyzji użytkownika.

**Konwencje repo:** RLS z osobnymi politykami per operacja; sekrety tylko server-side (`astro:env`); obrazy w F-04 — tu co najwyżej `image_url` / klucz obiektu, nie bucket.

**Po zakończeniu:** zaktualizować status F-01 w roadmapie (`/10x-archive`); Backlog Handoff — wtedy F-04 i slice'y zależne od F-01 mogą dostać `ready for /10x-plan`.
