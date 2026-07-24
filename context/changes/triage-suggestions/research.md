---
date: 2026-07-16T17:35:43+02:00
researcher: Auto
git_commit: cefca0c5b42a90f1a50222d1b43c6c7467bf20e9
branch: S-02-triage-suggestions
repository: kids-time
topic: "Jak dziś wygląda flow propozycji AI i gdzie wpiąć accept / reject / maybe?"
tags: [research, codebase, suggestions, triage, events, ai]
status: complete
last_updated: 2026-07-16
last_updated_by: Auto
---

# Badanie: Jak dziś wygląda flow propozycji AI i gdzie wpiąć accept / reject / maybe?

**Data**: 2026-07-16T17:35:43+02:00
**Badacz**: Auto
**Git Commit**: cefca0c5b42a90f1a50222d1b43c6c7467bf20e9
**Gałąź**: S-02-triage-suggestions
**Repozytorium**: kids-time

## Pytanie badawcze

Jak dziś wygląda flow propozycji AI i gdzie wpiąć accept / reject / maybe?

## Podsumowanie

S-01 jest **transient**: zalogowany rodzic na `/suggestions` wysyła kryteria → `POST /api/ai/suggestions` → OpenRouter + OG enrich → karty w stanie React (title, summary, sourceUrl?, imageUrl?). **Brak INSERT do `events` i brak przycisków triage.**

Schema pod triage **już istnieje** (F-01): `triage_status` ∈ `{draft, pending, accepted, rejected, maybe}`, `origin` ∈ `{ai_suggested, manual}`, publish osobno (`is_published`). S-02 wpinamy w **stopkę `SuggestionCard`** + **nowe API persist** (nie w endpoint generowania).

## Szczegółowe ustalenia

### Flow UI → API → AI (S-01)

```
[Browser /suggestions]
  suggestions.astro → SuggestionsPage (client:load)
       │
       │ POST /api/ai/suggestions  { place, time, childAge, indoorOutdoor }
       ▼
[middleware] session → locals.user  (else 401 JSON dla /api/*)
       ▼
[api/ai/suggestions.ts]
  Zod → generateSuggestions → enrichSuggestionImages
       ▼
  200 { suggestions: [{ title, summary, sourceUrl?, imageUrl? }] }
       ▼  (tylko React state — bez DB)
[SuggestionCard × N]
       ✗  accept / reject / maybe   ← tu S-02
```

| Warstwa      | Ścieżka                                                         | Rola                                                  |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------- |
| Strona       | `src/pages/suggestions.astro`                                   | Shell + island `SuggestionsPage`                      |
| Nav          | `src/components/Topbar.astro`                                   | Link „Propozycje” → `/suggestions`                    |
| Form + lista | `src/components/suggestions/SuggestionsPage.tsx`                | Walidacja, fetch, stan wyników                        |
| Karta        | `src/components/suggestions/SuggestionCard.tsx`                 | title / summary / link / obraz — **bez akcji triage** |
| API          | `src/pages/api/ai/suggestions.ts`                               | Auth, Zod, generate + enrich, bez DB                  |
| AI           | `src/lib/ai/openrouter-client.ts`, `build-suggestion-prompt.ts` | OpenRouter + json_schema                              |
| Enrich       | `src/lib/suggestions/enrich-suggestion-images.ts`               | Hotlink OG z `sourceUrl`                              |
| Auth         | `src/lib/route-access.ts`, `src/middleware.ts`                  | Default-deny; `/suggestions` chronione                |

Request (`suggestion-request.schema.ts`): `place`, `time`, `childAge` (0–18), `indoorOutdoor`: `indoor` \| `outdoor` \| `either`.

Response item (`EnrichedSuggestionItem`): `title`, `summary`, `sourceUrl?`, `imageUrl?` — **bez stabilnego id**.

### Gdzie wpiąć accept / reject / maybe

1. **UI (primary):** `SuggestionCard.tsx` — grupa przycisków po summary / source; callbacki z rodzica.
2. **Wiring:** `SuggestionsPage.tsx` (map kart) — handler dostaje pełny item + ostatnie kryteria (potrzebne do INSERT).
3. **API (nowe):** np. `POST /api/events` lub `POST /api/events/triage` — INSERT z `origin: "ai_suggested"` + `triage_status`; **nie** rozszerzać `POST /api/ai/suggestions` o zapis.
4. **Kolejność obrazu:** najpierw INSERT (dostajemy `event.id`), potem opcjonalnie pobranie OG → `uploadEventImage` → `image_path` (helpers F-04 wymagają `eventId`).

