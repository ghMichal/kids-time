# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier (write)
- `npm run format:check` - Prettier check only (no writes)
- `npm run deploy` - `astro sync`, lint, build, `wrangler deploy` (Cloudflare Worker)
- `npm run deploy:quick` - same without lint (`SKIP_LINT=1`)

### Git hooks (pre-commit)

After `npm install`, Husky runs **lint-staged on staged files only**. The hook **blocks** the commit on failure and prints fix commands; it does **not** modify your files.

If the hook fails, run `npm run lint:fix` and/or `npm run format`, review the diff, `git add`, and commit again. Skip only when intentional: `git commit --no-verify`.

### CI link after push

Requires [GitHub CLI](https://cli.github.com/) (`gh auth login`).

| Method                     | Behavior                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `git push`                 | Husky **pre-push** schedules a background job; ~few seconds after push you should see the Actions run URL in the terminal |
| `npm run push`             | Same as `git push`, but waits for the link synchronously (more reliable)                                                  |
| `npm run setup:push-alias` | Sets `git push` → wrapper (optional; use if the pre-push timing is flaky)                                                 |

The link targets workflow **CI** (`.github/workflows/ci.yml`) on the current branch.

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Database migrations and types

Schema lives in `supabase/migrations/` (timestamped SQL files). After changing migrations:

```bash
npx supabase db reset    # local: reapply migrations + seed (requires `supabase start`)
npx supabase gen types typescript --local > src/types/database.generated.ts
```

Import shared types from `@/types` (e.g. `EventRow`). Regenerate and commit `database.generated.ts` after schema changes — CI does not run migrations.

The `events` table is protected by **RLS**: owners see and modify their rows; other authenticated users can read only published events (`is_published = true`).

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection uses a public allowlist in `src/lib/route-access.ts` (default deny). New product pages are protected automatically; add exceptions to the allowlist for public paths only.

## OpenRouter Configuration

AI activity suggestions (F-02) use [OpenRouter](https://openrouter.ai/) via server-only env vars declared in `astro.config.mjs`. Without them, the config banner reports OpenRouter as missing and the suggestions API returns `503`.

### First-time setup

1. Create an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys). For a course project, set an optional **credit limit** on the key.
2. Add to `.env` and `.dev.vars` (same pattern as Supabase):

| Variable             | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `OPENROUTER_API_KEY` | API key from OpenRouter dashboard                                       |
| `OPENROUTER_MODEL`   | Model id (F-02 default: `openai/gpt-4o-mini` — structured JSON outputs) |

```
OPENROUTER_API_KEY=<your-key>
OPENROUTER_MODEL=openai/gpt-4o-mini
```

3. For Cloudflare preview/production, set Worker secrets (not only local `.env`):

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put OPENROUTER_MODEL
```

Changing the model later is env-only: update `OPENROUTER_MODEL` and smoke-test the suggestions endpoint.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) as worker **kids-time-mvp**.

**One command** (Node 24, `.env` for build, `npx wrangler login` once):

```bash
npm run deploy
```

Skips lint for a faster redeploy: `npm run deploy:quick`.

Manual steps (same pipeline): `npx astro sync` → `npm run lint` → `npm run build` → `npx wrangler deploy`.

Set `SUPABASE_URL`, `SUPABASE_KEY`, and OpenRouter vars as Worker secrets (not only in `.env` for local build):

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put OPENROUTER_MODEL
```

Full checklist: [`context/deployment/deploy-plan.md`](context/deployment/deploy-plan.md).

## CI

GitHub Actions runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
