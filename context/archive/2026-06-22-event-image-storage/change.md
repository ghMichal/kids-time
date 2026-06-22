---
change_id: event-image-storage
title: Event image storage
status: archived
created: 2026-06-22
updated: 2026-06-22
archived_at: 2026-06-22T21:06:19Z
roadmap_id: F-04
---

## Notes

**Roadmap:** [F-04](../../foundation/roadmap.md) — fundament storage; **F-01 done**, **F-02 done**, **F-03 done**; odblokowuje **S-01** (obraz w propozycji AI) i **S-03** (ręczne wydarzenie z obrazem).

**Outcome (foundation):** upload i odczyt jednego obrazu na wydarzenie (Supabase Storage bucket + polityki zgodne z RLS właściciela).

**PRD:** FR-002 (propozycja z co najwyżej jednym obrazem), FR-003 (ręczne wydarzenie z jednym obrazem).

**Baseline (2026-06-22):** tabela `public.events` ma `image_path text`; migracja [20260622120000_event_images_storage.sql](../../../supabase/migrations/20260622120000_event_images_storage.sql) — bucket `event-images` + RLS; helpery w `src/lib/storage/*`; klient Supabase w `src/lib/supabase.ts`.

**Zakres F-04 (nie S-01/S-03):** scaffold storage (bucket, RLS/policies, konwencja ścieżki w `image_path`, helpery upload/read) — bez pełnego UI produktowego ani flow triage.

**Decyzje (plan 2026-06-22):** private bucket `event-images`; path `{owner_id}/{event_id}/{filename}`; direct client upload; max 5 MB, JPEG/PNG/WebP; replace = jeden obraz/event (list+remove prefix); published read → S-05; storage RLS = owner segment only — walidacja `event_id` w app (S-01/S-03).

**Następny krok:** `/10x-implement event-image-storage phase 4`.