### Model `events` (gotowy pod triage)

Migracja `supabase/migrations/20260526120000_events_schema_and_rls.sql`:

- Enumy: `event_triage_status`, `event_origin`, `event_location_kind` (`indoor` \| `outdoor` — **bez** `either`)
- Kolumny m.in.: `title`, `summary`, `source_url`, `image_path`, `place`, `starts_at`, `child_age_years`, `location_kind`, `origin`, `triage_status`, `is_published` / `published_at`
- RLS: owner INSERT/UPDATE/DELETE; SELECT own **lub** published
- Typy: `src/types/database.generated.ts`, `EventRow` w `src/types.ts`

Storage: `src/lib/storage/event-image.ts` (`uploadEventImage` / replace / remove); bucket `event-images`. S-01 używa tylko transient HTTPS URL — nie zapisuje do bucketa.

**Brak w `src/`:** `.from("events")`, API CRUD events, Zod insert/triage, UI triage, signed URL do prywatnych obrazów.

### Granica S-01 vs S-02 (historia)

Jawna decyzja z archiwum S-01: **transient only**; triage + persist → S-02. F-01 świadomie zostawił kolumny pod triage/library zanim UI istniało. Akceptacja ≠ publikacja (S-05 / FR-006).

## Odniesienia do kodu

- `src/pages/suggestions.astro` — strona produktowa
- `src/components/suggestions/SuggestionsPage.tsx` — form → API → stan kart
- `src/components/suggestions/SuggestionCard.tsx` — wyświetlanie; naturalny hook przycisków
- `src/pages/api/ai/suggestions.ts` — generowanie (bez persist)
- `src/lib/ai/suggestion-request.schema.ts` — kryteria wejściowe
- `src/lib/suggestions/enriched-response.schema.ts` — kształt karty
- `supabase/migrations/20260526120000_events_schema_and_rls.sql` — enumy triage + RLS
- `src/lib/storage/event-image.ts` — upload po uzyskaniu `eventId`
- `src/middleware.ts` / `src/lib/route-access.ts` — auth guards

## Wnioski architektoniczne

- Jedna tabela `events` (nie osobna tabela suggestions); triage to kolumna, nie osobny byt.
- Generowanie AI i persist decyzji to **dwa endpointy** — utrzymuje czystą granicę S-01 / S-02.
- Karty bez id → najprostszy model: **INSERT przy pierwszej decyzji triage** (status od razu `accepted` \| `rejected` \| `maybe`), ewentualnie z `pending`/`draft` jeśli kiedyś rozdzielimy „zapisane bez decyzji”.
- Publish (`is_published`) poza zakresem S-02.

## Kontekst historyczny (z poprzednich zmian)

- `context/archive/2026-06-22-ai-activity-suggestions/frame.md` — „persist należy do S-02”; bar transient only
- `context/archive/2026-06-22-ai-activity-suggestions/plan.md` — Persist | Transient only; NOT doing: triage
- `context/archive/2026-05-26-event-schema-rls/plan.md` — `triage_status` vs `is_published`; enum draft/pending/accepted/rejected/maybe
- `context/archive/2026-05-26-ai-suggestion-scaffold/` — F-02: AI path bez UI i bez DB
- `context/foundation/roadmap.md` — S-02 odblokowane po S-01; metryka 70% akceptacji

## Powiązane badania

- `context/archive/2026-06-22-ai-activity-suggestions/research.md` — open Q (draft vs pending; `either` → `location_kind`) zamknięte dla S-01 jako „przy persist”
- `context/archive/2026-05-26-ai-suggestion-scaffold/research.md` — ścieżka OpenRouter

## Otwarte pytania

1. Przy INSERT z decyzji: od razu `accepted`/`rejected`/`maybe`, czy najpierw `draft`/`pending`?
2. Mapowanie `indoorOutdoor: "either"` → `location_kind` (nullable? wymusić wybór? pominąć kolumnę?)
3. `time` (free-text) → `starts_at` (`timestamptz`) — przechowywać tylko w `description`/`summary`, czy parsować?
4. Czy S-02 musi kopiować OG do `event-images`, czy wystarczy `source_url` + opcjonalny `image_path` później (S-03/S-04)?
5. Czy reject też tworzy wiersz (do metryki / historii), czy tylko accept/maybe?
