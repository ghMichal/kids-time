# Plan wdrożenia: AI path contracts (suggestions / summary)

## Przegląd

Phase 3 zamyka Risk #4: zły kształt odpowiedzi AI albo zła mapa błędu nie może wyglądać na sukces, a create manual nie może zależeć od OpenRouter. Warstwa to **unit (Zod + klient)** plus **cienki contract HTTP** na obu routach AI i na `POST /api/events`. Bez live OpenRouter, bez JWT integration, bez e2e UI.

## Analiza stanu obecnego

- Phase 1/2 shipped: Vitest `unit` / `integration`, cookbook §6.1/§6.2. Jedyny test AI to `src/pages/api/ai/suggestions.test.ts` — **401-only**.
- Produkcja ma taksonomię `OpenRouterErrorCode` (`configuration` | `upstream` | `timeout` | `invalid_response`) i dwustopniowy Zod w `openrouter-client`. Testy tego nie blokują.
- Switch HTTP (503/504/502) jest **skopiowany 1:1** w `suggestions.ts` i `event-summary.ts`. UI mapuje wyłącznie `response.status`, nigdy `body.error`.
- `POST /api/events` nie importuje `@/lib/ai`; `summary` jest opcjonalne. Generate to osobny `POST /api/ai/event-summary`.
- Prompt (3–5 / ~10 słów / Wikipedia / polski) **rozjeżdża się** z Zod (1–5 / 100 znaków / dowolny `z.url()`). To jest anty-wyrocznia.
- `astro:env/server` to statyczny import — jeden `vi.mock` z literałem nie przełączy „klucz jest / klucza brak” bez getterów albo osobnego pliku.

## Pożądany stan końcowy

- `npm test` (unit) dowodzi:
  - Zod odrzuca zły kształt i przyjmuje 1 element / 1–200 znaków (wbrew promptowi 3–5);
  - OpenRouter HTTP 200 + śmieci → `invalid_response`; `TimeoutError` → `timeout`; `!ok` (w tym zły klucz) → `upstream`; brak env → `configuration`;
  - obie routy AI mapują kody na 503/504/502 + `{ error: "<code>" }`; brak env → 503 **bez** `generate*`;
  - `event-summary` unauth → 401 `{ error: "unauthorized" }` bez wywołania AI;
  - `manualEventCreateSchema` akceptuje brak/`null`/`""` summary; `POST /api/events` nie woła `generateEventSummary`.
- `suggestions.test.ts` 401 **nietknięty** (nie litigujemy Phase 1).
- `test-plan.md` §6.3 wypełnione; §3 Phase 3 → `complete` gdy Progress w pełni `[x]`.
- Brak jsdom, live modelu, CI Docker (Phase 4).

### Kluczowe odkrycia:

- Discriminant: `OpenRouterErrorCode` w `src/lib/ai/openrouter-client.ts:22-31`; timeout **tylko** `DOMException` + `name === "TimeoutError"` (`:75-79`)
- Dwustopniowy Zod: `fromModel` potem product schema (`:114-124`, `:134-141`)
- Product vs prompt: `suggestionResponseSchema` `min(1).max(5)`, title ≤100, summary ≤200 (`suggestion-response.schema.ts:3-20`); prompt mówi 3–5 / ~10 słów
- Route short-circuit: brak `OPENROUTER_API_KEY` lub `OPENROUTER_MODEL` → 503 `{ error: "configuration" }` **zanim** `generate*` (`suggestions.ts:35-37`, `event-summary.ts:36-38`)
- Provider `!ok` → `upstream`, status dostawcy **odrzucony** (`openrouter-client.ts:84-86`) — ustawiony-ale-zły klucz to **502**, nie 503/401
- Create: `src/pages/api/events/index.ts:31-67` importuje tylko `createManualEvent`; schema `optionalSummarySchema` (`manual-event-create.schema.ts:3-18`)
- Wzorzec mocka routy: `vi.mock("astro:env/server")` + hoisted `generate*` + mock `OpenRouterError` (`suggestions.test.ts:4-22`)
- Vitest `vi.hoisted` / `vi.mock` / `vi.stubGlobal`: Context7 `/vitest-dev/vitest`, checked **2026-08-19**

