# Email Notifications

This doc describes the transactional-email pipeline that delivers match-related notifications via [Resend](https://resend.com).

## Overview

The pipeline turns rows in the `notifications` table into outbound email through two Edge Functions and one Postgres trigger:

```
INSERT INTO notifications
       │
       ▼
  AFTER INSERT trigger (send_notification_email_trigger)
       │  - skips non-emailable types (only the four match_* types qualify)
       │  - skips when profile.email_prefs[type] = false
       │  - skips when GUC settings are unset (lets you disable per env)
       ▼
  pg_net.http_post  ──►  Edge Function: send-notification-email
                              │  - re-fetches notification + profile + match
                              │  - renders subject/html/text per type
                              │  - calls Resend
                              │  - sets List-Unsubscribe + List-Unsubscribe-Post
                              └─ on 2xx: UPDATE notifications.email_sent_at
```

The `unsubscribe` Edge Function backs the RFC 8058 one-click unsubscribe header that mail clients (Gmail, Apple Mail) surface as a native button.

## Per-type Preferences

Players control delivery from `/profile`. The `profiles.email_prefs` jsonb column holds one boolean per emailable type:

```json
{
  "match_proposed":  true,
  "match_confirmed": true,
  "match_cancelled": true,
  "match_declined": true
}
```

New profiles default to all `true`. The trigger short-circuits when the type is disabled, and the Edge Function checks again before sending (defense in depth).

## RFC 8058 / RFC 2369 One-Click Unsubscribe

Each email carries:

```
List-Unsubscribe: <mailto:unsubscribe@<domain>?subject=unsubscribe-<token>>,
                  <https://<project>.supabase.co/functions/v1/unsubscribe?token=<token>>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

The `<token>` is a HMAC-SHA256 over `(user_id, type, iat)` using `UNSUBSCRIBE_SECRET`. Tokens never expire (so old emails keep working) but are bound to a specific user + type, so one cannot be replayed against another account or to disable a different category.

The HTTPS endpoint **only acts on POST** (returns 405 for GET / HEAD). This is mandated by RFC 8058 and is what protects users from link-checkers, security scanners, and pre-fetchers that issue GETs to URLs found in emails — those would otherwise silently unsubscribe people.

The body of every email also contains a "Manage email preferences" link to `/profile` for clients that don't honor `List-Unsubscribe`.

## Idempotency / Retry

`notifications.email_sent_at timestamptz` is the source of truth for delivery state:

- The trigger only fires when the row is freshly inserted, but it also short-circuits if `email_sent_at IS NOT NULL`.
- The Edge Function only stamps `email_sent_at` after Resend returns 2xx.
- Therefore: a transient failure leaves `email_sent_at = NULL` and the row is eligible for a manual retry. There is a partial index `idx_notifications_email_unsent` to make the "find unsent rows" query cheap.

A simple manual retry pattern (e.g. from Supabase Studio):

```sql
-- Forge a re-send by faking an INSERT trigger via UPDATE / re-INSERT, or just
-- POST directly to the function with the notification_id you want re-tried.
```

## Configuration

### Server-side secrets (Edge Functions)

Set in production with `supabase secrets set`:

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key. Required in the default `resend` delivery mode; if it is unset, the function returns 500 instead of pretending delivery succeeded. |
| `RESEND_FROM` | Verified sender, e.g. `Matchmaker <noreply@matchmaker.bann.us>` |
| `APP_URL` | Public app URL used to build links inside the email body (`/matches`, `/profile`). |
| `EMAIL_TRIGGER_SECRET` | **Required whenever the pipeline is enabled.** Shared secret the trigger sends as `X-Trigger-Secret`; the function returns 500 if it is unset or empty. |
| `UNSUBSCRIBE_SECRET` | **Required whenever the pipeline is enabled.** HMAC key for List-Unsubscribe tokens. Rotate independently of `EMAIL_TRIGGER_SECRET`; rotation invalidates old unsubscribe links but does not affect new emails. The email functions return 500 if it is unset or empty. |

`EMAIL_DELIVERY_MODE` is optional and defaults to `resend`. Set it to `log-only` only for local/testing if you want the function to log the outbound email instead of calling Resend. In `log-only` mode, `notifications.email_sent_at` stays `NULL`.

### Database config (Postgres trigger)

The trigger reads two values to know where to call the Edge Function and which secret to send. Production uses the `app_config` table because Supabase managed Postgres restricts `ALTER DATABASE ... SET app.settings.*`:

```sql
INSERT INTO app_config (key, value) VALUES
  ('edge_functions_url',   'https://<project>.supabase.co/functions/v1'),
  ('email_trigger_secret', '<must match EMAIL_TRIGGER_SECRET>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

`app_config` has RLS enabled with no policies, so it is unreadable through PostgREST. The `SECURITY DEFINER` trigger function reads it as the function owner.

The trigger also accepts the equivalent GUCs (`app.settings.edge_functions_url`, `app.settings.email_trigger_secret`) and prefers the table when both are set. Local dev keeps using GUCs because `ALTER DATABASE` works in the local stack.

If neither source is set or the value is empty, the trigger is a no-op. **Applying the migration to a fresh database does not start sending email** — the pipeline is opt-in per environment.

## Local Development

The local Supabase stack (`npm run db:start`) supports either explicit log-only mode or real Resend delivery.

1. Give the local edge runtime explicit secrets. There is no built-in fallback for `EMAIL_TRIGGER_SECRET` or `UNSUBSCRIBE_SECRET`, so set them in the shell (or env file) you use to run `supabase functions serve`:

   ```bash
   EMAIL_TRIGGER_SECRET=local-dev-trigger-secret
   UNSUBSCRIBE_SECRET=local-dev-unsubscribe-secret
   ```

2. If you want local notifications to log instead of calling Resend, also set:

   ```bash
   EMAIL_DELIVERY_MODE=log-only
   ```

   Leave `EMAIL_DELIVERY_MODE` unset (or set it to `resend`) when you want real delivery.

3. Set the local GUCs once after `db:reset` so the trigger can reach the Edge runtime via Kong:

   ```sql
   ALTER DATABASE postgres SET app.settings.edge_functions_url = 'http://kong:8000/functions/v1';
   ALTER DATABASE postgres SET app.settings.email_trigger_secret = 'local-dev-trigger-secret';
   ```

4. Serve the functions:

   ```bash
   npx supabase functions serve send-notification-email
   npx supabase functions serve unsubscribe
   ```

5. Trigger a notification (e.g. by running matchmaking or accepting a match). In `log-only` mode, the function logs the outbound email and leaves `email_sent_at` unset. In `resend` mode, it sends through Resend and stamps `email_sent_at` only after a 2xx response.

If you want a real email round-trip locally, set `RESEND_API_KEY` against a sandbox domain in `supabase/.env` (or wherever the local edge runtime reads env from) and leave `EMAIL_DELIVERY_MODE` unset.

## Adding a New Emailable Type

1. Add the new value to the `notification_type` allowed set in the schema (and the `NotificationType` TypeScript union).
2. Add the key with default `true` to the `email_prefs` default in `20260425000001_notification_email_pipeline.sql` (and run a follow-up migration to backfill existing profiles).
3. Add the new value to `EMAILABLE_TYPES` in `supabase/functions/send-notification-email/index.ts`.
4. Add a `case` in `templates.ts` `render()`.
5. Add a checkbox to `ProfilePage.tsx`.
6. Add the type to the `notifications_email_after_insert` trigger filter.

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260425000001_notification_email_pipeline.sql` | Schema, trigger, pg_net wiring |
| `supabase/functions/send-notification-email/index.ts` | Renders + sends + stamps `email_sent_at` |
| `supabase/functions/send-notification-email/templates.ts` | Per-type subject/html/text |
| `supabase/functions/send-notification-email/unsubscribe-token.ts` | HMAC sign / verify |
| `supabase/functions/unsubscribe/index.ts` | RFC 8058 POST-only endpoint |
| `src/pages/ProfilePage.tsx` | Per-type opt-in checkboxes |
