-- Email pipeline config: switch from ALTER DATABASE GUCs to a private config
-- table.
--
-- Background: Supabase managed Postgres restricts `ALTER DATABASE ... SET
-- app.settings.*`, so the original GUC-based config in
-- 20260425000001_notification_email_pipeline.sql cannot be applied in
-- production. We use a regular table with RLS denying all client access; the
-- trigger reads it via SECURITY DEFINER.
--
-- The trigger continues to fall back to the GUCs if the table is empty, so
-- the local Supabase stack (where ALTER DATABASE works) keeps functioning
-- without changes.

-- ============================================================
-- 1. Private config table
-- ============================================================

create table if not exists app_config (
  key   text primary key,
  value text not null
);

alter table app_config enable row level security;

-- No policies = no client access. Only SECURITY DEFINER functions and
-- direct SQL access (e.g. dashboard admin) can read/write.

revoke all on app_config from anon, authenticated;

comment on table app_config is
  'Private server-side configuration. Values include the Edge Functions base URL '
  'and the email-trigger shared secret used by send_notification_email_trigger. '
  'No RLS policies are defined on purpose so that the table is unreadable '
  'through PostgREST.';

-- ============================================================
-- 2. Rewire the trigger to prefer the table, falling back to GUCs
-- ============================================================

create or replace function public.send_notification_email_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url        text;
  v_secret     text;
  v_emailable  boolean;
  v_pref       boolean;
begin
  v_emailable := new.type in ('match_proposed', 'match_confirmed', 'match_cancelled', 'match_declined');
  if not v_emailable then
    return new;
  end if;

  if new.email_sent_at is not null then
    return new;
  end if;

  select coalesce((p.email_prefs ->> new.type)::boolean, true)
    into v_pref
    from profiles p
   where p.id = new.user_id;

  if v_pref is null or v_pref = false then
    return new;
  end if;

  -- Prefer config table; fall back to GUCs (used by local dev).
  select value into v_url   from app_config where key = 'edge_functions_url';
  select value into v_secret from app_config where key = 'email_trigger_secret';

  v_url    := coalesce(v_url,    current_setting('app.settings.edge_functions_url',    true), '');
  v_secret := coalesce(v_secret, current_setting('app.settings.email_trigger_secret', true), '');

  if v_url = '' or v_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url := v_url || '/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'X-Trigger-Secret', v_secret
    ),
    body := jsonb_build_object('notification_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;
