# Matchmaker — Completed TODOs

## Deployment

- [x] Create a Supabase cloud project and run the SQL migration (April 2026)
- [x] Configure Google OAuth in Supabase dashboard (April 2026)
- [x] Update `.env` with production Supabase URL and anon key (April 2026)
- [x] Deploy to Vercel/Netlify (`npm run build` → deploy `dist/`) (April 2026)
- [x] Set yourself as admin: `UPDATE profiles SET is_admin = true WHERE id = 'your-user-id'` (April 2026)
- [x] Add your 4 local courts via the admin panel (April 2026)

## Bugs Fixed

- [x] **Notification badge goes stale after mark-as-read** (April 2026)
  - `useNotificationCount` subscribed to realtime inserts and incremented the count, but marking notifications as read in `NotificationsPage` never decremented the badge
  - `refreshCount()` existed but was never called after mark-as-read
  - Fix: added an UPDATE event listener to the same realtime channel in `useNotificationCount.ts` — re-fetches the true unread count immediately when any notification row is updated
  - Affected: `useNotificationCount.ts`

- [x] **Cleanly deferred doubles support** (April 2026)
  - Doubles was half-built: schema allowed it, UI exposed it, but `run_matchmaking()` only creates singles. After the preference-respect fix, doubles-only players silently never got matched.
  - Real doubles would need two-phase matchmaking (to avoid stranding doubles-only players behind greedy singles pairing), team NTRP balancing, a 4-player accept/decline flow, and court-capacity modeling — too much for unproven MVP demand.
  - Removed the `'doubles'` option from `ProfileSetupPage`, `ProfilePage`, and `PostAvailabilityForm`. Added `20260424000002_normalize_doubles_preference.sql` to flip existing `'doubles'` rows → `'both'`. Schema check constraints left intact for future revival. Full design notes documented in `docs/matchmaking.md` under "Doubles is intentionally deferred".
  - Follow-up (P3 in TODO.md): build doubles matchmaking properly.
  - Affected: `ProfileSetupPage.tsx`, `ProfilePage.tsx`, `PostAvailabilityForm.tsx`, new migration, `docs/matchmaking.md`, `profiles.integration.test.ts`

- [x] **Matchmaking ignores singles/doubles preference** (April 2026)
  - `run_matchmaking()` selected `profiles.preferred_match_type` as `player_pref` but never used it
  - Result: a player whose profile was set to doubles-only could still be paired into singles
  - Fixed in `20260424000001_matchmaking_respects_preferences.sql` — both the slot `match_type` and the profile `preferred_match_type` must allow singles (`'singles'` or `'both'`) for both players. Doubles matchmaking remains unimplemented (requires 4 players); doubles-only players are now skipped instead of being silently paired into singles.
  - Affected: `run_matchmaking()`, `matchmaking.integration.test.ts`, `docs/matchmaking.md`

- [x] **Missing notifications when a match is confirmed or declined** (April 2026)
  - The schema and UI support `match_confirmed`, `match_cancelled`, and `match_declined`
  - But the backend only inserted `match_proposed` notifications during `run_matchmaking()`
  - `respond_to_match()` changed match status without notifying the other participant(s)
  - Fixed in `20260418000002_match_response_notifications.sql` — the RPC now inserts
    `match_declined` notifications for other participants on decline, and `match_confirmed`
    notifications when the final accept confirms the match
  - Affected: `20260416000002_respond_to_match_rpc.sql`, `match-responses.integration.test.ts`

- [x] **Availability stuck as matched after decline** (April 2026)
  - `run_matchmaking()` marks the source availability rows as `status = 'matched'` and stores `match_id`
  - `respond_to_match()` cancelled the match on decline but never reopened those availability rows
  - Result: one decline burned both players' slots and they could not be rematched for that same time window
  - Fixed in `20260418000001_reset_availability_on_match_cancel.sql` — trigger-based so future cancellation paths are covered too
  - Affected: `20260415000002_availability_match_link.sql`, `20260416000002_respond_to_match_rpc.sql`

- [x] **Decline match should cancel the match** (April 2026)
  - When a player declines a proposed match, the match status should change to `cancelled`
  - Root cause: missing UPDATE RLS policy on `matches` table — users couldn't change match status
  - Fixed in migration `20260414000001_fix_rls_policies.sql`

