# Plan wdrożenia: Vitest runner + critical owner access

## Przegląd

Uruchamiamy Vitest od zera i zamykamy regresje Risk #1 (własna biblioteka accepted/maybe + 401) oraz Risk #3 (cross-owner mutate → 404 `not_found` bez wycieku body) na warstwie unit + integration. Integration woła lib helpers z prawdziwymi JWT A/B (app filter + RLS). Lokalnie da się odpalić pełny pakiet; ostateczna weryfikacja integration trafi do CI z Dockerem w Phase 4 — Phase 1 **nie** wiesza `npm test` w Actions.

## Analiza stanu obecnego

- Test base = **none**: brak Vitest, `npm test`, `*.test.*` (`research.md` + `package.json`).
- Ochrona #1/#3 **istnieje w produkcji** (dual-layer: app `.eq("owner_id")` + RLS); Phase 1 ma ją zablokować przed regresją.
- RLS SELECT obejmuje też cudze `is_published=true` — bez app filtra biblioteka miesza obce published (`list-own-events.ts`, archive my-events-library).
- IDOR deny = **404** `{ error: "not_found" }` — nigdy 403 w obecnym kodzie.
- Suggestions: auth-gate only, nie owner-scoped DB list.
- Fixture pattern: `scripts/verify-event-images-rls.ts` (dwa JWT, bezpośredni Supabase JS).
- CI dziś: lint + build (Node 24); `npm test` w CI = Phase 4.

## Pożądany stan końcowy

- `npm test` uruchamia unit zawsze (zielone bez Dockera).
- `npm run test:integration` (lub równoważny project) uruchamia integration gdy env A/B + lokalny/remote Supabase; bez env → skip, nie fail.
- Unit: `route-access`, cienkie reguły unauth API 401, suggestions `locals.user=null` → 401, `isOwnerPath`/`assertOwnerPath`.
- Integration: owner list (own + empty + **brak** cudzego published) + cross-owner PATCH → `not_found`.
- `context/foundation/test-plan.md` §6.1/§6.2 wypełnione wzorcami; §3 Phase 1 → ścieżka do implementacji.
- Brak wire `npm test` w `.github/workflows/ci.yml` (świadomie Phase 4 + Docker).

### Kluczowe odkrycia:

- `listOwnLibraryEvents` — `.eq("owner_id")` + `.in("triage_status", ["accepted","maybe"])` (`src/lib/events/list-own-events.ts:11-16`)
- Middleware unauth `/api/*` → 401 JSON (`src/middleware.ts:17-24`); handlers re-check `locals.user`
- `updateOwnEvent` — brak wiersza po filtrze → `{ error: "not_found" }` (`src/lib/events/update-own-event.ts:39-52`)
- Path ownership: `isOwnerPath` / `assertOwnerPath` (`src/lib/storage/event-image-path.ts:113-121`)
- Suggestions POST: early 401, potem AI (`src/pages/api/ai/suggestions.ts:13-16`) — nie mylić z listą biblioteki
- Vitest projects (unit vs `*.integration.test.ts`): dokumentacja Vitest, checked **2026-08-13** via Context7 `/vitest-dev/vitest`

## Czego NIE robimy