## Czego NIE robimy

- Re-bootstrap Vitest / zmiana `vitest.config.ts` / nowych skryptów npm
- Wire `npm test` w CI / Docker (Phase 4)
- Live OpenRouter, smoke `scripts/smoke-openrouter.ts`, JWT integration
- e2e UI / jsdom / RTL / Playwright (interview Q5 / §7)
- Ekstrakcja produkcyjna wspólnego switcha HTTP (tests-only; macierz na obu routach)
- Rozszerzanie `suggestions.test.ts` poza istniejący 401
- Ponowne testowanie suggestions 401 jako nowej macierzy
- `requiresAuth("/api/ai/event-summary")` (prefix `/api/` już wymaga auth; nie rdzeń #4)
- Asercje z promptu: 3–5 kart, ~10 słów, `pl.wikipedia.org`, „po polsku”, snapshot `build-*-prompt.ts`
- Quality oracle na API 200 (kształt ≠ dobre summary)
- Extract `mapApiError` / snapshot Polish UI copy
- Stale cards na error (S-01 F5) — UX, nie najtańszy sygnał Phase 3
- `prerender = false` cleanup na suggestions
- Rate-limit / koszt OpenRouter (test-plan §7)
- Kotwice `file:line` w §2 Risk Map; backport „brak klucza” → `configuration` odkładamy na `--refresh`
- Risk #5 signed-URL (Phase 4)

## Podejście do implementacji

Koszt × sygnał, priorytet ryzyka:

1. Zod response schemas — najtańsza wyrocznia „zły JSON”; niezależna od fetch.
2. `openrouter-client` + stub `fetch` — origin taksonomii (200+garbage, timeout, upstream, configuration).
3. Cienki contract obu rout — HTTP, z którego UI czyta status; 401 event-summary.
4. Create ⊥ AI — schema + spy, że Save nie woła Generate.
5. Cookbook §6.3.

Oracle: HTTP status + `{ error: "<code>" }` albo `safeParse` na fixture JSON. Mock **na krawędzi**: `astro:env` dla każdego importu; `generate*` gdy testujemy routę; `vi.stubGlobal("fetch")` gdy testujemy klienta. Nigdy wholesale Supabase. Nigdy live model.

## Krytyczne szczegóły implementacji

- **Czas i cykl życia:** `vi.stubGlobal("fetch")` musi wrócić w `afterEach` (`vi.unstubAllGlobals()` + `mockReset`). Nie czekaj 25s na `AbortSignal.timeout` — rzuć `DOMException` z `name === "TimeoutError"` z mocka `fetch`. Inny throw (np. `TypeError`) to `upstream`, nie `timeout`.
- **Sekwencjonowanie:** Najpierw schematy (zero env/fetch), potem klient, potem routy (reuse mock class `OpenRouterError` z factory — `instanceof` w handlerze widzi **tę** klasę, nie produkcyjną). Create ⊥ AI nie zależy od Faz 2–3, ale idzie po contractach, bo to druga połowa Risk #4.
- **Env live bindings:** `import { OPENROUTER_API_KEY } from "astro:env/server"` jest statyczny. W plikach, które potrzebują **i** obecnego klucza **i** pustego env, użyj `vi.hoisted` + **getterów** na mocku (mutowalny obiekt), nie dwóch sprzecznych `vi.mock` literałów. Guidance dated 2026-08-19 (Vitest `vi.hoisted` / `vi.mock` factory via Context7 `/vitest-dev/vitest`). Nie włączaj `unstubGlobals: true` w `vitest.config.ts`.

---

## Faza 1: Unit — Zod response schemas (Risk #4 gate)

### Przegląd

Zablokować bramkę kształtu niezależnie od OpenRouter i HTTP. Wyrocznia = schema, nie prompt. Jeden przypadek **accept wbrew promptowi** (1 karta / dowolny poprawny URL).

### Wymagane zmiany:

#### 1. Suggestion response schema

**Plik**: `src/lib/ai/suggestion-response.schema.test.ts`

**Cel**: Lock `suggestionResponseFromModelSchema` vs `suggestionResponseSchema` — zły JSON odpada zanim stanie się API 200.

**Kontrakt**:

- Reject product schema: `suggestions: []`; 6 elementów; brak `title`/`summary`; `title` 101 znaków; `summary` 201; `sourceUrl` nie-URL
- Accept product: **1** element (prompt mówi 3–5); `sourceUrl: ""` → omitted; `sourceUrl` HTTPS **nie** z `pl.wikipedia.org`
- fromModel może przyjąć surowy string bez max length; product wtedy fail — to jest dwustopniowość, nie bug testu
- Brak expect na `openRouterJsonSchema.description` / Wikipedia

#### 2. Event summary response schema

**Plik**: `src/lib/ai/event-summary-response.schema.test.ts`

**Cel**: Lock `{ summary }` 1–200 po trim; puste / za długie nie przechodzi.

**Kontrakt**:

- Reject: `summary` missing / non-string / `""` / same whitespace-only po trim / 201 znaków
- Accept: 1 znak po trim; 200 znaków; leading/trailing space → trimmed
- Nie assertować języka, liczby zdań ani „konkretności”

### Meta:

| Pole                 | Treść                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Behavior asserted    | Zły kształt pada na Zod; 1–5 kart i summary 1–200 są legalne; pusty `sourceUrl` znika               |
| Regression caught    | Poluzowanie min/max; przyjęcie pustego summary; URL-refine wyłączony; pomyłka 3–5 z promptu         |
| Research source      | `research.md` §3 Zod + §8 prompt anti-oracle; `suggestion-response.schema.ts`; event-summary schema |
| Edge/error/boundary  | 0 i 6 elementów; 100 vs 101 title; 200 vs 201 summary; empty URL → omitted                          |
| Anti-pattern avoided | Asercja skopiowana z promptu (3–5, ~10 słów, Wikipedia, Polish copy); snapshot json_schema          |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Oba pliki `*.schema.test.ts` failują na pustym / za długim / 6 kartach i przechodzą na 1 karcie / 1–200 summary
- `npm test` exit 0 bez `OPENROUTER_*` live i bez Docker

#### Weryfikacja ręczna:

- W testach nie ma `toMatch(/rodzic/)`, `pl.wikipedia`, ani cytatu „Podaj od 3 do 5”

**Uwaga implementacyjna**: Po Fazie 1 zatrzymaj się na potwierdzenie ręczne przed Fazą 2.

---

## Faza 2: Unit — openrouter-client taxonomy

### Przegląd

Zablokować origin kodów błędów przy stubowanym `fetch`. OpenRouter HTTP 200 **nie** jest sukcesem, dopóki envelope + content JSON + dwa Zod nie przejdą. Ustawiony-ale-zły klucz to `upstream`, nie `configuration`.

### Wymagane zmiany:

#### 1. Client unit + stub fetch

**Plik**: `src/lib/ai/openrouter-client.test.ts`

**Cel**: Lock taksonomii w kliencie — jedyne miejsce, które widzi `fetch` / timeout / envelope.

**Kontrakt**:

- `vi.mock("astro:env/server")` z getterami (obecny klucz domyślnie)
- `vi.stubGlobal("fetch", fetchMock)` w `beforeEach`; `vi.unstubAllGlobals()` w `afterEach`
- **Nie** mockować `@/lib/ai/openrouter-client` (to SUT) ani schematów
- `fetch` reject `DOMException("TimeoutError")` → `OpenRouterError` code `"timeout"`
- `fetch` reject inny błąd (np. `TypeError`) → `"upstream"` (`"Failed to reach OpenRouter."`)
- `Response` `ok: false` (401/400/429/500 — wystarczy jeden 401 jako „zły klucz”) → `"upstream"` (`"OpenRouter request failed."`); **nie** `"configuration"`
- HTTP 200, body nie-JSON → `"invalid_response"`
- HTTP 200, JSON bez `choices[0].message.content` / pusty content → `"invalid_response"`
- HTTP 200, `content` nie-JSON → `"invalid_response"`
- HTTP 200, content JSON fail fromModel → `"invalid_response"` (`"…expected shape."`)
- HTTP 200, fromModel OK, product Zod fail (np. title 101 / summary 201 / 0 kart jeśli fromModel by przepuścił — użyj przypadku, który **realnie** rozdziela warstwy) → `"invalid_response"` (`"Suggestions failed validation."` / `"Event summary failed validation."`)
- HTTP 200, 1 legalna karta (lub summary 1–200) → resolved shape; **nie** oceniaj jakości tekstu
- Pusty env (gettery → `""`) → `"configuration"` **zanim** `fetch` (expect `fetchMock`).not.toHaveBeenCalled()
- Pokryj **obie** funkcje cienko: `generateSuggestions` i `generateEventSummary` dla invalid_response + jeden wspólny timeout/upstream (shared `requestChatCompletionContent`)
- Fixture request: minimalne `place/time/childAge/indoorOutdoor` oraz `{ title: "…" }` — nie kopiuj system promptu
- Nie assertuj `Authorization` / `response_format` jako dowodu Risk #4

### Meta:

| Pole                 | Treść                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Behavior asserted    | 200+garbage → `invalid_response`; TimeoutError → `timeout`; `!ok` → `upstream`; brak env → `configuration` |
| Regression caught    | Traktowanie OpenRouter 200 jako sukcesu; każdy abort jako 504; zły klucz jako 503; wyciek body dostawcy    |
| Research source      | `research.md` §2 taxonomy + §4 challenge 200; `openrouter-client.ts:53-145`                                |
| Edge/error/boundary  | TimeoutError vs inny throw; empty choices; content nie-JSON; fromModel OK / product fail; env pusty        |
| Anti-pattern avoided | Live fetch; mock całego klienta; oracle z promptu; czekanie 25s na timeout                                 |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Timeout / upstream / invalid_response / configuration asercje zielone na stubowanym `fetch`
- Zły klucz (`!ok`) nie jest `configuration`
- `npm test` bez sieci do OpenRouter

#### Weryfikacja ręczna:

- Żaden test nie woła prawdziwego URL-a; `afterEach` restoring globals

---

## Faza 3: Contract — AI route HTTP map

### Przegląd

Zablokować kontrakt, z którego UI czyta **status**. Ta sama macierz na suggestions **i** event-summary. Dodać 401 twin dla summary. Nie ruszać istniejącego 401 suggestions.

### Wymagane zmiany:

#### 1. Suggestions error/contract sibling

**Plik**: `src/pages/api/ai/suggestions.contract.test.ts` (nowy; **nie** edytować `suggestions.test.ts`)

**Cel**: Authenticated POST mapuje `OpenRouterError` → HTTP + `{ error, message }`; pusty env → 503 bez `generateSuggestions`.

**Kontrakt**:

- Ten sam przepis mocka co 401 (`astro:env` getters, hoisted `generateSuggestions` + `OpenRouterError` class, mock `enrichSuggestionImages`)
- `locals.user` truthy; `Content-Type: application/json`; body spełnia `suggestionRequestSchema` (`place`, `time`, `childAge`, `indoorOutdoor`)
- `generateSuggestions.mockRejectedValue(new OpenRouterError("configuration", "…"))` → 503 `{ error: "configuration" }`
- `"timeout"` → 504 `{ error: "timeout" }`
- `"upstream"` → 502 `{ error: "upstream" }`
- `"invalid_response"` → 502 `{ error: "invalid_response" }`
- Env gettery puste → 503 `{ error: "configuration" }`, `generateSuggestions` **not** called (krótki komunikat routy `"OpenRouter is not configured."`)
- Oracle: `status` + `error` code; `message` opcjonalnie tam, gdzie route je ustawia — **nie** Polish UI
- Nie dodawać 401 (już w `suggestions.test.ts`)
- Nie testować 400 content-type/json/validation jako rdzenia #4

#### 2. Event-summary 401 + ta sama macierz

**Plik**: `src/pages/api/ai/event-summary.test.ts`

**Cel**: Domknąć bliźniaka: 401 bez AI oraz HTTP map + pusty env.

**Kontrakt**:

- Analogiczny mock: `generateEventSummary` + `OpenRouterError`; **brak** enrichera
- `locals.user = null` → 401 `{ error: "unauthorized" }`; `generateEventSummary` not called
- User + valid `{ title }` (schema `.strict()` — bez extra pól) + macierz kodów jak wyżej
- Pusty env → 503, generate not called
- Body `.strict()`: nie wciskać pól spoza schematu w happy fixture

### Meta:

| Pole                 | Treść                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Behavior asserted    | `configuration`→503, `timeout`→504, `upstream`/`invalid_response`→502; brak env bez generate; summary 401 |
| Regression caught    | Rozjazd switchy między routami; 503 przy ustawionym kluczu (to ma być 502 z `upstream`); 401 woła AI      |
| Research source      | `research.md` §2 tabela + duplicated switch; `suggestions.ts:43-56`; `event-summary.ts:44-54`             |
| Edge/error/boundary  | 502 upstream vs 502 invalid_response (różny `error` string, ten sam status); env short-circuit            |
| Anti-pattern avoided | Ekstrakcja produkcyjnego mappera; litigowanie suggestions 401; snapshot Polish `mapApiError`              |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `suggestions.test.ts` nadal tylko 401; nowy sibling pokrywa macierz
- `event-summary.test.ts`: 401 + macierz 503/504/502 + pusty env
- `npm test` zielone

#### Weryfikacja ręczna:

- `instanceof OpenRouterError` używa klasy z mock factory (nie importu produkcyjnego obok mocka)

---

## Faza 4: Contract — create manual ⊥ AI

### Przegląd

Udowodnić, że Save nie zależy od Generate: schema dopuszcza brak summary, a `POST /api/events` nie woła `generateEventSummary`.

### Wymagane zmiany:

#### 1. Optional summary schema

**Plik**: `src/lib/events/manual-event-create.schema.test.ts`

**Cel**: Lock, że wydarzenie manualne jest poprawne bez AI summary.

**Kontrakt**:

- Bazowy obiekt z `title` (wymagane); `summary` omitted / `null` / `""` → success; `""` i whitespace → `null`
- Nie testować pełnej macierzy title/place — to nie Risk #4
- Nie importować `@/lib/ai`

#### 2. POST /api/events nie woła AI

**Plik**: `src/pages/api/events/index.test.ts`

**Cel**: Gdy ktoś podepnie Generate pod Save, spy padnie. Handler nie importuje AI dziś — mock modułu i tak łapie przyszły import.

**Kontrakt**:

- `vi.mock("@/lib/events/create-manual-event")` + `vi.mock("@/lib/supabase")` (`createClient` → truthy stub, żeby nie dostać 503 `configuration` z pustego klienta)
- `vi.mock("@/lib/ai/openrouter-client")` z `generateEventSummary` (i ewentualnie `generateSuggestions`) jako `vi.fn()`
- Authenticated POST, JSON `{ title: "…" }` (bez summary)
- `createManualEvent` called; `generateEventSummary` **not** called
- Status **201** z `{ event }` ze stuba create (nie twierdź o jakości DTO / `origin`)
- Nie wołać prawdziwego Supabase / JWT

### Meta:

| Pole                 | Treść                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Behavior asserted    | Summary opcjonalne na schemacie; create HTTP nie woła `generateEventSummary`; 201 bez AI      |
| Regression caught    | Save czeka na Generate; wymagane summary; import AI na ścieżce persist                        |
| Research source      | `research.md` §5; archive S-03; `events/index.ts:31-67`; `manual-event-create.schema.ts:3-23` |
| Edge/error/boundary  | omitted vs `null` vs `""`; 201 nie 200; stub supabase żeby nie mylić 503 create z 503 AI      |
| Anti-pattern avoided | e2e Generate+Save; JWT insert; mock „całego świata” poza krawędzią createClient/createManual  |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Schema: trzy warianty summary przechodzą
- POST: `generateEventSummary` not called, status 201
- `npm test` bez env A/B

#### Weryfikacja ręczna:

- Test nie importuje `ManualEventForm` / nie klika Generate

---

## Faza 5: Cookbook §6.3 + status sync

### Przegląd

Wypełnić `test-plan.md` §6.3 wzorcami z Faz 1–4; nota §6.6; §3 Phase 3 → `complete` gdy Progress full.

### Wymagane zmiany:

#### 1. §6.3 AI contracts

**Plik**: `context/foundation/test-plan.md` (§6.3)

**Cel**: Zastąpić „TBD — see §3 Phase 3” konkretnymi bulletami, żeby kolejny test AI nie kopiował promptu ani nie wołał live modelu.

**Kontrakt** (treść do wklejenia przy implementacji):

- Colocate `src/lib/ai/*.test.ts` i `src/pages/api/ai/*.test.ts` (Vitest `unit`). Contract = cienki unit HTTP, nie osobny project.
- Oracle: `status` + `{ error: "<code>" }` albo Zod `safeParse` na fixture. Kody: `configuration` 503, `timeout` 504, `upstream` / `invalid_response` 502. Nie `missing_key` / `invalid_request`.
- Mock na krawędzi: `vi.mock("astro:env/server")` **z getterami**, jeśli plik przełącza klucz obecny vs pusty; `vi.mock` `generate*` + ta sama klasa `OpenRouterError` gdy testujesz routę; `vi.stubGlobal("fetch")` gdy testujesz `openrouter-client`. Restore globals w `afterEach`.
- Challenge 200: OpenRouter 200 + śmieci → `invalid_response`; nasz API 200 = kształt Zod, nie jakość. Accept 1 karty / 1–200 znaków **wbrew** promptowi 3–5.
- Create ⊥ AI: `manualEventCreateSchema` optional summary; `POST /api/events` spy `generateEventSummary` not called. Generate ≠ Save.
- Suggestions 401 zostaje w `suggestions.test.ts` — nie duplikować. Event-summary 401 w `event-summary.test.ts`.
- Anti-patterns: asercja z promptu; live OpenRouter; e2e UI; extract mappera „żeby testować raz”; Polish `mapApiError`; zły klucz jako 503.
- Przykłady: `suggestion-response.schema.test.ts`, `event-summary-response.schema.test.ts`, `openrouter-client.test.ts`, `suggestions.contract.test.ts`, `event-summary.test.ts`, `manual-event-create.schema.test.ts`, `pages/api/events/index.test.ts`.

#### 2. §6.6 notes + §3 status latch

**Plik**: `context/foundation/test-plan.md`

**Cel**: Krótka nota Phase 3 shipped; Status → `complete` dopiero gdy Progress w pełni `[x]`.

**Kontrakt**: Nie dodawać file:line do §2. Nie zmieniać §1–§5 poza Status/Change-folder i cookbook §6. Nie backportować „brak klucza” w §2 ( `--refresh`).

### Meta:

| Pole              | Treść                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| Behavior asserted | Contributor wie jak dodać test AI: schema, taxonomy, HTTP map, create ⊥ AI |
| Regression caught | Powrót do TBD §6.3 / live model / prompt-oracle w kolejnym teście          |
| Research source   | Decyzje planu + `research.md` §7/§10                                       |
| Edge              | Unit vs „contract” to ten sam project `unit`; CI nadal Phase 4             |
| Anti-pattern      | Kotwice w §2; e2e „to be safer”; zmiana strategy §1–§5                     |

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- §6.3 nie zawiera „TBD — see §3 Phase 3”
- Pliki test z Faz 1–4 istnieją

#### Weryfikacja ręczna:

- Cookbook zgadza się z faktycznymi asercjami (1 karta, TimeoutError-only, 502 upstream dla złego klucza, create spy)

---

## Strategia testowania

### Testy jednostkowe:

- Zod product + fromModel (Faza 1)
- `openrouter-client` + stub `fetch` (Faza 2)
- `manualEventCreateSchema` optional summary (Faza 4)

### Testy kontraktowe (unit HTTP, ten sam project `unit`):

- Suggestions: macierz błędów + pusty env (Faza 3); 401 już Phase 1
- Event-summary: 401 + macierz + pusty env (Faza 3)
- `POST /api/events`: generate not called (Faza 4)

### Testy integracyjne:

- Brak w Phase 3. Nie dodawać JWT / live OpenRouter.

### Kroki testowania ręcznego:

1. `npm test` bez `OPENROUTER_API_KEY` produkcyjnego → zielone
2. Świadomie: brak `*.test.tsx`, brak `test:integration` dla tych plików
3. Potwierdź, że `suggestions.test.ts` nadal jest 401-only
4. CI nadal bez Docker `npm test` (Phase 4)

## Uwagi dotyczące wydajności

Zero sieci, zero 25s timeoutów. `stubGlobal("fetch")` tylko w pliku klienta. Nie spinować Astro preview.

## Uwagi dotyczące migracji

Brak migracji schematu i zmian produkcyjnych. Tests-only + docs.

## Referencje

- Badania: `context/changes/testing-ai-path-contracts/research.md`
- Test plan: `context/foundation/test-plan.md` §2 #4, §3 Phase 3, §6.3 TBD
- Phase 1 401 wzorzec: `src/pages/api/ai/suggestions.test.ts`
- Archive: `2026-05-26-ai-suggestion-scaffold` (F-02), `2026-06-22-ai-activity-suggestions` (S-01), `2026-08-10-manual-event-ai-summary` (S-03), `2026-08-13-testing-runner-critical-owner-access`
- Vitest mocking: Context7 `/vitest-dev/vitest` (`vi.hoisted`, `vi.mock`, `vi.stubGlobal`), checked **2026-08-19**
- AI-native layer: none (dated 2026-08-19 — brak browser/vision MCP; nie dodajemy)

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Unit — Zod response schemas (Risk #4 gate)

#### Automatyczne

- [x] 1.1 Suggestion schema: reject empty / 6 items / missing / too long / bad URL — 41aab18
- [x] 1.2 Suggestion schema: accept 1 item; empty `sourceUrl` → omitted — 41aab18
- [x] 1.3 Event-summary schema: reject empty/whitespace/201; accept 1–200 after trim — 41aab18
- [x] 1.4 `npm test` exit 0 bez live OpenRouter / Docker — 41aab18

#### Ręczne

- [x] 1.5 Brak asercji skopiowanej z promptu (3–5, Wikipedia, Polish copy) — 41aab18

### Faza 2: Unit — openrouter-client taxonomy

#### Automatyczne

- [x] 2.1 `fetch` `!ok` → `upstream` (zły klucz ≠ `configuration`)
- [x] 2.2 `TimeoutError` → `timeout`; inny throw → `upstream`
- [x] 2.3 HTTP 200 + zły envelope/content/Zod → `invalid_response`
- [x] 2.4 HTTP 200 + 1 legalna karta / summary → resolved shape (nie jakość)
- [x] 2.5 Pusty env → `configuration` bez `fetch`
- [x] 2.6 `npm test` bez sieci do OpenRouter

#### Ręczne

- [x] 2.7 Stub `fetch` restored; brak live URL / 25s wait

### Faza 3: Contract — AI route HTTP map

#### Automatyczne

- [ ] 3.1 Suggestions contract: macierz 503/504/502 + pusty env bez `generateSuggestions`
- [ ] 3.2 Event-summary: 401 + ta sama macierz + pusty env
- [ ] 3.3 `suggestions.test.ts` nadal wyłącznie 401
- [ ] 3.4 `npm test` zielone

#### Ręczne

- [ ] 3.5 Oracle = status + `error` code; mock `OpenRouterError` class dla `instanceof`; bez ekstrakcji switcha

### Faza 4: Contract — create manual ⊥ AI

#### Automatyczne

- [ ] 4.1 `manualEventCreateSchema`: omitted / `null` / `""` summary OK
- [ ] 4.2 `POST /api/events`: `generateEventSummary` not called; 201
- [ ] 4.3 `npm test` bez env A/B

#### Ręczne

- [ ] 4.4 Brak e2e Generate+Save / JWT insert

### Faza 5: Cookbook §6.3 + status sync

#### Automatyczne

- [ ] 5.1 §6.3 nie zawiera „TBD — see §3 Phase 3”
- [ ] 5.2 Pliki test z Faz 1–4 istnieją

#### Ręczne

- [ ] 5.3 Przegląd cookbook: 1 karta, TimeoutError-only, 502 upstream dla złego klucza, create spy; §3 Phase 3 → complete
