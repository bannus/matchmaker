-- Atomic match response RPC — eliminates race condition in accept flow.
-- Replaces the 3-query client-side respond() logic in MatchesPage.tsx.

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
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'Invalid response: must be accepted or declined';
  end if;

  -- Verify the match exists and is still proposed
  select status into v_match_status
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

  -- Handle decline: cancel the match immediately
  if p_response = 'declined' then
    update matches set status = 'cancelled' where id = p_match_id;
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
    return 'confirmed';
  end if;

  return 'proposed';
end;
$$;

grant execute on function respond_to_match(uuid, text) to authenticated;
