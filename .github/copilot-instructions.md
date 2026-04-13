# Copilot Instructions for Matchmaker

## Project Overview

Tennis matchmaking web app — helps neighbors find tennis partners at local courts. Built as a React SPA backed by Supabase (Postgres, Auth, Realtime).

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS 4
- **Backend**: Supabase (Postgres, GoTrue auth, PostgREST, Realtime)
- **Auth**: Google OAuth + magic link email (both passwordless)
- **Local dev**: Supabase CLI with Docker (13 containers)

## Supabase Auth — Critical Patterns

These patterns were hard-won through debugging. Do not deviate without good reason.

### AuthProvider (useAuth.tsx)

Use **both** `getSession()` and `onAuthStateChange` per Supabase docs:

```ts
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session)
  setUser(session?.user ?? null)
  if (session?.user) fetchProfile(session.user.id)
  setLoading(false)
})

const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (_event, session) => {
    // update state...
    setLoading(false)
  }
)
```

**Do NOT** `await` fetchProfile() inside the auth state handler — it blocks `setLoading(false)` and causes infinite spinners on protected routes.

### AuthCallback (magic links)

Use `verifyOtp({ token_hash })` for magic links (official Supabase pattern). Fall back to `onAuthStateChange` + `getSession()` for OAuth hash fragment redirects.

### New user detection

Check `ntrp_rating === null` to determine if a user needs the profile setup wizard. Do NOT check `display_name` — it's auto-populated to `'New Player'` by the `handle_new_user()` trigger.

## Supabase Auth — Known Gotchas

1. **Browser lock timeout**: Supabase JS uses a browser lock for session management. If `getSession()` is called while another tab/operation holds the lock, it blocks for ~5 seconds. Always have `onAuthStateChange` as a fallback.

2. **Trigger schema context**: Database trigger functions that fire from `auth.users` (like `handle_new_user()`) must use fully-qualified table names (`public.profiles`) and `SET search_path = public`, because they execute in the auth schema context.

3. **GoTrue NULL varchar columns**: When seeding `auth.users` directly, ALL varchar columns must be set to `''` (not NULL). GoTrue's Go scanner crashes on NULL string columns. Exception: `phone` has a unique constraint, so use NULL for that.

4. **Magic link redirect URL**: `site_url` in `supabase/config.toml` must match the Vite dev server origin exactly (`http://localhost:5173`, not `127.0.0.1`).

5. **Gateway stale after db reset**: After `supabase db reset`, the Kong gateway may lose its upstream connection to auth. Restart the gateway if auth requests return "invalid response from upstream server": `docker restart supabase_kong_matchmaker`

## Local Development

```bash
npm run db:start     # Start local Supabase (Docker)
npm run db:reset     # Apply migrations + seed data
npm run dev          # Start Vite dev server at localhost:5173
```

- **Supabase Studio**: http://127.0.0.1:54323
- **Mailpit** (email catcher): http://127.0.0.1:54324
- **Seed users**: `admin@localhost` (admin, NTRP 4.0) and `player2@localhost` (player, NTRP 3.5) — use magic links, check Mailpit

## Database

- Migrations live in `supabase/migrations/` (timestamp-prefixed)
- Seed data in `supabase/seed.sql`
- Matchmaking runs as a Postgres function: `SELECT run_matchmaking();`
- RLS is enabled on all tables

## Code Conventions

- TypeScript strict mode
- TailwindCSS for all styling (no CSS modules)
- Supabase client created without Database generic (pragmatic MVP choice — types resolve to `never` otherwise)
- `as any` casts on some Supabase `.upsert()` calls due to type inference issues
