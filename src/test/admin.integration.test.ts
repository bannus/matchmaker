import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  serviceClient,
  createUserClient,
  ADMIN_ID,
  PLAYER_ID,
  COURT_GROUP_ID,
} from './helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('admin: court management', () => {
  let adminClient: SupabaseClient
  const createdIds: { groups: string[]; courts: string[] } = { groups: [], courts: [] }

  beforeAll(async () => {
    adminClient = await createUserClient('admin@localhost', 'password123')
  })

  afterEach(async () => {
    // Cleanup any test-created courts and groups (use service role to bypass RLS)
    for (const id of createdIds.courts) {
      await serviceClient.from('courts').delete().eq('id', id)
    }
    for (const id of createdIds.groups) {
      await serviceClient.from('courts').delete().eq('court_group_id', id)
      await serviceClient.from('court_groups').delete().eq('id', id)
    }
    createdIds.groups = []
    createdIds.courts = []
  })

  it('admin can create a court group', async () => {
    const { data, error } = await adminClient
      .from('court_groups')
      .insert({
        name: 'Test Park Courts',
        description: 'Integration test group',
        timezone: 'America/Chicago',
        created_by: ADMIN_ID,
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data!.name).toBe('Test Park Courts')
    createdIds.groups.push(data!.id)
  })

  it('admin can update a court group', async () => {
    // Create via service role, update via admin client
    const { data: group } = await serviceClient
      .from('court_groups')
      .insert({
        name: 'Before Update',
        timezone: 'America/New_York',
        created_by: ADMIN_ID,
      })
      .select()
      .single()
    createdIds.groups.push(group!.id)

    const { error } = await adminClient
      .from('court_groups')
      .update({ name: 'After Update' })
      .eq('id', group!.id)

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('court_groups')
      .select('name')
      .eq('id', group!.id)
      .single()

    expect(data!.name).toBe('After Update')
  })

  it('admin can create a court', async () => {
    const { data, error } = await adminClient
      .from('courts')
      .insert({
        court_group_id: COURT_GROUP_ID,
        name: 'Test Court 99',
        sport: 'tennis',
        surface_type: 'clay',
        is_lit: true,
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data!.name).toBe('Test Court 99')
    expect(data!.surface_type).toBe('clay')
    expect(data!.is_lit).toBe(true)
    createdIds.courts.push(data!.id)
  })

  it('admin can update a court', async () => {
    const { data: court } = await serviceClient
      .from('courts')
      .insert({
        court_group_id: COURT_GROUP_ID,
        name: 'Old Name',
        sport: 'tennis',
      })
      .select()
      .single()
    createdIds.courts.push(court!.id)

    const { error } = await adminClient
      .from('courts')
      .update({ name: 'New Name', is_lit: true })
      .eq('id', court!.id)

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('courts')
      .select('name, is_lit')
      .eq('id', court!.id)
      .single()

    expect(data!.name).toBe('New Name')
    expect(data!.is_lit).toBe(true)
  })

  it('non-admin cannot create a court group', async () => {
    const playerClient = await createUserClient('player2@localhost', 'password123')

    const { error } = await playerClient
      .from('court_groups')
      .insert({
        name: 'Unauthorized Group',
        timezone: 'America/New_York',
        created_by: PLAYER_ID,
      })

    expect(error).not.toBeNull()
  })

  it('non-admin cannot create a court', async () => {
    const playerClient = await createUserClient('player2@localhost', 'password123')

    const { error } = await playerClient
      .from('courts')
      .insert({
        court_group_id: COURT_GROUP_ID,
        name: 'Unauthorized Court',
        sport: 'tennis',
      })

    expect(error).not.toBeNull()
  })

  it('admin can delete a court', async () => {
    const { data: court } = await serviceClient
      .from('courts')
      .insert({
        court_group_id: COURT_GROUP_ID,
        name: 'To Delete',
        sport: 'tennis',
      })
      .select()
      .single()

    const { error } = await adminClient
      .from('courts')
      .delete()
      .eq('id', court!.id)

    expect(error).toBeNull()

    // Verify the row is actually gone
    const { data } = await serviceClient
      .from('courts')
      .select('id')
      .eq('id', court!.id)

    expect(data).toHaveLength(0)
  })

  it('admin can delete a court group', async () => {
    const { data: group } = await serviceClient
      .from('court_groups')
      .insert({
        name: 'To Delete Group',
        timezone: 'America/New_York',
        created_by: ADMIN_ID,
      })
      .select()
      .single()

    const { error } = await adminClient
      .from('court_groups')
      .delete()
      .eq('id', group!.id)

    expect(error).toBeNull()

    // Verify the row is actually gone
    const { data } = await serviceClient
      .from('court_groups')
      .select('id')
      .eq('id', group!.id)

    expect(data).toHaveLength(0)
  })
})

describe('admin: user management', () => {
  let adminClient: SupabaseClient

  beforeAll(async () => {
    adminClient = await createUserClient('admin@localhost', 'password123')
  })

  afterEach(async () => {
    // Restore player to not-banned
    await serviceClient
      .from('profiles')
      .update({ is_banned: false })
      .eq('id', PLAYER_ID)
  })

  it('admin can ban a user', async () => {
    const { error } = await adminClient
      .from('profiles')
      .update({ is_banned: true })
      .eq('id', PLAYER_ID)
      .select()

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('profiles')
      .select('is_banned')
      .eq('id', PLAYER_ID)
      .single()

    expect(data!.is_banned).toBe(true)
  })

  it('admin can unban a user', async () => {
    // Ban via service role first
    await serviceClient
      .from('profiles')
      .update({ is_banned: true })
      .eq('id', PLAYER_ID)

    const { error } = await adminClient
      .from('profiles')
      .update({ is_banned: false })
      .eq('id', PLAYER_ID)

    expect(error).toBeNull()
  })

  it('non-admin cannot ban a user', async () => {
    const playerClient = await createUserClient('player2@localhost', 'password123')

    const { data } = await playerClient
      .from('profiles')
      .update({ is_banned: true })
      .eq('id', ADMIN_ID)
      .select()

    // RLS should block — 0 rows affected
    expect(data).toHaveLength(0)
  })

  it('banned status is visible to all users', async () => {
    await serviceClient
      .from('profiles')
      .update({ is_banned: true })
      .eq('id', PLAYER_ID)

    const playerClient = await createUserClient('player2@localhost', 'password123')
    const { data } = await playerClient
      .from('profiles')
      .select('is_banned')
      .eq('id', PLAYER_ID)
      .single()

    expect(data!.is_banned).toBe(true)
  })
})
