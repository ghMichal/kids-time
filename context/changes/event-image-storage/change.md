---
change_id: event-image-storage
title: Event image storage
status: implementing
created: 2026-06-22
updated: 2026-06-22
archived_at: null
roadmap_id: F-04
---

## Notes

**Roadmap:** [F-04](../../foundation/roadmap.md) — fundament storage; **F-01 done**, **F-02 done**, **F-03 done**; odblokowuje **S-01** (obraz w propozycji AI) i **S-03** (ręczne wydarzenie z obrazem).

**Outcome (foundation):** upload i odczyt jednego obrazu na wydarzenie (Supabase Storage bucket + polityki zgodne z RLS właściciela).

**PRD:** FR-002 (propozycja z co najwyżej jednym obrazem), FR-003 (ręczne wydarzenie z jednym obrazem).

**Baseline (2026-06-22):** tabela `public.events` ma kolumnę `image_path text` (nullable) — [F-01 migration](../../../supabase/migrations/20260526120000_events_schema_and_rls.sql); brak bucketu Storage w `supabase/migrations/`; klient Supabase w `src/lib/supabase.ts`; auth/middleware jak F-03. Stack: Astro SSR + Cloudflare Workers + Supabase ([tech-stack.md](../../foundation/tech-stack.md)).

**Zakres F-04 (nie S-01/S-03):** scaffold storage (bucket, RLS/policies, konwencja ścieżki w `image_path`, ewentualnie helper upload/read) — bez pełnego UI produktowego ani flow triage.

**Decyzje (plan 2026-06-22):** private bucket `event-images`; path `{owner_id}/{event_id}/{filename}`; direct client upload; max 5 MB, JPEG/PNG/WebP; replace = jeden obraz/event; published read → S-05.

**Następny krok:** `/10x-implement event-image-storage phase 1`.
