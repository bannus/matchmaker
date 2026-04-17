# Authentication Flow

This doc explains how authentication works in Matchmaker, why the current implementation looks the way it does, and which Supabase settings are required for it to work reliably.

## Overview

Matchmaker supports two passwordless sign-in methods:

- **Google OAuth**
- **Magic link email**

Both flows end at the same callback route:

```
/auth/callback
```

From there, the app decides whether the user should go to:

- `/profile/setup` for a new user
- `/dashboard` for a returning user

The "new user" check is based on **`profiles.ntrp_rating === null`**, not `display_name`.

## Architecture

```
LoginPage
  │
  ├── Google OAuth → Supabase Auth → /auth/callback
  └── Magic link   → email link     → /auth/callback?token_hash=...
                                          │
                                          ▼
                                   AuthCallback
                                          │
                                          ▼
                              Supabase session established
                                          │
                                          ▼
                  profile.ntrp_rating === null ? /profile/setup : /dashboard
```

## Main Files

| File | Purpose |
|---|---|
| `src\hooks\useAuth.tsx` | Global auth/session state, sign-in methods, profile fetch |
| `src\components\auth\AuthCallback.tsx` | Handles OAuth and magic-link callback flows |
| `src\pages\LoginPage.tsx` | Entry point for Google and magic-link sign-in |
| `src\pages\ProfileSetupPage.tsx` | New-user onboarding wizard |
| `supabase\migrations\20260413000001_initial_schema.sql` | `handle_new_user()` trigger that creates `profiles` rows |
| `supabase\config.toml` | Local auth provider and redirect configuration |

## Session Initialization Pattern

`useAuth.tsx` intentionally uses **both** of these Supabase APIs:

1. `supabase.auth.getSession()`
2. `supabase.auth.onAuthStateChange(...)`

That is not redundant.

### Why both are needed

- `getSession()` restores the current session on app load
- `onAuthStateChange()` catches later auth changes
- Supabase session management can be delayed by browser locking, so relying on only one path can cause long waits or stuck loading states

### Important implementation rule

Do **not** await `fetchProfile()` before calling `setLoading(false)` inside the auth-state handler.

If profile loading blocks auth-state completion, protected routes can get stuck behind a spinner even though the user is already signed in.

## Sign-In Methods

### Google OAuth

`useAuth.signInWithGoogle()` calls:

```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: callbackUrl.toString() },
})
```

The redirect target is built from `window.location.origin`, so local and deployed environments can share the same code.

### Magic link email

`useAuth.signInWithMagicLink()` calls:

```ts
supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: callbackUrl.toString() },
})
```

The user receives an email that returns to `/auth/callback`.

## Callback Handling

`AuthCallback.tsx` supports two callback styles.

### 1. Magic links

Magic links arrive with `token_hash` in the query string.

The callback exchanges that token with:

```ts
supabase.auth.verifyOtp({ token_hash })
```

This is the preferred Supabase pattern for email-link verification.

### 2. OAuth redirects

OAuth redirects may rely on session state established by Supabase during the redirect cycle, so the callback also falls back to:

1. `onAuthStateChange(...)`
2. `getSession()`

Whichever path yields a session first triggers the redirect decision.

## New User Creation

New auth users get a profile row via the database trigger:

```sql
create or replace function handle_new_user()
```

That trigger inserts a profile with:

- `id = auth.users.id`
- `display_name = raw_user_meta_data.full_name` when available
- fallback display name of `'New Player'`

Because `display_name` is auto-populated, it is **not** reliable for deciding whether onboarding is complete.

The app instead treats this as the onboarding check:

```ts
profile.ntrp_rating === null
```

## Redirect and Provider Configuration

Local auth configuration lives in `supabase\config.toml`.

Key settings:

```toml
site_url = "http://localhost:5173"
additional_redirect_urls = [
  "http://localhost:5173/auth/callback",
  "http://127.0.0.1:5173/auth/callback"
]
```

Google is enabled here as well:

```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
skip_nonce_check = true
```

## Local Development

### Magic links

Magic links are the easiest local auth flow:

1. Start local Supabase: `npm run db:start`
2. Reset schema/seed data: `npm run db:reset`
3. Start the app: `npm run dev`
4. Open Mailpit at `http://127.0.0.1:54324`
5. Request a magic link and open it from Mailpit

### Google OAuth

Google OAuth requires real credentials. It will not work in local dev unless:

- `GOOGLE_CLIENT_ID` is set
- `GOOGLE_CLIENT_SECRET` is set
- your Google OAuth app allows the exact Supabase/local redirect flow being used

## Known Gotchas

### 1. Use `getSession()` and `onAuthStateChange()`

Using only one of them is fragile. The current implementation intentionally uses both.

### 2. Do not block auth loading on profile fetch

Profile loading is allowed to complete after auth state is already known.

### 3. `site_url` must match the Vite origin exactly

For local magic links, `http://localhost:5173` and `http://127.0.0.1:5173` are not interchangeable.

### 4. Auth trigger functions run in auth schema context

`handle_new_user()` inserts into `public.profiles` and sets `search_path = public` for a reason. Trigger functions fired from `auth.users` should fully qualify public tables.

### 5. Direct seeding of `auth.users` is sensitive to NULL varchar columns

When seeding GoTrue tables directly, string columns generally need `''` instead of `NULL`. This is a Supabase/GoTrue implementation detail, not an app-level convention.

### 6. Local gateway can go stale after `supabase db reset`

If auth starts failing with an upstream error after a reset, restart the local Kong gateway:

```bash
docker restart supabase_kong_matchmaker
```

## Current Limitations

- `AuthCallback.tsx` currently has a known cleanup issue: the success path does not fully clean up its timeout/subscription before navigation
- Google OAuth local setup is more fragile than magic links
- Auth state depends on Supabase client/browser behavior, so timing bugs tend to show up first in callback handling and protected routes

