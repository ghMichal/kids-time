#!/usr/bin/env sh
# Prints the repo GitHub Actions list URL (no wait, no run lookup).

set -eu

# Git hooks often leave stdin as a TTY or a ref pipe. Reading it blocks until Enter.
exec </dev/null

origin="$(git -c core.pager= remote get-url origin 2>/dev/null || true)"
origin="${origin%.git}"

case "$origin" in
  git@github.com:*)
    actions_url="https://github.com/${origin#git@github.com:}/actions"
    ;;
  ssh://git@github.com/*)
    actions_url="https://github.com/${origin#ssh://git@github.com/}/actions"
    ;;
  https://github.com/* | http://github.com/*)
    actions_url="${origin}/actions"
    ;;
  *)
    exit 0
    ;;
esac

printf 'GitHub Actions: %s\n' "$actions_url" 2>/dev/null >/dev/tty \
  || printf 'GitHub Actions: %s\n' "$actions_url"
