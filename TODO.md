# Matchmaker TODO

## Deployment (go live)

1. [ ] Print flyers with QR codes — use Admin → Manage Courts → "QR Flyer" button per court group

## Bugs / Edge Cases

- [ ] **[P2]** Auth callback leaks subscription and timeout on success
  - `AuthCallback.tsx` sets up `onAuthStateChange` + a 10s timeout but never cleans them up on the success path
  - Can cause state updates on unmounted components
  - Fix: add cleanup in the success branch before navigating away
  - Affected: `AuthCallback.tsx`
- [ ] **[P3]** Database types out of sync with migrations
  - `availability.match_id` column added in `20260415000002_availability_match_link.sql` is not in `src/types/database.ts`
  - Fix: regenerate types with `npx supabase gen types typescript`
  - Affected: `src/types/database.ts`
- [ ] **[P2]** Hide calendar links for matches in 'awaiting opponent' state
  - Currently the Upcoming section shows Google Cal / iCal buttons for matches where `status === 'proposed' && my_response === 'accepted'`
  - These should only appear once the match is `confirmed` (both players accepted)
  - In `MatchesPage.tsx`, the calendar buttons render when `key === 'upcoming'` — add a check for `m.status === 'confirmed'`

## Features (not yet built)

- [ ] **[P3]** Build doubles matchmaking properly
  - Doubles is currently deferred — the `'doubles'` option is hidden from all UI pickers, and existing `'doubles'` rows were normalized to `'both'`
  - Building it properly requires: two-phase matchmaking (doubles-first pass anchored on doubles-only players, singles fallback), team NTRP balancing, 4-player accept/decline flow, and court-capacity modeling
  - See `docs/matchmaking.md` → "Doubles is intentionally deferred" for the full design notes
  - Schema constraints still allow `'doubles'` so no migration is needed to revive it
- [ ] **[P2]** Player messaging for match coordination
  - Players need a way to communicate after being matched (e.g., "I'll bring balls", "let's use court 3")
  - Recommended approach: match-scoped message thread (comment thread per match)
    - Simple `match_messages` table, opponent gets email notification per message
    - Naturally scoped to matches, easy to moderate, privacy-preserving (no email exchange)
    - Keep threads open after match completion so players can reconnect
  - Add a "Play again" button on completed matches to re-invite the same opponent
  - Alternatives considered:
    - Email relay (Craigslist-style proxy addresses) — operationally heavy, needs inbound email infra
    - Full in-app chat — overkill for match coordination
    - Reveal emails on confirmation — simplest but least private
    - Player-to-player threads (unlocked after playing) — flexible but starts feeling like a social network
  - Depends on email notifications (Resend) for full value
- [ ] **[P2]** Recurring availability support
  - Common pattern: "I'm free every Saturday 9am–12pm"
  - The `availability` table already has a `recurrence_rule` column (unused)
  - Approach: store an iCal-style RRULE (e.g., `FREQ=WEEKLY;BYDAY=SA`) on the availability row
  - A scheduled job (or the matchmaking function) expands recurrence into concrete date rows, rolling forward ~2 weeks
  - UI: add a "Repeat" toggle to PostAvailabilityForm with presets (weekly, biweekly) and an end date
  - Player can cancel individual occurrences or the whole series
- [ ] **[P3]** Landing page for unauthenticated users
- [ ] **[P2]** Court geolocation and map view
  - Add lat/lng to courts (court_groups already have `location_lat`/`location_lng`)
  - Show courts on an interactive map (Mapbox GL or Leaflet)
  - Let admins set location by clicking the map or entering an address
  - Players can browse courts near them and filter by distance
- [ ] **[P2]** Bulk availability submission to nearby courts
  - When posting availability, let players select multiple court groups at once
  - Show nearby courts sorted by distance (requires geolocation above)
  - Single form submission creates one availability row per selected court group
  - Matched at whichever court finds an opponent first
