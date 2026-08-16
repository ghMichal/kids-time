# Integration fixtures (JWT A/B)

Local Auth users for Vitest integration (`npm run test:integration` / `npm run test:all`).
Do **not** commit passwords. Keep credentials in `.env` / `.dev.vars` (gitignored).

## One-time seed

1. Start local Supabase (Docker):

   ```bash
   npx supabase start
   ```

2. Copy `SUPABASE_URL` and `SUPABASE_KEY` (anon) from the CLI output into `.env` and `.dev.vars` if missing.

3. Create **two** Auth users (Studio → Authentication → Users, or Admin API). Email confirmation must be off locally (see root README) or confirm both users.

4. Add to `.env` / `.dev.vars` (names match `scripts/verify-event-images-rls.ts`):

   ```bash
   USER_A_EMAIL=...
   USER_A_PASSWORD=...
   USER_A_ID=<uuid from auth.users>
   USER_B_EMAIL=...
   USER_B_PASSWORD=...
   USER_B_ID=<uuid from auth.users>
   ```

5. Confirm sign-in:

   ```bash
   npm run test:integration
   ```

   Suites using `hasIntegrationEnv()` should **run**, not skip. If they skip, check the console line listing missing env keys.

## Notes

- **Local + disposable A/B only.** Suites wipe **all** `events` for `USER_A_ID` / `USER_B_ID` between cases. Point `SUPABASE_URL` at local Supabase (`localhost` / `127.0.0.1`). Non-local URLs are refused unless you set `INTEGRATION_ALLOW_REMOTE=1` (still use disposable test users — never production parents). The integration Vitest project runs files **sequentially** (`fileParallelism: false`) so shared A/B wipes do not race.
- Fixture: `supabase-jwt-fixture.ts` — `createClient` + `signInWithPassword`; not the Astro SSR Supabase helper; no wholesale Supabase mock. Hydrates missing keys from `.env` / `.dev.vars` at import (shell env still wins). `scripts/verify-event-images-rls.ts` expects shell-exported env only.
- Without these env vars, integration tests **skip** and exit 0 (unit `npm test` stays green).
- CI Docker + forced integration gate lands in test-plan §3 Phase 4 (later rollout), not this change's Phase 1 scope.
- Foreign-published seeds must set `is_published=true` **and** `published_at` (CHECK `events_published_at_consistency`) with `triage_status` in `{accepted, maybe}` so a dropped `.eq("owner_id")` would actually leak.
