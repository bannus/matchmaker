-- Block banned users from posting/updating availability, and auto-cancel
-- their existing open slots when they get banned.
--
-- Background: matchmaking already filters out banned players, but RLS still
-- allowed them to insert/update availability rows, and the browse query
-- showed those rows to other players. Result: banned users remained visible
-- in a core customer-facing flow even though they could never be matched.

-- ============================================================
-- 1. Tighten availability RLS to reject banned users
-- ============================================================
drop policy if exists "availability_insert" on availability;
drop policy if exists "availability_update" on availability;
drop policy if exists "availability_delete" on availability;

create policy "availability_insert" on availability
  for insert with check (
    player_id = (select auth.uid())
    and not exists (
      select 1 from profiles
      where id = (select auth.uid()) and is_banned = true
    )
  );

create policy "availability_update" on availability
  for update using (
    player_id = (select auth.uid())
    and not exists (
      select 1 from profiles
      where id = (select auth.uid()) and is_banned = true
    )
  );

create policy "availability_delete" on availability
  for delete using (
    player_id = (select auth.uid())
    and not exists (
      select 1 from profiles
      where id = (select auth.uid()) and is_banned = true
    )
  );

-- ============================================================
-- 2. Auto-cancel open availability when a user is banned
-- ============================================================
create or replace function cancel_availability_on_ban()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_banned = true and (old.is_banned is distinct from true) then
    update public.availability
      set status = 'cancelled'
      where player_id = new.id
        and status = 'open';
  end if;
  return new;
end;
$$;

create trigger profiles_cancel_availability_on_ban
  after update of is_banned on profiles
  for each row execute function cancel_availability_on_ban();

-- ============================================================
-- 3. Patch reset_availability_on_match_cancel to skip banned users.
-- Without this, a sequence of (match → ban → decline) would revive a banned
-- player's availability back to 'open', bypassing the ban guards above.
-- ============================================================
create or replace function reset_availability_on_match_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update availability a
       set status = 'open', match_id = null
     where a.match_id = new.id
       and a.status = 'matched'
       and not exists (
         select 1 from profiles p
         where p.id = a.player_id and p.is_banned = true
       );

    -- Banned players' matched rows just get cancelled instead of reopened.
    update availability a
       set status = 'cancelled', match_id = null
     where a.match_id = new.id
       and a.status = 'matched'
       and exists (
         select 1 from profiles p
         where p.id = a.player_id and p.is_banned = true
       );
  end if;
  return new;
end;
$$;

-- ============================================================
-- 4. One-time backfill: cancel open availability for already-banned users
-- ============================================================
update availability
  set status = 'cancelled'
  where status = 'open'
    and player_id in (select id from profiles where is_banned = true);