- [ ] **[P2]** Admin onboarding flow
  - New court admins have no guided setup experience — they land in the admin panel cold
  - Flow should cover: confirm court details are accurate, print/share QR flyer, invite first players
  - Could be a checklist-style setup wizard shown until all steps are complete
  - Triggered when a user is first granted admin role on a court group
- [ ] **[P2]** Admin can block off court availability
  - Admins need to mark time windows as unavailable (school use, resurfacing, organized group bookings, etc.)
  - Blocked windows should suppress matchmaking for that court during those times
  - UI: calendar-style block entry in admin panel with optional label ("School team practice", "Resurfacing")
  - Matchmaking function should skip availability windows that overlap a court blackout
- [ ] **[P3]** Admin can pin announcements to a court
  - Admins can post a short notice visible to all players at that court (e.g., "Courts closed this weekend for resurfacing")
  - Shown prominently on the dashboard and courts page for affected court group
  - Optional expiry date so stale announcements don't linger
- [ ] **[P3]** Consider a lightweight "court steward" role
  - Full admin may be more than most court volunteers want to take on
  - Steward role: gets notified of flagged/reported users, can ban from their court, but cannot edit court details or run matchmaking manually
  - Courts without a steward still function — role is optional, not required
  - Reduces friction for recruiting community moderators vs. asking for full admin commitment
- [ ] **[P3]** Auto-populate courts from public GIS data
  - Cambridge has 7 public tennis locations in official open data (GeoJSON, CC license)
  - Source: `github.com/cambridgegis/cambridgegis_data/Recreation/Athletic_Facilities`
  - Filter by `Athletics === 'Tennis'`, includes name + lat/lng coordinates
  - Could expand to other cities with similar open data portals (Boston, Somerville, etc.)
  - Admin "Import from public data" button that fetches + previews before inserting
  - Broader sources to consider: Google Places API, OpenStreetMap (`sport=tennis`), USTA facility database
- [ ] **[P3]** Self-serve court creation by users
  - Currently creating a court group requires manual super-admin intervention
  - Lower priority if auto-import covers most courts, but needed as a long-tail escape hatch
  - Flow: user submits a court (name, location), goes into a review queue or is auto-approved
  - Creator becomes the initial steward/admin of that court
- [ ] **[P3]** Public QR flyer link (no login required)
  - Currently the QR flyer is only accessible inside the admin panel
  - If anyone at a court should be able to share it (no admin gatekeeper model), the flyer URL needs to be publicly accessible
  - Route: `/courts/:courtGroupId/flyer` — readable without auth, printable
- [ ] **[P3]** User flagging and reporting
  - Players should be able to flag a user or report an issue at a court without needing admin access
  - Flags notify the court steward/admin for review
  - Repeated flags from multiple users could surface to super-admin automatically
  - Part of the lightweight crowdsourced moderation model
- [ ] **[P3]** Court activity dashboard for admins/stewards
  - Admins need visibility into whether their court is healthy: active players, last match made, stale availability
  - Key metrics: total members, matches made last 30 days, last matchmaking run result, number of open availability windows
  - Helps identify courts that have gone dormant so they can be re-engaged or archived

## Engineering / Architecture

- [ ] **[P4]** Move `run_matchmaking()` out of Postgres into a TypeScript Edge Function
  - Currently the matchmaking algorithm lives in PL/pgSQL, making it hard to test, debug, and extend (especially for doubles)
  - **What moves:** `run_matchmaking()` — the candidate-finding logic, match creation, availability updates, and notification inserts
  - **What stays:** `respond_to_match()` — its row-locking and race-safety semantics are a natural fit for SQL and hard to replicate safely in application code
  - **Target:** Supabase Edge Function (Deno/TypeScript, already used in this project for `court-redirect`)
  - **Triggering changes:**
    - Replace the `availability` INSERT trigger with a Supabase Database Webhook → Edge Function
    - Replace `pg_cron` with a Vercel Cron Job or GitHub Actions schedule calling the same Edge Function
  - **Atomicity:** The SQL function does everything in one transaction. The Edge Function would need to issue an explicit `BEGIN`/`COMMIT` via a raw SQL connection (e.g. `postgres.js`) or accept that a crash mid-run could leave partial state — a retry-safe design helps here
  - **Payoff:** The matching algorithm (NTRP filtering, overlap math, preference compatibility, future doubles two-phase logic) becomes TypeScript that can be unit tested with mocked data, stepped through with a debugger, and observed with structured logging — instead of `RAISE NOTICE` and Postgres logs

