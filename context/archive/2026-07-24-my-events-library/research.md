---
date: 2026-07-24T19:08:16+02:00
researcher: Auto
git_commit: 567b11bcfa1702665cd5e9802b2647fa246b8af7
branch: main
repository: kids-time
topic: "Jak dziś wygląda model events i API/UI po S-02, i gdzie wpiąć listę / edycję / usuwanie własnych wydarzeń (biblioteka)?"
tags: [research, codebase, events, library, crud, rls, s-04]
status: complete
last_updated: 2026-07-24
last_updated_by: Auto
---

# Badanie: Jak dziś wygląda model events i API/UI po S-02, i gdzie wpiąć bibliotekę własnych wydarzeń?

**Data**: 2026-07-24T19:08:16+02:00  
**Badacz**: Auto  
**Git Commit**: 567b11bcfa1702665cd5e9802b2647fa246b8af7  
**Gałąź**: main  
**Repozytorium**: kids-time

## Pytanie badawcze

Jak dziś wygląda model `events` i API/UI po S-02, i gdzie wpiąć listę / edycję / usuwanie własnych wydarzeń (biblioteka)?

## Podsumowanie

**Warstwa DB jest gotowa pod S-04:** tabela `events`, enumy, RLS (owner INSERT/UPDATE/DELETE; SELECT own **lub** published). **Warstwa aplikacji jest create-only:** jedyny `.from("events")` to INSERT w triage (`POST /api/events/triage`). Brak list/get/update/delete API, brak strony biblioteki, brak linku w Topbar.

Naturalne wpięcie:

1. **API:** `GET/PATCH/DELETE` w `src/pages/api/events/` — wzorzec z `triage.ts` (auth, Zod, `createClient`, 401/400/503/500).
2. **Lib:** rozszerzyć `src/lib/events/` o list/update/delete (+ Zod).
3. **UI:** `src/pages/events.astro` + island React (jak `/suggestions`) + link „Moje wydarzenia” w `Topbar.astro`.
4. **Auth:** `/events` i `/api/events/*` chronione **bez** zmian w `route-access.ts` (default-deny).

**Krytyczne:** SELECT RLS zwraca też cudze published — lista biblioteki **musi** filtrować `.eq("owner_id", userId)`.

## Szczegółowe ustalenia

### Model danych i RLS (F-01)

Migracja: `supabase/migrations/20260526120000_events_schema_and_rls.sql`.

- Kolumny m.in.: `title`, `description`, `summary`, `source_url`, `image_path`, `place`, `starts_at`, `child_age_years`, `location_kind`, `origin`, `triage_status`, `is_published` / `published_at`, `copied_from_event_id`.
- Enumy: `triage_status` ∈ draft|pending|accepted|rejected|maybe; `origin` ∈ ai_suggested|manual; `location_kind` ∈ indoor|outdoor.
- RLS: SELECT own **OR** `is_published`; UPDATE/DELETE only own; INSERT `owner_id = auth.uid()`.
- Typy: `EventRow` w `src/types.ts`; `TablesInsert` / `TablesUpdate` w `database.generated.ts`.

Storage: `20260622120000_event_images_storage.sql` — prywatny bucket `event-images`; helpers w `src/lib/storage/*` (upload/replace/remove) — **niepodłączone** do API/UI.

### API / lib po S-02

| Istnieje                                     | Brak                       |
| -------------------------------------------- | -------------------------- |
| `POST /api/events/triage`                    | `GET` list / `GET` by id   |
| `lib/events/triage-request.schema.ts`        | PATCH / DELETE             |
| `lib/events/create-event-from-suggestion.ts` | list/update/delete helpers |
| Jedyny `.from("events").insert`              | Image upload API route     |

Wzorzec API (`src/pages/api/events/triage.ts`): `locals.user` → 401; Content-Type/JSON/Zod → 400; `createClient` null → 503; DB error → 500 `{ error: "internal" }`; sukces create → 201.

**S-02 → wiersze w bibliotece:** `origin: ai_suggested`, `is_published: false`, `image_path: null`, `starts_at: null`, `description` = `"Czas: …"`, status `accepted|rejected|maybe` (reject też tworzy wiersz).

### UI / routing / auth

