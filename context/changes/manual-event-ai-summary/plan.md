# Plan wdrożenia: Manual event + AI summary (S-03)

## Przegląd

Wdrażamy **S-03 / FR-003**: zalogowany rodzic na **`/events`** ręcznie dodaje wydarzenie (pola jak edycja biblioteki), opcjonalnie generuje krótkie podsumowanie AI z pól tekstowych, może je edytować lub pominąć, opcjonalnie dokłada jeden obraz, zapisuje do biblioteki jako `origin: manual` / `triage_status: accepted`, a lista pokazuje podgląd obrazu właściciela.

**Decyzje podjęte** (sesja planowania):

| Decyzja           | Wybór                                                   | Uzasadnienie                                                   | Źródło |
| ----------------- | ------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Obraz             | Opcjonalny przy create                                  | Niższy próg; FR-003 nadal spełnione gdy obraz jest             | Plan   |
| Moment AI         | Osobny „Generuj” przed Save; user widzi/edytuje summary | Kontrola rodzica; Save niezależny od AI                        | Plan   |
| Wejście AI        | Tylko pola tekstowe (bez wizji)                         | Reuse OpenRouter text path; brak multimodal w repo             | Plan   |
| Status po create  | `triage_status: accepted`                               | Od razu w filtrze biblioteki S-04                              | Plan   |
| Pola formularza   | Jak `EventCard` edit (bez `starts_at`)                  | Spójność z S-04; `starts_at` celowo poza edycją                | Plan   |
| AI fail           | Błąd widoczny; Save z pustym lub ręcznym summary        | Tworzenie wydarzenia nie zależy od OpenRouter                  | Plan   |
| Summary           | Opcjonalne, edytowalne                                  | Korekta AI + odporność na awarie                               | Plan   |
| Obraz poza create | Upload + podgląd w liście; bez replace/remove w edycji  | Domknięcie FR-003 visible; lifecycle edycji później            | Plan   |
| Upload            | `POST` create (JSON) → opcjonalnie multipart image API  | Brak browser Supabase client; helpery server-side już istnieją | Plan   |
| Podgląd           | Signed URL w `GET /api/events` dla właściciela          | Bucket `event-images` jest prywatny                            | Plan   |

## Analiza stanu obecnego

- **F-01:** `events` ma `summary`, `image_path`, `origin` (`ai_suggested` \| `manual`), RLS owner CRUD.
- **F-02:** OpenRouter HTTP + Zod + timeout 25s (`generateSuggestions`); brak ścieżki „summary z pól wydarzenia”.
- **F-04:** bucket `event-images`, limity 5 MB / jpeg|png|webp, `uploadEventImage` / `removeEventImage`; brak route API.
- **S-02:** jedyny INSERT — `POST /api/events/triage` → `origin: ai_suggested`, `image_path: null`.
- **S-04:** `GET`/`PATCH`/`DELETE` na `/events`; DTO bez `image_path`; edycja bez `starts_at`; copy UI sugeruje tylko propozycje AI.
- **S-05:** publish gotowy; cross-user image read nadal dług (poza S-03 — tu tylko owner preview).

### Kluczowe odkrycia:

- Wzorzec AI API: `src/pages/api/ai/suggestions.ts` + `OpenRouterError` taxonomy.
- Wzorzec create: `src/lib/events/create-event-from-suggestion.ts` + `src/pages/api/events/triage.ts`.
- Upload helper: `src/lib/storage/event-image.ts` (`uploadEventImage`, `validateEventImageFile`).
- Lista: `src/lib/events/list-own-events.ts` — dodać `image_path` / `imageUrl`; filtr `owner_id` + `accepted`/`maybe` zostaje.
- Storage RLS sprawdza tylko segment `owner_id` w path — app musi zweryfikować, że `event_id` należy do ownera przed uploadem.
- Brak test runnera — weryfikacja: `npx astro sync`, `npm run lint`, `npm run build` + smoke ręczny.

## Pożądany stan końcowy

