---
project: "kids-time MVP"
version: 1
status: draft
created: 2026-05-25
updated: 2026-08-04
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: kids-time MVP

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Rodzice tracą czas na szukanie pomysłów na aktywności po szkole lub w weekend — potrzebują krótkich, dopasowanych propozycji (miejsce, czas, wiek, wewnątrz/na zewnątrz), a nie kolejnej długiej listy wyników wyszukiwania. **Rdzeń produktu** — cecha, bez której aplikacja staje się zwykłym wyszukiwarkowym narzędziem — to zwięzłe filtrowanie AI według konkretnych kryteriów rodziny oraz świadome publikowanie wydarzeń przez innych rodziców jako dodatkowy sygnał.

## North star

**S-01: Propozycje AI według kryteriów** — najmniejszy przepływ end-to-end, który udowadnia, że rodzic po zalogowaniu dostaje kilka zwięzłych propozycji z obrazem i linkiem do źródła.

> **Gwiazda przewodnia** oznacza tu najmniejszy kompletny przepływ widoczny dla użytkownika, którego powodzenie potwierdza główną hipotezę produktu — umieszczony jak najwcześniej, jak pozwalają zależności techniczne, bo reszta ma sens tylko wtedy, gdy to działa.

## At a glance

| ID   | Change ID               | Outcome (user can …)                                                           | Prerequisites          | PRD refs               | Status   |
| ---- | ----------------------- | ------------------------------------------------------------------------------ | ---------------------- | ---------------------- | -------- |
| F-01 | event-schema-rls        | (foundation) model wydarzeń, migracje i RLS dla właściciela                    | —                      | Access Control, NFR-02 | done     |
| F-02 | ai-suggestion-scaffold  | (foundation) integracja dostawcy AI do generowania propozycji                  | —                      | FR-001, NFR-03         | done     |
| F-03 | app-route-auth-guards   | (foundation) ochrona tras aplikacji poza samym `/dashboard`                    | —                      | Access Control, US-01  | done     |
| F-04 | event-image-storage     | (foundation) przechowywanie jednego obrazu na wydarzenie                       | F-01                   | FR-002, FR-003         | done     |
| S-01 | ai-activity-suggestions | …poprosić o propozycje AI i zobaczyć kilka zwięzłych aktywności (obraz + link) | F-01, F-02, F-03, F-04 | US-01, FR-001, FR-002  | done     |
| S-02 | triage-suggestions      | …zaakceptować, odrzucić lub oznaczyć propozycję jako „może później”            | S-01                   | US-01, FR-005          | done     |
| S-03 | manual-event-ai-summary | …dodać ręcznie wydarzenie z jednym obrazem i krótkim podsumowaniem AI          | F-01, F-02, F-03, F-04 | FR-003                 | proposed |
| S-04 | my-events-library       | …przeglądać, edytować i usuwać własne wydarzenia                               | F-01, F-03             | FR-004                 | done     |
| S-05 | publish-shared-event    | …świadomie opublikować wydarzenie tylko do odczytu dla innych rodziców         | S-04                   | US-01, FR-006          | done     |

## Streams

Nawigacja — grupy wspólnego łańcucha zależności. Kolejność kanoniczna jest w sekcjach Foundations i Slices poniżej.

| Stream | Theme               | Chain                                               | Note                                                                                                         |
| ------ | ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A      | Rdzeń AI            | `F-02` → `F-01` / `F-03` → `F-04` → `S-01` → `S-02` | `F-01`, `F-03`, `F-04` równolegle po `F-02`; cel **speed** — gwiazda `S-01` jak najwcześniej po fundamentach |
| B      | Biblioteka wydarzeń | `F-01` → `F-03` → `S-04` → `S-05`                   | `S-03` równolegle z `S-04` po `F-04`; publikacja (`S-05`) na końcu ścieżki must-have                         |
| C      | Ręczne wydarzenie   | `F-01` → `F-04` → `S-03`                            | Dołącza do Stream B przy `F-01`; wspiera metrykę „75% wydarzeń z AI” (FR-003)                                |

## Baseline

Stan kodu na **2026-05-25** (auto-research + potwierdzenie użytkownika). Fundamenty poniżej **nie** powtarzają warstw oznaczonych jako obecne.

- **Frontend:** present — Astro 6 SSR + React 19, Tailwind 4, routing `src/pages/`, shadcn partial (`src/components/ui/button.tsx`)
- **Backend / API:** partial — Astro SSR + Cloudflare; tylko `src/pages/api/auth/*`, brak API domenowych
- **Data:** partial — klient Supabase (`src/lib/supabase.ts`); brak `supabase/migrations/`, brak `seed.sql`
- **Auth:** partial — Supabase cookie sessions, middleware `src/middleware.ts` chroni tylko `/dashboard`
- **Deploy / infra:** partial — `@astrojs/cloudflare`, `wrangler.jsonc`; CI lint/build (`.github/workflows/ci.yml`), brak workflow deploy
- **Observability:** partial — `wrangler.jsonc` observability flag; brak SDK/logowania w `src/`

