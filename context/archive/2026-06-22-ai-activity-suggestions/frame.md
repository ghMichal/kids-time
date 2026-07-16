# Frame Brief: S-01 AI activity suggestions

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

Fundamenty F-01–F-04 są gotowe (events + RLS, AI API, auth guards, storage helpers),
ale **rodzic po zalogowaniu nie może przejść przepływu S-01**: brak strony produktowej,
brak wywołania `POST /api/ai/suggestions`, brak wyświetlania propozycji z obrazem i linkiem
(FR-001, FR-002). Research wymienia 7 luk i 7 otwartych pytań naraz.

## Initial Framing (preserved)

- **User's stated cause or approach**: S-01 to end-to-end slice łączący UI + AI + storage
  - opcjonalnie zapis do `events` — pierwszy widoczny produkt po fundamentach.
- **User's proposed direction**: Zaplanować i zbudować pełny north star zgodnie z
  `change.md` i research (formularz → propozycje z obrazem i linkiem).
- **Pre-dispatch narrowing**: Użytkownik nie był pewien, który element jest głównym
  problemem — potrzebował rozróżnienia objaw vs przyczyna. Po badaniu hipotez:
  - **FR-002 bar**: pełne FR-002 (prawdziwy obraz, nie placeholder) przed zamknięciem S-01
  - **Persist bar**: tylko wyświetlanie transient — **bez** INSERT do `events`

## Dimension Map

Obserwacja mogła pochodzić z któregokolwiek z tych wymiarów:

1. **Product visibility** — brak UI/strony wywołującej API; rodzic nie widzi produktu
2. **Image architecture** — FR-002 wymaga obrazu, ale strategia pozyskania/wyświetlenia
   jest nierozstrzygnięta (OG-fetch, URL zewnętrzny, schema AI, F-04 upload)
3. **Scope coupling** — traktowanie UI + obrazów + persist `events` jako jednego
   obowiązkowego pakietu ← **początkowe ramowanie**
4. **Persistence assumption** — założenie, że north star wymaga zapisu do `events`
   i ścieżki F-04 (INSERT → upload → `image_path`)

## Hypothesis Investigation

| Hypothesis                                                                 | Evidence                                                                                                                                                                                                                           | Verdict                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **A: Główna luka to brak UI** — API gotowe, wystarczy strona + `fetch`     | Zero callerów w `src/`; API kompletne (`suggestions.ts:12-51`); auth via middleware (`middleware.ts:17-18`); tylko `dashboard.astro` jako produkt                                                                                  | **STRONG** dla tekst+link; **niewystarczające** dla pełnego FR-002 |
| **B: Główna luka to architektura obrazu** — bez decyzji plan będzie błędny | Schemat AI bez pola obrazu (`suggestion-response.schema.ts:3-16`); F-02 wyłączył obrazy (`ai-suggestion-scaffold/plan.md:44`); F-04 = Blob upload, nie URL z internetu (`event-image.ts:35-41`); FR-002 must-have (`prd-v2.md:91`) | **STRONG**                                                         |
| **C: Problem to zbyt szeroki zakres** — persist nie jest wymagany w S-01   | FR-002 = „view”, nie save; triage/persist → S-02 (`roadmap.md`); change.md: persist opcjonalny; F-02/F-04 odłożyły zapis DB                                                                                                        | **STRONG**                                                         |
| **D: North star wymaga pipeline events+storage**                           | `events` schema gotowa, F-04 helpers gotowe — ale roadmap S-01 = „udowodnij propozycje”, nie biblioteka; F-01 risk: persist „jeśli propozycje mają być trwałe” (`roadmap.md:77`)                                                   | **WEAK** — infra gotowa, nie oznacza obowiązku w S-01              |

## Narrowing Signals

Decydujące sygnały z badania hipotez i odpowiedzi użytkownika:

- API + auth są gotowe na happy path — brak UI to realny, ale **powierzchowny** objaw
  (`suggestions.ts`, `middleware.ts`, zero `fetch` w `src/`)
- FR-002 jest must-have i użytkownik wymaga **pełnego FR-002** (prawdziwy obraz) przed
  zamknięciem S-01 — placeholder nie wystarczy
