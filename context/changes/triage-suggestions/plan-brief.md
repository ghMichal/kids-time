# Triage suggestions (S-02) — Krótki plan

> Pełny plan: `context/changes/triage-suggestions/plan.md`
> Badania: `context/changes/triage-suggestions/research.md`

## Co i dlaczego

Rodzic po otrzymaniu propozycji AI musi móc **zaakceptować, odrzucić lub odłożyć** każdą kartę (FR-005). Bez tego nie ma metryki akceptacji ani trwałej ścieżki do biblioteki wydarzeń.

## Punkt wyjścia

S-01: transient `/suggestions` → karty bez akcji. F-01: schema `events.triage_status` + RLS gotowe. Brak API/UI zapisu decyzji.

## Pożądany stan końcowy

Na każdej karcie trzy decyzje; klik zapisuje wiersz `events` (`origin: ai_suggested`, właściwy status, w tym reject); karta znika z feedbackiem. Bez publikacji i bez uploadu obrazów.

## Kluczowe podjęte decyzje

| Decyzja         | Wybór                                   | Dlaczego (1 zdanie)                     | Źródło      |
| --------------- | --------------------------------------- | --------------------------------------- | ----------- |
| Status INSERT   | Od razu accepted/rejected/maybe         | Jeden INSERT = decyzja                  | Plan        |
| Reject          | Też zapisuje wiersz                     | Metryka + historia                      | Plan        |
| either          | `location_kind` NULL                    | Zero tarcia UX                          | Plan        |
| time            | `starts_at` NULL; tekst w `description` | Bez kruchego parsowania                 | Plan        |
| Obraz           | Bez `event-images` w S-02               | Unikamy SSRF; F-04 później              | Plan        |
| UX              | Karta znika + inline feedback           | Jasny progress                          | Plan        |
| Tożsamość karty | Stabilne `clientId` (UUID) w UI         | Unika bugów po filter/pending z indexem | Plan-review |
| API             | `POST /api/events/triage`               | Osobno od generowania AI                | Research    |

## Zakres

**W zakresie:**

- Zod + `lib/events` map/insert
- `POST /api/events/triage`
- Przyciski na `SuggestionCard` + wiring w `SuggestionsPage`
- README (krótko) + smoke E2E

**Poza zakresem:**

- Upload obrazów, signed URL
- Publish (S-05), biblioteka CRUD (S-04)
- Migracje, zmiana endpointu AI, toast library, test runner

## Architektura / Podejście

```
SuggestionCard onTriage
  → SuggestionsPage fetch POST /api/events/triage
  → Zod + createClient + INSERT events
  → 201 → remove card + feedback
```

## Fazy w skrócie

| Faza            | Co dostarcza                 | Kluczowe ryzyko                 |
| --------------- | ---------------------------- | ------------------------------- |
| 1. API triage   | Zod + insert + route         | Mapowanie kryteriów vs enumy DB |
| 2. UI decyzji   | Przyciski, pending, feedback | Double-submit / UX błędów       |
| 3. Smoke + docs | E2E + README                 | —                               |

**Wymagania wstępne:** S-01 done; lokalny Supabase / env; konto testowe.
**Szacowany wysiłek:** ~2–3 sesje w 3 fazach.

## Otwarte ryzyka i założenia

- Wiersze `rejected` pojawią się w przyszłej bibliotece — S-04 musi filtrować po statusie.
- Bez `image_path` zapisane wydarzenia nie mają trwałego obrazu do S-03/S-04.
- Brak cofnięcia decyzji z `/suggestions` (świadomie; S-04).

## Kryteria sukcesu (podsumowanie)

- Trzy decyzje działają end-to-end i zapisują poprawne `triage_status`.
- Reject też w DB; `is_published = false`.
- Lint + build przechodzą.
