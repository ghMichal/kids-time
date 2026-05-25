#!/usr/bin/env sh
# git push wrapper: push then print CI run link (requires gh).
# Usage: push-with-ci-link.sh [git push args...]

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="$(git branch --show-current 2>/dev/null || true)"

command git push "$@"
EXIT=$?

if [ "$EXIT" -ne 0 ]; then
  exit "$EXIT"
fi

sh "$ROOT/scripts/print-ci-run-link.sh" "$BRANCH"
exit 0
