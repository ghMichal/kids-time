# AI suggestion scaffold — Krótki plan

> Pełny plan: `context/changes/ai-suggestion-scaffold/plan.md`
> Badania: `context/changes/ai-suggestion-scaffold/research.md`

## Co i dlaczego

Fundament **F-02**: chroniona ścieżka serwerowa, która przyjmuje kryteria rodzica (miejsce, czas, wiek, indoor/outdoor), wywołuje OpenRouter i zwraca kilka zwięzłych propozycji JSON — bez UI i bez zapisu do bazy. Odblokowuje S-01 (north star) i S-03.

## Punkt wyjścia

Brak kodu AI w `src/`. Są wzorce: `astro:env` + Supabase, `APIRoute` w auth, middleware default deny (F-03). Research Context7 + repo: `fetch`, `json_schema` strict, timeout 25s na edge.

## Pożądany stan końcowy

Zalogowany dev z `.dev.vars` (OpenRouter + Supabase) wywołuje `POST /api/ai/suggestions` i dostaje `{ suggestions: [{ title, summary, sourceUrl? }] }` (1–5 pozycji). Błędy: 400 walidacja, 503 brak konfiguracji, 502/504 upstream. `npm run lint` i `npm run build` przechodzą.

## Kluczowe podjęte decyzje

| Decyzja    | Wybór                                               | Dlaczego                                                                          | Źródło        |
| ---------- | --------------------------------------------------- | --------------------------------------------------------------------------------- | ------------- |
| Model      | **`openai/gpt-4o-mini`** (`OPENROUTER_MODEL` w env) | Structured outputs; tani paid (~ułamek centa/request); podmiana = jedna linia env | User / Plan   |
| Guardrails | max 5; title ≤100, summary ≤200; prompt 3–5         | PRD „few concise”                                                                 | PRD-v2 / Plan |
| Auth       | Sesja wymagana (middleware)                         | F-03, US-01                                                                       | Research      |
| Klient     | `fetch`, bez SDK                                    | Edge, mało zależności                                                             | Research      |
| Streaming  | Poza F-02                                           | Scaffold; UX w S-01                                                               | Research      |

## Zakres

**W zakresie:** env OpenRouter, Zod, `src/lib/ai/*`, `POST /api/ai/suggestions`, README/.env.example, config-status.

**Poza zakresem:** UI, DB/triage, obrazy, streaming, anon AI, test runner.

## Architektura / Podejście

Middleware (auth) → API route (Zod in) → OpenRouter chat completions (`json_schema`) → Zod out → JSON 200. Sekrety tylko `astro:env/server` + Wrangler secrets.

## Fazy w skrócie

| Faza          | Co dostarcza                    | Kluczowe ryzyko           |
| ------------- | ------------------------------- | ------------------------- |
| 0. Model      | **done** — `openai/gpt-4o-mini` | —                         |
| 1. Env + Zod  | astro.config, zod dep, docs     | Brak secretów na Worker   |
| 2. Lib AI     | schemas, prompt, client         | Parse/strict schema       |
| 3. API route  | `/api/ai/suggestions`           | 302 zamiast 401 bez sesji |
| 4. Zamknięcie | archive, roadmap done           | Smoke tylko z kluczem OR  |

**Wymagania wstępne:** F-01, F-03 done; klucz OpenRouter.
**Szacowany wysiłek:** ~1–2 sesje implementacji w 4 fazach kodu.

## Otwarte ryzyka i założenia

- Ręczny smoke wymaga zalogowanej sesji (cookies), nie gołego curl.
- NFR-03 realizowane przez schema + prompt, nie osobną metryką w PRD v1.

## Kryteria sukcesu (podsumowanie)

- Endpoint zwraca zweryfikowany JSON propozycji dla poprawnych kryteriów.
- Lint i build CI przechodzą.
- Brak wycieku `OPENROUTER_API_KEY` w odpowiedziach błędów.