- Wire `npm test` w GitHub Actions / Docker job (Phase 4)
- Pełne e2e UI / Playwright (interview Q5 / §7)
- Risk #2 privacy/public list (Phase 2)
- AI schema/error taxonomy poza 401 (Phase 3)
- Image signed-URL soft-fail (§3 Phase 4 / Risk #5)
- HTTP spin-up `astro preview` jako główny harness
- Mock całego klienta Supabase w testach #1/#3 integration
- Pełna macierz IDOR na DELETE/publish/image upload (representative: PATCH + path unit)
- service_role „testy”

## Podejście do implementacji

Koszt × sygnał, priorytet ryzyka:

1. Bootstrap runnera (blokuje wszystko).
2. Tanie unit na pure auth/path (zawsze w `npm test`).
3. Integration JWT na #1 (w tym foreign-published leak), potem #3 PATCH.
4. Cookbook §6 jako domknięcie fazy.

Harness: lib + `@supabase/supabase-js` + `signInWithPassword` A/B. Oracle z zachowania ryzyka (research/PRD), nie z kopiowania SQL z produkcyjnego helpera do asercji.

## Krytyczne szczegóły implementacji

- **Czas i cykl życia:** Integration muszą seedować i sprzątać wiersze A/B w `beforeAll`/`afterAll` (lub per-test), żeby nie zanieczyszczać współdzielonej lokalnej DB. `toLibraryEventDto` może wołać storage — seed bez `image_path` albo akceptuj `imageUrl: null` (Risk #5 poza zakresem).
- **Sekwencjonowanie:** Najpierw Vitest + jeden smoke unit, dopiero potem integration zależne od env. Skrypty: `test` = unit (default CI-local), `test:integration` = project integration; `test:all` = oba gdy chcesz pełny lokalny run.
- **Debugowanie:** Gdy integration skipuje, log/jedna linia w dokumencie §6 musi mówić _dlaczego_ (brak env), żeby nie mylić skip z zielonym „przetestowane RLS”.

---

## Faza 1: Vitest bootstrap

### Przegląd

Dodać runner, skrypty, config z projects unit/integration i alias `@/*`. Zero asercji produktowych poza smoke „runner działa”.

### Wymagane zmiany:

#### 1. Zależności i skrypty

**Plik**: `package.json`

**Cel**: Zainstalować Vitest (devDependency) i skrypty uruchomieniowe zgodne z „local full possible / CI authoritative later”.

**Kontrakt**:

- `test` → unit project only (zawsze)
- `test:integration` → integration project
- `test:all` → unit + integration
- Brak zmiany `.github/workflows/ci.yml`

#### 2. Konfiguracja Vitest

**Plik**: `vitest.config.ts` (root)

**Cel**: Node environment, resolve `@/*` → `src/*` (tsconfig paths), dwa projects po nazwie pliku.

**Kontrakt**:

- Project `unit`: include `src/**/*.test.ts`, exclude `**/*.integration.test.ts`
- Project `integration`: include `src/**/*.integration.test.ts`
- `environment: "node"`
- Alias zgodny z `tsconfig.json` `paths["@/*"]`
- Guidance dated 2026-08-13 (Vitest `test.projects` via Context7)

#### 3. Smoke unit

**Plik**: np. `src/lib/route-access.test.ts` (minimal) **albo** osobny `src/lib/vitest-smoke.test.ts` usunięty gdy Faza 2 doda prawdziwe testy

**Cel**: Udowodnić, że `npm test` przechodzi przed właściwymi asercjami.

**Kontrakt**: Co najmniej jeden `expect(true)` / prosty import `@/` — zastępowalny w Fazie 2.

### Meta (bootstrap — nie produkt):

- **Behavior asserted:** Runner startuje; alias działa.
- **Regression caught:** „zapomniano dodać test script / config”.
- **Research source:** `research.md` § Test base; AGENTS „No test runner yet”.
- **Edge:** `npm test` bez Docker/env = sukces (tylko unit).
- **Anti-pattern avoided:** Nie wymagać Supabase do pierwszego zielonego `npm test`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test` exit 0 bez `SUPABASE_*` / user A/B
- `npx vitest --project integration` (lub `npm run test:integration`) startuje; bez env testy skip lub brak plików = nie fail bootstrapu
- `npm run lint` przechodzi na nowych plikach config
- Unit project **nie** uruchamia plików `*.integration.test.ts` (exclude obowiązkowy — `*.integration.test.ts` też matchuje `*.test.ts`)

#### Weryfikacja ręczna:

- Alias `@/` resolvuje się w pliku testowym
- Skrypty `test` / `test:integration` / `test:all` opisane krótko w output lub gotowe pod §6

**Uwaga implementacyjna**: Po Fazie 1 zatrzymaj się na potwierdzenie ręczne przed Fazą 2.

---

## Faza 2: Unit — auth surface (Risk #1 foundation)

### Przegląd

Udowodnić politykę ścieżek i unauth 401 **bez** twierdzenia, że middleware pass ⇒ biblioteka działa. Suggestions: tylko 401 przy braku usera.

### Wymagane zmiany:

#### 1. Unit `route-access`

**Plik**: `src/lib/route-access.test.ts`

**Cel**: Zablokować regresję public vs requiresAuth.

**Kontrakt**:

- `isPublicPath("/")` / `/auth...` / `/api/auth...` → true
- `requiresAuth("/api/events")` → true
- `requiresAuth("/api/ai/suggestions")` → true
- Boundary: `/api/auth` public, `/api/events` protected

#### 2. Cienkie reguły unauth API 401

**Plik**: wyciągnięty pure helper (preferowane) np. `src/lib/unauthenticated-api-guard.ts` używany z `src/middleware.ts`, **albo** równoważny testowalny moduł z tą samą tabelą decyzji — bez pełnego Astro middleware runtime

**Cel**: Udowodnić: brak usera + `/api/*` (nie `/api/auth`) → status 401 + body `{ error: "unauthorized" }`; strony chronione → redirect intent (nie JSON).

**Kontrakt**: Pure function(pathname) → `{ type: "json_401" } | { type: "redirect_signin" } | { type: "allow" }` (kształt do ustalenia przez implementatora, semantyka jak `middleware.ts:17-29`). Middleware deleguje do helpera.

#### 3. Suggestions handler 401-only

**Plik**: `src/pages/api/ai/suggestions.test.ts` (unit, nie integration)

**Cel**: `POST` z `locals.user = null` → 401 `{ error: "unauthorized" }` bez wywołania OpenRouter / generateSuggestions.

**Kontrakt**: Wywołanie eksportowanego `POST` z minimalnym `APIContext` mock (request + locals); brak asercji na suggestions body / schema AI (Phase 3).

**Blokada Vitest (plan-review F1):** Moduł (i transitive `openrouter-client`) importuje `astro:env/server` na top-level — bez tego load pada zanim early-return 401 się wykona. Implementator **musi** albo (a) `vi.mock("astro:env/server")` zanim zaimportuje handler, albo (b) wyciągnąć cienki pure check (np. shared z innymi handlerami) i testować go bez importu Astro route. Nie zakładać, że sam `locals.user=null` wystarczy do zielonego unit testu.

### Meta:

| Pole                 | Treść                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Behavior asserted    | Unauth API → 401 opaque; public paths nie wymagają auth; suggestions early-return 401                               |
| Regression caught    | Middleware/handler przestaje zwracać 401; `/api/events` przypadkiem public; suggestions idzie w AI bez usera        |
| Research source      | `research.md` Risk #1 unauth table; `middleware.ts:17-24`; `suggestions.ts:13-16`; challenge „middleware ⇒ library” |
| Edge/error/boundary  | `/api/auth` vs `/api/events`; empty vs unauthorized rozróżnione później w integration; suggestions bez body AI      |
| Anti-pattern avoided | Happy-path-only auth; traktowanie suggestions jako owner-scoped list; pełny cookie/SSR pipeline                     |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test` zielone; nowe unit przechodzą
- Suggestions test nie wymaga prawdziwych `OPENROUTER_*` (mock `astro:env/server` lub pure extract — F1)

#### Weryfikacja ręczna:

- Helper (jeśli wyciągnięty) jest faktycznie użyty przez middleware — brak rozjazdu „test vs prod”

---

## Faza 3: Unit — path-owner (Risk #3 foundation)

### Przegląd

Tanie unit na ownership segmentu ścieżki storage — uzupełnienie, nie zastępstwo, integration IDOR.

### Wymagane zmiany:

#### 1. Path owner helpers

**Plik**: `src/lib/storage/event-image-path.test.ts`

**Cel**: Udowodnić, że path `{ownerId}/{eventId}/{file}` należy tylko do wskazanego ownera.

**Kontrakt**:

- `isOwnerPath(pathA, ownerA)` → true; `isOwnerPath(pathA, ownerB)` → false
- `assertOwnerPath(pathA, ownerB)` → throw `EventImagePathError`
- Boundary: złamany segment / `..` w filename → `parseEventImagePath` null / not owner

### Meta:

| Pole                 | Treść                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Behavior asserted    | Obcy ownerId w path → deny                                                          |
| Regression caught    | Usunięcie/regresja `assertOwnerPath` przed storage ops                              |
| Research source      | `research.md` Storage path ownership; `event-image-path.ts:113-121`; archive F-04   |
| Edge/error/boundary  | Zła liczba segmentów; filename z `..`                                               |
| Anti-pattern avoided | Mock storage RLS zamiast testu pure path; mylenie path unit z pełnym IDOR event row |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test` obejmuje path tests, exit 0

#### Weryfikacja ręczna:

- Brak zależności od Supabase w tej fazie

---

## Faza 4: Integration — own library (Risk #1)

### Przegląd

Prawdziwe JWT A/B + `listOwnLibraryEvents`. Oracle: zachowanie biblioteki właściciela, nie „SELECT zwrócił cokolwiek”.

### Wymagane zmiany:

#### 1. Integration fixture helper

**Plik**: np. `src/lib/events/__test__/supabase-jwt-fixture.ts` (lub `src/test/integration/supabase-users.ts`)

**Cel**: Współdzielone logowanie A/B jak `verify-event-images-rls.ts`; wykrywanie env; **odblokowanie lokalnego `test:all`**.

**Kontrakt**:

- Env: `SUPABASE_URL`, `SUPABASE_KEY` (anon), `USER_A_EMAIL`, `USER_A_PASSWORD`, `USER_A_ID`, `USER_B_EMAIL`, `USER_B_PASSWORD` (oraz `USER_B_ID` jeśli potrzebne do seed)
- `hasIntegrationEnv()` → boolean; testy `describe.skipIf(!hasIntegrationEnv())`
- Klienci przez `createClient` z `@supabase/supabase-js` + `signInWithPassword` — **nie** SSR `src/lib/supabase` / **nie** mock całego Supabase
- **Seed Auth A/B (plan-review F3):** W tej fazie (albo w §6 przy Fazie 6) musi powstać krótka, powtarzalna instrukcja lokalna — bez haseł w git:
  1. `npx supabase start`
  2. Utwórz dwóch użytkowników Auth (Studio / `auth.users` / CLI) i zapisz email+password+uuid w `.dev.vars` / env (wzór nazw jak wyżej)
  3. Potwierdź logowanie skryptem lub `hasIntegrationEnv()` + smoke sign-in
  - Nie wymaga auto-provision w teście; wymaga **udokumentowanej** ścieżki, żeby „local full possible” nie było puste.
- Dokumentacja: lokalnie powyższy seed; CI Docker = Phase 4 rollout

#### 2. Own library integration tests

**Plik**: `src/lib/events/list-own-events.integration.test.ts`

**Cel**: Zablokować regresje listy właściciela.

**Kontrakt** (asercje zachowania):

1. **Own list:** User A z eventami `accepted`/`maybe` → wynik zawiera tylko je (po `owner_id` A), pola DTO bez cudzych id.
2. **Empty:** A bez accepted/maybe → `{ events: [] }` (nie błąd, nie 401 — to warstwa lib).
3. **Foreign published leak:** Event owned by B z `is_published=true` **oraz** `published_at` NOT NULL (CHECK `events_published_at_consistency`) **oraz** `triage_status ∈ {accepted, maybe}` — żeby po dropnięciu `.eq("owner_id")` przy zachowanym `.in(triage…)` wiersz realnie wyciekł na listę A. RLS SELECT (`owner_id = auth.uid() OR is_published`) **nie** filtruje po triage — triage jest tylko pod oracle regresji app-filter. Asercja: lista A **nie** zawiera id eventu B.
4. **Triage boundary (opcjonalnie tanie):** rejected A nie trafia na listę A.
5. Cleanup seed po teście.

**Nie asertować:** UI `EventsLibraryPage`; suggestions body; public shared list (Risk #2).

### Meta:

| Pole                 | Treść                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Behavior asserted    | Owner widzi własne accepted/maybe; empty = `[]`; cudzy published nie w own list                                              |
| Regression caught    | Drop `.eq("owner_id")`; drop triage `.in(...)`; RLS-only „library”                                                           |
| Research source      | `research.md` Risk #1 call chain + foreign published; `list-own-events.ts:11-16`; archive my-events-library                  |
| Edge/error/boundary  | Empty vs unauth (unauth = Faza 2); foreign published + `published_at`; rejected excluded                                     |
| Anti-pattern avoided | Happy-path-only; mock klienta kasujący RLS; „middleware pass ⇒ list OK”; conflating suggestions; mylenie triage z RLS SELECT |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Bez env: `npm test` / integration project → skip, exit 0
- Z env + seed: `npm run test:integration` — trzy główne przypadki zielone
- `npm run test:all` lokalnie z Docker/supabase działa

#### Weryfikacja ręczna:

- Ręczne potwierdzenie, że seed foreign published faktycznie istnieje w DB (inaczej test fałszywie zielony)
- Brak mocka `from("events")` w tych plikach
- Instrukcja Auth A/B wykonana raz lokalnie → `npm run test:integration` nie skipuje z powodu braku userów

---

## Faza 5: Integration — IDOR mutate (Risk #3)

### Przegląd

Session A na event id B → `updateOwnEvent` zwraca `{ error: "not_found" }`; brak DTO event w wyniku. Representative surface; publish/DELETE tylko jeśli tani clone wzorca.

### Wymagane zmiany:

#### 1. Cross-owner PATCH integration

**Plik**: `src/lib/events/update-own-event.integration.test.ts`

**Cel**: Udowodnić IDOR deny na mutate.

**Kontrakt**:

- Seed event owned by B
- `updateOwnEvent(clientA, ownerIdA, eventIdB, minimalPatch)` → `{ error: "not_found" }`
- Wynik **nie** zawiera `event` / title/summary B
- Opcjonalnie: A aktualizuje własny event → sukces (jeden happy path jako kontrast, nie jedyny test)
- **Nie** expectować 403
- Mapping HTTP 404 jest w handlerze — przy lib harness asercja na `not_found`; opcjonalny cienki unit mapowania w handlerze tylko jeśli tani i bez DB

#### 2. (Opcjonalnie, ten sam PR jeśli <~15 min) DELETE lub publish

**Plik**: analogiczny `*.integration.test.ts` **albo** jeden `describe` współdzielący seed

**Cel**: Ten sam wzorzec `.eq("owner_id")` → `not_found`. Pominąć, jeśli fixture kosztowny — zanotować w §6.6 jako deferred do Phase 2.

### Meta:

| Pole                 | Treść                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Behavior asserted    | Sesja A + id B → `not_found`; brak body event                                                   |
| Regression caught    | Drop `.eq("owner_id")` na update; test mockujący „zawsze row”                                   |
| Research source      | `research.md` Risk #3 table; `update-own-event.ts:39-52`; challenge „wystarczy być zalogowanym” |
| Edge/error/boundary  | 404-not-403; opaque error; own update nadal działa                                              |
| Anti-pattern avoided | Mock całego Supabase; expect 403; tylko happy-path logged-in                                    |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Integration z env: cross-owner → `not_found`
- Unit path z Fazy 3 nadal zielone
- `npm test` (unit-only) nie wymaga tego pliku do przejścia

#### Weryfikacja ręczna:

- Potwierdzenie, że event B nadal istnieje po deny (brak delete side-effect na cross-owner PATCH)

---

## Faza 6: Cookbook §6 + status sync

### Przegląd

Wypełnić `test-plan.md` §6 wzorcami z tej fazy; zaktualizować status Phase 1 po implementacji (tu: przygotować treść; orchestrator/`/10x-implement` domyka status).

### Wymagane zmiany:

#### 1. §6.1 Unit pattern

**Plik**: `context/foundation/test-plan.md` (§6.1)

**Cel**: Opisać jak dodać unit: colocated `*.test.ts`, pure helpers, suggestions 401 pattern, path-owner, bez mockania Supabase „na zapas”.

**Kontrakt**: Zastąpić TBD konkretnymi 4–8 bulletami + przykładowe ścieżki plików z Faz 2–3.

#### 2. §6.2 Integration pattern

**Plik**: `context/foundation/test-plan.md` (§6.2)

**Cel**: Env contract, `skipIf`, `*.integration.test.ts`, lib+JWT, anti-pattern „mock whole client”, local `test:all` vs CI Docker (Phase 4) jako authoritative, **oraz kroki seed Auth A/B** (F3).

**Kontrakt**: Zastąpić TBD; wzmianka o foreign-published (`published_at` + triage) i IDOR `not_found` (nie 403); checklista lokalnego seedu userów.

#### 3. §6.6 notes + §3 status (przy domknięciu implementacji)

**Plik**: `context/foundation/test-plan.md`

**Cel**: Krótka nota Phase 1 shipped; Status → `complete` dopiero gdy Progress planu w pełni `[x]` (robi `/10x-implement` / latch). W tej fazie planu: treść cookbook gotowa do wklejenia przy implementacji.

**Kontrakt**: Nie dodawać file:line anchors do §2 Risk Map.

### Meta:

| Pole              | Treść                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Behavior asserted | Nowy contributor wie jak dodać unit/integration zgodny z Phase 1 |
| Regression caught | Powrót do TBD / sprzeczne wskazówki (np. expect 403)             |
| Research source   | Decyzje planu + `research.md` corrections                        |
| Edge              | Local skip vs CI force (Phase 4)                                 |
| Anti-pattern      | Kotwice plików w §2; e2e „bo pewniej”                            |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `test -f` plan + brief; markdown §6.1/§6.2 nie zawiera „TBD — see §3 Phase 1” po implementacji tej fazy

#### Weryfikacja ręczna:

- Przeczytanie §6 pod kątem zgodności z faktycznymi skryptami `package.json`

---

## Strategia testowania

### Testy jednostkowe:

- `route-access` public/protected matrix
- Unauth API guard decision table
- Suggestions POST `locals.user=null` → 401
- `isOwnerPath` / `assertOwnerPath`

### Testy integracyjne:

- `listOwnLibraryEvents`: own / empty / foreign published excluded
- `updateOwnEvent`: A→B `not_found`
- Gate: `skipIf(!hasIntegrationEnv())`

### Kroki testowania ręcznego:

1. `npm test` bez Supabase → zielone
2. `supabase start` + seed A/B → `npm run test:all` → zielone
3. Świadomie: brak mocka całego klienta w integration
4. Potwierdź, że CI workflow **nie** dostał jeszcze `npm test`

## Uwagi dotyczące wydajności

Integration powinny być nieliczne i izolowane; nie pełny scan tabel. Seed minimalny (1–3 wiersze). Unit project bez isolate overhead jeśli Vitest projects na to pozwalają — opcjonalna optymalizacja, nie wymóg.

## Uwagi dotyczące migracji

Brak migracji schematu. Wymagane **dane seed** (Auth users A/B) lokalnie — instrukcja w Fazie 4 / §6 (hasła tylko w `.dev.vars` / env, nie w git). Bez tej instrukcji integration pozostaje skip-only.

## Referencje

- Badania: `context/changes/testing-runner-critical-owner-access/research.md`
- Test plan: `context/foundation/test-plan.md` §2 #1/#3, §3 Phase 1
- Fixture: `scripts/verify-event-images-rls.ts`
- Vitest projects: Context7 `/vitest-dev/vitest`, checked 2026-08-13
- Archive: `2026-07-24-my-events-library`, `2026-05-25-app-route-auth-guards`, `2026-06-22-event-image-storage`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Vitest bootstrap

#### Automatyczne

- [x] 1.1 `npm test` exit 0 bez env Supabase/user A/B — 759e7fc
- [x] 1.2 `npm run test:integration` startuje bez fail bootstrapu (skip lub empty) — 759e7fc
- [x] 1.3 Lint przechodzi na `vitest.config.ts` / `package.json` — 759e7fc
- [x] 1.4 Unit project nie uruchamia `*.integration.test.ts` — 759e7fc

#### Ręczne

- [x] 1.5 Alias `@/` działa w pliku testowym; skrypty test/test:integration/test:all zrozumiałe — 759e7fc

### Faza 2: Unit — auth surface

#### Automatyczne

- [x] 2.1 Unit `route-access` przechodzi (public vs `/api/events`) — 9ba1e16
- [x] 2.2 Unauth API guard → 401 `{ error: "unauthorized" }` dla chronionego `/api/*` — 9ba1e16
- [x] 2.3 Suggestions `locals.user=null` → 401 bez OpenRouter (z `vi.mock("astro:env/server")` lub pure extract) — 9ba1e16

#### Ręczne

- [x] 2.4 Helper unauth (jeśli wyciągnięty) jest użyty przez middleware — 9ba1e16

### Faza 3: Unit — path-owner

#### Automatyczne

- [x] 3.1 `isOwnerPath` / `assertOwnerPath` unit przechodzi (A vs B, throw na mismatch) — 7836928

#### Ręczne

- [x] 3.2 Brak zależności od Supabase w path tests — 7836928

### Faza 4: Integration — own library

#### Automatyczne

- [x] 4.1 Bez env: integration skip, exit 0 — 03fcc1b
- [x] 4.2 Z env: own accepted/maybe list poprawna dla A — 03fcc1b
- [x] 4.3 Z env: empty → `{ events: [] }` — 03fcc1b
- [x] 4.4 Z env: cudzy published B nie na liście A — 03fcc1b

#### Ręczne

- [x] 4.5 Seed foreign published ma `published_at` + triage accepted/maybe; brak wholesale Supabase mock — 03fcc1b
- [x] 4.6 Instrukcja seed Auth A/B (supabase start + dwóch userów + env) istnieje i działa lokalnie — 03fcc1b

### Faza 5: Integration — IDOR mutate

#### Automatyczne

- [x] 5.1 Z env: `updateOwnEvent(A, idB)` → `{ error: "not_found" }` bez body event — f0797f5
- [x] 5.2 Unit-only `npm test` nadal zielone bez env — f0797f5

#### Ręczne

- [x] 5.3 Event B nadal istnieje po cross-owner deny — f0797f5

### Faza 6: Cookbook §6 + status sync

#### Automatyczne

- [x] 6.1 §6.1 i §6.2 nie są TBD Phase 1 — 9a340d8
- [x] 6.2 Skrypty w §6 zgodne z `package.json` — 9a340d8

#### Ręczne

- [x] 6.3 Krótki przegląd cookbook pod kątem „local full / CI Docker later” — 9a340d8
