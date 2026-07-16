---
date: 2026-06-22T21:17:31+0000
researcher: Auto
git_commit: f5797f617bbaf97e3e1fae73027cf392ff7e43d7
branch: S01-ai-activity-suggestions
repository: kids-time
topic: "S-01 AI activity suggestions — codebase readiness for north-star slice"
tags: [research, codebase, ai-suggestions, events, storage, ui, s-01]
status: complete
last_updated: 2026-06-22
last_updated_by: Auto
---

# Badanie: S-01 AI activity suggestions — codebase readiness

**Data**: 2026-06-22T21:17:31+0000  
**Badacz**: Auto  
**Git Commit**: `f5797f6`  
**Gałąź**: `S01-ai-activity-suggestions`  
**Repozytorium**: kids-time

## Pytanie badawcze

Co już istnieje w bazie kodu, aby zaimplementować **S-01** (north star: formularz kryteriów → kilka zwięzłych propozycji AI z obrazem i linkiem), jakie są luki względem FR-001/FR-002, i jakie wzorce należy powtórzyć?

## Podsumowanie

Fundamenty **F-01–F-04 są gotowe** (events + RLS, AI API, auth guards, `src/lib/storage/*`). Roadmapa potwierdza F-04 jako `done` (`context/foundation/roadmap.md`).

**Brak warstwy produktowej:** żadna strona ani komponent nie wywołuje `POST /api/ai/suggestions`, nie zapisuje do `events`, nie obsługuje obrazów.

S-01 wymaga co najmniej:

1. **UI** — chroniona strona `/suggestions` + React island z formularzem i listą wyników (`fetch` + JSON, nie wzorzec form POST z auth).
2. **Obrazy (FR-002)** — największa luka: schemat AI ma tylko `title`, `summary`, `sourceUrl`; brak strategii pozyskania/wyświetlenia obrazu.
3. **Opcjonalny zapis draftów** — INSERT do `events` (`origin: ai_suggested`, `triage_status`) + `image_path` po uploadzie; triage UI → S-02.
4. **Signed URL helper** — prywatny bucket wymaga `createSignedUrl` do wyświetlania w `<img>`; brak w `src/`.
5. **API auth UX** — middleware daje 302 HTML dla niezalogowanego `fetch`; warto rozważyć JSON 401 w handlerze.

## Szczegółowe ustalenia

### Warstwa AI (F-02) — gotowa dla tekstu, nie dla obrazów

| Element                | Stan                                                                 | Odniesienie                                      |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| Request schema         | `place`, `time`, `childAge` (0–18), `indoorOutdoor`                  | `src/lib/ai/suggestion-request.schema.ts:3-8`    |
| Response schema        | 1–5 × `{ title, summary, sourceUrl? }` — **brak obrazu**             | `src/lib/ai/suggestion-response.schema.ts:3-20`  |
| OpenRouter JSON schema | strict, tylko title/summary/sourceUrl                                | `src/lib/ai/suggestion-response.schema.ts:39-64` |
| Prompt (PL)            | 3–5 propozycji, opcjonalny sourceUrl                                 | `src/lib/ai/build-suggestion-prompt.ts:20-38`    |
| Klient                 | `generateSuggestions`, 25s timeout, two-stage Zod                    | `src/lib/ai/openrouter-client.ts:40-107`         |
| API route              | Zod na granicy, mapowanie błędów 400/502/503/504                     | `src/pages/api/ai/suggestions.ts:12-51`          |
| Smoke                  | CLI, omija Astro/auth; duplikuje fetch zamiast `generateSuggestions` | `scripts/smoke-openrouter.ts`                    |
| Callers w produkcie    | **zero** — jedyny caller to API route                                | `src/pages/api/ai/suggestions.ts:35`             |

F-02 plan jawnie wyłączał obrazy i UI (`context/archive/2026-05-26-ai-suggestion-scaffold/plan.md:41-47`).

**Uwaga mapowania:** `indoorOutdoor` API ma wartość `either`, ale DB enum `event_location_kind` to tylko `indoor` \| `outdoor` (`supabase/migrations/20260526120000_events_schema_and_rls.sql:16-19`) — decyzja przy persist.

### UI i routing — wzorzec do skopiowania, brak produktu

