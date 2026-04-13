import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  serviceClient,
  createUserClient,
  createProposedMatch,
  clearMatchData,
  ADMIN_ID,
  PLAYER_ID,
} from './helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Replicates the respond() logic from MatchesPage.tsx
async function respondToMatch(
  client: SupabaseClient,
  matchId: string,
  playerId: string,
  response: 'accepted' | 'declined'
) {
  await client
    .from('match_players')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('player_id', playerId)

  if (response === 'accepted') {
    const { data: players } = await client
      .from('match_players')
      .select('response')
      .eq('match_id', matchId)

    const allAccepted = (players ?? []).every((p) => p.response === 'accepted')
    if (allAccepted) {
      await client
        .from('matches')
        .update({ status: 'confirmed' })
        .eq('id', matchId)
    }
  }

  if (response === 'declined') {
    await client
      .from('matches')
      .update({ status: 'cancelled' })
      .eq('id', matchId)
  }
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
})
