-- Email notification pipeline.
--
-- Adds the plumbing for transactional email delivery via Resend:
--
--   1. Per-type opt-in preferences live in profiles.email_prefs (jsonb), replacing
--      the single boolean profiles.notification_email column.
--   2. notifications.email_sent_at tracks delivery state so the trigger is
--      idempotent and the rest of the system can detect / retry failed sends.
--   3. An AFTER INSERT trigger on notifications calls the send-notification-email
--      Edge Function over pg_net, passing only the new notification id and a
--      shared-secret header. The function is responsible for re-fetching context,
--      rendering the email, calling Resend, and stamping email_sent_at.
--
-- Configuration (set in production via:
--   ALTER DATABASE postgres SET app.settings.edge_functions_url = 'https://<project>.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.settings.email_trigger_secret = '<random-string-matching-EMAIL_TRIGGER_SECRET-env>';
-- )
--
-- If the GUCs are unset, the trigger is a no-op — the email pipeline is opt-in
-- per environment, so applying this migration to a fresh database does not
-- start sending email.

-- ============================================================
-- 1. Per-type email preferences
-- ============================================================

alter table profiles
  add column if not exists email_prefs jsonb not null default
    jsonb_build_object(
      'match_proposed',  true,
      'match_confirmed', true,
      'match_cancelled', true,
      'match_declined',  true
    );

-- Backfill: anyone who had notification_email = false has all email types disabled.
update profiles
   set email_prefs = jsonb_build_object(
         'match_proposed',  false,
         'match_confirmed', false,
         'match_cancelled', false,
         'match_declined',  false
       )
 where notification_email = false;

alter table profiles drop column notification_email;

-- ============================================================
-- 2. Delivery tracking column on notifications
-- ============================================================

alter table notifications
  add column if not exists email_sent_at timestamptz;

create index if not exists idx_notifications_email_unsent
  on notifications(created_at)
  where email_sent_at is null;

-- ============================================================
-- 3. pg_net + trigger function + trigger
-- ============================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.send_notification_email_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url        text := coalesce(current_setting('app.settings.edge_functions_url', true), '');
  v_secret     text := coalesce(current_setting('app.settings.email_trigger_secret', true), '');
  v_emailable  boolean;
  v_pref       boolean;
begin
  -- Only the four match-related types are emailable.
  v_emailable := new.type in ('match_proposed', 'match_confirmed', 'match_cancelled', 'match_declined');
  if not v_emailable then
    return new;
  end if;

  -- Skip if delivery already tracked (defensive — supports re-inserts via copy).
  if new.email_sent_at is not null then
    return new;
  end if;

  -- Skip if the recipient has opted out of this notification type.
  select coalesce((p.email_prefs ->> new.type)::boolean, true)
    into v_pref
    from profiles p
   where p.id = new.user_id;

  if v_pref is null or v_pref = false then
    return new;
  end if;

  -- Skip silently if the pipeline isn't configured for this environment.
  if v_url = '' or v_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url := v_url || '/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'X-Trigger-Secret', v_secret
    ),
    body := jsonb_build_object('notification_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists notifications_email_after_insert on notifications;
create trigger notifications_email_after_insert
  after insert on notifications
  for each row execute function public.send_notification_email_trigger();