| Element                  | Stan                                                 | Odniesienie                                        |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| Auth policy              | default deny; `/suggestions` auto-chronione          | `src/lib/route-access.ts:6-17`                     |
| Middleware               | `context.locals.user`, redirect 302 → `/auth/signin` | `src/middleware.ts:17-18`                          |
| Jedyna strona produktowa | placeholder `/dashboard`                             | `src/pages/dashboard.astro:9-30`                   |
| React islands            | tylko `SignInForm` / `SignUpForm` (`client:load`)    | `src/pages/auth/signin.astro:21`                   |
| Auth transport           | `form POST` + redirect — **nie dla AI**              | `src/components/auth/SignInForm.tsx:43`            |
| Layout shell             | `Layout` → `AppShell showTopbar` → `PanelCard`       | `src/components/AppShell.astro`, `PanelCard.astro` |
| Nawigacja                | Topbar linkuje tylko `/dashboard`                    | `src/components/Topbar.astro:13-17`                |
| Post-login               | `/` → `/dashboard`                                   | `src/pages/index.astro:7-8`                        |
| Form primitives          | `FormField`, `ServerError`, `SubmitButton`, `Button` | `src/components/auth/*`                            |
| shadcn                   | tylko `Button` — brak select/radio                   | `src/components/ui/button.tsx`                     |

**Rekomendowana struktura S-01:**

```
src/pages/suggestions.astro
src/components/suggestions/
  SuggestionCriteriaForm.tsx   # client:load
  SuggestionResults.tsx        # opcjonalnie
  SuggestionCard.tsx           # opcjonalnie
```

**Transport:** `fetch("/api/ai/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(criteria) })`.

**Auth edge case:** niezalogowany `POST /api/ai/suggestions` → 302 HTML (nie JSON 401). Opcje: middleware tweak dla `/api/*`, guard w handlerze, lub client detect `response.redirected`.

### Events + storage (F-01, F-04) — schema gotowa, brak zapisu

| Element                    | Stan                                                             | Odniesienie                                                          |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Tabela `events`            | pełna schema z `image_path`, `origin`, `triage_status`, kryteria | `supabase/migrations/20260526120000_events_schema_and_rls.sql:21-43` |
| RLS                        | owner CRUD; SELECT published dla innych                          | `supabase/migrations/...:74-97`                                      |
| Bucket `event-images`      | private, 5 MB, jpeg/png/webp, owner-only RLS                     | `supabase/migrations/20260622120000_event_images_storage.sql`        |
| Storage helpers            | `uploadEventImage`, `replaceEventImage`, `removeEventImage`      | `src/lib/storage/event-image.ts:129-196`                             |
| Path convention            | `{owner_id}/{event_id}/{filename}`                               | `src/lib/storage/event-image-path.ts:84-93`                          |
| `.from("events")` w `src/` | **zero** — brak INSERT/UPDATE                                    | grep: brak dopasowań                                                 |
| Signed URLs                | **zero** — brak `createSignedUrl` w `src/`                       | grep: brak dopasowań                                                 |
| Browser Supabase client    | **brak** — tylko SSR `src/lib/supabase.ts`                       | `src/lib/supabase.ts:5-24`                                           |
| Typy                       | `EventRow`, storage types, AI types                              | `src/types.ts:5-15`                                                  |

**Kolejność obrazu (F-04):** INSERT event → upload z `event_id` → UPDATE `image_path` (`context/archive/2026-06-22-event-image-storage/plan.md`).

**Published read dla innych rodziców** → odłożone do S-05 (F-04).

### Strategia obrazów — nierozstrzygnięta (krytyczne dla FR-002)

| Opcja                                     | Plusy                       | Minusy                                                   |
| ----------------------------------------- | --------------------------- | -------------------------------------------------------- |
| OG/thumbnail z `sourceUrl` (server fetch) | Pasuje do AI-sourced linków | Worker egress, timeout, jakość                           |
| Placeholder w MVP                         | Szybki north-star           | Nie spełnia pełnego FR-002                               |
| URL w odpowiedzi modelu                   | Proste w schemacie          | Halucynacje, martwe linki                                |
| Direct client upload (F-04)               | Zgodne z storage helpers    | Wymaga browser client; nie pasuje do obrazów z internetu |

F-04 direct upload naturalne dla **S-03** (plik użytkownika), mniej dla **S-01** (obraz z zewnętrznego URL).

### Co F-02 i F-04 odłożyły → S-01 musi zaimplementować

| #   | Capability                                               | Źródło                      | PRD        |
| --- | -------------------------------------------------------- | --------------------------- | ---------- |
| 1   | Formularz kryteriów UI                                   | F-02 plan §Czego NIE robimy | FR-001     |
| 2   | `fetch` do `POST /api/ai/suggestions`                    | F-02 baseline               | FR-001     |
| 3   | Loading state podczas AI                                 | F-02 plan/research          | —          |
| 4   | Wyświetlanie 3–5 propozycji (title, summary, link)       | F-02 response               | FR-002     |
| 5   | Jeden obraz na propozycję — pozyskanie, storage, display | F-02 + F-04                 | FR-002     |
| 6   | Opcjonalny zapis draftów do `events` + `image_path`      | F-02 + F-04 + change.md     | FR-001/002 |
| 7   | Walidacja `event_id` przed uploadem                      | F-04 plan                   | —          |

