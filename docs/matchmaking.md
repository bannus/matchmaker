# Matchmaking

This doc explains the database-driven matchmaking system: how availability becomes matches, how automatic execution works, and why match responses are handled through a Postgres RPC instead of client-side writes.

## Overview

Matchmaking is primarily a **database feature**, not a frontend feature.

The React app posts availability, but the actual matching logic lives in Postgres functions and triggers inside Supabase.

Core pieces:

- `run_matchmaking()` - creates match proposals from open availability
- `trigger_matchmaking_on_availability()` - runs matchmaking when new availability is posted
- `pg_cron` schedule - reruns matchmaking every 15 minutes as a safety net
- `respond_to_match()` - atomically accepts or declines proposed matches

## Main Files

| File | Purpose |
|---|---|
| `supabase\migrations\20260413000001_initial_schema.sql` | Base schema, RLS, original `run_matchmaking()` |
| `supabase\migrations\20260415000001_automated_matchmaking.sql` | Insert trigger, `pg_cron`, `exec_sql()` helper |
| `supabase\migrations\20260415000002_availability_match_link.sql` | Adds `availability.match_id` and updates `run_matchmaking()` |
| `supabase\migrations\20260416000002_respond_to_match_rpc.sql` | Atomic response RPC |
| `src\pages\AvailabilityPage.tsx` | Posts availability |
| `src\pages\MatchesPage.tsx` | Reads matches and calls `respond_to_match()` |

## Data Model

The matchmaking flow spans four tables:

| Table | Role |
|---|---|
| `availability` | Open time slots posted by players |
| `matches` | Proposed or confirmed matches |
| `match_players` | Join table of players and their responses |
| `notifications` | In-app alerts created when matches are proposed |

`availability.match_id` is used to link source availability rows to the match they were matched into.

## End-to-End Flow

```
Player posts availability
  │
  ▼
availability row inserted with status = 'open'
  │
  ├── trigger_matchmaking_on_availability()
  │       │
  │       ▼
  │   run_matchmaking()
  │
  └── pg_cron safety net reruns every 15 minutes
          │
          ▼
   create proposed match + match_players rows
          │
          ▼
   mark source availability as matched
          │
          ▼
   insert notifications for both players
```

## Matching Rules

`run_matchmaking()` loops through open availability and tries to find the best candidate match.

Current filters:

- availability status must be `'open'`
- availability date must be today or later
- both players must be in the **same `court_group_id`**
- both players must be on the **same date**
- a player cannot match with themself
- banned players are excluded
- NTRP difference must be **<= 0.5**
- requested match types must be compatible
- time windows must overlap
- overlap must be at least **30 minutes**

Candidate selection is ordered by:

1. smallest NTRP difference
2. earliest start time

## Match Creation Side Effects

When a match is found, `run_matchmaking()` does all of this in the database:

1. inserts a `matches` row with `status = 'proposed'`
2. inserts two `match_players` rows with `response = 'pending'`
3. updates both `availability` rows to `status = 'matched'`
4. stores the new `match_id` back on both availability rows
5. inserts a `match_proposed` notification for each player

This is why the source of truth for matchmaking behavior is the SQL function, not the frontend.

## Automation

### Immediate execution

`trigger_matchmaking_on_availability()` runs after inserts on `availability`.

It only triggers matchmaking when the new row:

- is still `'open'`
- is for today or a future date

### Scheduled safety net

The migration also installs `pg_cron` and schedules:

```sql
select cron.schedule(
  'run-matchmaking',
  '*/15 * * * *',
  $$ select run_matchmaking(); $$
);
```

This protects against missed trigger runs, transient failures, or rows that were not matchable at insert time but become matchable later.

## Manual Operations

### Run matchmaking manually

```sql
select run_matchmaking();
```

This is useful in Supabase Studio, testing, and debugging.

### Test/admin SQL helper

The repo also defines:

```sql
exec_sql(query text)
```

That helper is granted only to `service_role`. It exists for admin/test scenarios and should not be exposed to normal users.

## Match Response Flow

Players do **not** directly update match state from the client.

Instead, `MatchesPage.tsx` calls:

```ts
supabase.rpc('respond_to_match', {
  p_match_id: matchId,
  p_response: response,
})
```

