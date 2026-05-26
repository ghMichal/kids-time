# Plan: event-schema-rls (F-01)

**Status:** planned  
**Roadmap:** [F-01](../../foundation/roadmap.md)  
**Change:** [change.md](./change.md)

---

## Overview

Fundament **F-01**: wprowadzenie tabeli `events`, migracji Supabase i polityk RLS, aby wszystkie przyszłe slice'y mogły trwale zapisywać wydarzenia, triage (FR-005) i publikację (FR-006) przy zachowaniu prywatności decyzji (NFR-02). Change obejmuje wyłącznie warstwę bazy i typy — bez API i UI.

## Current State Analysis

| Element                | Stan                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `supabase/config.toml` | Istnieje (`project_id`, Postgres 17, `db.migrations.enabled`)                                         |
| `supabase/migrations/` | **Brak** plików                                                                                       |
| `supabase/seed.sql`    | Oczekiwany przez config; może nie istnieć — utworzyć pusty lub minimalny jeśli `db reset` tego wymaga |
| `src/lib/supabase.ts`  | Klient SSR z cookie session                                                                           |
| Auth                   | `auth.users` (wbudowane Supabase Auth)                                                                |
| README                 | Twierdzi, że migracje nie są wymagane — **do aktualizacji**                                           |
| Test runner            | Brak `npm test`                                                                                       |

### Key Discoveries

- Roadmap i change Notes: **PRD v1** jako zakres; **prd-v2** FR-008/009 (copy/unpublish) — kolumna `copied_from_event_id` na przyszłość, bez logiki copy w RLS w tym change.
- Akceptacja ≠ publikacja (PRD Business Logic) — wymaga osobnych pól `triage_status` vs `is_published`.
- F-04 zależy od F-01 — w schemacie tylko `image_path text` (nullable), bez bucketu.
- Konwencja repo: migracje `YYYYMMDDHHmmss_description.sql`, RLS z politykami per operacja.

## Desired End State

- Jeden plik `supabase/migrations/*_events_schema_and_rls.sql`: enumy, tabela `public.events`, indeksy, trigger `updated_at`, **oraz** ENABLE/FORCE RLS + polityki SELECT/INSERT/UPDATE/DELETE.
- `supabase/seed.sql` istnieje (pusty) — `db reset` przechodzi.
- `src/types/database.generated.ts` (lub równoważna ścieżka) wygenerowany z lokalnej bazy po migracji.
- README opisuje `supabase/migrations` i komendy `db reset` / `gen types`.
- Manualna weryfikacja RLS w Studio lub `psql` z dwoma użytkownikami testowymi potwierdza brak wycieku prywatnych rekordów.

### Weryfikacja końcowa

Scenariusze z sekcji Testing Strategy + `npm run lint` + `npm run build`.

## What We're NOT Doing

- Endpointy `/api/events` ani stron produktowych (S-01, S-04).
- Supabase Storage / bucket (F-04).
- Polityki RLS pod kopiowanie wydarzeń (FR-009) — tylko nullable `copied_from_event_id`.
- Automatyczne ustawianie `published_at` w triggerze DB (aplikacja w S-05).
- Seed z danymi produkcyjnymi; opcjonalny seed dev poza zakresem.
- Aktualizacja `roadmap.md` statusu — robi `/10x-archive` po implementacji.

## Implementation Approach

**Jedna tabela `events`** z denormalizowanymi polami kryteriów (FR-001) i enumami stanu. RLS jako jedyne miejsce egzekucji dostępu na tym etapie — przyszłe slice'y używają klienta Supabase z JWT rodzica (anon key + JWT; bez `service_role` w F-01).

**Wymaganie atomowe (post-review):** cały SQL — `CREATE TABLE`, `ENABLE`/`FORCE ROW LEVEL SECURITY`, cztery polityki — w **jednym** pliku `supabase/migrations/<timestamp>_events_schema_and_rls.sql`. Fazy 1–2 to kolejność **weryfikacji**, nie osobne deploye. **Zakaz** `supabase db push` / migracji na cloud z samym schematem bez RLS. Jeden PR, jeden push migracji.

### Model logiczny (kontrakt kolumn)

