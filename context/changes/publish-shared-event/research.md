---
date: 2026-08-04T17:09:00+02:00
researcher: Auto
git_commit: 08535536dec773e23e1a2e65fe5a00e54d11f97d
branch: main
repository: kids-time
topic: "S-05: gdzie wpiąć publish + browse cudzych published (FR-006), Scope A light"
tags: [research, codebase, events, publish, is_published, rls, s-05]
status: complete
last_updated: 2026-08-04
last_updated_by: Auto
---

# Badanie: S-05 publish + browse (FR-006)

**Data**: 2026-08-04T17:09:00+02:00  
**Badacz**: Auto  
**Git Commit**: 08535536dec773e23e1a2e65fe5a00e54d11f97d  
**Gałąź**: main  
**Repozytorium**: kids-time

## Pytanie badawcze

Gdzie wpiąć świadomą publikację własnego wydarzenia oraz przeglądanie cudzych published (read-only) — Scope A, lekki research pod `/10x-plan`.

## Podsumowanie

**DB/RLS gotowe pod publish:** `is_published` + `published_at` + CHECK (published ⇒ `published_at` NOT NULL); SELECT dla `authenticated`: own **lub** published; UPDATE/DELETE tylko owner. Anon nie czyta published.

**Aplikacja nie publikuje:** PATCH biblioteki ma `.strict()` whitelist **bez** `is_published`; DTO listy własnej też bez pól publish; UI to tylko Edytuj/Usuń; brak trasy/listy cudzych.

Naturalne wpięcie S-05:

1. **Publish API** — dedykowany endpoint (zalecane), np. `POST /api/events/[id]/publish`, ustawia `is_published: true` + `published_at: now()`; nie rozszerzać ogólnego PATCH o publish (S-04 celowo wykluczył).
2. **Lib** — `publish-own-event.ts` + `list-published-events.ts` (cudze: `is_published` + `neq owner_id`; opcjonalnie własne published też w browse).
3. **UI own** — przycisk „Opublikuj” na `EventCard` (+ badge stanu); DTO własne o `is_published` / `published_at`.
4. **UI browse** — np. `/events/shared` + island read-only + link Topbar; auth default-deny — **bez** zmian `route-access.ts`.
5. **Poza zakresem:** unpublish/copy (FR-008/009), AI filter public (FR-007).

## Szczegółowe ustalenia

### Schema i RLS

- Kolumny: `is_published boolean NOT NULL DEFAULT false`, `published_at timestamptz`; CHECK `is_published = false OR published_at IS NOT NULL` (`supabase/migrations/20260526120000_events_schema_and_rls.sql:35-42`).
- Indeks partial `events_is_published_idx` WHERE published (`:49-50`).
- SELECT `events_select_own_or_published` TO **authenticated** (`:74-78`).
- UPDATE own bez restrykcji kolumn — RLS pozwala ownerowi ustawić publish; aplikacja dziś tego nie wystawia (`:86-91`).

### API / lib biblioteki (S-04)

- `GET /api/events`, `PATCH|DELETE /api/events/[id]` — tylko własne accepted/maybe.
- `event-update.schema.ts` `.strict()` — brak `is_published` → 400 przy próbie.
- `list-own-events` filtruje `owner_id` + triage; **nie** selectuje `is_published` (konieczne dla badge/publish UX).

### UI

- `EventCard`: Edytuj / Usuń — naturalny slot na „Opublikuj” obok akcji.
- Topbar: Propozycje / Moje wydarzenia / Panel — brak linku do shared.

### Auth

- Default-deny (`src/lib/route-access.ts`); middleware 401 API / redirect pages.
- Nowa `/events/shared` i `/api/events/shared` chronione automatycznie; zgodne z PRD (tylko zalogowani rodzice).

## Odniesienia do kodu

- `supabase/migrations/20260526120000_events_schema_and_rls.sql:35-42` — publish columns + CHECK
- `supabase/migrations/20260526120000_events_schema_and_rls.sql:74-97` — RLS SELECT/UPDATE/DELETE
- `src/lib/events/event-update.schema.ts:3-12` — PATCH whitelist + strict
- `src/lib/events/list-own-events.ts:54-59` — owner + triage filter
- `src/pages/api/events/[id].ts` — PATCH/DELETE
- `src/components/events/EventCard.tsx` — Edytuj/Usuń hook point
- `src/components/Topbar.astro:13-27` — nav
- `src/lib/route-access.ts:6-18` — public allowlist
- `src/middleware.ts:5-32` — auth gate

## Wnioski architektoniczne

- **Nie reuse GET `/api/events` na browse** — lista własna musi zostać z filtrem `owner_id` (RLS sam odda też cudze published).
- **Dedykowany publish > rozszerzenie PATCH** — zachowuje kontrakt S-04 (FR-004 pola) i wymusza atomowe `published_at`.
- **Browse = osobny list + read-only card** — bez edit/delete; opcjonalnie ukryć własne wiersze (`neq owner_id`) żeby nie dublować biblioteki.
- Unpublish/copy kolumny (`copied_from_event_id`) już w schemacie — **nie implementować** w S-05.

## Kontekst historyczny

- `context/archive/2026-07-24-my-events-library/research.md` — krytyczna reguła: lista biblioteki zawsze `.eq("owner_id")` mimo RLS published SELECT.
- `context/archive/2026-05-26-event-schema-rls/` — `is_published` jako osobny lifecycle od triage.
- Roadmap S-05 / Notes change: FR-008/009 poza zakresem; otwarte pytanie czy roadmap śledzi prd-v2.

## Powiązane badania

- `context/archive/2026-07-24-my-events-library/research.md`
- `context/archive/2026-05-26-event-schema-rls/` (plan/research jeśli obecne)

## Otwarte pytania (do decyzji w `/10x-plan`)

1. Ścieżka browse: `/events/shared` vs `/explore` vs inna?
2. Czy browse pokazuje **tylko cudze**, czy też własne published?
3. Publish: osobny `POST .../publish` vs `PATCH` z jednym polem `publish: true`?
4. Czy po publish karta w bibliotece blokuje ponowny publish / pokazuje tylko badge (bez unpublish w S-05)?
