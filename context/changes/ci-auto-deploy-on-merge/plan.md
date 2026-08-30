# Plan wdrożenia Auto-deploy Worker on merge to main

## Przegląd

Po zielonym jobie `ci` na `push` do `main` GitHub Actions wdraża Cloudflare Worker `kids-time-mvp` i sprawdza `GET /`. PR-y zostają przy lint + test + build — bez deployu. Lokalny `npm run deploy` zostaje jako ścieżka awaryjna.

## Analiza stanu obecnego

- `.github/workflows/ci.yml` ma jeden job `ci` (Node 24, `npm ci`, `astro sync`, lint, `npm test`, build z `SUPABASE_*`). Brak joba deploy, artifactów i GitHub Environment.
- Worker `kids-time-mvp` jest już na produkcji (`https://kids-time-mvp.michal-machlowski.workers.dev`). Lokalny pipeline: `scripts/deploy.sh` → `npx wrangler deploy`.
- Sekrety repo `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID` są dodane. Runtime `SUPABASE_*` / `OPENROUTER_*` żyją na Workerze (`wrangler secret put`), nie w YAML deployu.
- `astro.config.mjs` oznacza te sekrety jako `optional: true` — build w jobie deploy potrzebuje tych samych `SUPABASE_*` co job `ci`, nie OpenRouter.
- README sekcja CI mówi o `master` i pomija `npm test` oraz auto-deploy — rozjazd z workflowem na `main`.
- `context/deployment/deploy-plan.md` Faza 4 pkt 1 jest otwarta; Workers Builds / preview są follow-upem, nie tym change.

## Pożądany stan końcowy

Merge (push) na `main` po zielonym `ci` wdraża Workera i kończy się sukcesem tylko gdy `GET /` na URL produkcji zwraca HTTP 200. PR do `main` nie woła Wranglera. Awaria `ci` blokuje deploy. Dokumentacja (README + deploy-plan) opisuje ten przepływ, sekrety Cloudflare i ręczny rollback — bez `wrangler pages deploy` i bez Workers Builds jako bramki.

### Kluczowe odkrycia:

- Kontrakt joba ustalony w `change.md`: drugi job w istniejącym `ci.yml`, `needs: ci`, `if: push && main` — nie drugi workflow.
- `cloudflare/wrangler-action@v4` wymaga tylko `apiToken` + `accountId` + `command: deploy`. Nie wymaga powiązania Git / Workers Builds w dashboardzie Cloudflare.
- Wejście `secrets:` w wrangler-action **nadpisuje** sekrety Workera — nie używać. Smoke nie w `postCommands` (odpalają się także po nieudanym deployu).
- Komenda produkcyjna to `npx wrangler deploy` / `command: deploy` — nie `wrangler pages deploy` (`deploy-plan.md`).

## Czego NIE robimy

- Preview branches / osobny projekt Supabase
- `supabase db push` z Actions
- `wrangler pages deploy` i Cloudflare Workers Builds jako zamiennik bramki CI
- GitHub Environment `production`, required reviewer, `workflow_dispatch`
- Wstrzykiwanie `SUPABASE_*` / `OPENROUTER_*` do kroku Wrangler
- Upload/download artifactów `dist/` między jobami
- Automatyczny `wrangler rollback` przy padzie smoke
- Zmiana `scripts/deploy.sh` / lokalnego `npm run deploy`
- Aktualizacja `roadmap.md`, `AGENTS.md` i `CLAUDE.md` (osobna decyzja; ten plan syncuje tylko README + deploy-plan). Parked item „auto-deploy on merge” nie ma Change ID — `/10x-implement` go nie przestawi. AGENTS/CLAUDE nadal mówią Node 22 i PR-y na `master`.

## Podejście do implementacji

Jeden plik workflow, potem sync dokumentacji. Job `deploy` powtarza `npm ci` + `astro sync` + `build` (bez lint/test — to zrobił `ci`) i wdraża zablokowanym Wranglerem 4.x z `package.json`. Smoke to jeden `curl` na znany URL produkcji.

## Krytyczne szczegóły implementacji

Warunek `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` musi być na jobie `deploy`, nie na całym workflow — inaczej PR straci job `ci`. W `wrangler-action` nie podawaj `secrets:`; smoke jako osobny krok `run:` po action, z `curl -f` na `https://kids-time-mvp.michal-machlowski.workers.dev/`.