| Kolumna                    | Typ                             | Cel                                       |
| -------------------------- | ------------------------------- | ----------------------------------------- |
| `id`                       | `uuid` PK                       | Identyfikator wydarzenia                  |
| `owner_id`                 | `uuid` FK → `auth.users`        | Właściciel (rodzic)                       |
| `title`                    | `text` NOT NULL                 | Krótki tytuł aktywności                   |
| `description`              | `text`                          | Treść / szczegóły (manual lub AI)         |
| `summary`                  | `text`                          | Krótkie podsumowanie AI (FR-003, później) |
| `source_url`               | `text`                          | Link do źródła (FR-002)                   |
| `image_path`               | `text`                          | Ścieżka/klucz obrazu (F-04)               |
| `place`                    | `text`                          | Kryterium miejsca                         |
| `starts_at`                | `timestamptz`                   | Kryterium czasu                           |
| `child_age_years`          | `smallint`                      | Wiek dziecka (lata)                       |
| `location_kind`            | enum `indoor` \| `outdoor`      | Kryterium wewnątrz/na zewnątrz            |
| `origin`                   | enum `ai_suggested` \| `manual` | Metryka „75% z AI”                        |
| `triage_status`            | enum patrz niżej                | FR-005                                    |
| `is_published`             | `boolean` default false         | FR-006 — widoczność publiczna             |
| `published_at`             | `timestamptz` nullable          | Moment publikacji                         |
| `copied_from_event_id`     | `uuid` FK → `events` nullable   | Hook pod FR-009 (v2)                      |
| `created_at`, `updated_at` | `timestamptz`                   | Audyt                                     |

**Enum `event_triage_status`:** `draft`, `pending`, `accepted`, `rejected`, `maybe`.

**Enum `event_origin`:** `ai_suggested`, `manual`.

**Enum `event_location_kind`:** `indoor`, `outdoor`.

**Constraint (CHECK):** `is_published = false OR published_at IS NOT NULL` — spójność publikacji.

**Indeksy:** `(owner_id)`, `(is_published) WHERE is_published`, `(copied_from_event_id) WHERE copied_from_event_id IS NOT NULL`.

## Critical Implementation Details

**RLS SELECT musi być dwuczęściowe:** polityka „właściciel widzi swoje” OR „authenticated widzi wiersze z `is_published = true`”. Jedna polityka z `USING (owner_id = auth.uid() OR is_published)` jest OK; upewnij się, że **nie** ma osobnej polityki SELECT dającej pełny dostęp do `authenticated`.

**INSERT/UPDATE:** `WITH CHECK (owner_id = auth.uid())` — użytkownik nie może przypisać cudzego `owner_id`.

**DELETE:** tylko `owner_id = auth.uid()` — inni nie usuwają opublikowanych cudzych (zgodnie z PRD: właściciel zarządza swoimi).

**Service role:** ten plan nie dodaje polityk dla `service_role`. Testy manualne RLS używają roli `authenticated` (JWT / Studio jako zalogowany użytkownik), nie SQL Editor jako service role (omija RLS). F-02: przy `/10x-plan ai-suggestion-scaffold` potwierdzić JWT vs service role — poza F-01.

## Phase 1: Seed and atomic migration

### Overview

Kolejność: najpierw `seed.sql` (config go wymaga), potem **jedna** migracja ze schematem **i** RLS, potem `db reset`. Ta faza dostarcza kompletny stan DB — bez osobnego deployu „sama tabela”.

### Changes Required:

#### 1. Seed (przed pierwszym `db reset`)

**File:** `supabase/seed.sql`

**Intent:** `config.toml` ma `[db.seed] enabled = true` i `sql_paths = ["./seed.sql"]` — bez pliku `db reset` pada.

**Contract:** Utworzyć plik **przed** pierwszym `npx supabase db reset`; treść: komentarz SQL, brak INSERTów.

#### 2. Migracja atomowa (schema + RLS)

**File:** `supabase/migrations/<YYYYMMDDHHmmss>_events_schema_and_rls.sql`

**Intent:** Jedyny plik migracji F-01 — model wydarzeń i polityki dostępu w jednym deployu.

**Contract — schema:**

- `CREATE TYPE` dla trzech enumów (nazwy jak w Model logiczny).
- `CREATE TABLE public.events (...)` z kolumnami z tabeli kontraktu; `created_at` / `updated_at` z `DEFAULT now()`.
- `REFERENCES auth.users(id) ON DELETE CASCADE` dla `owner_id`.
- `REFERENCES public.events(id) ON DELETE SET NULL` dla `copied_from_event_id`.
- Funkcja + trigger `set_updated_at()` na `BEFORE UPDATE`.
- Komentarz SQL na tabeli (1 linia).

