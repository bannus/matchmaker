import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  serviceClient,
  createUserClient,
  PLAYER_ID,
  COURT_GROUP_ID,
} from './helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('profile updates', () => {
  let playerClient: SupabaseClient
  const originalProfile = {
    display_name: 'Test Player',
    ntrp_rating: 3.5,
    preferred_match_type: 'singles',
    court_group_id: COURT_GROUP_ID,
  }

  beforeAll(async () => {
    const { error } = await serviceClient.from('profiles').select('id').limit(1)
    if (error) {
      throw new Error(`Cannot connect to local Supabase.\n${error.message}`)
    }
    playerClient = await createUserClient('player2@localhost', 'password123')
  })

  afterEach(async () => {
    // Restore original profile
    await serviceClient
      .from('profiles')
      .update(originalProfile)
      .eq('id', PLAYER_ID)
  })

  it('can update display name', async () => {
    const { error } = await playerClient
      .from('profiles')
      .update({ display_name: 'Updated Name' })
      .eq('id', PLAYER_ID)

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('id', PLAYER_ID)
      .single()

    expect(data!.display_name).toBe('Updated Name')
  })

  it('can update NTRP rating', async () => {
    const { error } = await playerClient
      .from('profiles')
      .update({ ntrp_rating: 4.5 })
      .eq('id', PLAYER_ID)

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('profiles')
      .select('ntrp_rating')
      .eq('id', PLAYER_ID)
      .single()

    expect(Number(data!.ntrp_rating)).toBe(4.5)
  })

  it('can update preferred match type', async () => {
    const { error } = await playerClient
      .from('profiles')
      .update({ preferred_match_type: 'doubles' })
      .eq('id', PLAYER_ID)

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('profiles')
      .select('preferred_match_type')
      .eq('id', PLAYER_ID)
      .single()

    expect(data!.preferred_match_type).toBe('doubles')
  })

  it('can change court group', async () => {
    // Set to null first, then back
    const { error } = await playerClient
      .from('profiles')
      .update({ court_group_id: null })
      .eq('id', PLAYER_ID)

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('profiles')
      .select('court_group_id')
      .eq('id', PLAYER_ID)
      .single()

    expect(data!.court_group_id).toBeNull()
  })

  it('updated_at trigger fires on profile change', async () => {
    const { data: before } = await serviceClient
      .from('profiles')
      .select('updated_at')
      .eq('id', PLAYER_ID)
      .single()

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 50))

    await playerClient
      .from('profiles')
      .update({ bio: 'Testing updated_at trigger' })
      .eq('id', PLAYER_ID)

    const { data: after } = await serviceClient
      .from('profiles')
      .select('updated_at')
      .eq('id', PLAYER_ID)
      .single()

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
      new Date(before!.updated_at).getTime()
    )
  })

  it('cannot update another user profile', async () => {
    const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
    const { data } = await playerClient
      .from('profiles')
      .update({ display_name: 'Hacked!' })
      .eq('id', ADMIN_ID)
      .select()

    // RLS should block this — 0 rows affected
    expect(data).toHaveLength(0)

    // Verify admin profile unchanged
    const { data: admin } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('id', ADMIN_ID)
      .single()

    expect(admin!.display_name).toBe('Court Admin')
  })
})
