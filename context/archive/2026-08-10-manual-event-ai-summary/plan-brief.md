# Manual event + AI summary — Krótki plan

> Pełny plan: `context/changes/manual-event-ai-summary/plan.md`

## Co i dlaczego

FR-003 / S-03: zalogowany rodzic ręcznie dodaje wydarzenie z opcjonalnym jednym obrazem i krótkim, edytowalnym podsumowaniem AI — żeby biblioteka nie zależała wyłącznie od triage propozycji i wspierać metrykę „wydarzenia z pomocą AI”.

## Punkt wyjścia

Schema, RLS, OpenRouter, bucket `event-images` i biblioteka CRUD są gotowe. Brak: create `origin: manual`, upload API, prompt summary z pól wydarzenia, UI formularza i podglądu obrazu właściciela.

## Pożądany stan końcowy

Na `/events` rodzic wypełnia formularz (pola jak edycja karty), opcjonalnie generuje/edytuje summary, opcjonalnie wybiera obraz, zapisuje — wydarzenie trafia do listy jako `accepted` z podglądem obrazu gdy upload się udał.

## Kluczowe podjęte decyzje

| Decyzja         | Wybór                                | Dlaczego (1 zdanie)                      |
| --------------- | ------------------------------------ | ---------------------------------------- |
| Obraz           | Opcjonalny                           | Niższy próg; FR-003 gdy obraz jest       |
| AI timing       | Generuj przed Save, edytowalne       | Kontrola rodzica; Save niezależny od AI  |
| AI input        | Tylko tekst                          | Reuse OpenRouter bez vision              |
| Status          | `accepted`                           | Od razu w filtrze biblioteki             |
| Pola            | Jak EventCard (bez `starts_at`)      | Spójność z S-04                          |
| AI fail         | Błąd + Save bez/z ręcznym summary    | Tworzenie nie zależy od OpenRouter       |
| Obraz lifecycle | Create + preview; bez replace w edit | Domknięcie FR-003 bez rozrostu slice     |
| Upload          | JSON create → multipart image API    | Helpery server-side; brak browser client |

## Zakres

**W zakresie:**

- `POST /api/ai/event-summary`, `POST /api/events`, `POST /api/events/[id]/image`
- Signed `imageUrl` na liście właściciela
- Formularz create + podgląd obrazu na `/events`

**Poza zakresem:**

- Wymagany obraz/summary, vision, replace/remove w edit, `starts_at`, cross-user image URL, migracje, test runner

## Architektura / Podejście

Island `/events` → Generate (OpenRouter) → Create (JSON, `manual`/`accepted`) → opcjonalny upload (Storage + `image_path`) → list z signed URL. Wzorce: suggestions API, triage insert, F-04 helpers.

## Fazy w skrócie

| Faza    | Co dostarcza                                     | Kluczowe ryzyko                                                              |
| ------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1. APIs | Summary + create + image upload                  | Upload bez owner check; orphan bez obrazu; smoke multipart File na adapterze |
| 2. List | Signed `imageUrl` w DTO (list + PATCH + publish) | Fail signed URL / wipe preview po edit/publish                               |
| 3. UI   | Formularz + preview + copy                       | Regresja edit/delete/publish; NFR progress AI                                |

**Wymagania wstępne:** F-01–F-04, S-04; lokalny Supabase; OpenRouter do smoke Generate.  
**Szacowany wysiłek:** ~2–3 sesje w 3 fazach.

## Otwarte ryzyka i założenia

- Fail upload po udanym create zostawia event bez obrazu (brak replace w S-03 — delete+recreate lub późniejszy slice).
- Published cudzy obraz nadal poza zakresem (dług F-04/S-05).
- `starts_at` pozostaje null / poza klientem jak w S-04.

## Kryteria sukcesu (podsumowanie)

- Rodzic tworzy ręczne wydarzenie z opcjonalnym AI summary i opcjonalnym obrazem.
- Lista pokazuje nowe eventy i podgląd własnego obrazu.
- Lint/build zielone; AI awaria nie blokuje zapisu.
