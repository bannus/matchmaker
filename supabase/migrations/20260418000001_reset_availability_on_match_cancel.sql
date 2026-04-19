-- Fix bug: declining a match left both players' availability rows stuck as 'matched'.
-- `run_matchmaking()` stamps source availability rows with status='matched' and match_id.
-- When a match is cancelled (today only via respond_to_match decline, tomorrow possibly via
-- user-initiated cancel), those rows must be reopened so the slot can be rematched.
--
-- Fix this at the data layer with an AFTER UPDATE trigger on matches — this way any future
-- cancellation path automatically preserves the invariant.

create or replace function reset_availability_on_match_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update availability
       set status = 'open', match_id = null
     where match_id = new.id
       and status = 'matched';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_availability_on_match_cancel on matches;

create trigger trg_reset_availability_on_match_cancel
  after update of status on matches
  for each row
  execute function reset_availability_on_match_cancel();
