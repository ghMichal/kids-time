<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Auto-deploy Worker on merge to main

- **Plan**: context/changes/ci-auto-deploy-on-merge/plan.md
- **Tryb**: Głęboki
- **Data**: 2026-08-30
- **Werdykt**: REVISE → SOUND (po sortowaniu)
- **Ustalenia**: 1 krytyczne 1 ostrzeżeń 1 obserwacji

## Werdykty

| Wymiar                       | Werdykt                         |
| ---------------------------- | ------------------------------- |
| Zgodność ze stanem końcowym  | PASS                            |
| Oszczędne wykonanie          | PASS                            |
| Dopasowanie architektoniczne | PASS                            |
| Martwe punkty                | PASS                            |
| Kompletność planu            | FAIL → PASS (F1, F2 naprawione) |

## Ugruntowanie

Ugruntowanie: 8/8 ścieżek ✓, 5/5 symboli ✓, brief↔plan ✓

Sprawdzone ścieżki: `.github/workflows/ci.yml`, `README.md`, `context/deployment/deploy-plan.md`, `scripts/deploy.sh`, `wrangler.jsonc`, `package.json`, `astro.config.mjs`, `src/pages/index.astro`.

Symbole: `wrangler` ^4.90.0 / lockfile 4.90.0, `kids-time-mvp`, brak `account_id` w wrangler.jsonc, `GET /` publiczne → 200 bez sesji, wrangler-action `secrets:` / `postCommands` / `wranglerVersion`.

## Ustalenia

### F1 — Nagłówki Postęp/Faza nie spełniają kontraktu /10x-implement

- **Waga**: ❌ CRITICAL
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: ## Postęp oraz ## Faza 1 / ## Faza 2
- **Szczegóły**: Plan używał polskich nagłówków mechanicznych (`## Postęp`, `## Faza N:`, `#### Automatyczne` / `#### Ręczne`). `/10x-implement` parsuje `## Progress`, `## Phase N:`, `### Phase N:`, `#### Automated` / `#### Manual`.
- **Poprawka**: Zamień nagłówki mechaniczne na angielski kontrakt. Proza może zostać po polsku.
  - Siła: `/10x-implement phase 1` znajdzie fazę i pierwszy `- [ ]`.
  - Kompromis: Kosmetyka względem innych polskich planów w archive.
  - Pewność: HIGH — SKILL.md implementacji i wcześniejszy plan-review w tym repo.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED — Naprawiono w planie (nagłówki `Phase` / `Progress` / `Automated` / `Manual`)

### F2 — Faza 1 każe czekać na merge, Faza 2 obiecuje jeden PR

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Phase 1 uwaga implementacyjna; Phase 2 uwaga; plan-brief
- **Szczegóły**: Phase 1 kazała zatrzymać się na merge deployed przed Phase 2; Phase 2 mówiła, że jeden PR jest OK.
- **Poprawka A ⭐ Zalecana**: Jeden PR (YAML + docs). 1.4 na tym PR; 1.5–1.6 po merge. Usuń barierę „zatrzymaj się przed Fazą 2”.
  - Siła: Zgodne z Fazą 2 i solo MVP.
  - Kompromis: Docs twierdzą „Done”, zanim pierwszy merge udowodni deploy.
  - Pewność: HIGH — 1.4 da się sprawdzić na PR.
  - Martwy punkt: Jeśli token nie ma uprawnień Workers, docs wejdą na main razem z padającym jobem.
- **Poprawka B**: Dwa PR-y — najpierw sam `ci.yml`, po 1.5 merge docs.
- **Decyzja**: FIXED — Naprawiono za pomocą poprawki A

### F3 — Phase 2 nie rusza AGENTS.md / CLAUDE.md / parked roadmap

- **Waga**: 💬 OBSERVATION
- **Wpływ**: 🏃 LOW — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Czego NIE robimy; Phase 2
- **Szczegóły**: Świadomy zakres (README + deploy-plan). AGENTS.md/CLAUDE.md nadal mówią Node 22 i PR-y na `master`. Parked item nie ma Change ID.
- **Poprawka**: Zostaw poza zakresem, ale dopisz w Fazie 2 jedną linijkę o pozostałościach.
- **Decyzja**: FIXED — Naprawiono w planie (out-of-scope + uwaga Phase 2)
