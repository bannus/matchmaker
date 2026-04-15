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
- [ ] **[P2]** QR code flyers with court-aware onboarding
  - QR codes link to `matchmaker.app/?court=<court_group_id>`
  - New users who sign up via a court QR code get that court pre-selected as their home court in the profile setup wizard
  - Store the `court` param in localStorage before auth redirect, read it back in ProfileSetupPage
  - Admin panel generates printable flyer with QR code per court group
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
- [ ] **[P3]** Auto-populate courts from public GIS data
  - Cambridge has 7 public tennis locations in official open data (GeoJSON, CC license)
  - Source: `github.com/cambridgegis/cambridgegis_data/Recreation/Athletic_Facilities`
  - Filter by `Athletics === 'Tennis'`, includes name + lat/lng coordinates
  - Could expand to other cities with similar open data portals (Boston, Somerville, etc.)
  - Admin "Import from public data" button that fetches + previews before inserting

## Untested Flows

- [ ] Match cancellation by user (after confirmation)

## Testing Infrastructure

- [ ] **[P4]** Parallelize integration tests
  - Currently `fileParallelism: false` in vite.config.ts because test files share the same DB rows
  - Fix: scope each test file to its own court group and only clear data within it
  - Not worth the complexity now, but revisit if test suite time becomes a bottleneck
