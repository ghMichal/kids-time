<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI suggestion scaffold (F-02)

- **Plan**: `context/changes/ai-suggestion-scaffold/plan.md`
- **Zakres**: Phase 0-2 z 4
- **Data**: 2026-05-27
- **Werdykt**: NEEDS ATTENTION
- **Ustalenia**: 0 krytycznych, 3 ostrzezenia, 1 obserwacja

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodnosc z planem       | WARNING |
| Dyscyplina zakresu      | PASS    |
| Bezpieczenstwo i jakosc | WARNING |
| Architektura            | PASS    |
| Spojnosc wzorcow        | WARNING |
| Kryteria sukcesu        | PASS    |

## Ustalenia

### F1 - OpenRouter HTTP errors are not mapped cleanly

- **Waznosc**: WARNING
- **Wplyw**: LOW - poprawka jest waska i lokalna
- **Wymiar**: Safety & Quality
- **Lokalizacja**: `src/lib/ai/openrouter-client.ts:71`
- **Szczegoly**: Plan wymagal mapowania `HTTP != 2xx` na upstream/502 semantics. Implementacja probuje najpierw sparsowac `response.json()`, a dopiero potem sprawdza `response.ok`. Jesli OpenRouter zwroci blad HTTP z nie-JSON body, kod rzuci `invalid_response` zamiast `upstream`. Dodatkowo tekst `payload.error?.message` trafia do publicznego `OpenRouterError.message`, co moze pozniej zostac zwrocone przez route Phase 3 i ujawnic szczegoly providera/konta/modelu.
- **Poprawka**: Najpierw sprawdz `response.ok`; dla bledow HTTP rzuc generic `OpenRouterError("upstream", "OpenRouter request failed.")`, opcjonalnie zachowuj status w polu przeznaczonym do server-only logowania.
- **Decyzja**: PENDING

### F2 - JSON schema under-specifies response guardrails

- **Waznosc**: WARNING
- **Wplyw**: LOW - ogranicza sie do definicji schematu
- **Wymiar**: Plan Adherence
- **Lokalizacja**: `src/lib/ai/suggestion-response.schema.ts:52`
- **Szczegoly**: Zod runtime schema wymusza `title <= 100`, `summary <= 200` i normalizuje puste `sourceUrl`, ale `openRouterJsonSchema` nie przekazuje do modelu `maxLength` dla `title`/`summary` ani walidacji formatu URL. W praktyce guardrails dzialaja dopiero po odpowiedzi modelu, co zwieksza ryzyko odrzucenia odpowiedzi jako `invalid_response` zamiast zapobiegania blednemu ksztaltowi na poziomie structured output.
- **Poprawka**: Dodaj `maxLength: 100` dla `title`, `maxLength: 200` dla `summary` i jawny kontrakt `sourceUrl` w JSON schema zgodny z przyjetym modelem empty-string-then-omit.
- **Decyzja**: PENDING

### F3 - Optional smoke script bypasses the client it is meant to smoke

- **Waznosc**: WARNING
- **Wplyw**: MEDIUM - trzeba wybrac czy skrypt ma testowac klienta, czy tylko surowy kontrakt OpenRouter
- **Wymiar**: Pattern Consistency
- **Lokalizacja**: `scripts/smoke-openrouter.ts:52`
- **Szczegoly**: Plan dopuszczal opcjonalny krotki skrypt wywolujacy `openrouter-client` z `.dev.vars`. Dodany skrypt wykonuje osobny `fetch`, buduje payload, parsuje odpowiedz i waliduje ksztalt niezaleznie od `generateSuggestions`. To dubluje logike produkcyjna, wiec smoke moze przejsc mimo regresji w samym kliencie.
- **Poprawka**: Albo przebuduj smoke tak, aby wywolywal produkcyjna sciezke klienta, albo usun skrypt z Phase 2 i zostaw smoke dla Phase 3 endpointu, gdzie Astro env i route beda naturalnym punktem integracji.
  - Sila: Usuwa falszywe poczucie pokrycia i ogranicza utrzymanie zdublowanej logiki.
  - Kompromis: Import `astro:env/server` utrudnia bezposrednie uruchamianie klienta poza Astro; moze byc potrzebny maly adapter albo przeniesienie smoke na poziom endpointu.
  - Pewnosc: MED - problem z duplikacja jest jasny, ale najlepszy ksztalt smoke zalezy od decyzji o Phase 3.
  - Martwy punkt: Nie sprawdzono, czy repo ma juz preferowany sposob uruchamiania Astro env w standalone scripts.
