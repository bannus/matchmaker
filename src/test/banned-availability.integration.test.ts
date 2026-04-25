import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import {
  serviceClient,
  createUserClient,
  ADMIN_ID,
  PLAYER_ID,
  COURT_GROUP_ID,
  clearMatchData,
} from './helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Tomorrow's date — availability rows must be in the future (non-banned-related
// validations on the form; DB allows today too, but tomorrow is safer).
function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

describe('banned users: availability restrictions', () => {
  let playerClient: SupabaseClient
  let adminClient: SupabaseClient

  beforeAll(async () => {
    playerClient = await createUserClient('player2@localhost', 'password123')
    adminClient = await createUserClient('admin@localhost', 'password123')
  })

  beforeEach(async () => {
    // Always start each test with player2 unbanned and no availability rows
    await serviceClient.from('profiles').update({ is_banned: false }).eq('id', PLAYER_ID)
    await clearMatchData()
  })

  afterAll(async () => {
    await serviceClient.from('profiles').update({ is_banned: false }).eq('id', PLAYER_ID)
    await clearMatchData()
  })

  it('banned user cannot insert availability', async () => {
    await serviceClient.from('profiles').update({ is_banned: true }).eq('id', PLAYER_ID)

    const { data, error } = await playerClient
      .from('availability')
      .insert({
        player_id: PLAYER_ID,
        court_group_id: COURT_GROUP_ID,
        date: tomorrow(),
        start_time: '09:00',
        end_time: '10:00',
        match_type: 'singles',
      })
      .select()

    // RLS rejection — either an error or 0 rows returned
    expect(error !== null || (data ?? []).length === 0).toBe(true)

    // Confirm nothing landed in the DB
    const { data: rows } = await serviceClient
      .from('availability')
      .select('id')
      .eq('player_id', PLAYER_ID)
    expect(rows ?? []).toHaveLength(0)
  })

  it('banned user cannot update their own availability', async () => {
    // Create a row while not-banned (via service role for determinism)
    const { data: created } = await serviceClient
      .from('availability')
      .insert({
        player_id: PLAYER_ID,
        court_group_id: COURT_GROUP_ID,
        date: tomorrow(),
        start_time: '09:00',
        end_time: '10:00',
        match_type: 'singles',
        status: 'open',
      })
      .select('id')
      .single()
    const rowId = created!.id as string

    // Now ban
    await serviceClient.from('profiles').update({ is_banned: true }).eq('id', PLAYER_ID)

    // Re-auth not needed — RLS evaluates per-request against current DB state.
    // The trigger will have already cancelled the row, so we restore it
    // via service role to specifically test the UPDATE policy.
    await serviceClient
      .from('availability')
      .update({ status: 'open' })
      .eq('id', rowId)

    const { data: updated } = await playerClient
      .from('availability')
      .update({ notes: 'should not work' })
      .eq('id', rowId)
      .select()

    expect(updated ?? []).toHaveLength(0)
  })

  it('banning a user auto-cancels their open availability', async () => {
    // Seed mixed-status rows
    const { data: rows } = await serviceClient
      .from('availability')
      .insert([
        {
          player_id: PLAYER_ID,
          court_group_id: COURT_GROUP_ID,
          date: tomorrow(),
          start_time: '09:00',
          end_time: '10:00',
          match_type: 'singles',
          status: 'open',
        },
        {
          player_id: PLAYER_ID,
          court_group_id: COURT_GROUP_ID,
          date: tomorrow(),
          start_time: '11:00',
          end_time: '12:00',
          match_type: 'singles',
          status: 'expired',
        },
      ])
      .select('id, status')
    const openId = rows!.find((r) => r.status === 'open')!.id
    const expiredId = rows!.find((r) => r.status === 'expired')!.id

    // Ban
    await serviceClient.from('profiles').update({ is_banned: true }).eq('id', PLAYER_ID)

    // Open row should now be cancelled; expired row untouched
    const { data: after } = await serviceClient
      .from('availability')
      .select('id, status')
      .in('id', [openId, expiredId])
    const byId = Object.fromEntries((after ?? []).map((r) => [r.id, r.status]))
    expect(byId[openId]).toBe('cancelled')
    expect(byId[expiredId]).toBe('expired')
  })

  it('browse query excludes banned users', async () => {
    // player2 posts an open slot
    await serviceClient.from('availability').insert({
      player_id: PLAYER_ID,
      court_group_id: COURT_GROUP_ID,
      date: tomorrow(),
      start_time: '09:00',
      end_time: '10:00',
      match_type: 'singles',
      status: 'open',
    })

    // Admin browses — sees the slot
    const { data: before } = await adminClient
      .from('availability')
      .select('id, profiles:player_id!inner(is_banned)')
      .eq('court_group_id', COURT_GROUP_ID)
      .eq('status', 'open')
      .neq('player_id', ADMIN_ID)
      .eq('profiles.is_banned', false)
    expect((before ?? []).length).toBeGreaterThan(0)

    // Ban player2 (this also auto-cancels via trigger)
    await serviceClient.from('profiles').update({ is_banned: true }).eq('id', PLAYER_ID)

    // Defense in depth: even if we restore the row to 'open' via service role,
    // the inner-join filter on is_banned should still exclude it.
    await serviceClient
      .from('availability')
      .update({ status: 'open' })
      .eq('player_id', PLAYER_ID)

    const { data: after } = await adminClient
      .from('availability')
      .select('id, profiles:player_id!inner(is_banned)')
      .eq('court_group_id', COURT_GROUP_ID)
      .eq('status', 'open')
      .neq('player_id', ADMIN_ID)
      .eq('profiles.is_banned', false)
    expect(after ?? []).toHaveLength(0)
  })

  it('unbanning restores ability to post (cancelled rows stay cancelled)', async () => {
    // Pre-existing open row
    const { data: created } = await serviceClient
      .from('availability')
      .insert({
        player_id: PLAYER_ID,
        court_group_id: COURT_GROUP_ID,
        date: tomorrow(),
        start_time: '09:00',
        end_time: '10:00',
        match_type: 'singles',
        status: 'open',
      })
      .select('id')
      .single()
    const oldRowId = created!.id

    // Ban → cancels old row
    await serviceClient.from('profiles').update({ is_banned: true }).eq('id', PLAYER_ID)
    // Unban
    await serviceClient.from('profiles').update({ is_banned: false }).eq('id', PLAYER_ID)

    // Old row should still be cancelled (no resurrection)
    const { data: oldRow } = await serviceClient
      .from('availability')
      .select('status')
      .eq('id', oldRowId)
      .single()
    expect(oldRow!.status).toBe('cancelled')

    // Player can post again
    const { data: newRow, error } = await playerClient
      .from('availability')
      .insert({
        player_id: PLAYER_ID,
        court_group_id: COURT_GROUP_ID,
        date: tomorrow(),
        start_time: '13:00',
        end_time: '14:00',
        match_type: 'singles',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(newRow!.id).toBeTruthy()
  })

  it('match cancellation does not revive banned user availability', async () => {
    // Player has an availability row that got matched
    const { data: created } = await serviceClient
      .from('availability')
      .insert({
        player_id: PLAYER_ID,
        court_group_id: COURT_GROUP_ID,
        date: tomorrow(),
        start_time: '09:00',
        end_time: '10:00',
        match_type: 'singles',
        status: 'open',
      })
      .select('id')
      .single()
    const availId = created!.id

    const { data: match } = await serviceClient
      .from('matches')
      .insert({
        court_group_id: COURT_GROUP_ID,
        match_type: 'singles',
        date: tomorrow(),
        start_time: '09:00',
        end_time: '10:00',
        status: 'proposed',
      })
      .select('id')
      .single()
    const matchId = match!.id

    await serviceClient
      .from('match_players')
      .insert([
        { match_id: matchId, player_id: ADMIN_ID, response: 'pending' },
        { match_id: matchId, player_id: PLAYER_ID, response: 'pending' },
      ])
    await serviceClient
      .from('availability')
      .update({ status: 'matched', match_id: matchId })
      .eq('id', availId)

    // Ban player — their 'matched' row stays matched (not 'open' to cancel)
    await serviceClient.from('profiles').update({ is_banned: true }).eq('id', PLAYER_ID)

    // Cancel the match — reset trigger must NOT revive banned user's row to 'open'
    await serviceClient.from('matches').update({ status: 'cancelled' }).eq('id', matchId)

    const { data: after } = await serviceClient
      .from('availability')
      .select('status, match_id')
      .eq('id', availId)
      .single()
    expect(after!.status).toBe('cancelled')
    expect(after!.match_id).toBeNull()
  })
})
