<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Manual event + AI summary (S-03)

- **Plan**: context/changes/manual-event-ai-summary/plan.md
- **Zakres**: Fazy 1–3 z 3
- **Data**: 2026-08-10
- **Werdykt**: APPROVED
- **Ustalenia**: 0 krytycznych 2 ostrzeżenia 1 obserwacja

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | PASS    |
| Bezpieczeństwo i jakość | WARNING |
| Architektura            | PASS    |
| Spójność wzorców        | PASS    |
| Kryteria sukcesu        | PASS    |

## Ustalenia

### F1 — Orphan storage przy failu UPDATE po uploadzie

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/events/upload-own-event-image.ts:47–71
- **Szczegóły**: Upload/replace do Storage może się udać, a UPDATE events.image_path potem paść → 500, obiekt w bucketcie bez ścieżki w wierszu (orphan).
- **Poprawka**: Przy update_failed / missing row best-effort removeEventImage(uploadedPath).
- **Decyzja**: FIXED

### F2 — replaceEventImage usuwa stary obiekt przed uploadem

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — w S-03 UI nie robi replace; dotyczy re-upload API
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/storage/event-image.ts:195–224
- **Szczegóły**: Przy istniejącym image_path helper wołał delete-then-upload. Fail uploadu zostawiał DB path wskazujący na usunięty obiekt.
- **Poprawka**: Upload nowego klucza → best-effort delete old (gdy path ≠ new); usunięto removeAllInEventFolder przed uploadem.
- **Decyzja**: FIXED

### F3 — Create bez rollbacku obrazu przy failu uploadu

- **Ważność**: OBSERVATION
- **Wpływ**: 🏃 LOW
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: ManualEventForm.tsx (create → image)
- **Szczegóły**: Po udanym create fail uploadu zostawiał event bez obrazu + warning; brak ścieżki dokończenia.
- **Poprawka**: Panel retry po failu uploadu (pendingUploadEventId + Spróbuj ponownie / Pomiń), bez replace UI na EventCard.
- **Decyzja**: FIXED