## UX Issues

- [ ] **[P2]** No error states on data fetches — infinite spinners on failure
  - Several pages have no `try/catch` around Supabase queries — network failures leave the loading spinner forever
  - Fix: wrap fetches in try/catch, add error state UI with retry button
  - Affected: `DashboardPage.tsx`, `CourtsPage.tsx`, `NotificationsPage.tsx`, `AdminCourtsPage.tsx`
- [ ] **[P3]** Login button has no loading or error feedback
  - Google sign-in button has no disabled/loading state while auth is in progress
  - Auth errors are not surfaced to the user
  - Fix: add loading spinner on click, show error toast on failure
  - Affected: `LoginPage.tsx`
- [ ] **[P3]** Accessibility gaps — clickable divs and modal semantics
  - Notification rows are clickable `<div>`s with no `role="button"`, `tabIndex`, or keyboard handler
  - Modals (availability form, admin court form) lack `<dialog>` semantics and focus trapping
  - Affected: `NotificationsPage.tsx`, `PostAvailabilityForm.tsx`, `AdminCourtsPage.tsx`
- [ ] **[P3]** Mutations fail silently — no user feedback on save errors
  - Profile save, admin ban/unban, court CRUD swallow errors and just reload data
  - Fix: surface error messages via toast or inline alert
  - Affected: `ProfilePage.tsx`, `AdminUsersPage.tsx`, `AdminCourtsPage.tsx`

## Untested Flows

- [ ] Match cancellation by user (after confirmation)

## Improvements

- [ ] **[P3]** Bias matchmaking tiebreaker toward longer overlap
  - Current tiebreaker (among equally-rated players) is `a.start_time` — picks whoever starts their window earliest in the day
  - More meaningful tiebreaker: longest overlap duration, so matched players have the most scheduling flexibility
  - Fix: replace `a.start_time` with `least(a.end_time, avail_a.end_time) - greatest(a.start_time, avail_a.start_time) desc` in the `ORDER BY` of `run_matchmaking()`
  - Affected: `20260413000001_initial_schema.sql`, `run_matchmaking()`
- [ ] **[P3]** Regenerate Supabase types to eliminate `as any` casts
  - Multiple files use `as any` on `.upsert()` and `.insert()` calls due to stale/missing types
  - Fix: run `npx supabase gen types typescript --local > src/types/database.ts` and update Supabase client generic
  - Affected: `ProfileSetupPage.tsx`, `ProfilePage.tsx`, `AdminCourtsPage.tsx`, `AvailabilityPage.tsx`
- [ ] **[P3]** Fix N+1 crowding queries in MatchesPage
  - Each match fires a separate query to count overlapping availability for the crowding indicator
  - Fix: batch into a single RPC or join in the initial matches query
  - Affected: `MatchesPage.tsx:136-166`
- [ ] **[P3]** Add a landing page for unauthenticated users
  - Currently `/*` redirects to `/dashboard` which bounces to `/login` — no explanation of what the app does
  - The P3 landing page feature in "Features" covers this, but it's worth noting the current redirect chain is jarring
  - Could be as simple as a hero section on the login page explaining the app

## Testing Infrastructure

- [ ] **[P4]** Parallelize integration tests
  - Currently `fileParallelism: false` in vite.config.ts because test files share the same DB rows
  - Fix: scope each test file to its own court group and only clear data within it
  - Not worth the complexity now, but revisit if test suite time becomes a bottleneck
