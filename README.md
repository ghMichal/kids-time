# kids-time

A parent-facing MVP for planning child activities: concise AI-filtered suggestions from place, time, children's age, and indoor/outdoor preference, plus a private events library the parent can publish read-only for others.

Product scope: [`context/foundation/prd-v2.md`](context/foundation/prd-v2.md).

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v24.15.0 (as specified in `.nvmrc`; CI uses Node 24)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/ghMichal/kids-time.git
cd kids-time
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

After `npm install`, Husky runs **lint-staged on staged files only**. The hook **blocks** the commit on failure and prints fix commands; it does **not** modify your files. Risk-area TypeScript (`src/lib`, `src/pages`, `src/components`, `src/middleware.ts`) also runs related **unit** tests (`vitest related --run --project unit`).

If the hook fails, run `npm run lint:fix` and/or `npm run format` and/or `npm test`, review the diff, `git add`, and commit again. Skip only when intentional: `git commit --no-verify`.

### CI link after push

Prints the repo **Actions list** URL (`…/actions`). No GitHub CLI, no waiting, no lookup of a specific run.

| Method                     | Behavior                                                  |
| -------------------------- | --------------------------------------------------------- |
| `git push`                 | Husky **pre-push** prints the Actions list URL            |
| `npm run push`             | Push, then print the same URL                             |
| `npm run setup:push-alias` | Sets `git push` → wrapper (print after a successful push) |

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

### Event image storage

Migration `supabase/migrations/20260622120000_event_images_storage.sql` creates a private bucket **`event-images`** with owner-only RLS on `storage.objects`.

| Setting                         | Value                                   |
| ------------------------------- | --------------------------------------- |
| Bucket                          | `event-images` (private)                |
| Path key in `events.image_path` | `{owner_id}/{event_id}/{filename}`      |
| Max size                        | 5 MB                                    |
| MIME types                      | `image/jpeg`, `image/png`, `image/webp` |

Helpers live in `src/lib/storage/*` (`uploadEventImage`, `removeEventImage`, `replaceEventImage`). Storage RLS checks only the owner segment (`foldername[1] = auth.uid()`); the app must ensure `event_id` matches a real `events.id` before upload (S-01/S-03).

After `db reset`, smoke the lib + JWT flow (requires a test user in Auth):

```bash
# .dev.vars or env: SUPABASE_URL, SUPABASE_KEY, SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD
npx tsx scripts/smoke-event-image.ts
```

Two-user RLS denial (owner vs non-owner) — `npx tsx scripts/verify-event-images-rls.ts` with `USER_A_*` / `USER_B_*` env vars (see script header).

Vitest integration (owner library / IDOR) uses the same `USER_A_*` / `USER_B_*` pair — seed steps: `src/lib/events/__test__/README.md`.

After merging storage migrations, apply to cloud: `npx supabase db push`.

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

| Route                 | Description                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/auth/signin`        | Email/password sign-in form                                                                                        |
| `/auth/signup`        | Email/password sign-up form                                                                                        |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                                                                |
| `/dashboard`          | Protected page after sign-in (redirects to `/auth/signin` if unauthenticated)                                      |
| `/suggestions`        | AI activity suggestions — criteria → proposals → accept/reject/maybe                                               |
| `/events`             | Own events library — add manually (optional AI summary + image), browse / edit / delete / publish accepted + maybe |

Route protection uses a public allowlist in `src/lib/route-access.ts` (default deny). New product pages are protected automatically; add exceptions to the allowlist for public paths only.

## AI activity suggestions

Signed-in parents open **Propozycje** (`/suggestions`), submit place / time / child age / indoor-outdoor, and get 1–5 AI proposals (title, summary, optional source link + OG image). On each card they can **Akceptuj** / **Odrzuć** / **Może później** — the decision is stored in `events` (`origin: ai_suggested`, `triage_status`) with `is_published` still `false` (publish is a later slice). Image upload to storage is not part of this flow yet.

Accepted and maybe decisions show up under **Moje wydarzenia** (`/events`), where parents can also add an event manually (optional AI summary via Generate, optional one image), edit selected fields inline, publish, or delete with confirmation.

Requires OpenRouter env (see below). Optional local checks:

```bash
npx tsx scripts/smoke-openrouter.ts
npx tsx scripts/smoke-suggestions-enriched.ts
```

Manual flow: `npm run dev` → sign in → `/suggestions` → submit → triage decisions on cards → rows appear in `events` (Studio / SQL). Manual create: `/events` → fill form → optional Generate → optional image → Save.

## OpenRouter Configuration

AI activity suggestions (F-02 scaffold + S-01 product UI) use [OpenRouter](https://openrouter.ai/) via server-only env vars declared in `astro.config.mjs`. Without them, the config banner reports OpenRouter as missing and the suggestions API returns `503`.

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

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) as worker **kids-time-mvp**. Production also deploys from GitHub Actions on push to `main` after a green `ci` job; local `npm run deploy` remains the fallback.

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

GitHub Actions runs on every push and pull request to `main`. The `ci` job runs lint, `npm test`, and build. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.

The `deploy` job runs only on `push` to `main` after a green `ci` job. It rebuilds, deploys worker `kids-time-mvp`, and smokes `GET /` (`https://kids-time-mvp.michal-machlowski.workers.dev/`). Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets for deploy. Do not put `SUPABASE_*` or `OPENROUTER_*` in the Wrangler action `secrets:` input — runtime secrets stay on the Worker.

## License

MIT