- Użytkownik wybrał **transient only** — persist do `events` **nie** jest częścią S-01
- F-04 direct upload pasuje do S-03 (plik użytkownika), nie do transient display z AI
- Brak udokumentowanego scope creep w archiwum — wzorzec: scaffold → slice produktowy

## Cross-System Convention

W tym repozytorium fundamenty (F-01–F-04) konsekwentnie dostarczają **infrastrukturę bez
flow produktowego**; slice S-01 przejmuje UI i prezentację. Roadmapa dzieli US-01:
S-01 = request + view (FR-001/002), S-02 = triage (FR-005), S-05 = publish (FR-006).

Wiodąca hipoteza (display transient + prawdziwy obraz bez persist) **zgodna z konwencją**:
nie wymaga INSERT do `events` ani `uploadEventImage` dla proof north star. Obraz może być
pozyskany i wyświetlony bez zapisu do prywatnego bucketa — o ile plan rozstrzygnie
kontrakt (np. OG z `sourceUrl`, zewnętrzny URL w odpowiedzi API po enricherze).

**Odwrotność sprawdzona:** Gdyby persist był wymagany, oczekiwalibyśmy FR-005/triage
w S-01 — nie ma (`change.md:22`). Gdyby UI nie wystarczało nawet na tekst, API byłoby
niekompletne — nie jest (`openrouter-client.ts:40-107`).

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Zbudować **pierwszy widoczny dla rodzica**
> przepływ kryteria → propozycje AI z **prawdziwym obrazem i linkiem** (pełne FR-002),
> **bez zapisu do `events`** — rozstrzygając **jak pozyskać i wyświetlić obraz
> transientnie**, a nie jak spiąć pełny pipeline F-04 + DB.

Początkowe ramowanie traktowało S-01 jak monolit „UI + storage + events persist”.
To **przeszacowuje** zakres: persist należy do S-02; F-04 bucket upload nie jest
naturalną ścieżką dla obrazów z linków AI przy wyświetlaniu bez zapisu.

Dwa wątki pozostają, ale w **kolejności**:

1. **Udowodnienie wartości AI** — formularz + `fetch` + karty wyników (tekst, link, loading)
2. **Kontrakt obrazu transient** — enricher server-side (np. OG z `sourceUrl`) lub inna
   strategia **bez** `events.image_path` — to blokuje zamknięcie S-01, nie brak React card

Brak strony to **pierwszy krok wykonawczy**, nie sedno architektoniczne.

## Confidence

**HIGH**

- Silne dowody z kodu i archiwum (F-02/F-04 deferrals, zero `.from("events")`)
- Zgodność z konwencją roadmapy (display vs persist split)
- Decydujące zawężenie od użytkownika: pełne FR-002 + transient only

Jedyna decyzja techniczna pozostawiona dla `/10x-plan`: **która strategia transient image**
(OG-fetch vs rozszerzenie odpowiedzi API o zweryfikowany URL obrazu) — to wybór
implementacji w ramach potwierdzonego problemu, nie nowe ramowanie.

## What Changes for /10x-plan

Plan powinien dotyczyć **chronionej strony `/suggestions` + formularz + wyświetlanie
propozycji z prawdziwym obrazem i linkiem**, z **server-side enricherem obrazu**
(transient). **Wyłączyć z S-01:** INSERT/UPDATE `events`, `uploadEventImage`,
signed URL dla bucketa (chyba że enricher świadomie kopiuje do storage — nie domyślnie),
triage UI (S-02). **Uwzględnić:** loading UX, JSON auth edge case dla `fetch`.

## References

- `context/changes/ai-activity-suggestions/research.md`
- `context/changes/ai-activity-suggestions/change.md`
- `src/pages/api/ai/suggestions.ts:12-51`
- `src/lib/ai/suggestion-response.schema.ts:3-20`
- `src/lib/storage/event-image.ts:35-41` (Blob upload — nie default path S-01)
- `context/archive/2026-05-26-ai-suggestion-scaffold/plan.md:41-47`
- `context/archive/2026-06-22-event-image-storage/plan.md:42-48`
- `context/foundation/prd-v2.md:53-63, 91`
- `context/foundation/roadmap.md:121-131`
- Investigation: agents 6279205d, ec8d5095, d1f5a795, fc0a0ef0
