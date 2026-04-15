-- Automated Matchmaking
-- Runs matchmaking instantly when new availability is posted (trigger)
-- and every 15 minutes as a safety net (pg_cron).

-- ============================================================
-- 1. Trigger: run matchmaking on new availability
-- ============================================================

create or replace function trigger_matchmaking_on_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only run when new availability is open and in the future
  if NEW.status = 'open' and NEW.date >= current_date then
    perform run_matchmaking();
  end if;
  return NEW;
end;
$$;

create trigger trg_matchmaking_on_availability
  after insert on availability
  for each row
  execute function trigger_matchmaking_on_availability();

-- ============================================================
-- 2. pg_cron: run matchmaking every 15 minutes as safety net
--    Requires pg_cron extension enabled in Supabase dashboard:
--    Dashboard → Database → Extensions → search "pg_cron" → Enable
-- ============================================================

-- Enable the extension (no-op if already enabled, errors if not available)
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'run-matchmaking',
  '*/15 * * * *',
  $$ select run_matchmaking(); $$
);

-- ============================================================
-- 3. exec_sql helper for service_role (admin/test use only)
-- ============================================================

create or replace function exec_sql(query text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute query;
end;
$$;

revoke execute on function exec_sql(text) from public;
revoke execute on function exec_sql(text) from authenticated;
grant execute on function exec_sql(text) to service_role;
