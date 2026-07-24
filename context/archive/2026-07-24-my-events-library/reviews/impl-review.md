<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: My events library (S-04)

- **Plan**: context/changes/my-events-library/plan.md
- **Zakres**: Fazy 1–3 z 3
- **Data**: 2026-07-24
- **Werdykt**: NEEDS ATTENTION
- **Ustalenia**: 0 krytycznych 3 ostrzeżeń 1 obserwacja

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura            | PASS    |
| Spójność wzorców        | PASS    |
| Kryteria sukcesu        | PASS    |

## Automated / Manual

- Automated: `npx astro sync` + `npm run lint` + `npm run build` — PASS (re-run 2026-07-24)
- Manual Progress 1.2–1.5, 2.2–2.5, 3.2–3.4 — `[x]` (user-confirmed)

## Ustalenia

### F1 — `source_url` renderowany bez ograniczenia schematu

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — prawdziwy kompromis; warto przemyśleć granicę walidacji
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/events/EventCard.tsx:258
- **Szczegóły**: Link „Zobacz źródło” ustawia `href={event.source_url}` (jest `noopener noreferrer`). S-04 nie edytuje `source_url`, ale wartość pochodzi z triage (`z.url()` bez wymogu https). Niebezpieczny schemat mógłby trafić do href.
- **Poprawka A ⭐ Zalecana**: Renderuj link tylko gdy URL zaczyna się od `https://` (ew. `http://`); inaczej pokaż tekst bez href.
  - Siła: Tania obrona w miejscu renderu biblioteki; nie blokuje S-05.
  - Kompromis: Nie naprawia źródła w triage.
  - Pewność: HIGH — typowy pattern allowlist schematu.
  - Martwy punkt: Czy Zod `z.url()` już odrzuca `javascript:` w tej wersji.
- **Poprawka B**: Wymuś https w schema triage + library.
  - Siła: Naprawa u źródła zapisu.
  - Kompromis: Szerszy touch (S-02 path); poza wąskim S-04.
  - Pewność: MED — wymaga regresji smoke suggestions.
  - Martwy punkt: Istniejące wiersze w DB z non-https URL.
- **Decyzja**: PENDING

### F2 — Cleanup storage przy DELETE kontynuuje mimo błędu

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — kolejność cleanup vs delete ma realne stany awarii
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/events/delete-own-event.ts:25-33
- **Szczegóły**: Plan wymagał `removeEventImage` gdy `image_path` — jest. Przy `EventImageError` kod kontynuuje DELETE wiersza. Dziś S-02 rows mają `image_path: null` (no-op), więc ryzyko praktycznie przyszłe (S-03).
- **Poprawka A ⭐ Zalecana**: Zostaw jak jest + krótki komentarz „best-effort cleanup; orphans OK until S-03 hardens storage”.
  - Siła: Zgodne z planem MVP; brak obrazów w S-04.
  - Kompromis: Orphan objects możliwe później.
  - Pewność: HIGH — plan explicite defensive no-op dla null path.
  - Martwy punkt: Zachowanie `EventImageError` vs inne błędy storage.
- **Poprawka B**: Najpierw DELETE wiersza, potem best-effort remove.
  - Siła: UI/DB spójne nawet przy awarii storage.
  - Kompromis: Możliwy orphan file zamiast dangling path.
  - Pewność: MED — zależy od pożądanego modelu awarii.
  - Martwy punkt: Retry/queue poza zakresem.
- **Decyzja**: PENDING

### F3 — Nieplanowany fix auth w tym samym change

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — szybka decyzja; zmiana już zmerge’owana w p3
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/components/auth/SubmitButton.tsx (+ SignIn/SignUp)
- **Szczegóły**: Usunięto `useFormStatus` (crash SSR islandów). Poza planem S-04, ale odblokowało manual QA. Harmless EXTRA.
- **Poprawka**: Zaakceptuj jako incidental fix i ewentualnie 1 linia w Notes change.md / follow-up. Bez revertu.
- **Decyzja**: PENDING

### F4 — Lista bez paginacji

- **Ważność**: OBSERVATION
- **Wpływ**: 🏃 LOW
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/events/list-own-events.ts:54
- **Szczegóły**: Unbounded SELECT — zgodne z planem MVP („brak paginacji”).
- **Poprawka**: Nic teraz; limit/paginacja gdy volume urośnie.
- **Decyzja**: PENDING
