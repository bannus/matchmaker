# Matchmaker — Completed TODOs

## Bugs Fixed

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

- [x] **Browse availability tab** (April 2026)
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