Warstwy ze **tech-stack.md** (bez ponownego sondowania): Astro starter, Supabase, Cloudflare Pages, GitHub Actions (auto-deploy planowany, niepodłączony).

## Foundations

### F-01: Model wydarzeń i RLS

- **Outcome:** (foundation) tabela wydarzeń (i powiązane pola kryteriów), migracje Supabase i polityki RLS — właściciel widzi i modyfikuje tylko swoje rekordy.
- **Change ID:** event-schema-rls
- **PRD refs:** Access Control, NFR-02 (prywatność decyzji)
- **Unlocks:** S-01, S-02, S-03, S-04, S-05
- **Prerequisites:** —
- **Parallel with:** F-02, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez schematu żaden slice z biblioteką ani triage nie ma gdzie zapisać stanu — sensownie przed S-01, jeśli propozycje mają być trwałe.
- **Status:** done

### F-02: Integracja AI do propozycji

- **Outcome:** (foundation) ścieżka serwerowa wywołująca model AI z kryteriami (miejsce, czas, wiek, indoor/outdoor) i zwracająca zwięzły zestaw propozycji.
- **Change ID:** ai-suggestion-scaffold
- **PRD refs:** FR-001, NFR-03
- **Unlocks:** S-01 (gwiazda przewodnia), S-03
- **Prerequisites:** —
- **Parallel with:** F-01, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Największa nieznana techniczna MVP — warto ustawić wcześnie przy celu **speed**, żeby S-01 nie czekał na resztę UI.
- **Status:** done

### F-03: Ochrona tras aplikacji

- **Outcome:** (foundation) zalogowany rodzic jest wymagany na trasach produktowych (nie tylko `/dashboard`); niezalogowany trafia na logowanie.
- **Change ID:** app-route-auth-guards
- **PRD refs:** Access Control, US-01
- **Unlocks:** S-01, S-02, S-03, S-04, S-05
- **Prerequisites:** —
- **Parallel with:** F-01, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niski — middleware i Supabase session już istnieją; rozszerzenie listy chronionych tras.
- **Status:** done

### F-04: Przechowywanie obrazów wydarzeń

- **Outcome:** (foundation) upload i odczyt jednego obrazu na wydarzenie (bucket + polityki zgodne z RLS).
- **Change ID:** event-image-storage
- **PRD refs:** FR-002, FR-003
- **Unlocks:** S-01, S-03
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sekwencja po F-01 — bucket powinien respektować ten sam model właściciela co wydarzenia.
- **Status:** done

## Slices

### S-01: Propozycje AI według kryteriów

- **Outcome:** user can enter place, time, child age, and indoor/outdoor preference and receive a few concise AI-suggested activities, each with at most one image and a source link.
- **Change ID:** ai-activity-suggestions
- **PRD refs:** US-01, FR-001, FR-002
- **Prerequisites:** F-01, F-02, F-03, F-04
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** To jest **gwiazda przewodnia** — dowód hipotezy „zwięzłe AI zamiast długiej listy”; wymaga wszystkich czterech fundamentów, ale nie czeka na CRUD ani publikację.
- **Status:** done

### S-02: Decyzje o propozycjach

- **Outcome:** user can accept, reject, or mark each suggested activity as maybe/save for later.
- **Change ID:** triage-suggestions
- **PRD refs:** US-01, FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-03 (po F-01, F-04)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Metryka sukcesu „70% akceptacji” (Kryteria sukcesu) wymaga tego slice'a zaraz po S-01.
- **Status:** done

### S-03: Ręczne wydarzenie z podsumowaniem AI

- **Outcome:** user can manually add event information with one image and get a short AI summary.
- **Change ID:** manual-event-ai-summary
- **PRD refs:** FR-003
- **Prerequisites:** F-01, F-02, F-03, F-04
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wspiera drugorzędną metrykę „75% wydarzeń z pomocą AI”; można równolegle z biblioteką po fundamentach.
- **Status:** proposed

### S-04: Biblioteka własnych wydarzeń

- **Outcome:** user can browse, edit, and delete their own events.
- **Change ID:** my-events-library
- **PRD refs:** FR-004
- **Prerequisites:** F-01, F-03
- **Parallel with:** S-03 (po F-04 dla S-03)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Potrzebny przed publikacją — rodzic publikuje to, co już ma w bibliotece.
- **Status:** done

### S-05: Publikacja dla innych rodziców

