# Plan: app-route-auth-guards (F-03)

**Status:** planned  
**Roadmap:** [F-03](../../foundation/roadmap.md)  
**Change:** [change.md](./change.md)

---

## Overview

Rozszerzenie ochrony tras tak, aby **każda przyszła strona produktowa była chroniona domyślnie**, bez ręcznego dopisywania do listy. Zalogowany rodzic jest wymagany poza jawnie publicznymi ścieżkami; niezalogowany dostaje przekierowanie na `/auth/signin`.

## Current State Analysis

| Element                                        | Stan                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| [`src/middleware.ts`](../../src/middleware.ts) | `PROTECTED_ROUTES = ["/dashboard"]` — tylko jedna trasa |
| `context.locals.user`                          | Ustawiane z `supabase.auth.getUser()` na każdym żądaniu |
| Strony                                         | `/`, `/auth/*`, `/dashboard`; API tylko `/api/auth/*`   |
| `src/lib/route-access.ts`                      | Brak                                                    |

### Key Discoveries

- Prefix `startsWith("/")` **nie może** oznaczać publicznego `/` — dopasowałoby wszystko; `/` wymaga dopasowania dokładnego (`pathname === "/"`).
- [`src/pages/api/auth/signout.ts`](../../src/pages/api/auth/signout.ts) musi pozostać publiczny (wylogowanie bez sesji).
- Brak runnera testów w `package.json` — weryfikacja: `lint` + `build` + scenariusze manualne.

## Desired End State

- Wylogowany użytkownik: `GET /`, `/auth/*`, `POST /api/auth/*` — działa bez sesji.
- Wylogowany użytkownik: `GET /dashboard` i **dowolna przyszła strona** (np. `/activities`) — `302` → `/auth/signin`.
- Zalogowany użytkownik: chronione strony — `200`.
- Nowa strona w `src/pages/` **nie wymaga** edycji middleware — wystarczy, że nie trafi na allowlistę publiczną.

### Weryfikacja końcowa

Manualna tabela w sekcji Testing Strategy + `npm run lint` i `npm run build` przechodzą.

## What We're NOT Doing

- Redirect zalogowanego z `/auth/signin` na `/dashboard`.
- Parametr `?redirect=` po logowaniu (powrót na żądaną stronę).
- Ochrona przyszłych tras API domenowych (np. `/api/events`) — domyślnie będą chronione, ale brak takich tras w MVP; osobny slice jeśli potrzeba wyjątków.
- Zmiana struktury URL (np. prefiks `/app/*`).
- Testy jednostkowe — brak skonfigurowanego runnera (opcjonalnie później).

## Implementation Approach

**Model: publiczna allowlista + default deny**

| Typ               | Ścieżki                               | Zachowanie                        |
| ----------------- | ------------------------------------- | --------------------------------- |
| Publiczne         | `/` (dokładnie), `/auth`, `/api/auth` | bez sesji OK                      |
| Framework         | `/_astro`                             | bez sprawdzania auth              |
| **Wszystko inne** | `/dashboard`, przyszłe strony         | brak sesji → `302` `/auth/signin` |

Logika w [`src/lib/route-access.ts`](../../src/lib/route-access.ts); middleware tylko wywołuje politykę.

## Critical Implementation Details

**Dopasowanie `/`:** `isPublicPath` musi traktować `/` wyłącznie przez równość ścieżki, nie `startsWith("/")`.

**Kolejność w middleware:** najpierw `getUser()` → `locals.user`, potem `requiresAuth(pathname)` — bez zmiany istniejącego flow sesji.

## Phase 1: Polityka tras i middleware

### Overview

Wydzielenie reguł dostępu do modułu lib i podłączenie w middleware zamiast `PROTECTED_ROUTES`.

### Changes Required:

#### 1. Moduł polityki tras

**File:** `src/lib/route-access.ts`

**Intent:** Jedno miejsce z definicją tras publicznych i funkcją `requiresAuth`, używane przez middleware i ewentualnie przyszłe testy.

**Contract:**