- Brak `src/pages/events.astro`, brak `src/components/events/`.
- Szablon: `suggestions.astro` → `AppShell` + `PanelCard` + `client:load` island.
- Topbar: tylko Propozycje + Panel — dodać „Moje wydarzenia” → `/events`.
- `route-access.ts`: public tylko `/`, `/auth/*`, `/api/auth/*` — `/events` chronione automatycznie.
- Reuse: `Button`, `ServerError`, `FormField`, wzorzec karty z `SuggestionCard` (akcje edit/delete zamiast triage).
- Brak toast library; S-02 używał inline feedback.

### Granice roadmapy

- **S-04 (FR-004):** browse / edit / delete own — **nie** publish (S-05), **nie** manual create (S-03).
- Prerequisites S-04: F-01, F-03 (F-04 **nie** wymagane w roadmapie — image edit to decyzja planu).
- S-05 wymaga S-04; S-03 równolegle.

## Odniesienia do kodu

- `supabase/migrations/20260526120000_events_schema_and_rls.sql:21-97` — tabela + RLS
- `supabase/migrations/20260622120000_event_images_storage.sql` — bucket + storage RLS
- `src/lib/events/create-event-from-suggestion.ts:24-50` — jedyny INSERT
- `src/pages/api/events/triage.ts` — wzorzec authenticated JSON API
- `src/lib/supabase.ts` — `createClient` + `Database`
- `src/types.ts:5` — `EventRow`
- `src/lib/route-access.ts:6-18` — default-deny
- `src/middleware.ts:17-30` — 401 API / redirect pages
- `src/pages/suggestions.astro` — szablon strony produktowej
- `src/components/Topbar.astro:13-24` — nav
- `src/lib/storage/event-image.ts` — upload/replace/remove (nieużywane w UI)

## Wnioski architektoniczne

1. **S-04 = cienka warstwa app** na gotowym schemacie/RLS — nie migracje (chyba że indeks `(owner_id, updated_at)`).
2. **Filter `owner_id` na liście jest obowiązkowy** — RLS SELECT jest szerszy niż „moja biblioteka”.
3. **Widoczność `rejected`** — decyzja produktowa (S-02 ostrzegał: reject rows trafią do DB).
4. **Obrazy** — F-04 helpers gotowe; S-02 rows mają `image_path: null`; signed URL / display strategy potrzebna jeśli S-04 obejmuje image edit.
5. **Publish poza zakresem** — nie ustawiać `is_published` w S-04.
6. **`owner_id` zawsze z `locals.user.id`** — jak w triage.

## Kontekst historyczny (z poprzednich zmian)

- `context/archive/2026-05-26-event-schema-rls/` — accept ≠ publish; API/UI deferred to S-04
- `context/archive/2026-07-16-triage-suggestions/` — library CRUD / image persist / undo poza S-02; reject tworzy wiersz; filter `triage_status` w bibliotece
- `context/archive/2026-06-22-event-image-storage/` — helpers gotowe; public image read → S-05
- `context/foundation/prd.md` — FR-004 must-have: browse, edit, delete own events

## Powiązane badania

- `context/archive/2026-07-16-triage-suggestions/research.md` — flow S-01→S-02, otwarte Q zamknięte w planie triage
- `context/archive/2026-05-26-event-schema-rls/` — intencja schematu pod library

## Otwarte pytania

1. **Filtr statusów w liście:** tylko `accepted`+`maybe`, czy też `rejected` (osobna zakładka / historia)?
2. **Zakres edycji:** które pola (title/summary/place/time/`starts_at`/`location_kind`/`triage_status`)?
3. **Obrazy w MVP S-04:** upload/replace via F-04 helpers, tylko `source_url`, czy defer do S-03?
4. **Undo triage:** czy zmiana `rejected`→`accepted` / delete rejected w bibliotece?
5. **API shape:** `GET /api/events` + `PATCH|DELETE /api/events/[id]` vs SSR load w Astro frontmatter?
6. **Delete:** hard delete + `removeEventImage` gdy `image_path` ustawione?
7. **Signed URLs** dla prywatnych obrazów przy wyświetlaniu listy/detail?
8. **prd-v2 FR-008/009** (unpublish/copy) — poza S-04 v1?
