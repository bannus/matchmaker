-- Fix: run_matchmaking() ignored the player's profile preferred_match_type.
--
-- Previously the function selected profiles.preferred_match_type as player_pref
-- but never used it. Only the per-slot availability.match_type was considered,
-- so a player whose profile says "doubles only" could still be paired into a
-- singles match. Matches are also hardcoded to match_type='singles'.
--
-- Doubles matchmaking is not yet implemented (would require 4 players), so
-- until then we only create singles matches. The fix narrows the candidate
-- filter so both players' slot and profile preferences must allow singles.

create or replace function run_matchmaking()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  match_count integer := 0;
  avail_a record;
  avail_b record;
  new_match_id uuid;
  overlap_start time;
  overlap_end time;
  min_overlap interval := interval '30 minutes';
begin
  for avail_a in
    select a.*, p.ntrp_rating, p.preferred_match_type as player_pref
    from availability a
    join profiles p on p.id = a.player_id
    where a.status = 'open'
      and a.date >= current_date
      and p.is_banned = false
      -- Player must allow singles (only singles matches are created today).
      and a.match_type in ('singles', 'both')
      and p.preferred_match_type in ('singles', 'both')
    order by a.date, a.start_time
  loop
    if (select status from availability where id = avail_a.id) != 'open' then
      continue;
    end if;

    for avail_b in
      select a.*, p.ntrp_rating, p.preferred_match_type as player_pref
      from availability a
      join profiles p on p.id = a.player_id
      where a.status = 'open'
        and a.court_group_id = avail_a.court_group_id
        and a.date = avail_a.date
        and a.player_id != avail_a.player_id
        and p.is_banned = false
        and abs(p.ntrp_rating - avail_a.ntrp_rating) <= 0.5
        -- Opponent must also allow singles (slot + profile).
        and a.match_type in ('singles', 'both')
        and p.preferred_match_type in ('singles', 'both')
        and a.start_time < avail_a.end_time
        and a.end_time > avail_a.start_time
      order by abs(p.ntrp_rating - avail_a.ntrp_rating), a.start_time
      limit 1
    loop
      if (select status from availability where id = avail_b.id) != 'open' then
        continue;
      end if;

      overlap_start := greatest(avail_a.start_time, avail_b.start_time);
      overlap_end := least(avail_a.end_time, avail_b.end_time);

      if (overlap_end - overlap_start) < min_overlap then
        continue;
      end if;

      insert into matches (court_group_id, match_type, date, start_time, end_time, status)
      values (
        avail_a.court_group_id,
        'singles',
        avail_a.date,
        overlap_start,
        overlap_end,
        'proposed'
      )
      returning id into new_match_id;

      insert into match_players (match_id, player_id, response)
      values
        (new_match_id, avail_a.player_id, 'pending'),
        (new_match_id, avail_b.player_id, 'pending');

      update availability set status = 'matched', match_id = new_match_id where id = avail_a.id;
      update availability set status = 'matched', match_id = new_match_id where id = avail_b.id;

      insert into notifications (user_id, type, title, body, data)
      values
        (avail_a.player_id, 'match_proposed', 'New match proposal! 🎾',
         'You have a new match proposal for ' || to_char(avail_a.date, 'Mon DD') || ' at ' || to_char(overlap_start, 'HH12:MI AM'),
         jsonb_build_object('match_id', new_match_id)),
        (avail_b.player_id, 'match_proposed', 'New match proposal! 🎾',
         'You have a new match proposal for ' || to_char(avail_a.date, 'Mon DD') || ' at ' || to_char(overlap_start, 'HH12:MI AM'),
         jsonb_build_object('match_id', new_match_id));

      match_count := match_count + 1;
    end loop;
  end loop;

  return match_count;
end;
$$;
