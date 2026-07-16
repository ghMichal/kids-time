<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI activity suggestions (S-01)

- **Plan**: context/changes/ai-activity-suggestions/plan.md
- **Zakres**: Fazy 1–3 z 3
- **Data**: 2026-07-16
- **Werdykt**: NEEDS ATTENTION
- **Ustalenia**: 0 krytycznych 2 ostrzeżenia 3 obserwacje

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura            | PASS    |
| Spójność wzorców        | PASS    |
| Kryteria sukcesu        | PASS    |

## Ustalenia

### F1 — SSRF przez OG enricher (model-controlled sourceUrl)

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM — hardening przed szerszym deploymentem
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/suggestions/enrich-suggestion-images.ts:92-99
- **Szczegóły**: Enricher robi fetch(sourceUrl) z redirect: "follow" bez bramki https-only ani blocklisty IP prywatnych/metadata. sourceUrl pochodzi z modelu (pośrednio z place/time) — ryzyko SSRF auth-gated, akceptowalne w wąskim MVP, ryzykowne przy szerszej ekspozycji.
- **Poprawka A ⭐ Zalecana**: Przed fetch — tylko https; reject private/reserved IP; ograniczyć redirecty.
  - Siła: Usuwa klasę SSRF bez zmiany UX kart.
  - Kompromis: ~20–40 linii w enricherze; część URL może odpaść.
  - Pewność: HIGH — standardowa lista kontrolna SSRF.
  - Martwy punkt: Zachowanie DNS rebinding na Workerze nie testowane.
- **Poprawka B**: Odłóż do follow-up przed produkcją poza trusted users
  - Siła: Nie blokuje zamknięcia S-01 / archive.
  - Kompromis: Ryzyko zostaje na branchu do S-02+.
  - Pewność: MEDIUM — zależy od audience deploymentu.
  - Martwy punkt: Brak formalnego threat modelu kursu.
- **Decyzja**: PENDING

### F2 — sourceUrl: z.url() bez wymogu https (javascript:/data:)

- **Ważność**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW — wąska poprawka schematu + opcjonalny guard UI
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/ai/suggestion-response.schema.ts:6-15; src/components/suggestions/SuggestionCard.tsx:30-38
- **Szczegóły**: sourceUrl walidowane przez z.url() (bez https). imageUrl ma refine https, sourceUrl nie. Model może zwrócić javascript:/data: — trafia do `<a href>`. Prompt mówi HTTPS, schema nie egzekwuje.
- **Poprawka**: Dodaj refine https:// na sourceUrl (jak imageUrl); opcjonalnie w karcie pomijaj link jeśli !startsWith("https://").
- **Decyzja**: PENDING

### F3 — EXTRA: zmiany promptu/schematu OpenRouter poza planem

- **Ważność**: OBSERVATION
- **Wpływ**: 🏃 LOW
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/lib/ai/build-suggestion-prompt.ts; src/lib/ai/suggestion-response.schema.ts
- **Szczegóły**: Prompt wymusza HTTPS sourceUrl + preferencję Wikipedii; opis pola w JSON schema. Nie było w Changes Required — naprawia puste sourceUrl z debugu Fazy 2. Bariery zakresu OK (brak imageUrl w schemacie modelu).
- **Poprawka**: Udokumentuj jako dodatek w planie / follow-up notes albo zaakceptuj jako uzasadniony drift.
- **Decyzja**: PENDING

### F4 — Brak rate limitu na POST /api/ai/suggestions

- **Ważność**: OBSERVATION
- **Wpływ**: 🔎 MEDIUM (koszt OpenRouter), poza zakresem S-01
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/ai/suggestions.ts
- **Szczegóły**: Auth user może generować kosztowne requesty (AI + OG) bez limitu. Plan tego nie wymagał.
- **Poprawka**: Follow-up — per-user rate limit / daily cap.
- **Decyzja**: PENDING

### F5 — Stare karty zostają przy błędzie API

- **Ważność**: OBSERVATION
- **Wpływ**: 🏃 LOW
- **Wymiar**: Spójność wzorców / Reliability
- **Lokalizacja**: src/components/suggestions/SuggestionsPage.tsx:123-125
- **Szczegóły**: Przy !response.ok ustawiany jest serverError, ale suggestions nie są czyszczone — stare karty + nowy błąd jednocześnie.
- **Poprawka**: setSuggestions([]) przy starcie submit lub przy błędzie.
- **Decyzja**: PENDING