1. Na `/events` jest formularz „Dodaj wydarzenie” z polami jak edycja karty + opcjonalny plik obrazu + przycisk Generuj podsumowanie + Save.
2. Generate woła AI, wypełnia edytowalne pole summary (≤200); błąd AI nie blokuje Save.
3. Save tworzy wiersz `origin: manual`, `triage_status: accepted`, `is_published: false`; przy pliku uploaduje do Storage i zapisuje `image_path`.
4. Lista biblioteki pokazuje miniaturę/podgląd obrazu właściciela (signed URL) gdy `image_path` ustawione.
5. Empty-state / copy nie sugerują już wyłącznie propozycji AI.
6. `npm run lint` + `npm run build`; smoke z sesją + lokalnym Supabase (+ OpenRouter dla Generate).

## Czego NIE robimy

- Wymaganie obrazu lub summary przy Save.
- Multimodal / vision na obrazie.
- Replace/remove obrazu w inline edit `EventCard` (poza create).
- Edycja / ustawianie `starts_at` z klienta.
- Zmiana `triage_status` / `origin` po create; publish/unpublish/copy (S-05 / prd-v2).
- Cross-user signed URL dla cudzych published (dług S-05/F-04).
- Direct browser upload (brak `createBrowserClient`).
- Migracje SQL (kolumny/bucket już są).
- Soft delete, toast library, test runner, paginacja.

## Podejście do implementacji

```mermaid
sequenceDiagram
  participant UI as EventsLibraryPage
  participant Sum as POST_api_ai_event_summary
  participant Create as POST_api_events
  participant Img as POST_api_events_id_image
  participant List as GET_api_events
  participant OR as OpenRouter
  participant DB as Supabase
  participant St as Storage

  UI->>Sum: pola tekstowe
  Sum->>OR: chat completions
  OR-->>UI: summary
  UI->>Create: JSON manual event
  Create->>DB: insert origin=manual accepted
  DB-->>UI: event id
  opt obraz wybrany
    UI->>Img: multipart file
    Img->>St: uploadEventImage
    Img->>DB: update image_path
  end
  UI->>List: refresh
  List->>St: createSignedUrl (owner)
  List-->>UI: events + imageUrl
```

Warstwy: **Zod + `lib/ai` + `lib/events` + `lib/storage`** → **API routes** → **rozszerzenie island `/events`**.

## Krytyczne szczegóły implementacji

- **Kolejność create → upload:** path Storage wymaga `event_id`; najpierw INSERT, potem multipart upload, potem `UPDATE image_path`. Przy failu uploadu event bez obrazu zostaje — UI pokazuje błąd uploadu; user może dokończyć później poza tym slice (brak replace w S-03) albo usunąć i dodać ponownie.
- **Owner check przed uploadem:** potwierdź wiersz `events.id` + `owner_id = locals.user.id` (404 jeśli brak), potem `uploadEventImage` — storage RLS nie waliduje `event_id`.
- **Multipart na Workerze:** F-04 unikał proxy uploadu; tu JSON create → multipart image API (brak browser Supabase client). W route: `await request.formData()`, pole `file` jako `File`/`Blob`, przekaż `name`/`type` do `uploadEventImage`. Przed Fazą 3 obowiązkowy smoke lokalny z plikiem ~1–5 MB (nie tylko curl z JSON).
- **NFR progress:** Generate i Save z obrazem mogą trwać >2s — spinner / disabled + komunikat postępu (wzór SuggestionsPage).
- **`summary` w Zod create:** opcjonalne `null` lub string 1–200 po trim; puste string → `null`. PATCH biblioteki nadal wymaga `min(1)` gdy pole jest wysyłane — bez zmiany kontraktu edycji.

## Faza 1: AI summary + create + image APIs

### Przegląd

Ścieżki serwerowe: generowanie summary, INSERT manual event, upload jednego obrazu z zapisem `image_path`.

### Wymagane zmiany:

#### 1. Schema + prompt AI summary

**Plik**: `src/lib/ai/event-summary-request.schema.ts` (nowy), `src/lib/ai/event-summary-response.schema.ts` (nowy), `src/lib/ai/build-event-summary-prompt.ts` (nowy)

**Cel**: Zwalidować wejście Generate (pola jak formularz create) i wyjście `{ summary }` ≤200 znaków; zbudować prompt PL „krótkie podsumowanie wydarzenia dla rodzica”.

**Kontrakt**: Request: `title` (wymagany), opcjonalne `description`, `place`, `childAge`, `locationKind`. Response: `{ summary: string }` max 200. OpenRouter `response_format` JSON schema jak w suggestions.

#### 2. OpenRouter: `generateEventSummary`

