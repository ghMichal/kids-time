# My events library — Krótki plan

> Pełny plan: `context/changes/my-events-library/plan.md`  
> Badania: `context/changes/my-events-library/research.md`

## Co i dlaczego

Rodzic potrzebuje **biblioteki własnych wydarzeń** (FR-004 / S-04): przeglądać, edytować i usuwać to, co już trafiło do `events` po triage (S-02). Bez tego nie ma sensownej ścieżki do publikacji (S-05).

## Punkt wyjścia

Schema i RLS są gotowe; aplikacja umie tylko **INSERT** przez `POST /api/events/triage`. Brak listy, edycji, usuwania i strony `/events`.

## Pożądany stan końcowy

Na `/events` widać własne `accepted`/`maybe`, można edytować kluczowe pola inline i usunąć wydarzenie z potwierdzeniem. Publish i upload obrazów nadal poza zakresem.

## Kluczowe podjęte decyzje

| Decyzja     | Wybór                                        | Dlaczego (1 zdanie)                   | Źródło  |
| ----------- | -------------------------------------------- | ------------------------------------- | ------- |
| Filtr listy | `accepted` + `maybe`                         | Reject zostaje w DB, nie zaśmieca UI  | Plan    |
| Pola edycji | title/summary/description/place/age/location | FR-004 bez triage/publish/`starts_at` | Plan    |
| Obrazy      | Brak uploadu                                 | F-04/S-03; unikamy signed URL w MVP   | Plan    |
| Fetch       | Client jak suggestions                       | Spójny wzorzec island                 | Plan    |
| Delete      | Hard + confirm                               | Proste, zgodne z FR-004               | Plan    |
| Edit UX     | Inline na `/events`                          | Jeden route, bez Dialog               | Plan    |
| Query       | Zawsze filtr `owner_id`                      | RLS SELECT jest szerszy niż „moje”    | Badania |

## Zakres

**W zakresie:**

- `GET` / `PATCH` / `DELETE` API + `lib/events`
- `/events` + Topbar + lista + inline edit + delete confirm
- README (krótko)

**Poza zakresem:**

- Publish (S-05), manual create (S-03), image upload, rejected w UI, soft delete, migracje, test runner

## Architektura / Podejście

Island na `/events` woła nowe endpointy obok istniejącego triage. Lib mapuje Zod → Supabase z `ownerId` z sesji. RLS jako defense-in-depth; filtr `owner_id` + statusy na liście jest obowiązkowy dla poprawnego UX.

## Fazy w skrócie

| Faza                    | Co dostarcza                 | Kluczowe ryzyko                              |
| ----------------------- | ---------------------------- | -------------------------------------------- |
| 1. API CRUD             | List/update/delete + Zod     | Zły filtr listy (cudze published / rejected) |
| 2. UI lista             | `/events`, Topbar, browse    | Empty/auth edge cases                        |
| 3. Edit + delete + docs | Inline form, confirm, README | Misclick delete; regresja triage             |

**Wymagania wstępne:** F-01, F-03, S-02 (wiersze w `events`); lokalny Supabase do smoke.  
**Szacowany wysiłek:** ~2–3 sesje w 3 fazach.

## Otwarte ryzyka i założenia

- Wiersze S-03 z `image_path` mogą pojawić się później — DELETE i tak robi defensywny cleanup.
- Brak paginacji OK dla MVP; przy wzroście dodać limit/offset.
- `rejected` niewidoczne w UI — świadoma decyzja produktowa.

## Kryteria sukcesu (podsumowanie)

- Rodzic widzi i zarządza accepted/maybe na `/events`.
- Edit i delete działają end-to-end z poprawnymi wierszami w DB.
- Lint/build przechodzą; publish/obrazy nadal poza produktem.
