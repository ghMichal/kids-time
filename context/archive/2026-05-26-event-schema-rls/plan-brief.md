# Event schema and RLS — Plan Brief

> Full plan: `context/changes/event-schema-rls/plan.md`
> Change: `context/changes/event-schema-rls/change.md`
> Revised: 2026-05-26 (post plan-review)

## What & Why

Fundament **F-01**: pierwsza trwała warstwa danych dla wydarzeń rodzica — migracje Supabase, tabela `events` i RLS tak, aby właściciel zarządzał tylko swoimi rekordami, a inni rodzice widzieli wyłącznie świadomie opublikowane wydarzenia (FR-006, NFR-02). Bez tego slice'y S-01–S-05 i F-04 nie mają gdzie zapisać stanu.

## Starting Point

Klient Supabase w `src/lib/supabase.ts`, auth przez `auth.users`, **brak** `supabase/migrations/` i `supabase/seed.sql`. README nadal mówi, że migracje nie są wymagane. F-03 (route guards) — done.

## Desired End State

Po `npx supabase db reset`: jedna migracja `_events_schema_and_rls.sql` (tabela + RLS), `seed.sql` obecny, typy w `src/types/database.generated.ts` + barrel `src/types.ts`, README zaktualizowany. Manualnie: rodzic A nie widzi prywatnych B; B widzi tylko opublikowane A (testy jako `authenticated`, nie service role).

## Key Decisions Made

| Decision          | Choice                                       | Why (1 sentence)                                | Source         |
| ----------------- | -------------------------------------------- | ----------------------------------------------- | -------------- |
| Deploy migracji   | **Atomowa** (schema + RLS w jednym pliku)    | Bez okna „otwartej” tabeli przed RLS na cloud   | Plan-review F1 |
| Kolejność lokalna | **seed.sql → migracja → db reset**           | `config.toml` wymaga seed; reset pada bez pliku | Plan-review F2 |
| Zakres PRD        | **PRD v1** + `copied_from_event_id` nullable | v2 copy/unpublish w S-05                        | Notes / Plan   |
| Model danych      | **Jedna tabela `events`**                    | Prostsze RLS niż sessions + suggestions         | Plan           |
| Typy TS           | **generated + `src/types.ts` barrel**        | Zgodność z `@/types` / AGENTS.md                | Plan-review F3 |
| ESLint            | **ignore `database.generated.ts`**           | Lint przechodzi po `gen types`                  | Plan-review F4 |
| Testy RLS         | **JWT / authenticated**, scenariusz 8 INSERT | Service role omija RLS                          | Plan-review F5 |
| API / UI          | **Poza zakresem**                            | F-01 = DB + typy                                | Notes / Plan   |

## Scope

**In scope:**

- `supabase/seed.sql` (pusty) + `supabase/migrations/*_events_schema_and_rls.sql`
- RLS per operacja; typy + `src/types.ts`; README; `eslint.config.js` ignore

**Out of scope:**

- Storage (F-04), API, UI, copy RLS (FR-009), `service_role`, schema-only cloud push

## Architecture / Approach

Jedna tabela `events`, jedna migracja atomowa. Aplikacja (przyszłe slice'y) — anon key + JWT użytkownika; RLS egzekwuje prywatność w Postgresie.

## Phases at a Glance

| Phase                      | What it delivers                                 | Key risk                                 |
| -------------------------- | ------------------------------------------------ | ---------------------------------------- |
| 1. Seed + atomic migration | seed.sql, tabela + RLS w jednym pliku, db reset  | Push schema-only na cloud — **zakazane** |
| 2. RLS verification        | Scenariusze 1–8 jako authenticated               | Pomylenie z testem service role          |
| 3. Types & docs            | gen types, `src/types.ts`, eslint ignore, README | Drift typów jeśli nie commit generated   |

**Prerequisites:** Docker, `npx supabase start`, `SUPABASE_*` dla buildu.

**Estimated effort:** ~1–2 sesje, 3 fazy.

## Open Risks & Assumptions

- Pierwszy `db push` na cloud dopiero z pełną migracją atomową.
- F-02: potwierdzić JWT vs service role w osobnym planie.

## Success Criteria (Summary)

- `db reset` + migracja atomowa applied.
- RLS scenariusze 1–8 (authenticated).
- `npm run lint` + `npm run build`.
