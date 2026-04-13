import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
export const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
export const PLAYER_ID = '00000000-0000-0000-0000-000000000002'
export const COURT_GROUP_ID = '10000000-0000-0000-0000-000000000001'

// Service role client — bypasses RLS, used for test setup/teardown
// persistSession: false avoids storage conflicts with user clients
export const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// Create an authenticated client for a specific user (tests RLS)
let clientCounter = 0
export async function createUserClient(email: string, password: string): Promise<SupabaseClient> {
  clientCounter++
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `test-client-${clientCounter}`,
    },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Failed to sign in as ${email}: ${error.message}`)
  return client
}

// Helper to create a proposed match between the two seed users
export async function createProposedMatch(): Promise<string> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().split('T')[0]

  const { data, error } = await serviceClient
    .from('matches')
    .insert({
      court_group_id: COURT_GROUP_ID,
      match_type: 'singles',
      date,
      start_time: '10:00',
      end_time: '11:00',
      status: 'proposed',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create match: ${error.message}`)

  const { error: playersError } = await serviceClient
    .from('match_players')
    .insert([
      { match_id: data.id, player_id: ADMIN_ID, response: 'pending' },
      { match_id: data.id, player_id: PLAYER_ID, response: 'pending' },
    ])

  if (playersError) throw new Error(`Failed to add players: ${playersError.message}`)

  return data.id
}

export async function clearMatchData() {
  await serviceClient.from('match_players').delete().neq('match_id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('availability').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}