**Contract — RLS (w tym samym pliku, zaraz po `CREATE TABLE`):**

| Operacja | Polityka                         | USING / WITH CHECK                                                     |
| -------- | -------------------------------- | ---------------------------------------------------------------------- |
| SELECT   | `events_select_own_or_published` | `owner_id = auth.uid() OR is_published = true`                         |
| INSERT   | `events_insert_own`              | `WITH CHECK (owner_id = auth.uid())`                                   |
| UPDATE   | `events_update_own`              | `USING (owner_id = auth.uid())` + `WITH CHECK (owner_id = auth.uid())` |
| DELETE   | `events_delete_own`              | `USING (owner_id = auth.uid())`                                        |

- `ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE public.events FORCE ROW LEVEL SECURITY;`
- Polityki `TO authenticated`; **brak** polityk `TO anon`.

### Success Criteria:

#### Automated Verification:

- `supabase/seed.sql` istnieje przed pierwszym resetem
- `npx supabase db reset` — sukces (lokalny stack uruchomiony)
- `npx supabase migration list` — migracja `_events_schema_and_rls` applied

#### Manual Verification:

- W Supabase Studio → Table Editor widać `events` z oczekiwanymi kolumnami
- W Studio → Authentication → Policies: RLS włączone, cztery polityki na `events`

**Implementation Note:** Po fazie 1 — potwierdzenie manualne przed fazą 2 (testy RLS jako `authenticated`).

---

## Phase 2: RLS verification

### Overview

Weryfikacja polityk z migracji atomowej — **bez** drugiego pliku migracji i **bez** `db push` między krokami. Wszystkie testy zapisu/odczytu jako zalogowany użytkownik (JWT), nie service role.

### Changes Required:

Brak nowych plików — tylko manualna weryfikacja zgodnie z tabelą poniżej (Studio z dwoma kontami testowymi, lub tymczasowy skrypt z `createClient` + sesją).

### Success Criteria:

#### Automated Verification:

- (brak — faza wyłącznie manualna)

#### Manual Verification:

Wykonać jako użytkownik A i B (`authenticated`, nie service role):

| #   | Scenariusz                                            | Oczekiwany wynik                               |
| --- | ----------------------------------------------------- | ---------------------------------------------- |
| 1   | A: SELECT własne `is_published = false`               | wiersze widoczne                               |
| 2   | B: SELECT prywatne A (`is_published = false`)         | **0 wierszy**                                  |
| 3   | A: UPDATE `is_published = true`, ustaw `published_at` | sukces                                         |
| 4   | B: SELECT opublikowane A                              | wiersze widoczne (read-only — B nie ma UPDATE) |
| 5   | B: UPDATE wiersz A                                    | błąd / 0 rows                                  |
| 6   | B: DELETE wiersz A                                    | błąd / 0 rows                                  |
| 7   | A: INSERT z `owner_id = B`                            | odrzucone (WITH CHECK)                         |
| 8   | A: INSERT własny wiersz (`owner_id = A`)              | sukces — potwierdza INSERT pod RLS             |

**Implementation Note:** Po scenariuszach 1–8 — przejście do fazy 3.

---

## Phase 3: Generated types and documentation

### Overview

Typy TypeScript z bazy i aktualizacja dokumentacji deweloperskiej.

### Changes Required:

#### 1. Wygenerowane typy

**File:** `src/types/database.generated.ts` (nowy)

**Intent:** Typowany dostęp do `events` w przyszłych slice'ach.

**Contract:**

- Komenda: `npx supabase gen types typescript --local > src/types/database.generated.ts`
- Plik w repo; nie edytować ręcznie (regenerować po migracjach).

#### 2. Barrel typów (zgodność z AGENTS.md)

**File:** `src/types.ts` (nowy)

**Intent:** Wspólny punkt importu `@/types` — re-eksport z generated bez edycji generated.

**Contract:** Eksport `Database`, `Tables`, typ wiersza `events` (np. `export type EventRow = Tables<"events">`).

#### 3. ESLint ignore dla generated

**File:** `eslint.config.js`

**Intent:** `npm run lint` nie failuje na wygenerowanym pliku.

**Contract:** Dodać `src/types/database.generated.ts` do `ignores` w konfiguracji ESLint (preferowane nad `eslint-disable` w generated).

#### 4. README

**File:** `README.md`

**Intent:** Usunąć stwierdzenie „No database tables or migrations”; dodać krótką sekcję migracji.

**Contract:**