- [x] **5 missing RLS policies** (April 2026)
  - `matches`: no UPDATE policy (players couldn't accept/decline)
  - `match_players`: SELECT only showed own row (couldn't see opponents or check "all accepted?")
  - `profiles`: no admin UPDATE policy (admins couldn't ban/unban)
  - `court_groups`/`courts`: no DELETE policy for admins
  - Fixed via new migration with `get_my_match_ids()` SECURITY DEFINER helper

- [x] **Admin dashboard match stats return 0** (April 2026)
  - RLS policy `matches_select` only allowed match participants to read matches
  - Admin dashboard queries returned empty/partial results even for admin users
  - Added admin bypass to `matches_select` policy (`OR is_admin = true`)
  - Migration: `20260416000001_admin_matches_select.sql`

- [x] **No desktop navigation** (April 2026)
  - Bottom nav bar only rendered on mobile (`md:hidden` in `AppLayout.tsx`)
  - Desktop users had no primary navigation
  - Added inline desktop nav links (`hidden md:flex`) in the top header bar
  - Affected: `AppLayout.tsx`

- [x] **Match accept race condition** (April 2026)
  - Client-side accept did 3 queries (update response, check all accepted, update match status)
  - Two players accepting simultaneously could leave match stuck in "proposed"
  - Created atomic `respond_to_match(match_id, response)` Postgres RPC with row locking
  - Updated `MatchesPage.tsx` to use single RPC call instead of multi-query flow
  - Migration: `20260416000002_respond_to_match_rpc.sql`

## Features

- [x] **In-app notifications with realtime badge** (April 2026)
  - Notification bell with unread count badge in the app header
  - Full notifications page with mark-as-read
  - Realtime subscription for live badge updates via Supabase Realtime
  - `useNotificationCount` hook, `NotificationsPage.tsx`, `AppLayout.tsx`

- [x] **Admin dashboard with user management** (April 2026)
  - Admin dashboard with match/user/court stats
  - User list with ban/unban functionality
  - Full court CRUD (create, edit, delete court groups and courts)
  - `AdminDashboardPage.tsx`, `AdminUsersPage.tsx`, `AdminCourtsPage.tsx`

- [x] **Calendar export for confirmed matches** (April 2026)
  - Google Calendar link generation and iCal file download
  - Renders on upcoming matches in `MatchesPage.tsx`
  - Utility functions in `src/utils/calendar.ts`

- [x] **Court crowding indicator on matches** (April 2026)
  - Shows how many other players have availability at the same court/time
  - Helps players gauge how busy a court will be
  - `MatchesPage.tsx`

- [x] **QR code flyers with court-aware onboarding** (April 2026)
  - QR codes link to `/join?court=<court_group_id>` with dedicated public landing page
  - New users who sign up via a court QR code get that court pre-selected in the profile setup wizard
  - Court param passed through auth redirect URLs (survives magic links in different browsers) + localStorage fallback with 1-hour TTL
  - Admin panel generates printable flyer with QR code per court group (`/admin/courts/flyer/:id`)
  - `JoinPage.tsx`, `CourtFlyerPage.tsx`, `onboardingCourt.ts`, modified `useAuth.tsx`, `AuthCallback.tsx`, `ProfileSetupPage.tsx`, `LoginPage.tsx`, `AdminCourtsPage.tsx`, `App.tsx`
  - Read-only discovery view showing other players' posted availability
  - Lets players see who's looking for matches at which courts/times
  - `AvailabilityPage.tsx`

- [x] **Automated matchmaking trigger** (April 2026)
  - Added `trg_matchmaking_on_availability` trigger — runs matchmaking instantly when new availability is posted
  - Added pg_cron scheduled job every 15 minutes as safety net
  - Added `exec_sql` service_role-only helper for test trigger management
  - Migration: `20260415000001_automated_matchmaking.sql`

## Testing

- [x] **Add integration tests for match responses, profiles, admin** (April 2026)
  - 24 integration tests: decline→cancel, accept→confirm, profile CRUD, court CRUD, ban/unban, RLS isolation
  - Tests discovered 5 RLS policy bugs (all fixed)
  - Shared test helpers in `src/test/helpers.ts`

- [x] **Set up Vitest test suite with unit + integration tests** (April 2026)
  - 27 unit tests: NTRP utilities, calendar generation, match categorization
  - 10 integration tests: matchmaking function against local Supabase
  - npm scripts: `test`, `test:unit`, `test:integration`, `test:watch`
  - Extracted match categorization logic to `src/utils/matches.ts` for testability