That RPC exists to make responses atomic and race-safe.

### Why the RPC exists

Accept/decline sounds simple, but multiple participants can respond nearly at the same time.

The RPC:

- locks the match row
- verifies the match is still `proposed`
- verifies the caller is a pending participant
- updates only that player's response
- locks participant rows before checking whether everyone accepted
- confirms the match only when all participants are accepted
- cancels immediately on decline

Without the RPC, the client would need multiple reads/writes and could easily race.

## Current Status Model

Relevant match states:

- `proposed`
- `confirmed`
- `cancelled`

Relevant player response states:

- `pending`
- `accepted`
- `declined`

Behavior:

| Action | Result |
|---|---|
| One player accepts | Match stays `proposed` until everyone accepts |
| All players accept | Match becomes `confirmed` |
| Any player declines | Match becomes `cancelled` |

## RLS and Access Model

The system relies on row-level security:

- players can only read matches they participate in
- players can only read `match_players` rows for their own matches
- helper function `get_my_match_ids()` exists to avoid recursive RLS checks
- notifications are readable/updatable only by their owner

This matters when debugging from the client: a missing row may be an RLS issue, not a missing insert.

## Current Limitations

### Doubles is intentionally deferred

The schema (`profiles.preferred_match_type`, `availability.match_type`, `matches.match_type`) allows `'doubles'`, but `run_matchmaking()` only forms **singles** matches. The doubles option has been removed from the UI (profile setup, profile edit, post-availability form) so players can't pick it and then silently never get matched.

The check constraints are left in place so the schema stays forward-compatible for a future doubles build-out.

#### Why doubles is non-trivial — the stranding problem

Doubles needs 4 players overlapping on the same court group and date. The current matchmaker is a greedy pairwise loop. If it simply tried to match doubles the same way, "both"-pref players would almost always be paired into singles before a foursome could form, leaving doubles-only players stranded. To actually deliver doubles matches, the matchmaker has to **hold back eligible players** to try forming a foursome first.

#### What a future doubles implementation needs

1. **Two-phase matchmaking.** First pass tries to form doubles foursomes, anchored on players whose preference is doubles-only (or whose slot is doubles-only), plus 3 others whose slot + profile both allow doubles. Second pass runs the existing singles logic on whoever's left.
2. **Team NTRP balancing.** A ±0.5 pairwise band isn't enough for 4 players. Either require a tighter overall NTRP band (e.g. ±1.0 spread across all 4) or pair the high and low NTRPs as one team and the two middles as the other, so both teams are roughly balanced.
3. **4-player response flow.** `respond_to_match()` locks the match row, which is race-safe, but the surrounding UX assumes 2 participants. Match cards must show 3 opponents, and intermediate states ("2 of 4 accepted") must be handled without confirming prematurely. Decline/cancel semantics with 4 players need a decision: does any decline cancel, or does the match fall back to 3-waiting?
4. **Court capacity.** A confirmed doubles match occupies a court for ~2 hours. Today matchmaking doesn't model court counts at all — crowding is derived in the UI. Doubles pushes capacity concerns into the matching layer.
5. **UI.** Profile and availability pickers would need to re-expose the doubles option; match cards and calendar integrations would need to render multiple opponents; notification copy needs updating.

Until those are addressed, doubles is **explicitly not supported**. Anyone whose profile was previously set to `'doubles'` was normalized to `'both'` by migration `20260424000002_normalize_doubles_preference.sql` so they participate in singles matching.

### Notifications are only emitted on proposal creation

`run_matchmaking()` inserts `match_proposed` notifications, but response-side notifications are not yet generated for confirmed/cancelled/declined events.

### Crowding is a frontend read model

Court crowding warnings shown in the UI are derived from confirmed overlapping matches in `MatchesPage.tsx`; they are not part of the matchmaking SQL itself.

## Debugging Checklist

If expected matches are not being created, check these first:

1. Are both availability rows still `status = 'open'`?
2. Are the players in the same `court_group_id`?
3. Is the date the same?
4. Is the NTRP gap `<= 0.5`?
5. Is there at least 30 minutes of overlap?
6. Is either player banned?
7. Did `pg_cron` get enabled successfully?
8. Can `select run_matchmaking();` create the match manually?

