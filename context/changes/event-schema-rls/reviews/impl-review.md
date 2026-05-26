# Implementation Review: event-schema-rls (F-01)

**Reviewed:** 2026-05-26  
**Commits:** `dc9b74c` (p1), `888d309` (p2), `823617c` (p3), `69d49b4` (epilogue)  
**Plan:** [plan.md](../plan.md) — all 3 phases

## Verdict

**APPROVE** — implementacja realizuje kontrakt F-01: atomowa migracja `events` + RLS, weryfikacja manualna scenariuszy 1–8, wygenerowane typy i dokumentacja. Brak luk blokujących `/10x-archive` ani zależne slice'y (F-04, S-01…).

---

## Plan compliance

| Wymaganie planu                                                              | Status | Dowód                                                                                                                  |
| ---------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `supabase/seed.sql` (pusty, przed reset)                                     | OK     | [`supabase/seed.sql`](../../../../supabase/seed.sql)                                                                   |
| Jedna migracja schema + RLS                                                  | OK     | [`20260526120000_events_schema_and_rls.sql`](../../../../supabase/migrations/20260526120000_events_schema_and_rls.sql) |
| 3 enumy, kolumny kontraktu, CHECK publikacji                                 | OK     | migracja L3–43                                                                                                         |
| Indeksy `(owner_id)`, partial `is_published`, partial `copied_from_event_id` | OK     | migracja L47–53                                                                                                        |
| Trigger `set_updated_at`                                                     | OK     | migracja L55–68                                                                                                        |
| ENABLE + FORCE RLS, 4 polityki `TO authenticated`                            | OK     | migracja L70–97                                                                                                        |
| Brak polityk `anon`, brak osobnego deployu schema-only                       | OK     | jeden plik migracji                                                                                                    |
| RLS manual 1–8 (`authenticated`)                                             | OK     | potwierdzone przez użytkownika (p2)                                                                                    |
| `database.generated.ts` z lokalnej bazy                                      | OK     | [`src/types/database.generated.ts`](../../../../src/types/database.generated.ts)                                       |
| Barrel `@/types` + `EventRow`                                                | OK     | [`src/types.ts`](../../../../src/types.ts)                                                                             |
| ESLint ignore generated                                                      | OK     | [`eslint.config.js`](../../../../eslint.config.js) L77                                                                 |
| README: migracje, `db reset`, `gen types`, RLS                               | OK     | [`README.md`](../../../../README.md) L135–146                                                                          |
| `npm run lint` + `npm run build`                                             | OK     | Progress 3.3–3.4                                                                                                       |
| Poza zakresem: API, UI, Storage, copy RLS                                    | OK     | nie zaimplementowano                                                                                                   |

---

## Findings

### F1 — Nagłówek planu `Status: planned` (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW

[plan.md](../plan.md) L3: `**Status:** planned` — rozjazd z [`change.md`](../change.md) (`implemented`). Progress i commity są kompletne.

**Rekomendacja:** Usunąć linię Status z plan.md lub ustawić `implemented` przy `/10x-archive`.

---

### F2 — README `gen types` bez `2>/dev/null` (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW

README podaje:

```bash
npx supabase gen types typescript --local > src/types/database.generated.ts
```

CLI wypisuje komunikaty na stderr; przy przekierowaniu stdout plik jest czysty, ale przy błędnym redirect (np. `2>&1`) pierwsza linia pliku może zawierać „Connecting to db…”. Podczas implementacji wystąpił ten problem — naprawiono regeneracją z `2>/dev/null`.

**Rekomendacja:** W README dodać wariant z `2>/dev/null` albo krótką uwagę „redirect tylko stdout”.

---

### F3 — `lint-staged` poza planem (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW

Plan wymagał ignore w ESLint; pre-commit nadal failował na staged `database.generated.ts` (`--max-warnings 0` + ignored-file warning). Dodano `--no-warn-ignored` w [`package.json`](../../../../package.json) — sensowna adaptacja, bez zmiany zachowania lintu aplikacji.

**Rekomendacja:** Zostawić; opcjonalnie dopisać do plan-brief / lessons przy kolejnym projekcie z generated types.

---

### F4 — Klient Supabase bez typu `Database` (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW

[`src/lib/supabase.ts`](../../../../src/lib/supabase.ts) nie używa jeszcze `createServerClient<Database>(...)`. Plan F-01 tego nie wymagał — typy są gotowe pod F-02 / slice'y API.

**Rekomendacja:** Przy pierwszym endpoincie `/api/events` podpiąć generic `Database` z `@/types`.

---

## Cross-phase notes

- **Atomowość migracji:** schema i RLS w jednym pliku — zgodnie z post-review planu; bezpieczne pod jednorazowy `supabase db push` na cloud po merge.
- **RLS SELECT:** jedna polityka `owner_id = auth.uid() OR is_published = true` — zgodnie z kontraktem; brak wycieku prywatnych (scenariusz 2 potwierdzony).
- **Roadmap F-01:** status w [`roadmap.md`](../../../foundation/roadmap.md) — aktualizacja przez `/10x-archive`, nie w tym change (zgodnie z planem).

---

## Summary

| Faza                      | Wynik |
| ------------------------- | ----- |
| Phase 1 — seed + migracja | ✅    |
| Phase 2 — weryfikacja RLS | ✅    |
| Phase 3 — typy + docs     | ✅    |

**Gotowe do:** `/10x-archive event-schema-rls` (po merge / `db push` na cloud według Migration Notes w planie).
