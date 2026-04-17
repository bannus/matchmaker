-- Fix: Admin users can now see all matches in the dashboard
-- Previously matches_select only allowed match participants to SELECT.

drop policy "matches_select" on matches;

create policy "matches_select" on matches
  for select using (
    exists (
      select 1 from match_players
      where match_players.match_id = matches.id
      and match_players.player_id = (select auth.uid())
    )
    or exists (
      select 1 from profiles
      where id = (select auth.uid()) and is_admin = true
    )
  );
