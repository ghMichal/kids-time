# Repository Guidelines

kids-time MVP helps parents plan child activities with AI-assisted suggestions, built on Astro 6 SSR, React islands, Supabase, and Cloudflare. Product scope: `@context/foundation/prd-v2.md`. Stack and auth depth: `@CLAUDE.md`.

## Agent-Specific Instructions

- Use **Node 24** (`@.nvmrc`). CI uses Node 22 in `@.github/workflows/ci.yml` until aligned.
- **SSR only** (`output: "server"` in `@astro.config.mjs`). API routes need `export const prerender = false`.
- Keep `SUPABASE_URL` and `SUPABASE_KEY` server-only (`astro:env` schema). Local secrets: `.env` or `.dev.vars` (see `@README.md`).
- Supabase migrations in `supabase/migrations/` as `YYYYMMDDHHmmss_description.sql`; enable **RLS** with per-operation policies.
- Tailwind: use `cn()` from `@/lib/utils`, not string concatenation.
- Astro for layout; React only when interactive. No Next.js directives.
- Do not move or rewrite `context/foundation/` unless the task changes product docs (`@context/foundation/README.md`).
- Auth and protected routes: `@src/middleware.ts`, `@src/pages/api/auth/`.

## Project Structure & Module Organization

`src/pages/` routes and `src/pages/api/` handlers (uppercase `GET`/`POST`, Zod validation). `src/components/ui/` for shadcn (`npx shadcn@latest add <name>`). Business logic in `src/lib/`; hooks in `src/components/hooks/`; shared types in `src/types.ts`. Alias `@/*` → `src/*` (`@tsconfig.json`).

## Build, Test, and Development Commands

`npm run dev` — local dev. `npm run build` — production (requires Supabase env). `npm run lint` / `lint:fix` / `format` — ESLint + Prettier per `@eslint.config.js`. `npx astro sync` before lint in CI. `npx supabase start` for local DB (Docker).

Husky pre-commit: lint-staged on `*.{ts,tsx,astro}` and `*.{json,css,md}` (`@package.json`).

## Coding Style & Naming Conventions

TypeScript strict + type-checked ESLint. Prefix unused symbols with `_`. `no-console` is warn. Match sibling naming in each folder. Validate API input with Zod at route boundaries.

## Testing Guidelines

No test runner is configured yet. Add a `package.json` script and colocated tests before claiming coverage in PRs.

## Commit & Pull Request Guidelines

No commit history yet; use a consistent style (Conventional Commits recommended). PRs target `master`. Before opening a PR, run `npm ci`, `npx astro sync`, `npm run lint`, and `npm run build` with Supabase env vars — same gate as `@.github/workflows/ci.yml`.
