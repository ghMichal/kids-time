# Implementation Review: app-route-auth-guards — Phase 1

**Reviewed:** 2026-05-25  
**Commit:** `3dd83d8` (`feat(app-route-auth-guards): public allowlist route guards (p1)`)  
**Plan:** [plan.md](./plan.md) — Phase 1: Polityka tras i middleware

## Verdict

**APPROVE** — implementacja realizuje zamierzony model (allowlista + default deny) i spełnia kontrakt fazy 1. Drobne luki dokumentacyjne i jeden opcjonalny krok Progress — nie blokują zamknięcia F-03.

---

## Plan compliance

| Wymaganie planu                                             | Status | Dowód                                                        |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| `src/lib/route-access.ts` z `isPublicPath` / `requiresAuth` | OK     | [`src/lib/route-access.ts`](../../src/lib/route-access.ts)   |
| `/` tylko exact match                                       | OK     | `pathname === "/" \|\| pathname === ""` (L9–10)              |
| Prefiksy `/auth`, `/api/auth`, `/_astro`                    | OK     | `PUBLIC_PATH_PREFIXES` (L6)                                  |
| Usunięcie `PROTECTED_ROUTES`                                | OK     | [`src/middleware.ts`](../../src/middleware.ts) — brak stałej |
| `requiresAuth` + redirect `/auth/signin`                    | OK     | middleware L17–18                                            |
| Kolejność: `getUser` → guard                                | OK     | middleware L8–18                                             |
| Komentarz „default chronione”                               | OK     | nagłówek w `route-access.ts` (L1–4)                          |
| Poza zakresem: redirect po login, `?redirect=`              | OK     | nie zaimplementowano (zgodnie z planem)                      |
| Automated 1.1–1.3                                           | OK     | Progress + commit                                            |
| Manual 1.4 (scenariusze 1–7)                                | OK     | potwierdzone przez użytkownika                               |
| Manual 1.5 (opcjonalny)                                     | OPEN   | Progress `[ ]` — akceptowalne                                |

---

## Findings

### F1 — README nieaktualny (WARNING)

**Severity:** WARNING · **Impact:** MEDIUM (wprowadza w błąd kolejnych agentów / devów)

[README.md](../../README.md) L156 nadal mówi o dodawaniu ścieżek do `PROTECTED_ROUTES`. Po F-03 publiczne trasy dodaje się w `src/lib/route-access.ts`.

**Rekomendacja:** Zaktualizować sekcję Auth routes (1 akapit + wzmianka o default deny).

---

### F2 — Statyczne assety w `public/` (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW (dziś brak plików poza `.assetsignore`)

Ścieżki typu `/favicon.png` nie są na allowliście → wylogowany klient dostaje 302 na favicon. Strona działa; ikona może nie załadować się na publicznym `/`.

**Rekomendacja:** Przy pierwszym assercie w `public/` dodać prefix (np. tylko jawne pliki) lub trzymać assety pod `/_astro` / CDN. Nie blokuje F-03.

---

### F3 — Dopasowanie prefiksu `/auth` (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW

`pathname.startsWith("/auth")` dopasuje też hipotetyczną trasę `/authentication`. Bezpieczniejszy wzorzec: `pathname === "/auth" || pathname.startsWith("/auth/")` (analogicznie dla `/api/auth`).

**Rekomendacja:** Refactor przy kolejnym dotyku auth routes; obecne trasy (`/auth/signin`, …) są poprawne.

---

### F4 — Progress 1.5 opcjonalny (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW

Scenariusz 8 (default deny na `/activities`) nie był wymagany do zamknięcia fazy; użytkownik potwierdził 1–7. `/dashboard` już dowodzi guarda; nowa ścieżka to dodatkowa pewność.

**Rekomendacja:** Oznaczyć 1.5 jako N/A w Progress albo jednorazowy curl na nieistniejącą ścieżkę.

---

### F5 — Nagłówek planu `Status: planned` (OBSERVATION)

**Severity:** OBSERVATION · **Impact:** LOW

[plan.md](./plan.md) L3: `**Status:** planned` — rozjazd z `change.md` (`implemented`). Progress i commity są aktualne.

**Rekomendacja:** Ustawić w plan.md `implementing` / `implemented` lub usunąć linię na rzecz `change.md`.

---

## End-state check (F-03)

| Cel roadmapy                              | Spełniony?                                               |
| ----------------------------------------- | -------------------------------------------------------- |
| Zalogowany rodzic na trasach produktowych | Tak — default deny                                       |
| Niezalogowany → logowanie                 | Tak — 302 `/auth/signin`                                 |
| Nowe strony bez edycji middleware         | Tak — tylko `route-access.ts` przy wyjątkach publicznych |

---

## Suggested follow-ups (poza tym review)

1. Poprawka README (F1) — ~2 min.
2. `/10x-archive app-route-auth-guards` po akceptacji review.
3. Opcjonalnie: test jednostkowy `isPublicPath` gdy pojawi się runner.

---

## Reviewer sign-off

Phase 1 implementation matches the approved plan. **Ready to archive** after README fix (recommended, not blocking).
