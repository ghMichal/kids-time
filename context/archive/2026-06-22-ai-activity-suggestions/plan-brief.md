# AI activity suggestions (S-01) — Krótki plan

> Pełny plan: `context/changes/ai-activity-suggestions/plan.md`
> Krótki opis ramowy: `context/changes/ai-activity-suggestions/frame.md`
> Badania: `context/changes/ai-activity-suggestions/research.md`

## Co i dlaczego

> **The actual problem to plan around is**: Zbudować pierwszy widoczny dla rodzica przepływ kryteria → propozycje AI z prawdziwym obrazem i linkiem (pełne FR-002), bez zapisu do `events` — rozstrzygając jak pozyskać i wyświetlić obraz transientnie.

North star S-01 udowadnia wartość produktu: rodzic po zalogowaniu dostaje zwięzłe propozycje AI zamiast długiej listy — z obrazem i linkiem do źródła.

## Punkt wyjścia

F-01–F-04 done: AI API (`POST /api/ai/suggestions`), auth guards, events schema, storage helpers. **Brak warstwy produktowej** — zero stron/komponentów wywołujących API. Schemat AI ma tylko tekst + `sourceUrl`; brak strategii obrazu. Frame: persist nie jest wymagany; F-04 upload nie pasuje do transient display z linków AI.

## Pożądany stan końcowy

Rodzic na `/suggestions` wypełnia kryteria → widzi 1–5 kart z tytułem, podsumowaniem, linkiem i **prawdziwym obrazem** (OG z `sourceUrl` gdy dostępny). Brak zapisu do Supabase. Triage → S-02.

## Kluczowe podjęte decyzje

| Decyzja          | Wybór                                 | Dlaczego (1 zdanie)                                | Źródło |
| ---------------- | ------------------------------------- | -------------------------------------------------- | ------ |
| Persist          | Transient only                        | North star = view, nie save; S-02 przejmuje triage | Frame  |
| FR-002           | Prawdziwy obraz (OG), nie placeholder | Wymaganie użytkownika przy frame                   | Frame  |
| Strategia obrazu | Server-side OG enricher po AI         | Wykorzystuje `sourceUrl`; bez halucynacji modelu   | Plan   |
| Pole `imageUrl`  | Warstwa API, nie OpenRouter           | Rozdzielenie text AI vs enricher                   | Plan   |
| Fallback OG      | Karta bez bloku obrazu                | Brak fałszywego placeholdera                       | Plan   |
| Storage F-04     | Poza S-01                             | Transient hotlink; bucket dla S-03/persist         | Frame  |
| API auth         | JSON 401 dla `/api/*`                 | `fetch` nie obsługuje 302 HTML                     | Plan   |
| Nawigacja        | Link Propozycje w Topbar              | Minimalna zmiana post-login flow                   | Plan   |

## Zakres

**W zakresie:**

- `/suggestions` + formularz kryteriów + `fetch` API
- Loading UX, obsługa błędów API
- OG enricher + wyświetlanie obrazu na kartach
- JSON 401, README, manual smoke

**Poza zakresem:**

- INSERT/UPDATE `events`, triage UI (S-02)
- `uploadEventImage`, signed URL, browser Supabase client
- Streaming SSE, zmiana modelu AI
- Test runner

## Architektura / Podejście

Astro shell (`Layout` → `AppShell` → `PanelCard`) + React island `SuggestionsPage` (`client:load`). Formularz `fetch`uje istniejące API; handler po `generateSuggestions` wywołuje `enrichSuggestionImages` (równoległe OG fetch). UI renderuje karty z hotlinkiem do `imageUrl` lub tekst-only przy braku OG.

## Fazy w skrócie

| Faza              | Co dostarcza                                 | Kluczowe ryzyko                                   |
| ----------------- | -------------------------------------------- | ------------------------------------------------- |
| 1. UI + formularz | Strona, formularz, karty tekst+link, loading | Długi timeout OpenRouter bez UX loading           |
| 2. OG + obrazy    | Enricher, `imageUrl` w API, karty z `<img>`  | OG niedostępny / hotlink block — karta bez obrazu |
| 3. Auth + docs    | 401 JSON, README, smoke                      | Regresja redirectów HTML dla stron                |

**Wymagania wstępne:** F-01–F-04 done; `OPENROUTER_*` w `.dev.vars`; konto testowe Supabase.
**Szacowany wysiłek:** ~3 sesje implementacji w 3 fazach.

## Otwarte ryzyka i założenia

- Część stron nie ma OG lub blokuje hotlink — karty bez obrazu (akceptowalne MVP).
- Łączna latencja AI + OG może przekroczyć 30s — loading musi być czytelny.
- Model może zwracać `sourceUrl` bez obrazów — zależność od jakości promptu F-02.

## Kryteria sukcesu (podsumowanie)

- Zalogowany rodzic: kryteria → propozycje z linkiem i obrazem (gdy OG działa).
- Brak zapisu do `events`.
- `npm run lint` + `npm run build` przechodzą.
