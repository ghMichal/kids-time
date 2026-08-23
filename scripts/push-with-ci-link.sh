#!/usr/bin/env sh
# git push wrapper: push then print the GitHub Actions list URL.

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Skip husky pre-push duplicate print; this wrapper prints after a successful push.
export KIDS_TIME_CI_LINK_FROM_WRAPPER=1

command git push "$@"
EXIT=$?

if [ "$EXIT" -ne 0 ]; then
  exit "$EXIT"
fi

sh "$ROOT/scripts/print-ci-run-link.sh" </dev/null
exit 0
