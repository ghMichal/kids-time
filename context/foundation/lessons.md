# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always fill Notes in /10x-new change.md

- **Context**: Każda nowa zmiana tworzona przez `/10x-new` (`context/changes/<change-id>/change.md`)
- **Problem**: Pusta sekcja Notes (tylko komentarz HTML) nie przenosi kontekstu z roadmapy, PRD ani rozmowy — kolejne kroki (`/10x-research`, `/10x-plan`) muszą odkrywać zakres od zera.
- **Rule**: Przy `/10x-new` zawsze wypełniaj `## Notes` treścią merytoryczną: roadmap ID + link, outcome, prerequisites/blokery, kluczowe PRD refs i decyzje z foundation docs lub rozmowy. Komentarz-podpowiedź tylko gdy naprawdę brak kontekstu — nigdy comment-only, jeśli znasz roadmap item lub intent.
- **Applies to**: research, plan, plan-review, implement