- **Outcome:** user can intentionally publish an event read-only to other parents.
- **Change ID:** publish-shared-event
- **PRD refs:** US-01, FR-006
- **Prerequisites:** S-04
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Ostatni krok must-have z US-01; akceptacja bez publikacji pozostaje prywatna (logika biznesowa PRD).
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                  | Ready for `/10x-plan` | Notes                                |
| ---------- | ----------------------- | -------------------------------------- | --------------------- | ------------------------------------ |
| F-01       | event-schema-rls        | Event schema + Supabase RLS            | no                    | Odblokowuje wszystkie slice'y danych |
| F-02       | ai-suggestion-scaffold  | AI suggestion server path              | no                    | Odblokowuje S-01, S-03               |
| F-03       | app-route-auth-guards   | Expand auth route guards               | yes                   | `/10x-plan app-route-auth-guards`    |
| F-04       | event-image-storage     | Event image storage + policies         | no                    | Wymaga F-01                          |
| S-01       | ai-activity-suggestions | AI activity suggestions by criteria    | no                    | Gwiazda przewodnia — po F-01–F-04    |
| S-02       | triage-suggestions      | Accept / reject / maybe on suggestions | no                    | Po S-01                              |
| S-03       | manual-event-ai-summary | Manual event + AI summary              | no                    | Po fundamentach                      |
| S-04       | my-events-library       | My events CRUD                         | no                    | Po F-01, F-03                        |
| S-05       | publish-shared-event    | Publish event read-only to others      | no                    | Po S-04                              |

## Open Roadmap Questions

1. **Czy roadmap ma śledzić `prd-v2.md` (FR-008 unpublish, FR-009 copy)?** — Owner: user. Block: roadmap-wide (obecny PRD v1 ich nie zawiera).
2. ~~**Który dostawca/model AI na produkcję (OpenRouter vs inny)?**~~ — **Rozstrzygnięte (F-02):** OpenRouter + `openai/gpt-4o-mini` via `OPENROUTER_MODEL` — zob. [change.md](../changes/ai-suggestion-scaffold/change.md).

## Parked

- **FR-007: AI filter on public events** — Why parked: nice-to-have w PRD; must-have path najpierw (cel **speed**).
- **Zaawansowane rekomendacje poza filtrem kryteriów** — Why parked: PRD §Non-Goals.
- **Import PDF/DOCX** — Why parked: PRD §Non-Goals.
- **Czat / wiadomości między rodzicami** — Why parked: PRD §Non-Goals.
- **Aplikacje mobilne natywne** — Why parked: PRD §Non-Goals.
- **Pełny pipeline deploy (auto-deploy on merge)** — Why parked: tech-stack planuje GA deploy, baseline ma tylko CI; po pierwszym slice'u produktowym.
- **Observability produktowa (Sentry, metryki aplikacyjne)** — Why parked: brak w baseline; NFR UX (200 ms) realizowane w UI slice'ach, nie osobnym fundamentem na start.

## Done

- **F-01: (foundation) tabela wydarzeń (i powiązane pola kryteriów), migracje Supabase i polityki RLS — właściciel widzi i modyfikuje tylko swoje rekordy.** — Archived 2026-05-26 → `context/archive/2026-05-26-event-schema-rls/`. Lesson: —.
- **F-03: (foundation) zalogowany rodzic jest wymagany na trasach produktowych (nie tylko `/dashboard`); niezalogowany trafia na logowanie.** — Archived 2026-05-25 → `context/archive/2026-05-25-app-route-auth-guards/`. Lesson: —.
- **F-02: (foundation) ścieżka serwerowa wywołująca model AI z kryteriami (miejsce, czas, wiek, indoor/outdoor) i zwracająca zwięzły zestaw propozycji.** — Zarchiwizowano 2026-06-22 → `context/archive/2026-05-26-ai-suggestion-scaffold/`. Lekcja: —.
- **F-04: (foundation) upload i odczyt jednego obrazu na wydarzenie (bucket + polityki zgodne z RLS).** — Zarchiwizowano 2026-06-22 → `context/archive/2026-06-22-event-image-storage/`. Lekcja: —.
- **S-01: user can enter place, time, child age, and indoor/outdoor preference and receive a few concise AI-suggested activities, each with at most one image and a source link.** — Zarchiwizowano 2026-07-16 → `context/archive/2026-06-22-ai-activity-suggestions/`. Lekcja: —.
- **S-02: user can accept, reject, or mark each suggested activity as maybe/save for later.** — Zarchiwizowano 2026-07-24 → `context/archive/2026-07-16-triage-suggestions/`. Lekcja: —.
- **S-04: user can browse, edit, and delete their own events.** — Zarchiwizowano 2026-07-24 → `context/archive/2026-07-24-my-events-library/`. Lekcja: —.
- **S-05: user can intentionally publish an event read-only to other parents.** — Zarchiwizowano 2026-08-04 → `context/archive/2026-08-04-publish-shared-event/`. Lekcja: —.
