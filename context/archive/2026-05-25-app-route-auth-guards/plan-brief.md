# app-route-auth-guards — Plan Brief

> Full plan: `context/changes/app-route-auth-guards/plan.md`  
> Change: `context/changes/app-route-auth-guards/change.md`

## What & Why

Fundament **F-03**: zalogowany rodzic musi być wymagany na trasach produktowych, nie tylko na `/dashboard`. Bez tego każda nowa strona (S-01–S-05) ryzykuje lukę — strona istnieje, ale nie jest na liście chronionych.

## Starting Point

Middleware chroni wyłącznie `/dashboard` przez `PROTECTED_ROUTES`. Sesja Supabase i `context.locals.user` już działają na każdym żądaniu.

## Desired End State

Publiczne: landing, auth (strony + API), zasoby `/_astro`. Wszystko inne — brak sesji → logowanie. Nowe strony w `src/pages/` są chronione automatycznie.

## Key Decisions Made

| Decision        | Choice                          | Why                                            | Source |
| --------------- | ------------------------------- | ---------------------------------------------- | ------ |
| Model tras      | Public allowlist + default deny | Unika ręcznego dopisywania każdej nowej strony | Plan   |
| Moduł polityki  | `src/lib/route-access.ts`       | Testowalna logika, cienki middleware           | Plan   |
| Dopasowanie `/` | Exact match, nie `startsWith`   | `startsWith("/")` chroniłoby całą aplikację    | Plan   |
| API domenowe    | Poza zakresem (brak w MVP)      | Domyślnie chronione gdy powstaną               | Plan   |
| Post-login UX   | Poza zakresem                   | Nice-to-have, nie blokuje F-03                 | Plan   |

## Scope

**In scope:** `route-access.ts`, refactor `middleware.ts`, manual + lint/build.

**Out of scope:** `?redirect=`, redirect zalogowanego z sign-in, test runner, ochrona wyjątków API domenowych.

## Architecture / Approach

```
Request → middleware → getUser() → locals.user
                    → requiresAuth(pathname)?
                         no  → next()
                         yes + !user → redirect /auth/signin
```

`requiresAuth` = negacja `isPublicPath` (allowlista: `/`, `/auth`, `/api/auth`, `/_astro`).

## Phases at a Glance

| Phase                    | What it delivers              | Key risk                                     |
| ------------------------ | ----------------------------- | -------------------------------------------- |
| 1. Polityka + middleware | Default deny, jeden moduł lib | Błędne dopasowanie `/` (łatwe do uniknięcia) |

**Prerequisites:** brak  
**Estimated effort:** ~1 sesja

## Open Risks & Assumptions

- Przyszłe publiczne trasy (np. health check, legal) wymagają wpisu w allowliście — świadoma konwencja.
- `npm run build` wymaga env Supabase lokalnie/CI.

## Success Criteria (Summary)

- Wylogowany nie wchodzi na `/dashboard` ani przyszłe strony produktowe.
- Publiczne auth i landing działają bez sesji.
- Lint i build przechodzą.