- **Decyzja**: PENDING

### F4 - Env-only smoke crashes when `.dev.vars` is absent

- **Waznosc**: OBSERVATION
- **Wplyw**: LOW - oczywista poprawka w skrypcie
- **Wymiar**: Pattern Consistency
- **Lokalizacja**: `scripts/smoke-openrouter.ts:40`
- **Szczegoly**: Komentarz mowi, ze skrypt czyta OpenRouter vars z `.dev.vars` albo `process.env`, ale `loadDevVars(".dev.vars")` jest wywolywane bezwarunkowo. Gdy `.dev.vars` nie istnieje, skrypt padnie przed fallbackiem do `process.env`.
- **Poprawka**: Traktuj brak `.dev.vars` jako pusty obiekt albo najpierw sprawdz `process.env`, a plik czytaj tylko jako fallback.
- **Decyzja**: PENDING

## Dowody zgodnosci

- Phase 0 pozostaje zgodna: `change.md` zawiera `OPENROUTER_MODEL=openai/gpt-4o-mini`, link do OpenRouter i notatke o `structured_outputs`.
- Phase 1 pozostaje zgodna: `zod` jest zaleznoscia produkcyjna, `OPENROUTER_*` sa server-only secrets w `astro.config.mjs`, onboarding env jest opisany w `.env.example`/`README.md`, a `config-status` wymaga key + model.
- `src/lib/ai/suggestion-request.schema.ts` spelnia kontrakt FR-001.
- `src/lib/ai/build-suggestion-prompt.ts` buduje system/user messages po polsku, zawiera miejsce/czas/wiek/preferencje i nie loguje promptu.
- `src/lib/ai/openrouter-client.ts` uzywa `astro:env/server`, `fetch`, `AbortSignal.timeout(25_000)`, niskiej temperatury, structured output i typowanego `OpenRouterError`.
- `src/types.ts` re-exportuje `SuggestionRequest` i `SuggestionResponse`.

## Weryfikacja automatyczna

| Komenda                                                                              | Wynik | Uwagi                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PATH=/Users/michal.machlowski/.nvm/versions/node/v24.15.0/bin:$PATH npm install`    | PASS  | Exit 0. `husky` nie mogl zapisac `.git/config` w sandboxie, ale instalacja zakonczyla sie powodzeniem.                                                                                                            |
| `PATH=/Users/michal.machlowski/.nvm/versions/node/v24.15.0/bin:$PATH npx astro sync` | PASS  | Pierwsza proba w sandboxie padla na `listen EPERM`; po zatwierdzonym uruchomieniu poza sandboxem typy wygenerowaly sie poprawnie.                                                                                 |
| `PATH=/Users/michal.machlowski/.nvm/versions/node/v24.15.0/bin:$PATH npm run lint`   | PASS  | ESLint zakonczyl sie kodem 0.                                                                                                                                                                                     |
| `PATH=/Users/michal.machlowski/.nvm/versions/node/v24.15.0/bin:$PATH npm run build`  | PASS  | Pierwsza proba w sandboxie padla na `listen EPERM`; po zatwierdzonym uruchomieniu poza sandboxem build zakonczyl sie poprawnie. Ostrzezenie sitemap o braku `site` jest istniejacym ostrzezeniem konfiguracyjnym. |