**Plik**: `src/lib/ai/openrouter-client.ts`

**Cel**: Dodać funkcję równoległą do `generateSuggestions` — ten sam URL, timeout, taxonomy `OpenRouterError`, inny prompt/schema.

**Kontrakt**: `generateEventSummary(input): Promise<{ summary: string }>`. Nie zmieniać zachowania `generateSuggestions`.

#### 3. API Generate

**Plik**: `src/pages/api/ai/event-summary.ts` (nowy)

**Cel**: Authenticated `POST` JSON → summary; mapowanie błędów jak `suggestions.ts` (401/400/503/504/502/500).

**Kontrakt**: `export const prerender = false`; body przez `eventSummaryRequestSchema`; sukces `{ summary }`.

#### 4. Create manual event (lib + schema)

**Plik**: `src/lib/events/manual-event-create.schema.ts` (nowy), `src/lib/events/create-manual-event.ts` (nowy)

**Cel**: Zmapować body create → `TablesInsert<"events">` z `origin: "manual"`, `triage_status: "accepted"`, `is_published: false`, `image_path: null`, `starts_at: null`, `source_url: null`, `owner_id` z sesji.

**Kontrakt**: Wymagane: `title`. Opcjonalne: `summary`, `description`, `place`, `childAge`, `locationKind` (nullable jak PATCH). Zwróć DTO zgodne z listą (lub minimalne `{ id, ... }` do refresh). Błąd insert → `insert_failed`.

#### 5. `POST /api/events`

**Plik**: `src/pages/api/events/index.ts`

**Cel**: Obok istniejącego `GET` dodać `POST` create manual; zachować `GET` bez regresji.

**Kontrakt**: JSON + Zod; 201 `{ event }`; 401/400/503/500 jak siblings.

#### 6. Image upload API

**Plik**: `src/pages/api/events/[id]/image.ts` (nowy), ewentualnie cienki helper w `src/lib/events/` do update `image_path`

**Cel**: Multipart `file` → walidacja MIME/size → owner+event check → `uploadEventImage` → `UPDATE events.image_path`.

