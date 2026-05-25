#!/usr/bin/env sh
# Prints the GitHub Actions CI run URL for the current branch (best effort).
# Usage: print-ci-run-link.sh [branch]

set -eu

BRANCH="${1:-$(git branch --show-current 2>/dev/null || true)}"
WORKFLOW="${CI_WORKFLOW_NAME:-CI}"
MAX_WAIT="${CI_LINK_MAX_WAIT:-20}"

if [ -z "$BRANCH" ]; then
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo ""
  echo "CI link: install GitHub CLI (https://cli.github.com/) and run: gh auth login"
  echo ""
  exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
  echo ""
  echo "CI link: run: gh auth login"
  echo ""
  exit 0
fi

REPO_URL="$(gh repo view --json url -q '.url' 2>/dev/null || true)"
ACTIONS_FALLBACK="${REPO_URL:+$REPO_URL/actions}"

i=0
while [ "$i" -lt "$MAX_WAIT" ]; do
  URL="$(gh run list --branch "$BRANCH" --workflow "$WORKFLOW" --limit 1 --json url -q '.[0].url' 2>/dev/null || true)"
  STATUS="$(gh run list --branch "$BRANCH" --workflow "$WORKFLOW" --limit 1 --json status -q '.[0].status' 2>/dev/null || true)"

  if [ -n "$URL" ] && [ "$URL" != "null" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  GitHub Actions — $WORKFLOW ($STATUS)"
    echo "  $URL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 0
  fi

  i=$((i + 1))
  sleep 1
done

echo ""
echo "CI link: run not listed yet (workflow: $WORKFLOW, branch: $BRANCH)."
if [ -n "$ACTIONS_FALLBACK" ]; then
  echo "  $ACTIONS_FALLBACK"
fi
echo ""