- Opis: `supabase/migrations/`, `npx supabase db reset`, `npx supabase gen types …`
- Wzmianka, że RLS chroni `events` — odwołanie do change/planu nie jest wymagane w README.

#### 5. change.md

**File:** `context/changes/event-schema-rls/change.md`

**Intent:** Po implementacji — `in-progress` przez `/10x-implement`.

**Contract:** `updated` = data implementacji.

### Success Criteria:

#### Automated Verification:

- `npx supabase gen types typescript --local` → `src/types/database.generated.ts`
- `npm run lint` (po ignore generated w eslint.config.js)
- `npm run build` (env Supabase jak w CI)

#### Manual Verification:

- Plik `database.generated.ts` zawiera definicję `events` zgodną ze schematem
- `src/types.ts` re-eksportuje typ wiersza `events`
- README odzwierciedla obecność migracji

---

## Testing Strategy

### Unit Tests

Pominięte — brak runnera. Opcjonalnie w przyszłości testy polityk RLS przez `supabase test db` jeśli zespół doda harness.

### Manual Testing Steps

Scenariusze RLS z fazy 2 (tabela 1–8, rola `authenticated`) są obowiązkowe. Dodatkowo:

1. `db reset` na czystym volume — brak błędów migracji.
2. Dwa konta rodzica w Auth — weryfikacja przez klienta JS w Studio lub tymczasowy skrypt — opcjonalnie.

## Performance Considerations

Indeksy `(owner_id)` i partial na `is_published` wystarczą na MVP. Brak full-text na `description` do czasu FR-007 / skali.

## Migration Notes

- **Cloud:** po merge **jednorazowo** `supabase db push` pełnej migracji `_events_schema_and_rls.sql` — **nigdy** schema-only. Do pierwszego push: tylko lokalny `db reset`.
- **Rollback:** nowa migracja `DROP TABLE` tylko jeśli brak danych produkcyjnych; na MVP przed pierwszym deployem danych — akceptowalne `db reset` lokalnie.
- **README był nieaktualny** — aktualizacja w fazie 3.
- **CI:** migracje nie w workflow — `database.generated.ts` musi być commitowany po `gen types`.

## References

- [change.md](./change.md), [plan-brief.md](./plan-brief.md), [plan-review](./reviews/plan-review.md)
- [roadmap F-01](../../foundation/roadmap.md)
- [prd.md](../../foundation/prd.md) — FR-004–006, Access Control, NFR-02
- [prd-v2.md](../../foundation/prd-v2.md) — FR-008/009 (świadomie poza RLS w F-01)
- Klient: [`src/lib/supabase.ts`](../../src/lib/supabase.ts)
- Wzorzec planu: [`context/archive/2026-05-25-app-route-auth-guards/plan.md`](../../archive/2026-05-25-app-route-auth-guards/plan.md)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Seed and atomic migration

#### Automated

- [x] 1.1 `supabase/seed.sql` utworzony przed pierwszym resetem
- [x] 1.2 `npx supabase db reset` — sukces
- [x] 1.3 `npx supabase migration list` — `_events_schema_and_rls` applied

#### Manual

- [x] 1.4 Studio: tabela `events` i kolumny zgodne z kontraktem
- [x] 1.5 Studio: RLS włączone, cztery polityki na `events`

### Phase 2: RLS verification

#### Manual

- [ ] 2.1 Scenariusz RLS 1 — właściciel widzi własne prywatne
- [ ] 2.2 Scenariusz RLS 2 — inny użytkownik nie widzi cudzych prywatnych
- [ ] 2.3 Scenariusz RLS 3–4 — publikacja i odczyt opublikowanych przez innego
- [ ] 2.4 Scenariusz RLS 5–6 — inny nie UPDATE/DELETE cudzego
- [ ] 2.5 Scenariusz RLS 7 — INSERT z cudzym `owner_id` odrzucony
- [ ] 2.6 Scenariusz RLS 8 — INSERT własny pod RLS (`authenticated`) — sukces

### Phase 3: Generated types and documentation

#### Automated

- [ ] 3.1 `npx supabase gen types typescript --local` → `database.generated.ts`
- [ ] 3.2 `eslint.config.js` — ignore `database.generated.ts`
- [ ] 3.3 `npm run lint`
- [ ] 3.4 `npm run build`

#### Manual

- [ ] 3.5 `database.generated.ts` zawiera `events`
- [ ] 3.6 `src/types.ts` re-eksportuje typy `events`
- [ ] 3.7 README opisuje migracje i `gen types`
