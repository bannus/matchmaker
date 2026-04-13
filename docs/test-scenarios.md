# Matchmaker — Manual Test Scenarios

This doc covers the core user flows and known edge cases discovered during initial testing. Use it as a guide for regression testing after changes.

## Prerequisites

- Local Supabase running (`npm run db:start && npm run db:reset`)
- Vite dev server running (`npm run dev`)
- Seed data includes: admin user, regular player, 1 court group with 4 courts
- Mailpit at http://127.0.0.1:54324 for catching emails

---

## 1. Authentication

### 1.1 Magic link sign-in (new user)
1. Go to login page
2. Enter a never-before-used email address
3. Open Mailpit, click the magic link
4. **Expected**: Redirected to profile setup wizard (not dashboard)

### 1.2 Magic link sign-in (existing user with completed profile)
1. Sign in as a user who has completed the wizard (e.g. `player2@localhost`)
2. Click magic link from Mailpit
3. **Expected**: Redirected to dashboard (not wizard)

### 1.3 Auth callback responsiveness
1. Click a magic link
2. **Expected**: Redirect happens within ~1 second, not 5+

### 1.4 Direct navigation while authenticated
1. Sign in successfully
2. Navigate directly to `http://localhost:5173/dashboard` via address bar
3. **Expected**: Dashboard renders immediately (no infinite spinner or blank page)

### 1.5 Direct navigation while unauthenticated
1. Clear session (sign out or use incognito)
2. Navigate directly to `http://localhost:5173/dashboard`
3. **Expected**: Redirected to login page

### 1.6 Sign out and sign in as different user
1. Sign out
2. Sign in as a different user
3. **Expected**: See the new user's data, not the previous user's

---

## 2. Profile Setup Wizard

### 2.1 Complete wizard flow
1. Sign in as a new user
2. Walk through all 4 steps (name, NTRP, match type, court group)
3. **Expected**: Each step saves, final step redirects to dashboard

### 2.2 Court group selection
1. During wizard step 4, court groups should be listed
2. **Expected**: The seeded "Neighborhood Tennis Courts" group appears and is selectable

---

## 3. Availability

### 3.1 Post availability
1. Navigate to Availability page
2. Post a new time slot (date, start/end time, match type)
3. **Expected**: Appears in "My Availability" tab

### 3.2 Post availability without court group
1. Sign in as a user with no court_group_id set
2. Try to post availability
3. **Expected**: Clear error message ("You must join a court group first")

### 3.3 Browse others' availability
1. Post availability as one user
2. Sign in as another user in the same court group
3. Check "Browse" tab
4. **Expected**: See the first user's availability

---

## 4. Matchmaking

### 4.1 Basic match creation
1. Two users in the same court group post overlapping availability (same date, overlapping times)
2. Run `SELECT run_matchmaking();` in Supabase Studio SQL editor
3. **Expected**: A match is created with status `proposed`, both players have response `pending`

### 4.2 NTRP filtering
1. Set two users with NTRP ratings more than 0.5 apart (e.g. 2.0 and 4.0)
2. Post overlapping availability for both
3. Run matchmaking
4. **Expected**: No match is created (players are too far apart in skill)

### 4.3 No overlapping availability
1. Two users post availability on different dates or non-overlapping times
2. Run matchmaking
3. **Expected**: No match is created

### 4.4 Matchmaking idempotency
1. Run matchmaking twice with the same open availability
2. **Expected**: Only one match is created (availability status changes to `matched` after first run)

---

## 5. Match Responses

### 5.1 Accept a match
1. View a proposed match on the Matches page
2. Click Accept
3. **Expected**: Match moves to Upcoming section with "awaiting opponent" badge

### 5.2 Both players accept
1. Both players accept the same match
2. **Expected**: Match status changes to `confirmed`

### 5.3 Decline a match
1. View a proposed match, click Decline
2. **Expected**: Match status changes to `cancelled`, disappears from Pending

### 5.4 Match visibility after responding
1. Accept a match where the opponent hasn't responded yet
2. **Expected**: Match is visible in Upcoming (not missing from all sections)

### 5.5 Calendar links visibility
1. View a match in Upcoming that is `confirmed`
2. **Expected**: Google Cal and iCal buttons are shown
3. View a match in Upcoming that is `awaiting opponent`
4. **Expected**: Calendar buttons should NOT be shown (see TODO.md)

---

## 6. Notifications

### 6.1 Match proposal notification
1. Run matchmaking to create a match
2. Check notifications page
3. **Expected**: Notification appears for both matched players

### 6.2 Notification click navigation
1. Click a match notification
2. **Expected**: Navigates to matches page, notification marked as read

### 6.3 Mark all as read
1. Have multiple unread notifications
2. Click "Mark all as read"
3. **Expected**: All notifications marked as read, badge count clears

### 6.4 Notification badge in nav
1. Have unread notifications
2. **Expected**: Bell icon in top nav shows unread count badge

---

## 7. Admin Pages

### 7.1 Admin access control
1. Sign in as a non-admin user
2. Navigate to `/admin`
3. **Expected**: Access denied or redirect (not admin content)

### 7.2 Admin dashboard
1. Sign in as admin (`admin@localhost`)
2. Navigate to `/admin`
3. **Expected**: Stats dashboard renders with player count, match count, etc.

### 7.3 Court management
1. Navigate to `/admin/courts`
2. **Expected**: Court group and courts are listed, CRUD operations work

### 7.4 User management
1. Navigate to `/admin/users`
2. **Expected**: User list with ban/unban controls

---

## 8. Courts Page

### 8.1 Public court directory
1. Navigate to `/courts`
2. **Expected**: Lists court groups with their courts and details (surface type, lighting)

---

## Notes

- **Email notifications** are not yet implemented (Resend integration is planned). In-app notifications work.
- **Google OAuth** requires real credentials and won't work in local dev. Use magic links for local testing.
- After `supabase db reset`, you may need to restart the Kong gateway (`docker restart supabase_kong_matchmaker`) if auth requests fail with "invalid response from upstream server".
