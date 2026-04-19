import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  serviceClient,
  createUserClient,
  createProposedMatch,
  clearMatchData,
  ADMIN_ID,
  PLAYER_ID,
  COURT_GROUP_ID,
} from './helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Insert an availability row already linked to the given match (mirrors what run_matchmaking()
// does). Returns the availability id.
async function insertLinkedAvailability(matchId: string, playerId: string): Promise<string> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().split('T')[0]

  const { data, error } = await serviceClient
    .from('availability')
    .insert({
      player_id: playerId,
      court_group_id: COURT_GROUP_ID,
      date,
      start_time: '10:00',
      end_time: '11:00',
      match_type: 'singles',
      status: 'matched',
      match_id: matchId,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to insert linked availability: ${error.message}`)
  return data.id
}

// Uses the respond_to_match RPC for atomic match responses
async function respondToMatch(
  client: SupabaseClient,
  matchId: string,
  _playerId: string,
  response: 'accepted' | 'declined'
) {
  const { error } = await client.rpc('respond_to_match', {
    p_match_id: matchId,
    p_response: response,
  })
  if (error) throw new Error(`respond_to_match failed: ${error.message}`)
}

describe('match responses', () => {
  let adminClient: SupabaseClient
  let playerClient: SupabaseClient

  beforeAll(async () => {
    const { error } = await serviceClient.from('profiles').select('id').limit(1)
    if (error) {
      throw new Error(
        `Cannot connect to local Supabase. Is it running? (npm run db:start)\n${error.message}`
      )
    }
    adminClient = await createUserClient('admin@localhost', 'password123')
    playerClient = await createUserClient('player2@localhost', 'password123')
  })

  beforeEach(async () => {
    await clearMatchData()
  })

  it('declining a match sets status to cancelled', async () => {
    const matchId = await createProposedMatch()

    await respondToMatch(playerClient, matchId, PLAYER_ID, 'declined')

    const { data } = await serviceClient
      .from('matches')
      .select('status')
      .eq('id', matchId)
      .single()

    expect(data!.status).toBe('cancelled')
  })

  it('accepting a match keeps status proposed when opponent has not responded', async () => {
    const matchId = await createProposedMatch()

    await respondToMatch(playerClient, matchId, PLAYER_ID, 'accepted')

    const { data } = await serviceClient
      .from('matches')
      .select('status')
      .eq('id', matchId)
      .single()

    expect(data!.status).toBe('proposed')

    // Verify player response was recorded
    const { data: mp } = await serviceClient
      .from('match_players')
      .select('response, responded_at')
      .eq('match_id', matchId)
      .eq('player_id', PLAYER_ID)
      .single()

    expect(mp!.response).toBe('accepted')
    expect(mp!.responded_at).not.toBeNull()
  })

  it('both players accepting confirms the match', async () => {
    const matchId = await createProposedMatch()

    await respondToMatch(adminClient, matchId, ADMIN_ID, 'accepted')
    await respondToMatch(playerClient, matchId, PLAYER_ID, 'accepted')

    const { data } = await serviceClient
      .from('matches')
      .select('status')
      .eq('id', matchId)
      .single()

    expect(data!.status).toBe('confirmed')
  })

  it('declining after opponent accepted cancels the match', async () => {
    const matchId = await createProposedMatch()

    await respondToMatch(adminClient, matchId, ADMIN_ID, 'accepted')
    await respondToMatch(playerClient, matchId, PLAYER_ID, 'declined')

    const { data } = await serviceClient
      .from('matches')
      .select('status')
      .eq('id', matchId)
      .single()

    expect(data!.status).toBe('cancelled')
  })

  it('user can only see matches they are part of', async () => {
    const matchId = await createProposedMatch()

    // Both players should see the match
    const { data: adminMatches } = await adminClient
      .from('matches')
      .select('id')
      .eq('id', matchId)

    const { data: playerMatches } = await playerClient
      .from('matches')
      .select('id')
      .eq('id', matchId)

    expect(adminMatches).toHaveLength(1)
    expect(playerMatches).toHaveLength(1)
  })

  it('user can only update their own match_players response', async () => {
    const matchId = await createProposedMatch()

    // Player tries to update admin's response — should fail silently (0 rows affected)
    const { data } = await playerClient
      .from('match_players')
      .update({ response: 'accepted' })
      .eq('match_id', matchId)
      .eq('player_id', ADMIN_ID)
      .select()

    expect(data).toHaveLength(0)

    // Verify admin's response is still pending
    const { data: mp } = await serviceClient
      .from('match_players')
      .select('response')
      .eq('match_id', matchId)
      .eq('player_id', ADMIN_ID)
      .single()

    expect(mp!.response).toBe('pending')
  })

  it('concurrent accepts both confirm the match (no race condition)', async () => {
    const matchId = await createProposedMatch()

    // Both players accept concurrently
    const [result1, result2] = await Promise.all([
      adminClient.rpc('respond_to_match', { p_match_id: matchId, p_response: 'accepted' }),
      playerClient.rpc('respond_to_match', { p_match_id: matchId, p_response: 'accepted' }),
    ])

    // At least one should succeed without error
    const errors = [result1.error, result2.error].filter(Boolean)
    // At most one might get "no longer open" if the other confirmed first
    expect(errors.length).toBeLessThanOrEqual(1)

    // Match must be confirmed regardless
    const { data } = await serviceClient
      .from('matches')
      .select('status')
      .eq('id', matchId)
      .single()

    expect(data!.status).toBe('confirmed')
  })

  it('respond_to_match rejects invalid response values', async () => {
    const matchId = await createProposedMatch()

    const { error } = await adminClient.rpc('respond_to_match', {
      p_match_id: matchId,
      p_response: 'maybe',
    })

    expect(error).not.toBeNull()
    expect(error!.message).toContain('Invalid response')
  })

  it('respond_to_match rejects response to already confirmed match', async () => {
    const matchId = await createProposedMatch()

    // Confirm the match via service role
    await serviceClient.from('matches').update({ status: 'confirmed' }).eq('id', matchId)

    const { error } = await adminClient.rpc('respond_to_match', {
      p_match_id: matchId,
      p_response: 'accepted',
    })

    expect(error).not.toBeNull()
    expect(error!.message).toContain('no longer open')
  })

  it('declining reopens both players linked availability rows', async () => {
    const matchId = await createProposedMatch()
    const availA = await insertLinkedAvailability(matchId, ADMIN_ID)
    const availB = await insertLinkedAvailability(matchId, PLAYER_ID)

    await respondToMatch(playerClient, matchId, PLAYER_ID, 'declined')

    const { data } = await serviceClient
      .from('availability')
      .select('id, status, match_id')
      .in('id', [availA, availB])

    expect(data).toHaveLength(2)
    for (const row of data!) {
      expect(row.status).toBe('open')
      expect(row.match_id).toBeNull()
    }
  })

  it('directly cancelling a match also reopens linked availability (covers future cancel paths)', async () => {
    const matchId = await createProposedMatch()
    const availA = await insertLinkedAvailability(matchId, ADMIN_ID)
    const availB = await insertLinkedAvailability(matchId, PLAYER_ID)

    // Simulate a user-initiated or admin cancel path that directly flips status.
    const { error } = await serviceClient
      .from('matches')
      .update({ status: 'cancelled' })
      .eq('id', matchId)
    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('availability')
      .select('id, status, match_id')
      .in('id', [availA, availB])

    expect(data).toHaveLength(2)
    for (const row of data!) {
      expect(row.status).toBe('open')
      expect(row.match_id).toBeNull()
    }
  })

  it('declining emits a match_declined notification to the other participant', async () => {
    const matchId = await createProposedMatch()

    await respondToMatch(playerClient, matchId, PLAYER_ID, 'declined')

    const { data } = await serviceClient
      .from('notifications')
      .select('user_id, type, data')
      .eq('type', 'match_declined')

    expect(data).toHaveLength(1)
    expect(data![0].user_id).toBe(ADMIN_ID)
    expect((data![0].data as { match_id: string }).match_id).toBe(matchId)

    // The decliner does not receive a notification about their own action
    const { data: declinerNotifs } = await serviceClient
      .from('notifications')
      .select('id')
      .eq('user_id', PLAYER_ID)
      .eq('type', 'match_declined')
    expect(declinerNotifs).toHaveLength(0)
  })

  it('final accept that confirms the match notifies the other participant', async () => {
    const matchId = await createProposedMatch()

    await respondToMatch(adminClient, matchId, ADMIN_ID, 'accepted')

    // No confirmation notification yet — match still proposed
    const { data: early } = await serviceClient
      .from('notifications')
      .select('id')
      .eq('type', 'match_confirmed')
    expect(early).toHaveLength(0)

    await respondToMatch(playerClient, matchId, PLAYER_ID, 'accepted')

    const { data } = await serviceClient
      .from('notifications')
      .select('user_id, type, data')
      .eq('type', 'match_confirmed')

    // Only the other participant (admin) is notified; the caller (player2) is not.
    expect(data).toHaveLength(1)
    expect(data![0].user_id).toBe(ADMIN_ID)
    expect((data![0].data as { match_id: string }).match_id).toBe(matchId)
  })

  it('first accept (not yet confirmed) does not create a match_confirmed notification', async () => {
    const matchId = await createProposedMatch()

    await respondToMatch(adminClient, matchId, ADMIN_ID, 'accepted')

    const { data } = await serviceClient
      .from('notifications')
      .select('id')
      .eq('type', 'match_confirmed')

    expect(data).toHaveLength(0)
  })

  it('cancellation does not resurrect availability rows the user has since taken down', async () => {
    const matchId = await createProposedMatch()
    const linked = await insertLinkedAvailability(matchId, ADMIN_ID)

    // User already advanced this row past 'matched' (e.g. cancelled their own slot).
    await serviceClient
      .from('availability')
      .update({ status: 'cancelled' })
      .eq('id', linked)

    await respondToMatch(playerClient, matchId, PLAYER_ID, 'declined')

    const { data } = await serviceClient
      .from('availability')
      .select('status, match_id')
      .eq('id', linked)
      .single()

    // Guard holds: row stays cancelled, match_id untouched.
    expect(data!.status).toBe('cancelled')
    expect(data!.match_id).toBe(matchId)
  })
})
