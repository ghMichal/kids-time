---
date: 2026-05-26T21:03:20+02:00
researcher: Cursor Agent
git_commit: 4ea3a3b04c7a146adda65633e55427511c51a306
branch: main
repository: kids-time
topic: "F-02 ai-suggestion-scaffold — pass Context7 (badania zewnętrzne)"
tags: [research, f-02, ai-suggestion-scaffold, context7, openrouter, astro, cloudflare]
status: complete
last_updated: 2026-05-26
last_updated_by: Cursor Agent
---

# Badanie: F-02 — integracja AI do propozycji (ai-suggestion-scaffold)

**Data**: 2026-05-26  
**Badacz**: Cursor Agent  
**Git Commit**: [`4ea3a3b`](https://github.com/ghMichal/kids-time/commit/4ea3a3b04c7a146adda65633e55427511c51a306)  
**Gałąź**: main  
**Repozytorium**: kids-time

## Pytanie badawcze

Jak zbudować fundament F-02 (serwerowa ścieżka AI: route API, secret dostawcy, klient OpenRouter, kształt prompt/response) na stacku Astro 6 SSR + Cloudflare Workers + OpenRouter, zgodnie z [roadmapą F-02](../../foundation/roadmap.md) i zakresem z [change.md](./change.md)?

## Podsumowanie

Context7 potwierdza wzorzec zgodny z baseline repozytorium: **endpoint Astro `APIRoute`** w `src/pages/api/`, **sekrety przez `astro:env/server`** (`getSecret` / `envField` w `astro.config.mjs`), **deploy secretów przez Wrangler** (`.dev.vars` lokalnie). Po stronie AI: **OpenRouter `POST /api/v1/chat/completions`** z **`response_format: json_schema`** (strict) — bez obowiązkowego SDK; wystarczy `fetch` z Bearer tokenem. Po stronie edge: **czas oczekiwania na `fetch` do OpenRouter nie wlicza się do CPU time** Workera; warto jednak ustawić **timeout na `fetch`** i rozważyć `limits.cpu_ms` w `wrangler.jsonc` przy późniejszym przetwarzaniu odpowiedzi.

## Badania zewnętrzne

> Źródło: **Context7 MCP** (klucz API w `.cursor/mcp.json`). Zapytania: 2026-05-26.

### Biblioteki (Context7 library ID)

| Biblioteka         | Context7 ID                               | Użycie w F-02                               |
| ------------------ | ----------------------------------------- | ------------------------------------------- |
| Astro              | `/llmstxt/astro_build_llms_txt`           | API routes, `astro:env`, adapter Cloudflare |
| OpenRouter         | `/websites/openrouter_ai`                 | Chat completions, structured outputs        |
| Cloudflare Workers | `/websites/developers_cloudflare_workers` | Limity CPU/subrequests, `wrangler` limits   |

---

### 1. Astro — endpoint API i sekrety serwerowe

**Źródło Context7:** `/llmstxt/astro_build_llms_txt`

#### Endpointy (`APIRoute`)

- W `output: "server"` (jak w projekcie) endpointy w `src/pages/api/*.ts` są renderowane **on demand** — nie trzeba `export const prerender = false` (wymagane tylko w trybie `static` / hybrid bez domyślnego SSR).
- Eksport `POST: APIRoute` z parsowaniem JSON:

```typescript
export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("Content-Type") === "application/json") {
    const body = await request.json();
    // ...
    return new Response(JSON.stringify({ message: "..." }), { status: 200 });
  }
  return new Response(null, { status: 400 });
};
```

- Istniejący wzorzec w repo: [`src/pages/api/auth/signin.ts`](https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/src/pages/api/auth/signin.ts) używa `APIRoute` + `context.request` — F-02 powinien dodać równoległy route z **`request.json()`** i odpowiedzią JSON (nie redirect).

#### Sekrety (`astro:env`)

- Sekrety tylko po stronie serwera: `import { getSecret } from "astro:env/server"` lub import nazwanego pola ze schematu.
- `getSecret("OPENROUTER_API_KEY")` działa także gdy pole jest zdefiniowane dynamicznie — zwraca `string | undefined`.
- Schemat w `astro.config.mjs` (analogicznie do `SUPABASE_*`):

```javascript
OPENROUTER_API_KEY: envField.string({
  context: "server",
  access: "secret",
  optional: false,
}),
```

**Stan repo:** [`astro.config.mjs`](https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/astro.config.mjs) ma już `SUPABASE_URL` / `SUPABASE_KEY` jako `server` + `secret` — ten sam wzorzec dla OpenRouter.

#### Adapter Cloudflare (env + Wrangler)

- Zmienne niepoufne: `wrangler.jsonc` → `"vars"`.
- Sekrety: **`npx wrangler secret put <KEY>`** (nie w pliku config); lokalnie: **`.dev.vars`** w root projektu (jak Supabase w README).
- Dostęp w runtime: `import { env } from "cloudflare:workers"` **lub** `astro:env` — dokumentacja zaleca **`astro:env` dla przenośności** (zgodne z [infrastructure.md](../../foundation/infrastructure.md)).
- Instalacja: `wrangler` + `@astrojs/cloudflare` — już w projekcie (`package.json`, `wrangler.jsonc`).

**Wniosek F-02:** `OPENROUTER_API_KEY` w schemacie Astro + `.dev.vars` + `wrangler secret put OPENROUTER_API_KEY` w CI/produkcji; **nigdy** w kliencie ani w `PUBLIC_*`.

---

### 2. OpenRouter — wywołanie modelu i structured outputs

**Źródło Context7:** `/websites/openrouter_ai`

#### Endpoint i autoryzacja

- **URL:** `https://openrouter.ai/api/v1/chat/completions`
- **Metoda:** `POST`, nagłówki: `Authorization: Bearer <API_KEY>`, `Content-Type: application/json`
- **SDK opcjonalne** — dokumentacja pokazuje równorzędnie `fetch` i `@openrouter/sdk`; dla MVP i małego scaffoldu **`fetch` w `src/lib/`** wystarczy (mniej zależności, zgodne z edge).

#### Structured outputs (kluczowe dla NFR-03 / zwięzłości)

- Parametr `response_format`:
  - `{ type: "json_object" }` — tylko poprawny JSON (słabsza kontrola kształtu).
  - **`{ type: "json_schema", json_schema: { name, strict: true, schema } }`** — odpowiedź zgodna ze schematem (preferowane dla listy propozycji aktywności).
- Przykład `fetch` (skrót z docs):

```typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "…", // decyzja użytkownika — roadmap open question #2
    messages: [{ role: "user", content: "…" }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "activity_suggestions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  sourceUrl: { type: "string" },
                },
                required: ["title", "summary"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  }),
});
const data = await response.json();
const content = data.choices[0].message.content; // string JSON — parse + Zod w route
```

#### Routing modelu i wsparcie parametrów

- Przed implementacją: na [openrouter.ai/models](https://openrouter.ai/models) sprawdzić model z **`structured_outputs` / `response_format`**.
- Opcjonalnie w request: `provider: { require_parameters: true }` — wymusza providera obsługującego `json_schema` (mniej „cichego” fallbacku).
- **Streaming:** obsługiwany ze structured outputs (`stream: true`); dla **F-02 scaffold** wystarczy **non-streaming**; streaming odłożyć do S-01/UI jeśli potrzebny UX ładowania.
- **Plugins:** Response Healing naprawia składnię JSON (nie walidację schematu) — sensowne dla non-streaming + `json_schema`.

#### Mapowanie na FR-001 (kryteria wejścia)

| Pole wejścia (PRD) | W request API F-02 | W prompt / messages |
| ------------------ | ------------------ | ------------------- |
| miejsce            | `place`            | user/system message |
| czas               | `time`             | user/system message |
| wiek dziecka       | `childAge`         | user/system message |
| indoor/outdoor     | `indoorOutdoor`    | user/system message |

Walidacja wejścia: **Zod na granicy route** (konwencja repo), przed wywołaniem OpenRouter.

**Wniosek F-02:** jeden moduł `src/lib/openrouter.ts` (lub `ai/openrouter-client.ts`) + route `POST /api/.../suggestions` zwracający sparsowany JSON; błędy upstream mapować na 502/504 z bezpiecznym komunikatem (bez wycieku klucza).

---

### 3. Cloudflare Workers — limity przy wywołaniu OpenRouter

**Źródło Context7:** `/websites/developers_cloudflare_workers`

#### CPU time vs czas wall-clock

- **CPU time** = czas faktycznej pracy CPU (parsowanie JSON, logika), **nie** czas oczekiwania na odpowiedź `fetch` do OpenRouter.
- Domyślnie **~30 s CPU** na request (paid można podnieść do **300 000 ms** przez `limits.cpu_ms` w `wrangler.jsonc`).
- **Duration (wall-clock):** brak twardego limitu, dopóki klient jest połączony — długie odpowiedzi LLM są akceptowalne pod warunkiem timeoutu po stronie klienta HTTP i `AbortSignal` na `fetch`.

#### Subrequests

- Każde `fetch()` do OpenRouter = subrequest.
- Paid: domyślnie do **10 000** subrequests/invocation (konfigurowalne w `limits.subrequests`).
- F-02 (jedno wywołanie LLM na request) — **niski ryzyko** przekroczenia.

#### Konfiguracja Wrangler (opcjonalna na start)

```jsonc
{
  "limits": {
    "cpu_ms": 30000,
    "subrequests": 50,
  },
}
```

Limity egzekwowane **tylko na produkcji**, nie w lokalnym dev — smoke test na preview/deploy po implementacji ([infrastructure.md](../../foundation/infrastructure.md)).

#### Sekrety (potwierdzenie)

- `wrangler secret put` + `.dev.vars` — spójne z sekcją Astro/Cloudflare powyżej.
- Nazwy secretów muszą być **identyczne** między Astro schema, `.dev.vars`, CI i produkcją.

**Wniosek F-02:** ustawić **`signal: AbortSignal.timeout(25_000)`** (lub podobnie) na `fetch` OpenRouter; logować status/latency bez treści promptu w produkcji; nie polegać na podniesieniu `cpu_ms` dla samego oczekiwania na model.

---

### 4. Synteza Context7 → rekomendowany kształt F-02

| Warstwa          | Rekomendacja (z Context7)                                                               |
| ---------------- | --------------------------------------------------------------------------------------- |
| Route            | `src/pages/api/ai/suggestions.ts` (lub `activity-suggestions.ts`) — `POST`, JSON in/out |
| Auth             | Poza scope F-02 w change.md; route chroniony przez middleware F-03 przy integracji S-01 |
| Secret           | `OPENROUTER_API_KEY` w `astro.config.mjs` + `.dev.vars` + `wrangler secret put`         |
| Klient AI        | `fetch` → OpenRouter chat completions, bez SDK na start                                 |
| Odpowiedź modelu | `response_format.type: "json_schema"`, `strict: true`, schema `suggestions[]`           |
| Walidacja        | Zod: body request + parse/validate `message.content` po odpowiedzi                      |
| Edge             | `AbortSignal.timeout` na upstream; opcjonalnie `limits` w `wrangler.jsonc`              |
| Poza F-02        | UI, zapis do DB, triage, streaming UX → S-01 / S-02                                     |

---

### 5. Otwarte po passie Context7 (nie rozstrzygnięte dokumentacją)

1. **Konkretny model OpenRouter** — roadmap [open question #2](../../foundation/roadmap.md#open-roadmap-questions); wymaga wyboru użytkownika + weryfikacji `structured_outputs` na stronie modeli.
2. **NFR-03** — brak w `prd.md` v1 w repo; change.md odnosi się do jakości/zwięzłości — prompt i schema (max items, max length `summary`) do ustalenia w `/10x-plan`.
3. **Auth na route F-02** — Context7 nie zastępuje review `src/middleware.ts`; przy scaffold warto od razu wymagać sesji Supabase (JWT), spójnie z F-03.

---

## Badania wewnętrzne (repo)

### Current state (istotne pod F-02)

- **SSR + adapter Cloudflare**: projekt jest w `output: "server"` i używa `@astrojs/cloudflare` (Workers runtime).
- **API routes**: istnieją tylko trasy auth w `src/pages/api/auth/*` (formData + redirect). Brak tras domenowych.
- **Auth guard (default deny)**: middleware chroni **wszystko poza allowlistą publiczną** — nowa trasa `POST /api/ai/*` będzie **domyślnie chroniona** (bo prefix `/api/ai` nie jest na liście publicznej).
- **Supabase SSR client**: `createClient()` bierze `SUPABASE_URL`/`SUPABASE_KEY` z `astro:env/server` i mapuje cookies (wzorzec do naśladowania dla server-only sekretów).
- **Zod**: w repo **nie ma** Zoda ani walidacji request body JSON (wymagane przez standardy repo dla API routes). F-02 będzie musiał dodać `zod` jako zależność lub jasno przyjąć prostą walidację ręczną (mniej pożądane).

### Konsekwencje dla projektu endpointu F-02

- **Czy endpoint ma być chroniony?** Tak, zgodnie z F-03: `/api/ai/*` pozostaje poza `PUBLIC_PATH_PREFIXES`. Jeśli chcemy umożliwić anon użycie AI (niezgodne z US-01), to dopiero wtedy trzeba dodać wyjątek w `route-access.ts`.
- **Obsługa “brak konfiguracji”**: istnieje wzorzec `createClient()` → `null` + redirect error dla Supabase. Dla OpenRouter warto mieć analogiczny “config status” (np. w `src/lib/config-status.ts`) i zwracać 503/500 dla API route, zamiast “wisieć” na fetch.

## Kontekst historyczny (z poprzednich zmian)

- **F-03 app-route-auth-guards** wprowadził allowlistę publiczną i default deny; to wpływa bezpośrednio na to, czy nowy route `/api/ai/*` będzie dostępny bez sesji (nie będzie).
- **F-01 event-schema-rls (plan-review)** zawiera decyzję dot. **JWT vs service_role**: w MVP trzymamy się anon key + sesja użytkownika; service role tylko, jeśli pojawi się batch AI bez sesji (poza scope MVP). To wspiera założenie, że F-02 powinien działać z kontekstem zalogowanego rodzica, bez service role do DB.

## Odniesienia do kodu (Code References)

- `src/middleware.ts` — middleware ustawia `context.locals.user` i robi redirect jeśli `requiresAuth()` i brak usera:  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/src/middleware.ts
- `src/lib/route-access.ts` — definicja publicznej allowlisty; ważne: **publiczne** są tylko `/`, `/auth*`, `/api/auth*`, `/_astro*`:  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/src/lib/route-access.ts
- `src/lib/supabase.ts` — wzorzec server-only secrets przez `astro:env/server` oraz cookies bridging dla `@supabase/ssr`:  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/src/lib/supabase.ts
- `src/pages/api/auth/signin.ts` — wzorzec `APIRoute` + `request.formData()` + redirect:  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/src/pages/api/auth/signin.ts
- `astro.config.mjs` — `env.schema` dla server-only `SUPABASE_URL`/`SUPABASE_KEY` (analogicznie dodać `OPENROUTER_API_KEY`):  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/astro.config.mjs
- `wrangler.jsonc` — `nodejs_compat` włączone; sekrety runtime powinny być ustawiane przez `.dev.vars`/`wrangler secret put`:  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/wrangler.jsonc
- `context/archive/2026-05-25-app-route-auth-guards/plan.md` — intencja: “product pages protected by default”:  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/context/archive/2026-05-25-app-route-auth-guards/plan.md
- `context/archive/2026-05-26-event-schema-rls/reviews/plan-review.md` — notatka o F-02 i service_role:  
  https://github.com/ghMichal/kids-time/blob/4ea3a3b04c7a146adda65633e55427511c51a306/context/archive/2026-05-26-event-schema-rls/reviews/plan-review.md

## Wnioski architektoniczne

- **API AI jako chroniony zasób**: najlepszy “default” zgodny z US-01 i F-03 to traktować `/api/ai/*` jak resztę produktu — wymaga sesji.
- **Sekrety**: repo już ma “server-only env schema” (`astro:env/server`) i ignoruje `.dev.vars` w git — dopisanie `OPENROUTER_API_KEY` powinno iść tą samą ścieżką co Supabase.
- **Walidacja**: brak Zoda to realna luka względem konwencji API w repo; plan F-02 powinien ją jawnie adresować (dodać `zod` i walidować request + response).

## Powiązane artefakty

- [change.md](./change.md) — zakres F-02
- [roadmap F-02](../../foundation/roadmap.md#f-02-integracja-ai-do-propozycji)
- [infrastructure.md](../../foundation/infrastructure.md) — Cloudflare + OpenRouter, ryzyka CPU/timeout
- [tech-stack.md](../../foundation/tech-stack.md) — `has_ai: true`

## Otwarte pytania (całość badania)

1. Który model OpenRouter na MVP (koszt vs jakość vs `json_schema`)?
2. Czy F-02 ma od razu wymagać zalogowanego rodzica na `POST`, czy dopiero przy S-01?
3. Maksymalna liczba propozycji i długość pól w schema (product guardrail NFR-03)?
