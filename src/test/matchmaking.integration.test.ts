import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// These tests run against local Supabase — requires `npm run db:start`
// Uses the service role key to bypass RLS for test setup
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const PLAYER_ID = '00000000-0000-0000-0000-000000000002'
const COURT_GROUP_ID = '10000000-0000-0000-0000-000000000001'

// Tomorrow's date to avoid timezone edge cases
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const TEST_DATE = tomorrow.toISOString().split('T')[0]

async function clearMatchData() {
  await supabase.from('match_players').delete().neq('match_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('availability').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

async function postAvailability(playerId: string, start: string, end: string, matchType = 'both') {
  const { error } = await supabase.from('availability').insert({
    player_id: playerId,
    court_group_id: COURT_GROUP_ID,
    date: TEST_DATE,
    start_time: start,
    end_time: end,
    match_type: matchType,
  })
  if (error) throw new Error(`Failed to insert availability: ${error.message}`)
}

async function runMatchmaking(): Promise<number> {
  const { data, error } = await supabase.rpc('run_matchmaking')
  if (error) throw new Error(`Matchmaking failed: ${error.message}`)
  return data as number
}

describe('run_matchmaking()', () => {
  beforeAll(async () => {
    // Verify we can connect to Supabase
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) {
      throw new Error(
        `Cannot connect to local Supabase. Is it running? (npm run db:start)\n${error.message}`
      )
    }
  })

  beforeEach(async () => {
    await clearMatchData()
    // Reset NTRP ratings to seed defaults
    await supabase.from('profiles').update({ ntrp_rating: 4.0 }).eq('id', ADMIN_ID)
    await supabase.from('profiles').update({ ntrp_rating: 3.5 }).eq('id', PLAYER_ID)
  })

  it('creates a match when two players have overlapping availability', async () => {
    await postAvailability(ADMIN_ID, '09:00', '11:00')
    await postAvailability(PLAYER_ID, '10:00', '12:00')

    const count = await runMatchmaking()
    expect(count).toBe(1)

    // Verify match was created
    const { data: matches } = await supabase
      .from('matches')
      .select('*, match_players(*)')
      .eq('court_group_id', COURT_GROUP_ID)
    expect(matches).toHaveLength(1)
    expect(matches![0].status).toBe('proposed')
    expect(matches![0].start_time).toBe('10:00:00') // overlap start
    expect(matches![0].end_time).toBe('11:00:00') // overlap end
  })

  it('does not match players with NTRP difference > 0.5', async () => {
    await supabase.from('profiles').update({ ntrp_rating: 2.0 }).eq('id', PLAYER_ID)

    await postAvailability(ADMIN_ID, '09:00', '11:00')
    await postAvailability(PLAYER_ID, '09:00', '11:00')

    const count = await runMatchmaking()
    expect(count).toBe(0)
  })

  it('matches players with NTRP difference exactly 0.5', async () => {
    // Admin is 4.0, player is 3.5 — difference is exactly 0.5
    await postAvailability(ADMIN_ID, '09:00', '11:00')
    await postAvailability(PLAYER_ID, '09:00', '11:00')

    const count = await runMatchmaking()
    expect(count).toBe(1)
  })

  it('does not match players with no time overlap', async () => {
    await postAvailability(ADMIN_ID, '09:00', '10:00')
    await postAvailability(PLAYER_ID, '10:00', '11:00')

    const count = await runMatchmaking()
    // 10:00-10:00 is zero duration, below 30 min minimum
    expect(count).toBe(0)
  })

  it('requires minimum 30 minutes of overlap', async () => {
    await postAvailability(ADMIN_ID, '09:00', '10:00')
    await postAvailability(PLAYER_ID, '09:45', '11:00')

    const count = await runMatchmaking()
    // Overlap is 09:45-10:00 = 15 min, below threshold
    expect(count).toBe(0)
  })

  it('marks availability as matched after creating a match', async () => {
    await postAvailability(ADMIN_ID, '09:00', '11:00')
    await postAvailability(PLAYER_ID, '09:00', '11:00')

    await runMatchmaking()

    const { data } = await supabase
      .from('availability')
      .select('status')
      .eq('date', TEST_DATE)
    expect(data!.every((a) => a.status === 'matched')).toBe(true)
  })

  it('is idempotent — running twice does not create duplicate matches', async () => {
    await postAvailability(ADMIN_ID, '09:00', '11:00')
    await postAvailability(PLAYER_ID, '09:00', '11:00')

    const first = await runMatchmaking()
    const second = await runMatchmaking()

    expect(first).toBe(1)
    expect(second).toBe(0)
  })

  it('creates notifications for both players', async () => {
    await postAvailability(ADMIN_ID, '09:00', '11:00')
    await postAvailability(PLAYER_ID, '09:00', '11:00')

    await runMatchmaking()

    const { data: notifications } = await supabase
      .from('notifications')
      .select('user_id, type')
      .eq('type', 'match_proposed')

    expect(notifications).toHaveLength(2)
    const userIds = notifications!.map((n) => n.user_id).sort()
    expect(userIds).toContain(ADMIN_ID)
    expect(userIds).toContain(PLAYER_ID)
  })

  it('respects match type compatibility', async () => {
    await postAvailability(ADMIN_ID, '09:00', '11:00', 'singles')
    await postAvailability(PLAYER_ID, '09:00', '11:00', 'doubles')

    const count = await runMatchmaking()
    expect(count).toBe(0)
  })

  it('matches when one player wants "both" match types', async () => {
    await postAvailability(ADMIN_ID, '09:00', '11:00', 'both')
    await postAvailability(PLAYER_ID, '09:00', '11:00', 'singles')

    const count = await runMatchmaking()
    expect(count).toBe(1)
  })
})
