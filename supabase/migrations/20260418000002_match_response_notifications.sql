-- Emit notifications when a player accepts or declines a match.
--
-- Previously only `match_proposed` notifications were inserted (by run_matchmaking).
-- The respond_to_match RPC changed match status silently, so players never learned
-- that their opponent accepted or declined. This migration extends the RPC to insert
-- `match_confirmed` / `match_declined` notifications for the OTHER participants.

create or replace function respond_to_match(p_match_id uuid, p_response text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := auth.uid();
  v_match_status text;
  v_all_accepted boolean;
  v_match_date date;
  v_match_start time;
  v_when_label text;
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'Invalid response: must be accepted or declined';
  end if;

  -- Verify the match exists and is still proposed
  select status, date, start_time
    into v_match_status, v_match_date, v_match_start
  from matches
  where id = p_match_id
  for update;

  if v_match_status is null then
    raise exception 'Match not found';
  end if;

  if v_match_status != 'proposed' then
    raise exception 'Match is no longer open for responses (status: %)', v_match_status;
  end if;

  -- Verify caller is a participant and update their response
  update match_players
  set response = p_response, responded_at = now()
  where match_id = p_match_id
    and player_id = v_player_id
    and response = 'pending';

  if not found then
    raise exception 'You are not a pending participant in this match';
  end if;

  v_when_label := to_char(v_match_date, 'Mon DD') || ' at ' || to_char(v_match_start, 'HH12:MI AM');

  -- Handle decline: cancel the match and notify the other participants
  if p_response = 'declined' then
    update matches set status = 'cancelled' where id = p_match_id;

    insert into notifications (user_id, type, title, body, data)
    select mp.player_id,
           'match_declined',
           'Match declined',
           'Your opponent declined the match for ' || v_when_label,
           jsonb_build_object('match_id', p_match_id)
    from match_players mp
    where mp.match_id = p_match_id
      and mp.player_id <> v_player_id;

    return 'cancelled';
  end if;

  -- Handle accept: lock all participant rows then check if everyone accepted
  perform 1 from match_players mp
  where mp.match_id = p_match_id
  for update;

  select bool_and(mp.response = 'accepted')
  into v_all_accepted
  from match_players mp
  where mp.match_id = p_match_id;

  if v_all_accepted then
    update matches set status = 'confirmed' where id = p_match_id;

    -- Notify everyone except the caller (who just clicked accept and knows).
    insert into notifications (user_id, type, title, body, data)
    select mp.player_id,
           'match_confirmed',
           'Match confirmed! 🎾',
           'Your match for ' || v_when_label || ' is confirmed',
           jsonb_build_object('match_id', p_match_id)
    from match_players mp
    where mp.match_id = p_match_id
      and mp.player_id <> v_player_id;

    return 'confirmed';
  end if;

  return 'proposed';
end;
$$;

grant execute on function respond_to_match(uuid, text) to authenticated;
