# Auto-deploy Worker on merge — Krótki plan

> Pełny plan: `context/changes/ci-auto-deploy-on-merge/plan.md`

## Co i dlaczego

Po zielonym CI na `main` GitHub Actions ma wdrażać Workera `kids-time-mvp`, zamiast polegać na ręcznym `npm run deploy`. To parked item z roadmapy (auto-deploy on merge) — slice'y F-01–S-05 są done, sekrety Cloudflare już w repo.

## Punkt wyjścia

Workflow ma tylko job `ci` (lint/test/build). Worker i lokalny `scripts/deploy.sh` istnieją; brak joba deploy, artifactów i Environment. Runtime sekrety są na Workerze, nie w YAML.

## Pożądany stan końcowy

Merge na `main` po zielonym `ci` publikuje Workera i przechodzi tylko gdy `GET /` zwraca 200. PR-y nie deployują. README i `deploy-plan.md` opisują ten przepływ i ręczny `wrangler rollback`.

## Kluczowe podjęte decyzje

| Decyzja         | Wybór                                      | Dlaczego (1 zdanie)                                           | Źródło    |
| --------------- | ------------------------------------------ | ------------------------------------------------------------- | --------- |
| Kształt CI      | Drugi job w `ci.yml`, `needs: ci`          | Jeden workflow; PR-y bez deployu                              | change.md |
| Mechanizm       | `cloudflare/wrangler-action@v4` po buildie | Oficjalne API token+account; nie wymaga Git bind w Cloudflare | Plan      |
| Bundle          | Przebudowa w jobie deploy                  | Brak artifactów dziś; prostsze niż upload `dist/`             | Plan      |
| Smoke           | `GET /` → 200                              | Łapie martwy deploy bez pełnej Fazy 3                         | Plan      |
| Bramka          | Bez Environment / Approve                  | Solo MVP; `ci` + `main` wystarczy                             | Plan      |
| Docs            | README + deploy-plan, nie roadmap          | Sync operacyjny; roadmap osobno                               | Plan      |
| Runtime sekrety | Zostają na Workerze                        | `secrets:` w action nadpisałby produkcję                      | change.md |

## Zakres

**W zakresie:** job `deploy` + smoke; docs README/deploy-plan; pin Wrangler 4.x.

**Poza zakresem:** preview, `supabase db push`, Pages/Workers Builds, Environment, auto-rollback, zmiana `deploy.sh`.

## Architektura / Podejście

`push`/`pull_request` → job `ci`. Tylko `push` + `refs/heads/main` + zielony `ci` → job `deploy`: `npm ci` → sync → build (`SUPABASE_*`) → wrangler-action `deploy` → `curl -f` na `workers.dev`. Lokalny `npm run deploy` bez zmian.

## Fazy w skrócie

| Faza | Co dostarcza                          | Kluczowe ryzyko                                   |
| ---- | ------------------------------------- | ------------------------------------------------- |
| 1    | Job `deploy` + smoke w `ci.yml`       | Token bez uprawnień Workers / nadpisanie sekretów |
| 2    | README + deploy-plan zsynchronizowane | Docs rozjadą się z YAML (`master` vs `main`)      |

**Wymagania wstępne:** sekrety `CLOUDFLARE_*` i `SUPABASE_*` w GitHub; Worker `kids-time-mvp` już istnieje; CI na `main` zielone.
**Szacowany wysiłek:** ~1 sesja, 2 fazy (YAML + docs w jednym PR; 1.4 na PR, 1.5–1.6 po merge).

## Otwarte ryzyka i założenia

- Token ma uprawnienie do edycji Workera — oznaczone jako done w `change.md`; pad deployu to pierwszy sygnał jeśli nie.
- Smoke 200 nie dowodzi auth/AI — to akceptowane zawężenie.
- Równoległy ręczny `npm run deploy` i Actions mogą się wyścigić; rzadkie przy solo.

## Kryteria sukcesu (podsumowanie)

- PR nie wdraża; merge na `main` wdraża i `/` zwraca 200.
- Pad `ci` blokuje deploy; sekrety Workera nietknięte.
- Docs mówią `main`, job `deploy` i `wrangler rollback`.
