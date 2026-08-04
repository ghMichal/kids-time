# Publish shared event — Krótki plan

> Pełny plan: `context/changes/publish-shared-event/plan.md`
> Badania: `context/changes/publish-shared-event/research.md`

## Co i dlaczego

Domknięcie **FR-006 / S-05**: rodzic świadomie publikuje wydarzenie z biblioteki tylko do odczytu dla innych zalogowanych rodziców oraz może przeglądać cudze published. Akceptacja triage bez publish pozostaje prywatna.

## Punkt wyjścia

S-04 daje `/events` (list/edit/delete własnych accepted/maybe). F-01 ma kolumny i RLS publish; aplikacja nie wystawia publish ani browse — PATCH celowo blokuje `is_published`.

## Pożądany stan końcowy

Z biblioteki: Opublikuj + confirm → badge „Opublikowane”. Na `/events/shared`: read-only lista cudzych published, link w Topbar. Publish przez dedykowany POST z serwerowym `published_at`.

## Kluczowe podjęte decyzje

| Decyzja          | Wybór                                 | Dlaczego (1 zdanie)        | Źródło   |
| ---------------- | ------------------------------------- | -------------------------- | -------- |
| Browse path      | `/events/shared`                      | Hierarchia obok biblioteki | Plan     |
| Zawartość browse | Tylko cudze                           | Bez dublowania `/events`   | Plan     |
| Publish API      | `POST …/[id]/publish`                 | Chroni kontrakt PATCH S-04 | Research |
| Po publish UI    | Badge + ukryj przycisk                | Jasny stan bez FR-008      | Plan     |
| Confirm          | Inline (jak Usuń)                     | Świadoma publikacja        | Plan     |
| Błędy            | 409 already_published / 404 not_found | Jawne stany dla UI         | Plan     |

## Zakres

**W zakresie:** publish API + lib, DTO publish fields, UI biblioteki, browse API/strona, Topbar.

**Poza zakresem:** unpublish/copy (FR-008/009), AI filter public (FR-007), published image read (dług F-04), migracje, zmiany auth allowlist, test runner.

## Architektura / Podejście

`publish-own-event` → `POST /api/events/[id]/publish`; lista własna nadal z `owner_id` + nowe pola DTO. Browse: `list-published-events` (`is_published` + `neq owner_id`) → `GET /api/events/shared` → island read-only na `/events/shared`.

## Fazy w skrócie

| Faza | Co dostarcza                 | Kluczowe ryzyko                                    |
| ---- | ---------------------------- | -------------------------------------------------- |
| 1    | Publish API + DTO biblioteki | Pomyłka: reuse GET /api/events bez filtra owner_id |
| 2    | Confirm + badge na EventCard | Przypadkowy publish bez confirm / brak obsługi 409 |
| 3    | `/events/shared` + Topbar    | Własne wiersze na browse lub mutacje na cudzych    |

**Wymagania wstępne:** S-04 zarchiwizowane; lokalny Supabase + dwa konta do smoke browse.
**Szacowany wysiłek:** ~1–2 sesje w 3 fazach.

## Otwarte ryzyka i założenia

- Brak unpublish do FR-008 — delete z biblioteki usuwa wiersz całkowicie (akceptowalne w S-05).
- Roadmap nadal nie śledzi formalnie prd-v2 FR-008/009 (poza zakresem tej zmiany).

## Kryteria sukcesu (podsumowanie)

- Rodzic publikuje świadomie; inny rodzic widzi tylko read-only na `/events/shared`.
- Niepublished accepted nie wycieka do innych.
- Lint + build zielone; regresja biblioteki S-04 zachowana.
