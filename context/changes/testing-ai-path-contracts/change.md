---
change_id: testing-ai-path-contracts
title: AI path contracts for suggestions and summary errors
status: implementing
created: 2026-08-18
updated: 2026-08-23
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "AI path contracts".
Risks covered: #4 — Ścieżka AI (suggestions / summary) zwraca zły kształt lub mapuje błąd tak, że UI wygląda na sukces albo blokuje Save wbrew kontraktowi.
Test types planned: unit + contract.
Risk response intent: Zły JSON / timeout / brak klucza → jawny kod błędu; create manual nie zależy od AI. Challenge „200 z body = dobre summary”. Avoid asercja skopiowana z promptu produkcyjnego.
After creating the folder, follow the downstream continuation rule.