---

## Phase 1: Job deploy + smoke w CI

### Przegląd

Drugi job w istniejącym workflow wdraża Workera po zielonym `ci` na `main` i weryfikuje, że produkcyjny `/` odpowiada 200.

### Wymagane zmiany:

#### 1. Job `deploy` w workflow CI

**Plik**: `.github/workflows/ci.yml`

**Cel**: Po sukcesie joba `ci` na `push` do `main` zbudować bundle i wdrożyć `kids-time-mvp`. PR-y i padnięty `ci` nie dochodzą do Wranglera.

**Kontrakt**: Nowy job `deploy` z `needs: ci` i `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`. Kroki: `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: 24`, `cache: npm`), `npm ci`, `npx astro sync`, `npm run build` z `SUPABASE_URL` / `SUPABASE_KEY` (jak w jobie `ci`). Potem `cloudflare/wrangler-action@v4` z `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `command: deploy`, `packageManager: npm`. Przypnij `wranglerVersion` do Wranglera 4.x z `package.json` (`^4.90.0`), żeby CI zgadzał się z lokalnym `npx wrangler deploy`. **Zakaz** klucza `secrets:` w action. Job `ci` bez zmian triggerów i kroków.

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

#### 2. Smoke GET /

**Plik**: `.github/workflows/ci.yml` (ostatni krok joba `deploy`)

**Cel**: Cichy, zły deploy (pusty Worker, 5xx na `/`) ma oblać job, zanim ktoś uzna merge za „na produkcji”.

**Kontrakt**: Osobny krok `run:` **po** wrangler-action (nie `postCommands`). `curl -fsS` na `https://kids-time-mvp.michal-machlowski.workers.dev/` — sukces tylko przy HTTP 200. Brak auth, brak OpenRouter, brak `wrangler tail`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Job `deploy` jest w `.github/workflows/ci.yml` z `needs: ci` oraz `if` ograniczającym do `push` + `main`
- Plik workflow parsuje się jako YAML
- `npm test` i `npm run lint` przechodzą (brak zmian w aplikacji)

#### Weryfikacja ręczna:

- PR do `main`: job `deploy` jest skipped; `ci` nadal leci
- Push/merge na `main` po zielonym `ci`: `deploy` wdraża `kids-time-mvp` i smoke `GET /` zwraca 200
- Czerwony job `ci` nie uruchamia `deploy`

**Uwaga implementacyjna**: Jeden PR z Fazą 2. Krok 1.4 weryfikuj na tym PR (`deploy` skipped). Kroki 1.5–1.6 dopiero po merge na `main` — nie blokuj Fazy 2 czekaniem na produkcyjny deploy.

---

## Phase 2: Dokumentacja README + deploy-plan

### Przegląd

Zsynchronizować README i plan wdrożenia z rzeczywistym jobem, sekretami i ręcznym rollbackiem.

### Wymagane zmiany:

#### 1. README — CI i auto-deploy

**Plik**: `README.md`

**Cel**: Czytelnik widzi, że Actions jest na `main` (nie `master`), że CI robi też testy, i że merge na `main` wdraża Workera.

**Kontrakt**: Sekcja `## CI` — trigger `main`, kroki lint + test + build, job `deploy` tylko na `push` do `main` po zielonym `ci`, sekrety `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (deploy) oraz `SUPABASE_*` (build). Sekcja `## Deployment` — jedno zdanie, że produkcja idzie też z Actions; lokalny `npm run deploy` zostaje awaryjny. Nie obiecywać preview ani Workers Builds.

#### 2. Deploy-plan — Faza 4 i sekrety

**Plik**: `context/deployment/deploy-plan.md`

**Cel**: Faza 4 pkt 1 i status „Auto-deploy on merge” odzwierciedlają zrobiony job; macierz i diagram nie kłamią, że GHA tylko buduje.

