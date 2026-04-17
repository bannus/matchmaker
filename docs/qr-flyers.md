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
https://your-app-domain.com/join?court=<court_group_id>
  │  public landing
  ▼
/join?court=<court_group_id>  (JoinPage)
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

The QR code points directly at your public app domain:

```
https://your-app-domain.com/join?court=<court_group_id>
```

`CourtFlyerPage` uses `VITE_APP_URL` when provided, and falls back to `window.location.origin` otherwise.

Click "Print Flyer" or use Ctrl+P. The page has `print:` styles that hide the nav bar and controls.

## Deployment

### 1. Set the public app URL

```bash
VITE_APP_URL=https://your-app-domain.com
```

### 2. Generate and print flyers

1. Log in as admin
2. Go to **Admin → Manage Courts**
3. Click **"QR Flyer"** on any court group
4. Click **"Print Flyer"** (or Ctrl+P)

## Edge Cases

| Scenario | Behavior |
|---|---|
| Invalid/non-UUID `court` param | JoinPage shows generic "outdated link" message |
| Deleted court group | JoinPage shows generic "outdated link" message |
| Stale localStorage (>1 hour) | Automatically discarded, no pre-selection |
| Existing logged-in user scans QR | Redirected to `/dashboard` |
| Magic link opened in different browser | Court param in the callback URL ensures it still works |
| Shared device / leftover localStorage | 1-hour TTL + cleared on sign-out prevents contamination |

## Local Development

During local dev, if `VITE_APP_URL` is unset, QR codes in the flyer point to:

```
http://localhost:5173/join?court=<id>
```

To test the full flow locally:

1. Ensure local Supabase is running (`npm run db:start`)
2. Start the dev server (`npm run dev`)
3. Log in as admin, go to Manage Courts, click "QR Flyer"
4. Copy the QR URL or scan it with your phone (if on same network, use `--host`)

## Files

| File | Purpose |
|---|---|
| `src/pages/JoinPage.tsx` | Public landing page for QR scans |
| `src/pages/CourtFlyerPage.tsx` | Printable flyer with QR code |
| `src/utils/onboardingCourt.ts` | localStorage helpers (store/get/clear/validate) |
| `src/pages/LoginPage.tsx` | Passes court context through auth methods |
| `src/hooks/useAuth.tsx` | Auth methods accept optional `courtGroupId` |
| `src/components/auth/AuthCallback.tsx` | Reads court from URL, stores in localStorage |
| `src/pages/ProfileSetupPage.tsx` | Pre-selects court from localStorage |
| `src/pages/AdminCourtsPage.tsx` | "QR Flyer" link per court group |
