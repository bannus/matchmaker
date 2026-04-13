# Matchmaker TODO

## Deployment (go live)

1. [ ] Create a Supabase cloud project and run the SQL migration
2. [ ] Configure Google OAuth in Supabase dashboard
3. [ ] Update `.env` with production Supabase URL and anon key
4. [ ] Deploy to Vercel/Netlify (`npm run build` → deploy `dist/`)
5. [ ] Set yourself as admin: `UPDATE profiles SET is_admin = true WHERE id = 'your-user-id'`
6. [ ] Add your 4 local courts via the admin panel
7. [ ] Print flyers with QR codes pointing to the site!

## Bugs / Edge Cases

- [ ] **[P3]** Hide calendar links for matches in 'awaiting opponent' state
  - Currently the Upcoming section shows Google Cal / iCal buttons for matches where `status === 'proposed' && my_response === 'accepted'`
  - These should only appear once the match is `confirmed` (both players accepted)
  - In `MatchesPage.tsx`, the calendar buttons render when `key === 'upcoming'` — add a check for `m.status === 'confirmed'`

## Features (not yet built)

- [ ] **[P1]** Automated matchmaking trigger
  - Currently matchmaking only runs via manual SQL (`SELECT run_matchmaking()`)
  - For production, need pg_cron (scheduled) or a trigger when new availability is posted
  - pg_cron setup is commented out in the migration file
- [ ] **[P2]** Email notifications via Resend
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
- [ ] **[P3]** QR code generation for flyers
- [ ] **[P3]** Landing page for unauthenticated users

## Untested Flows

- [ ] Match cancellation by user (after confirmation)

## Testing Infrastructure

- [ ] **[P4]** Parallelize integration tests
  - Currently `fileParallelism: false` in vite.config.ts because test files share the same DB rows
  - Fix: scope each test file to its own court group and only clear data within it
  - Not worth the complexity now, but revisit if test suite time becomes a bottleneck