**Kontrakt**: Tabela „Stan wykonania” — Auto-deploy = Done; „GitHub secrets + zielony CI” = Done. Faza 4 pkt 1 — zrobione (wskazać `ci.yml` job `deploy`); pkt 2–3 nadal follow-up / poza tym change (OpenRouter na Workerze już jest wymaganiem F-02, nie nowym zadaniem). Macierz sekretów: dodać `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID` (tylko kolumna GitHub Actions). Diagram: GHA `ci` → `deploy` → Worker. Rollback bez zmian mechanizmu: `npx wrangler rollback` ręcznie; smoke fail **nie** rollbackuje automatycznie. Ryzyko „Brak auto-deploy” — zmitigowane. Nadal zakaz `wrangler pages deploy`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- README sekcja CI opisuje branch `main`, `npm test` oraz job deploy po `ci`
- `deploy-plan.md` oznacza Faza 4 pkt 1 / Auto-deploy jako zrobione i wymienia `CLOUDFLARE_*` w macierzy

#### Weryfikacja ręczna:

- Nazwy sekretów, URL smoke i komenda rollback w docs zgadzają się z YAML i `wrangler.jsonc` (`name: kids-time-mvp`)

**Uwaga implementacyjna**: YAML + README + deploy-plan w jednym PR. Po merge: 1.5 (deploy + smoke 200) i 1.6 (czerwone `ci` nie woła `deploy`). Nie ruszaj `AGENTS.md` / `CLAUDE.md` / parked roadmap — osobna decyzja (Node 22/`master` i parked auto-deploy zostają świadomie).

---

## Strategia testowania

### Testy jednostkowe:

- Brak nowych testów aplikacji — zmiana jest w YAML i markdownie.
- Istniejące `npm test` / `npm run lint` muszą pozostać zielone (regresja „nie ruszaj `src/`”).

### Testy integracyjne:

- Brak. Nie dodajemy joba `test:integration` ani Dockera.

### Kroki testowania ręcznego:

1. Otwórz PR do `main` — w Actions widać tylko `ci`; `deploy` skipped.
2. Zmerguj PR (albo push na `main`) — `ci` zielone, potem `deploy` + smoke 200.
3. W Cloudflare: nowa wersja Workera `kids-time-mvp` odpowiada SHA / czasowi runa.
4. Świadomie zły token nie jest wymagany do sign-off; jeśli deploy padnie, `ci` i tak zostaje źródłem prawdy — nie obchodzić `needs: ci`.

## Uwagi dotyczące wydajności

Job `deploy` powtarza install + build (~kilka minut). Świadomy koszt zamiast artifactów. Brak wpływu na runtime aplikacji.

## Uwagi dotyczące migracji

Brak migracji DB. Rollback Workera: `npx wrangler rollback` (lub ponowny deploy znanego commita). Migracje Supabase nie cofają się z rollbackiem Workera. Istniejące sekrety Workera zostają nietknięte.

## Referencje

- Tożsamość zmiany: `context/changes/ci-auto-deploy-on-merge/change.md`
- Plan operacyjny: `context/deployment/deploy-plan.md` (Faza 4 pkt 1)
- Lokalny odpowiednik: `scripts/deploy.sh`
- Action: [cloudflare/wrangler-action@v4](https://github.com/cloudflare/wrangler-action)
- Worker: `wrangler.jsonc` (`name: kids-time-mvp`)

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Phase 1: Job deploy + smoke w CI

#### Automated

- [x] 1.1 Job `deploy` jest w `.github/workflows/ci.yml` z `needs: ci` oraz `if` ograniczającym do `push` + `main`
- [x] 1.2 Plik workflow parsuje się jako YAML
- [x] 1.3 `npm test` i `npm run lint` przechodzą (brak zmian w aplikacji)

#### Manual

- [ ] 1.4 PR do `main`: job `deploy` jest skipped; `ci` nadal leci
- [ ] 1.5 Push/merge na `main` po zielonym `ci`: `deploy` wdraża `kids-time-mvp` i smoke `GET /` zwraca 200
- [ ] 1.6 Czerwony job `ci` nie uruchamia `deploy`

### Phase 2: Dokumentacja README + deploy-plan

#### Automated

- [ ] 2.1 README sekcja CI opisuje branch `main`, `npm test` oraz job deploy po `ci`
- [ ] 2.2 `deploy-plan.md` oznacza Faza 4 pkt 1 / Auto-deploy jako zrobione i wymienia `CLOUDFLARE_*` w macierzy

#### Manual

- [ ] 2.3 Nazwy sekretów, URL smoke i komenda rollback w docs zgadzają się z YAML i `wrangler.jsonc` (`name: kids-time-mvp`)
