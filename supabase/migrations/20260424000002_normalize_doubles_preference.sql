-- Normalize existing `doubles` rows to `both` so no one is silently un-matchable.
--
-- Doubles matchmaking is intentionally deferred (see docs/matchmaking.md). After
-- the preference-respect fix in 20260424000001, players whose profile or slot
-- preference was `doubles` would silently never get matched. We flip those rows
-- to `both` so they participate in singles matching while preserving their
-- openness to future doubles support.
--
-- The check constraints (`in ('singles','doubles','both')`) are intentionally
-- left in place so the schema stays forward-compatible for future doubles work.
-- The UI no longer exposes `doubles` as a selectable option.

update profiles
set preferred_match_type = 'both'
where preferred_match_type = 'doubles';

-- Only touch still-open availability. Matched/expired/cancelled rows are
-- historical and shouldn't be rewritten.
update availability
set match_type = 'both'
where match_type = 'doubles'
  and status = 'open';
