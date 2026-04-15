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

## Features

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
