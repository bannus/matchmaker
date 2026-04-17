# QR Code Flyers & Court-Aware Onboarding

This doc covers the QR code flyer system: how it works, how to deploy it, and how the court-aware onboarding flow connects everything together.

## Overview

Physical flyers with QR codes are placed at tennis courts. When a new player scans the QR code:

1. They're redirected to the app with their court pre-identified
2. They sign up via Google or magic link
3. Their scanned court is automatically pre-selected during profile setup

This removes friction — players don't have to find and select their court manually.

## Architecture

```
QR Code (printed flyer)
  │
  ▼
Supabase Edge Function (stable URL — never changes)
  │  302 redirect
  ▼
/join?court=<court_group_id>  (JoinPage — public landing)
  │  stores court in localStorage + navigates to login
  ▼
/login?court=<court_group_id>  (LoginPage — passes court through auth)
  │  court param encoded in OAuth/magic-link redirect URL
  ▼
/auth/callback?court=<court_group_id>  (AuthCallback — persists court)
  │  stores court in localStorage, routes to setup or dashboard
  ▼
/profile/setup  (ProfileSetupPage — court pre-selected in step 4)
  │  clears localStorage after save
  ▼
/dashboard  (done!)
```

## Key Components

### Edge Function: `supabase/functions/court-redirect/index.ts`

The QR code encodes a **stable Supabase project URL** that never changes, even if the app domain changes:

```
https://<project-ref>.supabase.co/functions/v1/court-redirect?court=<court_group_id>
```

The edge function:
- Validates the `court` param is a UUID
- Verifies the court group exists in the database
- 302-redirects to `{APP_URL}/join?court=<court_group_id>`
- Falls back to `/join` (no court context) if the court is invalid or deleted

The redirect target is configured via the `APP_URL` secret. **Changing your app domain only requires updating this one secret — no reprinting flyers.**

### localStorage: `src/utils/onboardingCourt.ts`

Court context is stored in localStorage to survive the auth redirect cycle (OAuth goes to Google and back, magic links go through email).

```typescript
storeOnboardingCourt(courtGroupId)  // stores with timestamp
getOnboardingCourt()                // returns ID or null (checks TTL)
clearOnboardingCourt()              // removes from storage
isValidUuid(value)                  // validates UUID format
```

- **TTL**: 1 hour — stale values are automatically discarded
- **Cleared on**: successful profile save, sign-out
- **Storage format**: `{ courtGroupId: string, timestamp: number }`

The court param is also passed through auth redirect URLs (`/auth/callback?court=<id>`), so magic links opened in a different browser still carry the court context.

### Join Page: `src/pages/JoinPage.tsx`

Public landing page at `/join?court=<court_group_id>`. Shows the court name and a "Get Started" button. If the user is already logged in, redirects straight to `/dashboard`.

### Court Flyer Page: `src/pages/CourtFlyerPage.tsx`

Admin-only page at `/admin/courts/flyer/:courtGroupId`. Renders a print-optimized flyer with:
- App name and tagline
- Court group name
- Large QR code (SVG for print quality)
- Call-to-action text
- Human-readable URL as text fallback

Click "Print Flyer" or use Ctrl+P. The page has `print:` styles that hide the nav bar and controls.

## Deployment

### 1. Deploy the edge function

```bash
supabase functions deploy court-redirect
```

### 2. Set the app URL secret

```bash
supabase secrets set APP_URL=https://your-domain.com
```

### 3. Generate and print flyers

1. Log in as admin
2. Go to **Admin → Manage Courts**
3. Click **"QR Flyer"** on any court group
4. Click **"Print Flyer"** (or Ctrl+P)

### Changing your domain later

```bash
supabase secrets set APP_URL=https://new-domain.com
```

All existing QR codes will redirect to the new domain. No reprinting needed.

## Edge Cases

| Scenario | Behavior |
|---|---|
| Invalid/non-UUID `court` param | JoinPage shows generic "outdated link" message |
| Deleted court group | Edge function redirects to `/join` (no court context) |
| Stale localStorage (>1 hour) | Automatically discarded, no pre-selection |
| Existing logged-in user scans QR | Redirected to `/dashboard` |
| Magic link opened in different browser | Court param in the callback URL ensures it still works |
| Shared device / leftover localStorage | 1-hour TTL + cleared on sign-out prevents contamination |

## Local Development

The edge function uses `APP_URL` env var, defaulting to `http://localhost:5173`. During local dev, QR codes in the flyer will point to:

```
http://127.0.0.1:54321/functions/v1/court-redirect?court=<id>
```

This redirects to the local Vite dev server. To test the full flow locally:

1. Ensure local Supabase is running (`npm run db:start`)
2. Start the dev server (`npm run dev`)
3. Log in as admin, go to Manage Courts, click "QR Flyer"
4. Copy the QR URL or scan it with your phone (if on same network, use `--host`)

## Files

| File | Purpose |
|---|---|
| `supabase/functions/court-redirect/index.ts` | Edge function — stable QR redirect |
| `src/pages/JoinPage.tsx` | Public landing page for QR scans |
| `src/pages/CourtFlyerPage.tsx` | Printable flyer with QR code |
| `src/utils/onboardingCourt.ts` | localStorage helpers (store/get/clear/validate) |
| `src/pages/LoginPage.tsx` | Passes court context through auth methods |
| `src/hooks/useAuth.tsx` | Auth methods accept optional `courtGroupId` |
| `src/components/auth/AuthCallback.tsx` | Reads court from URL, stores in localStorage |
| `src/pages/ProfileSetupPage.tsx` | Pre-selects court from localStorage |
| `src/pages/AdminCourtsPage.tsx` | "QR Flyer" link per court group |
