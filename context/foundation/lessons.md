# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always fill Notes in /10x-new change.md

- **Context**: Każda nowa zmiana tworzona przez `/10x-new` (`context/changes/<change-id>/change.md`)
- **Problem**: Pusta sekcja Notes (tylko komentarz HTML) nie przenosi kontekstu z roadmapy, PRD ani rozmowy — kolejne kroki (`/10x-research`, `/10x-plan`) muszą odkrywać zakres od zera.
- **Rule**: Przy `/10x-new` zawsze wypełniaj `## Notes` treścią merytoryczną: roadmap ID + link, outcome, prerequisites/blokery, kluczowe PRD refs i decyzje z foundation docs lub rozmowy. Komentarz-podpowiedź tylko gdy naprawdę brak kontekstu — nigdy comment-only, jeśli znasz roadmap item lub intent.
- **Applies to**: research, plan, plan-review, implement

## Przy naprawie pre-commita formatuj tylko staged pliki

- **Context**: Husky / lint-staged / ręczne `npm run format` przed commitem, gdy pre-commit pada na Prettierze dla plików w stage.
- **Problem**: `npm run format` (Prettier `--write .`) formatuje całe repo — w tym wygenerowane lub niepowiązane pliki (np. `src/types/database.generated.ts`) — i zostawia niezacommitowane zmiany poza zakresem commita.
- **Rule**: Przy commitach i naprawie hooków formatuj wyłącznie pliki ze stage: użyj `npx prettier --write` / `lint-staged` na konkretnych ścieżkach albo `git diff --name-only --cached`, nigdy `prettier --write .` jako skrótu do naprawy jednego commita.
- **Applies to**: implement, impl-review
