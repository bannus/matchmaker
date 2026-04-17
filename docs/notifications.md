# Notifications

This doc explains how in-app notifications work, how the unread badge stays updated, and which Supabase configuration is required for realtime delivery.

## Overview

Notifications are currently an **in-app feature** backed by the `notifications` table in Supabase.

There is no production email notification pipeline yet. The existing implementation covers:

- storing notification rows in Postgres
- showing them on the Notifications page
- showing an unread badge in the app header
- receiving new rows through Supabase Realtime
- polling as a fallback if realtime is delayed or misconfigured

## Main Files

| File | Purpose |
|---|---|
| `supabase\migrations\20260413000001_initial_schema.sql` | `notifications` table, index, and RLS policies |
| `supabase\migrations\20260415000003_notifications_realtime.sql` | Adds `notifications` to `supabase_realtime` publication |
| `supabase\migrations\20260415000002_availability_match_link.sql` | Inserts `match_proposed` notifications during matchmaking |
| `src\hooks\useNotificationCount.ts` | Navbar badge count via realtime + polling |
| `src\components\layout\AppLayout.tsx` | Bell icon and unread badge |
| `src\pages\NotificationsPage.tsx` | Notification list and mark-as-read actions |

## Data Model

The `notifications` table contains:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `user_id` | Notification owner |
| `type` | Notification category |
| `title` | Short label shown in UI |
| `body` | Main message |
| `data` | JSON payload for related metadata |
| `read` | Read/unread state |
| `created_at` | Timestamp |

Allowed types in the schema:

- `match_proposed`
- `match_confirmed`
- `match_cancelled`
- `match_declined`
- `system`

Important: those are **allowed types**, not a guarantee that all are currently emitted.

## Who Creates Notifications

Right now, the implemented producer is the matchmaking SQL function.

When `run_matchmaking()` creates a match proposal, it inserts one `match_proposed` notification per player.

The payload includes:

```json
{ "match_id": "<uuid>" }
```

That lets the UI navigate to the matches experience.

## Delivery Architecture

```
run_matchmaking()
  │
  ▼
insert into notifications
  │
  ├── NotificationsPage fetches rows on load
  └── useNotificationCount subscribes to realtime inserts
          │
          └── polling fallback every 15s
```

## Realtime Requirement

The unread badge relies on a Postgres changes subscription:

```ts
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user?.id}`,
  }, ...)
```

For that to work outside local assumptions, the table must be added to the Supabase Realtime publication:

```sql
alter publication supabase_realtime add table notifications;
```

That migration exists specifically because the subscription can appear fine in development while silently failing in production if the table is not published.

## Badge Count Behavior

`useNotificationCount.ts` does three things:

1. fetches the unread count from Supabase
2. subscribes to realtime `INSERT` events for the current user
3. polls every 15 seconds as a fallback

The hook returns:

- `unreadCount`
- `refreshCount()`

The badge is rendered in `AppLayout.tsx`.

## Notifications Page Behavior

`NotificationsPage.tsx`:

- fetches the latest 50 notifications for the signed-in user
- orders them newest first
- marks an item as read on click
- supports "Mark all as read"
- routes match-related notifications to `/matches`

The page does not currently deep-link to a specific match card; it only routes to the matches page in general.

## RLS Model

Notifications are protected by row-level security:

- users can only `select` their own notifications
- users can only `update` their own notifications

This is why all client-side notification queries filter on the authenticated user's `user_id`.

## Polling Fallback

Realtime is helpful but not trusted as the only delivery mechanism.

The polling fallback exists because:

- Realtime can be misconfigured
- subscriptions can connect late
- browsers can throttle background tabs
- network interruptions can cause missed inserts

Current polling interval:

```ts
15_000 ms
```

## Current Limitations

### Only proposal notifications are actually emitted

The schema and UI know about:

- `match_confirmed`
- `match_cancelled`
- `match_declined`

But the current backend only inserts `match_proposed` rows.

### Badge count can go stale after mark-as-read

Known issue:

- the badge hook increments on realtime inserts
- the Notifications page updates rows to `read = true`
- but the badge is not refreshed immediately after mark-as-read

The polling fallback corrects this eventually, but not instantly.

### No email notifications yet

The repo README mentions transactional email as part of the broader architecture, but notification email delivery is still planned work rather than a current feature.

## Debugging Checklist

If notifications do not appear or the badge stays at zero, check:

1. Did `run_matchmaking()` actually insert rows into `notifications`?
2. Is the current user the owner of those rows?
3. Is RLS allowing the signed-in user to read them?
4. Was `alter publication supabase_realtime add table notifications;` applied?
5. Is the realtime subscription connected?
6. Does the count query return rows even if realtime does not?