**Poza zakresem S-01:** triage accept/reject/maybe (S-02), publikacja (S-05), CRUD biblioteki (S-04), manual event (S-03).

## Odniesienia do kodu

- `src/pages/api/ai/suggestions.ts:12-51` — JSON API, walidacja Zod, OpenRouter
- `src/lib/ai/suggestion-response.schema.ts:3-20` — kontrakt odpowiedzi (brak image)
- `src/lib/ai/suggestion-request.schema.ts:3-8` — kontrakt requestu
- `src/lib/ai/openrouter-client.ts:40-107` — `generateSuggestions`
- `src/lib/route-access.ts:6-17` — polityka public/protected
- `src/middleware.ts:17-18` — sesja + redirect
- `src/pages/dashboard.astro:9-30` — szablon strony produktowej
- `src/components/auth/SignInForm.tsx:43` — wzorzec formularza (adaptacja na fetch)
- `src/lib/storage/event-image.ts:129-196` — upload/remove/replace (F-04)
- `src/lib/storage/event-image-path.ts:84-93` — path convention
- `supabase/migrations/20260526120000_events_schema_and_rls.sql` — schema events
- `supabase/migrations/20260622120000_event_images_storage.sql` — bucket + RLS storage
- `scripts/smoke-openrouter.ts` — smoke AI (bez auth)
- `scripts/smoke-event-image.ts` — smoke storage (upload/download)

## Wnioski architektoniczne

1. **Warstwy:** Astro (layout) + React island (interakcja) + `src/lib/` (logika) + `src/pages/api/` (granice HTTP).
2. **Walidacja:** Zod na granicy API; client-side mirror dla UX (jak auth forms).
3. **Sekrety:** `astro:env/server` — OpenRouter i Supabase tylko server-side; browser client potrzebuje public anon key + cookies (nowy moduł, np. `src/lib/supabase-browser.ts`).
4. **Schema-first dla rozszerzeń AI:** rozszerz `suggestionItemSchema` + `openRouterJsonSchema` razem; prompt w `build-suggestion-prompt.ts` zsynchronizowany.
5. **Two-stage Zod:** zachować loose `suggestionResponseFromModelSchema` → strict `suggestionResponseSchema`.
6. **Zakres S-01 vs S-02:** wyświetl propozycje bez triage UI; opcjonalnie zapis draftów bez przycisków accept/reject/maybe.
7. **MVP wąski:** criteria form → lista tekst+link → obraz → persist + storage.

## Kontekst historyczny

- `context/archive/2026-05-26-ai-suggestion-scaffold/plan.md` — F-02: tekst + sourceUrl; świadomie bez obrazów i UI
- `context/archive/2026-06-22-event-image-storage/plan.md` — bucket private, direct upload, defer published read do S-05
- `context/changes/ai-activity-suggestions/change.md` — S-01 north star, prerequisites done, bez triage
- `context/foundation/roadmap.md:121-131` — S-01 outcome i prerequisites
- `context/foundation/prd-v2.md` — US-01, FR-001, FR-002

## Powiązane badania

- `context/archive/2026-05-26-ai-suggestion-scaffold/research.md` — pierwotne badanie F-02
- `context/archive/2026-06-22-event-image-storage/research.md` — badanie F-04 (jeśli obecne)

## Otwarte pytania (do rozstrzygnięcia w /10x-plan lub /10x-frame)

1. **Obraz w S-01:** placeholder vs OG-fetch vs rozszerzenie schematu AI o `imageUrl`?
2. **Persist w S-01:** tylko transient JSON vs zapis `events` draft?
3. **`triage_status` dla nowych propozycji:** `draft` vs `pending`?
4. **Mapowanie `either` → `location_kind`:** split na dwa wiersze, domyślny `outdoor`, czy nullable?
5. **Landing po loginie:** `/dashboard` vs `/suggestions` jako north star?
6. **Signed URL helper:** w S-01 czy osobny slice?
7. **API 401:** poprawka middleware/handler dla `fetch` z React island?

## Rekomendowany kierunek planu

**Faza 1 (MVP visible):** `/suggestions` + formularz + `fetch` API + karty wyników (tekst + link) + loading state.  
**Faza 2 (FR-002 obraz):** strategia obrazu + signed URL lub placeholder + integracja storage.  
**Faza 3 (opcjonalnie):** zapis draftów do `events` (INSERT → upload → UPDATE `image_path`).  
**Poza zakresem S-01:** accept/reject/maybe (S-02), publikacja (S-05), biblioteka CRUD (S-04).
