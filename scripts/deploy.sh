#!/usr/bin/env sh
# Production deploy: Cloudflare Worker (kids-time-mvp).
# Matches context/deployment/deploy-plan.md — use Node 24.
#
# Usage:
#   npm run deploy
#   SKIP_LINT=1 npm run deploy   # build + deploy only
#
# Prerequisites: .env with SUPABASE_URL/SUPABASE_KEY for build, wrangler logged in.

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ] && [ ! -f .dev.vars ]; then
  echo "warning: no .env or .dev.vars — npm run build may fail without SUPABASE_*"
  echo "         copy .env.example or set secrets before build"
  echo ""
fi

echo "→ astro sync"
npx astro sync

if [ "${SKIP_LINT:-}" != "1" ]; then
  echo "→ lint"
  npm run lint
else
  echo "→ lint skipped (SKIP_LINT=1)"
fi

echo "→ build"
npm run build

echo "→ wrangler deploy"
npx wrangler deploy

echo ""
echo "Deploy finished. Worker: kids-time-mvp (see wrangler.jsonc)"
echo "Docs: context/deployment/deploy-plan.md"