**Kontrakt**: Tylko owner; `request.formData()` → pole `file` (`File`/`Blob` + `filename`/`contentType`); 200/201 z `{ imagePath }` (i ewentualnie signed URL); 400 invalid file; 404 missing event; mapuj `EventImageError` na 4xx/5xx. Bez replace UI — endpoint może użyć `uploadEventImage` (upsert) lub `replaceEventImage` jeśli path już istnieje (defensywnie).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx astro sync` przechodzi
- `npm run lint` przechodzi
- `npm run build` przechodzi (z wymaganymi env)

#### Weryfikacja ręczna:

- `POST /api/ai/event-summary` z sesją zwraca summary ≤200; bez sesji 401; bez OpenRouter 503
- `POST /api/events` tworzy wiersz `origin=manual`, `triage_status=accepted`, `image_path=null`
- `POST /api/events/:id/image` multipart (`formData` + File jpeg ≤5MB) ustawia `image_path`; zły MIME / >5MB → 400; cudze/nieistniejące id → 404; smoke lokalny na Astro/CF adapter przed Fazą 3
- `GET /api/events` nadal listuje accepted/maybe właściciela

**Uwaga implementacyjna**: Po tej fazie zatrzymaj się na ręczne potwierdzenie przed Fazą 2.

---

## Faza 2: List DTO + signed image URL

### Przegląd

Biblioteka zwraca podgląd obrazu dla właściciela, bez zmiany reguł filtra listy.

### Wymagane zmiany:

#### 1. Signed URL helper

**Plik**: `src/lib/storage/event-image.ts` (lub `src/lib/storage/event-image-url.ts` nowy)

**Cel**: Dla znanego `image_path` właściciela wygenerować krótkożyjący signed URL (Supabase `createSignedUrl`).

**Kontrakt**: Wejście: client, path, ownerId (assert owner path). Wyjście: `string | null` przy failu (nie wywracać całej listy). TTL krótki (np. 1h) — wystarczy na sesję UI.

#### 2. Rozszerzenie list DTO

**Plik**: `src/lib/events/list-own-events.ts`, konsumenci typów (`EventCard`, shared types jeśli potrzeba)

**Cel**: Select `image_path`; do DTO dodać `imageUrl: string | null` (signed); nie eksponować raw path w UI jeśli niepotrzebne (path może zostać w DTO wewnętrznie lub tylko `imageUrl`).

**Kontrakt**: `LibraryEventDto` zyskuje `imageUrl: string | null`. Filtr `owner_id` + `accepted`/`maybe` bez zmian.

#### 3. Spójność list / PATCH / publish (ten sam DTO)

**Plik**: `src/lib/events/list-own-events.ts`, `src/lib/events/update-own-event.ts`, `src/lib/events/publish-own-event.ts` (trzy kopie `toLibraryEventDto` + SELECT; opcjonalnie wspólny mapper)

**Cel**: EventCard robi full replace stanu z odpowiedzi PATCH i publish — te odpowiedzi muszą zwracać signed `imageUrl` tak jak lista. DELETE (`[id].ts`) zwraca 204 bez body — bez zmian DTO.

**Kontrakt**: We wszystkich trzech mapperach: SELECT zawiera `image_path`; DTO ma `imageUrl` (null jeśli brak path / signed fail). Nie zwracaj `imageUrl: null` gdy path istnieje, bo UI zgubi podgląd po edycji/publikacji.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna:

- Event z `image_path` na liście API ma niepusty `imageUrl` dla właściciela
- Event bez obrazu ma `imageUrl: null`
- Fail signed URL nie zwala całego `GET /api/events`
- PATCH i publish dla eventu z obrazem zwracają niepusty `imageUrl` (podgląd nie znika po edycji/publikacji)

**Uwaga implementacyjna**: Po tej fazie zatrzymaj się na ręczne potwierdzenie przed Fazą 3.

---

## Faza 3: UI create flow + image preview

### Przegląd

Formularz create na `/events`, Generate → edycja summary → Save (+ opcjonalny upload), podgląd obrazu na karcie, zaktualizowany copy empty-state.

### Wymagane zmiany:

#### 1. Formularz create (island)

**Plik**: `src/components/events/EventsLibraryPage.tsx` i/lub `src/components/events/ManualEventForm.tsx` (nowy)

**Cel**: UI: pola jak edit (`title`, `summary`, `description`, `place`, `childAge`, `locationKind`), file input opcjonalny, Generuj, Zapisz; stany loading/error PL; po sukcesie odśwież listę / prepend event.

**Kontrakt**: Generate → `POST /api/ai/event-summary` (nie blokuje Save przy błędzie). Save → `POST /api/events` → jeśli File, `POST /api/events/:id/image`. Progress >2s widoczny. Walidacja client-side zgodna z Zod (title wymagany, summary ≤200, age 0–18).

#### 2. Podgląd obrazu na karcie

**Plik**: `src/components/events/EventCard.tsx`

**Cel**: Gdy `imageUrl`, pokaż obraz (wzorzec `SuggestionCard`); bez UI replace/remove.

**Kontrakt**: Brak zmian w polach edycji inline; obraz tylko read-only w widoku karty.

#### 3. Copy / empty state

**Plik**: `src/components/events/EventsLibraryPage.tsx`

**Cel**: Nagłówek i empty-state uwzględniają ręczne dodawanie (nie tylko „z propozycji AI”); CTA może wskazywać formularz create lub `/suggestions`.

**Kontrakt**: Teksty PL spójne z resztą UI.

#### 4. Docs (krótko)

**Plik**: `README.md` (tylko jeśli lokalny flow create/upload wymaga wzmianki obok istniejących API notes)

**Cel**: Jedno zdanie o ręcznym create + opcjonalnym obrazie / Generate, jeśli README już dokumentuje event APIs.

**Kontrakt**: Bez osobnego przewodnika; pomiń jeśli README nie ma sekcji events.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna:

- Happy path: wypełnij pola → Generuj → popraw summary → wybierz obraz → Zapisz → karta z summary i obrazem na liście
- Save bez Generate i bez obrazu działa (`summary` null, brak `imageUrl`)
- Błąd Generate pokazuje komunikat; Save nadal dostępny
- Zły plik (typ/rozmiar) pokazuje błąd; event utworzony wcześniej zachowuje się zgodnie z Fazą 1 (komunikat upload fail)
- Inline edit/delete/publish bez regresji
- Niezalogowany nie wchodzi na `/events` (istniejący guard)

**Uwaga implementacyjna**: Po Fazie 3 — pełny smoke S-03; potem `/10x-impl-review` lub `/10x-archive` według workflow kursu.

---

## Strategia testowania

### Testy jednostkowe:

- Brak runnera — nie dodajemy w tym slice.
- Opcjonalnie później: Zod schemas summary/create; mapowanie insert manual.

### Testy integracyjne:

- Brak — smoke przez API + UI lokalnie.

### Kroki testowania ręcznego:

1. Zaloguj się; otwórz `/events`; dodaj wydarzenie z Generate + obrazem; potwierdź w UI i w Supabase (`origin`, `triage_status`, `image_path`).
2. Dodaj wydarzenie bez Generate/obrazu; potwierdź listę.
3. Wywołaj Generate przy wyłączonym kluczu / złym modelu — błąd; Save OK.
4. Upload nie-jpeg/png/webp lub >5MB — błąd walidacji.
5. Edycja/usuwanie/publikacja istniejącej karty bez regresji; delete czyści storage gdy był obraz.

## Uwagi dotyczące wydajności

- OpenRouter do 25s — UI progress obowiązkowy na Generate.
- Signed URL: generować per list item; przy failu null; unikać serial bottleneck jeśli lista duża (MVP: sekwencyjnie OK, Promise.all akceptowalne).
- Obraz max 5 MB — bez resize w MVP.

## Uwagi dotyczące migracji

- Brak migracji SQL.
- Istniejące wiersze AI bez `image_path` — `imageUrl: null`; bez backfill.

## Referencje

- Roadmap S-03: `context/foundation/roadmap.md`
- PRD FR-003: `context/foundation/prd-v2.md`
- F-04 archive: `context/archive/2026-06-22-event-image-storage/plan.md`
- S-04 archive: `context/archive/2026-07-24-my-events-library/plan.md`
- AI scaffold: `context/archive/2026-05-26-ai-suggestion-scaffold/plan.md`
- Lessons: `context/foundation/lessons.md`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Faza 1: AI summary + create + image APIs

#### Automatyczne

- [x] 1.1 `npx astro sync` przechodzi — 7c21360
- [x] 1.2 `npm run lint` przechodzi — 7c21360
- [x] 1.3 `npm run build` przechodzi (z wymaganymi env) — 7c21360

#### Ręczne

- [x] 1.4 `POST /api/ai/event-summary` z sesją zwraca summary ≤200; bez sesji 401; bez OpenRouter 503 — 7c21360
- [x] 1.5 `POST /api/events` tworzy wiersz `origin=manual`, `triage_status=accepted`, `image_path=null` — 7c21360
- [x] 1.6 `POST /api/events/:id/image` multipart File jpeg ≤5MB ustawia `image_path`; zły MIME / >5MB → 400; cudze/nieistniejące id → 404; smoke lokalny adaptera — 7c21360
- [x] 1.7 `GET /api/events` nadal listuje accepted/maybe właściciela — 7c21360

### Faza 2: List DTO + signed image URL

#### Automatyczne

- [x] 2.1 `npm run lint` przechodzi — 8900244
- [x] 2.2 `npm run build` przechodzi — 8900244

#### Ręczne

- [x] 2.3 Event z `image_path` na liście API ma niepusty `imageUrl` dla właściciela — 8900244
- [x] 2.4 Event bez obrazu ma `imageUrl: null` — 8900244
- [x] 2.5 Fail signed URL nie zwala całego `GET /api/events` — 8900244
- [x] 2.6 PATCH i publish dla eventu z obrazem zwracają niepusty `imageUrl` — 8900244

### Faza 3: UI create flow + image preview

#### Automatyczne

- [x] 3.1 `npm run lint` przechodzi — c824900
- [x] 3.2 `npm run build` przechodzi — c824900

#### Ręczne

- [x] 3.3 Happy path: Generuj → popraw summary → obraz → Zapisz → karta z summary i obrazem — c824900
- [x] 3.4 Save bez Generate i bez obrazu działa — c824900
- [x] 3.5 Błąd Generate pokazuje komunikat; Save nadal dostępny — c824900
- [x] 3.6 Zły plik pokazuje błąd uploadu zgodnie z Fazą 1 — c824900
- [x] 3.7 Inline edit/delete/publish bez regresji — c824900
- [x] 3.8 Niezalogowany nie wchodzi na `/events` — c824900