- Eksport `isPublicPath(pathname: string): boolean`
- Eksport `requiresAuth(pathname: string): boolean` — `!isPublicPath(pathname)`
- Publiczne prefiksy/ścieżki:
  - dokładnie `/` (oraz opcjonalnie `""` jeśli framework tak podaje)
  - prefix `/auth`
  - prefix `/api/auth`
  - prefix `/_astro`

#### 2. Middleware

**File:** `src/middleware.ts`

**Intent:** Usunąć `PROTECTED_ROUTES`; po ustawieniu `context.locals.user`, jeśli `requiresAuth(context.url.pathname)` i brak użytkownika — redirect na `/auth/signin`.

**Contract:** Import z `@/lib/route-access`; zachować istniejące tworzenie klienta Supabase i `getUser()`.

#### 3. Dokumentacja w kodzie (minimalna)

**File:** `src/middleware.ts` lub `src/lib/route-access.ts`

**Intent:** Jedno zdanie w komentarzu — nowe strony produktowe są domyślnie chronione; publiczne trasy dodaje się w `route-access.ts`.

### Success Criteria:

#### Automated Verification:

- `npx astro sync` (jeśli zmieniono typy Astro)
- `npm run lint` — bez błędów
- `npm run build` — sukces (wymaga env Supabase w CI/lokalnie)

#### Manual Verification:

- Wylogowany `GET /` → 200 (landing)
- Wylogowany `GET /auth/signin` → 200
- Wylogowany `POST /api/auth/signin` (poprawne dane) → redirect po logowaniu
- Wylogowany `GET /dashboard` → 302 → `/auth/signin`
- Zalogowany `GET /dashboard` → 200
- Zalogowany `POST /api/auth/signout` → wylogowanie, redirect
- (Opcjonalnie) tymczasowa strona testowa pod np. `/activities` — wylogowany 302, zalogowany 200 — potwierdza default deny

**Implementation Note:** Po fazie 1 i automated verification — potwierdzenie manualne od człowieka przed zamknięciem change.

---

## Testing Strategy

### Unit Tests

Pominięte w tym change — brak `npm test`. Logika `route-access` jest czystą funkcją — dobry kandydat przy dodaniu runnera.

### Manual Testing Steps

| #   | Scenariusz                                                                        | Oczekiwany wynik             |
| --- | --------------------------------------------------------------------------------- | ---------------------------- |
| 1   | Wylogowany GET `/`                                                                | 200                          |
| 2   | Wylogowany GET `/auth/signin`                                                     | 200                          |
| 3   | Wylogowany GET `/auth/signup`                                                     | 200                          |
| 4   | Wylogowany POST `/api/auth/signin` (valid)                                        | redirect po sukcesie         |
| 5   | Wylogowany GET `/dashboard`                                                       | 302 → `/auth/signin`         |
| 6   | Zalogowany GET `/dashboard`                                                       | 200                          |
| 7   | Zalogowany POST `/api/auth/signout`                                               | sesja wyczyszczona, redirect |
| 8   | Wylogowany GET nieistniejącej chronionej ścieżki (np. `/activities` jeśli dodana) | 302 → `/auth/signin`         |

## Performance Considerations

Jedno sprawdzenie stringów na żądanie — pomijalne vs. `getUser()`.

## Migration Notes

Brak migracji danych. Zachowanie dla istniejących użytkowników bez zmian — rozszerzenie ochrony nie psuje publicznych tras auth.

## References

- [change.md](./change.md) — F-03, baseline
- [roadmap F-03](../../foundation/roadmap.md)
- PRD v2: Access Control
- Middleware: [`src/middleware.ts`](../../src/middleware.ts)

## Progress

> Convention: `- [ ]` pending, `- [x]` done.

### Phase 1: Polityka tras i middleware

#### Automated

- [x] 1.1 `npx astro sync` (jeśli potrzebne) — 3dd83d8
- [x] 1.2 `npm run lint` — 3dd83d8
- [x] 1.3 `npm run build` — 3dd83d8

#### Manual

- [x] 1.4 Scenariusze 1–7 z tabeli Manual Testing Steps — 3dd83d8
- [x] 1.5 (Opcjonalnie) scenariusz 8 — default deny na nowej ścieżce — zweryfikowane przez `requiresAuth()` (default deny poza allowlistą); 2026-05-26
