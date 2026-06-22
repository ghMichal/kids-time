# Event image storage — Krótki plan

> Pełny plan: `context/changes/event-image-storage/plan.md`
> Change: `context/changes/event-image-storage/change.md`

## Co i dlaczego

Fundament **F-04**: jeden obraz na wydarzenie w Supabase Storage — private bucket, RLS właściciela, ścieżka `{owner_id}/{event_id}/{filename}` w `events.image_path`. Odblokowuje S-01 (obraz przy propozycji AI) i S-03 (ręczne wydarzenie z obrazem) zgodnie z FR-002 i FR-003.

## Punkt wyjścia

F-01: tabela `events` z `image_path text` nullable + RLS na rekordach. Brak bucketu w migracjach; `supabase/config.toml` ma zakomentowany szablon bucketu. Brak kodu `supabase.storage` w `src/`. Auth: JWT rodzica (F-03).

## Pożądany stan końcowy

Po `db reset`: bucket `event-images` (private, 5 MB, jpeg/png/webp) z politykami owner-only. Helpery w `src/lib/storage/*` budują ścieżkę i obsługują upload/remove/replace przez direct client upload. README + smoke script. Lint/build zielone. Published read dla innych rodziców — **S-05**, nie F-04.

## Kluczowe podjęte decyzje

| Decyzja        | Wybór                               | Dlaczego (1 zdanie)                            | Źródło |
| -------------- | ----------------------------------- | ---------------------------------------------- | ------ |
| Bucket         | Private + RLS owner                 | Drafty niewidoczne; spójne z F-01              | Plan   |
| Ścieżka        | `{owner_id}/{event_id}/{filename}`  | Proste polityki `(foldername)[1] = auth.uid()` | Plan   |
| Published read | Odłożone do S-05                    | FR-006 poza fundamentem F-04                   | Plan   |
| Upload         | Direct client + helpery             | Standard Supabase; bez proxy na Workerze       | Plan   |
| Limity         | 5 MB; JPEG, PNG, WebP               | Jeden obraz aktywności — rozsądny MVP          | Plan   |
| Replace        | Jeden obraz — upsert + remove stary | PRD: at most one image per event               | Plan   |
| Deliverable    | Migracja + lib + README + smoke     | Scaffold bez UI/API produktowego               | Plan   |

## Zakres

**W zakresie:**

- Migracja SQL: bucket + polityki storage (atomowo)
- `src/lib/storage/*` (constants, path, upload/remove/replace)
- `config.toml` parity, README, opcjonalny `scripts/smoke-event-image.ts`

**Poza zakresem:**

- UI S-01/S-03, API route upload, public bucket, published read (S-05), `service_role`, test runner

## Architektura / Podejście

Private bucket `event-images`. RLS na `storage.objects`: pierwszy segment folderu = `auth.uid()`. Przyszłe slice'y uploadują direct przez `supabase.storage` z JWT; zapisują klucz w `events.image_path`. F-04 dostarcza infrastrukturę i helpery — nie pełny flow produktowy.

## Fazy w skrócie

| Faza                | Co dostarcza                         | Kluczowe ryzyko                       |
| ------------------- | ------------------------------------ | ------------------------------------- |
| 1. Migracja Storage | Bucket + RLS w jednym SQL            | Push bucketu bez polityk na cloud     |
| 2. Moduł lib        | Path helpers + upload/remove/replace | Pomyłka owner segment vs `image_path` |
| 3. Dev onboarding   | README, smoke, change notes          | Smoke wymaga dwóch userów testowych   |
| 4. Zamknięcie       | CI, db push cloud, archive           | Cloud push przed smoke produkcyjnym   |

**Wymagania wstępne:** F-01 done, Docker, `npx supabase start`, `SUPABASE_*` w `.dev.vars`.

**Szacowany wysiłek:** ~2–3 sesje, 4 fazy.

## Otwarte ryzyka i założenia

- Published visibility obrazów wymaga osobnej pracy w S-05 (signed URL lub policy z join na `events`).
- Cloud: jeden atomowy `db push` po merge — jak F-01.

## Kryteria sukcesu (podsumowanie)

- Bucket + RLS działają lokalnie (owner vs non-owner).
- Helpery lint/build OK; smoke upload/read/delete przechodzi.
- F-04 archived; roadmap `done`.
