<!-- PLAN-REVIEW-REPORT -->

# Plan Review: event-schema-rls (F-01)

- **Plan**: `context/changes/event-schema-rls/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-26
- **Verdict**: SOUND (po poprawkach planu 2026-05-26)
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 4/5 paths ✓ (`supabase/migrations/` absent by design — plan creates it), 3/3 symbols ✓ (`supabase.ts`, `SUPABASE_KEY` anon, README), brief↔plan ✓

## Findings

### F1 — Phase 1 bez RLS może trafić na cloud przed fazą 2

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 / Phase 2; Migration Notes
- **Detail**: Plan dzieli pracę na fazę 1 (schema) i 2 (RLS), a w `supabase/` nie ma jeszcze migracji. Domyślne granty Supabase na `public` + brak RLS = każdy `authenticated` widzi wszystkie wiersze przez PostgREST. Rekomendacja „jeden plik schema+RLS” jest w linii 156, ale fazy i success criteria sugerują, że 1.1–1.4 mogą być „done” przed RLS. `db push` po samym schema (np. wczesny PR) otwiera tabelę do czasu fazy 2. Dziś brak kodu `.from('events')` — ryzyko aktywuje się przy pierwszym deployu migracji.
- **Fix A ⭐ Recommended**: W planie ustawić **jedną migrację atomową** (CREATE TABLE + ENABLE/FORCE RLS + polityki) jako **wymaganie**, nie opcję implementera; fazy 1–2 = kolejność weryfikacji w jednym PR, bez `db push` do cloud między nimi. Dodać w Migration Notes: „Zakaz push schema-only”.
  - Strength: Zamyka okno podatności; zgodne z NFR-02 od pierwszego deployu.
  - Tradeoff: Mniej „czystego” podziału commitów schema vs RLS lokalnie.
  - Confidence: HIGH — standard Supabase + potwierdzone brakiem RLS w repo.
  - Blind spot: Czy zespół używa wyłącznie lokalnego `db reset` przed pierwszym cloud deploy.
- **Fix B**: Osobna migracja 1 tylko z `ENABLE ROW LEVEL SECURITY` + deny-all default policy, potem migracja 2 schema+policies
  - Strength: Tabela nigdy nie jest „open by default”.
  - Tradeoff: Więcej plików migracji i złożoność deny-all.
  - Confidence: MEDIUM — działa, ale nadmiarowe przy MVP.
  - Blind spot: Czy Supabase CLI kolejność migracji jest już skonfigurowana w CI.
- **Decision**: FIXED via Fix A — plan.md Implementation Approach + Phase 1 atomowa migracja

### F2 — Brak `seed.sql` zablokuje 1.1 zanim implementer dotrze do migracji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — seed.sql; Success Criteria 1.1
- **Detail**: `supabase/config.toml` ma `[db.seed] enabled = true` i `sql_paths = ["./seed.sql"]`. Plik **nie istnieje** — `npx supabase db reset` padnie na seedzie. Plan to przewiduje (§1.2 seed), ale **1.1 jest przed** jawna kolejnością „najpierw seed, potem reset”.
- **Fix**: W Phase 1 dodać pierwszy krok checklisty: utworzyć `supabase/seed.sql` (pusty komentarz) **przed** pierwszym `db reset`; w Progress zamienić 1.1 na dwa kroki lub notę w 1.1.
- **Decision**: FIXED — Progress 1.1 seed przed reset

### F3 — `database.generated.ts` vs dokumentacja `src/types.ts`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3; References
- **Detail**: Plan: `src/types/database.generated.ts`. `AGENTS.md` / `CLAUDE.md`: „shared types in `src/types.ts`” — plik **nie istnieje**. Implementer może pominąć barrel albo zduplikować konwencję.
- **Fix A ⭐ Recommended**: Phase 3 — dodać cienki `src/types.ts` re-eksportujący `Tables<'events'>` z generated; jedna linia w README/AGENTS nie jest wymagana w F-01.
  - Strength: Zgodność z aliasem `@/types` i przyszłymi slice'ami.
  - Tradeoff: Dodatkowy plik poza strict DB-only scope.
  - Confidence: HIGH — wzorzec Supabase + istniejący `@/*` alias.
  - Blind spot: None significant.
- **Fix B**: Zostawić tylko `database.generated.ts` i zaktualizować AGENTS.md w osobnym change
  - Strength: Minimalny F-01.
  - Tradeoff: Drift dokumentacji agentów do naprawy później.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — Phase 3 `src/types.ts` barrel

### F4 — ESLint nie uwzględnia wygenerowanego pliku typów

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Success Criteria 3.1
- **Detail**: `eslint.config.js` type-checkuje wszystkie `**/*.{ts,tsx}`. Duży `database.generated.ts` często łamie `lint` (np. `any`, unused). Plan zakłada `npm run lint` pass bez wzmianki o ignore.
- **Fix**: W Phase 3 dodać: `eslint.config.js` — `ignores: ["src/types/database.generated.ts"]` lub blok `eslint-disable` w nagłówku generated (prefer ignore w config).
- **Decision**: FIXED — Phase 3.2 + Progress 3.2

### F5 — Test INSERT „service role” w fazie 1 nie weryfikuje RLS

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Manual — 1.4
- **Detail**: INSERT w SQL Editor jako service role omija RLS. Przy jednej migracji schema+RLS sensowniejszy jest INSERT jako `authenticated` (JWT) już w fazie 2. Faza 1.4 jest OK tylko do sprawdzenia constraintów FK.
- **Fix**: W 1.4 doprecyzować: service role tylko jeśli RLS jeszcze off; po włączeniu RLS — przenieść INSERT testowy do scenariuszy 2.x.
- **Decision**: FIXED — scenariusz 8, Phase 2 authenticated only

### F6 — F-02 / service_role świadomie odłożone

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details — Service role
- **Detail**: Aplikacja używa wyłącznie anon key (`.env.example`, `src/lib/supabase.ts`). F-02 prawdopodobnie wystarczy JWT użytkownika — zgodne z planem. Ryzyko pojawia się tylko przy batch AI bez sesji — nie w scope MVP.
- **Fix**: Brak zmiany planu; przy `/10x-plan ai-suggestion-scaffold` potwierdzić ścieżkę JWT vs service role.
- **Decision**: ACCEPTED — doprecyzowane w Critical Implementation Details
