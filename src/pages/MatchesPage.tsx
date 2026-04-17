import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getNtrpLabel } from '../utils/ntrp'
import {
  generateGoogleCalendarUrl,
  generateICalEvent,
  downloadICalFile,
} from '../utils/calendar'
import { categorizeMatches } from '../utils/matches'

interface MatchRow {
  id: string
  date: string
  start_time: string
  end_time: string
  match_type: string
  status: string
  court_group_id: string
  my_response: string
  opponents: { display_name: string; ntrp_rating: number | null }[]
  opponent_notes: string[]
}

type Section = 'pending' | 'upcoming' | 'past'

export function MatchesPage() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [courtCounts, setCourtCounts] = useState<Record<string, number>>({})
  const [crowding, setCrowding] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const fetchMatches = useCallback(async () => {
    if (!user) return

    // Get all matches for this user
    const { data: playerRows } = await supabase
      .from('match_players')
      .select('match_id, response')
      .eq('player_id', user.id)

    if (!playerRows || playerRows.length === 0) {
      setMatches([])
      return
    }

    const matchIds = playerRows.map((r) => r.match_id)
    const responseMap = Object.fromEntries(
      playerRows.map((r) => [r.match_id, r.response])
    )

    // Fetch match details
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .in('id', matchIds)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (!matchData) {
      setMatches([])
      return
    }

    // Fetch all players in these matches
    const { data: allPlayers } = await supabase
      .from('match_players')
      .select('match_id, player_id')
      .in('match_id', matchIds)

    // Get unique opponent IDs
    const opponentIds = [
      ...new Set(
        (allPlayers ?? [])
          .filter((p) => p.player_id !== user.id)
          .map((p) => p.player_id)
      ),
    ]

    // Fetch opponent profiles
    let profileMap: Record<string, { display_name: string; ntrp_rating: number | null }> = {}
    if (opponentIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, ntrp_rating')
        .in('id', opponentIds)
      for (const p of profiles ?? []) {
        profileMap[p.id] = {
          display_name: p.display_name,
          ntrp_rating: p.ntrp_rating,
        }
      }
    }

    // Fetch opponent availability notes for each match
    const { data: availRows } = await supabase
      .from('availability')
      .select('match_id, player_id, notes')
      .in('match_id', matchIds)
      .not('notes', 'is', null)

    const opponentNotesMap: Record<string, string[]> = {}
    for (const a of availRows ?? []) {
      if (a.player_id === user.id) continue
      if (!a.notes) continue
      if (!opponentNotesMap[a.match_id]) opponentNotesMap[a.match_id] = []
      opponentNotesMap[a.match_id].push(a.notes)
    }

    // Assemble rows
    const rows: MatchRow[] = matchData.map((m) => {
      const opps = (allPlayers ?? [])
        .filter((p) => p.match_id === m.id && p.player_id !== user.id)
        .map((p) => profileMap[p.player_id] ?? { display_name: 'Unknown', ntrp_rating: null })

      return {
        id: m.id,
        date: m.date,
        start_time: m.start_time,
        end_time: m.end_time,
        match_type: m.match_type,
        status: m.status,
        court_group_id: m.court_group_id,
        my_response: responseMap[m.id] ?? 'pending',
        opponents: opps,
        opponent_notes: opponentNotesMap[m.id] ?? [],
      }
    })

    setMatches(rows)
    await fetchCrowding(rows)
  }, [user])

  // Court crowding: count overlapping matches per court group time slot
  const fetchCrowding = async (rows: MatchRow[]) => {
    if (!profile?.court_group_id) return

    // Get court count for the group
    const { count } = await supabase
      .from('courts')
      .select('id', { count: 'exact', head: true })
      .eq('court_group_id', profile.court_group_id)

    const totalCourts = count ?? 0
    setCourtCounts((prev) => ({ ...prev, [profile.court_group_id!]: totalCourts }))

    const crowdMap: Record<string, number> = {}

    for (const m of rows) {
      if (m.status !== 'confirmed') continue
      // Count overlapping confirmed matches in same court group
      const { count: overlap } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('court_group_id', m.court_group_id)
        .eq('status', 'confirmed')
        .eq('date', m.date)
        .lt('start_time', m.end_time)
        .gt('end_time', m.start_time)

      crowdMap[m.id] = overlap ?? 0
    }

    setCrowding(crowdMap)
  }

  useEffect(() => {
    setLoading(true)
    fetchMatches().finally(() => setLoading(false))
  }, [fetchMatches])

  const respond = async (matchId: string, response: 'accepted' | 'declined') => {
    const { error } = await supabase.rpc('respond_to_match', {
      p_match_id: matchId,
      p_response: response,
    } as any)

    if (error) {
      console.error('Failed to respond to match:', error.message)
    }

    fetchMatches()
  }

  const today = new Date().toISOString().split('T')[0]
  const { pending, upcoming, past } = categorizeMatches(matches, today)

  const sectionData: { key: Section; title: string; items: MatchRow[] }[] = [
    { key: 'pending', title: 'Pending Proposals', items: pending },
    { key: 'upcoming', title: 'Upcoming Matches', items: upcoming },
    { key: 'past', title: 'Past Matches', items: past },
  ]

  const statusColor = (s: string) => {
    switch (s) {
      case 'proposed':
        return 'bg-yellow-100 text-yellow-800'
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-500'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getCrowdingIndicator = (matchId: string) => {
    const overlap = crowding[matchId]
    if (overlap == null) return null
    const courts = courtCounts[profile?.court_group_id ?? ''] ?? 0
    if (courts === 0) return null

    const ratio = overlap / courts
    let color = 'text-green-600'
    let label = 'Low'
    if (ratio > 1) {
      color = 'text-red-600'
      label = 'Full'
    } else if (ratio > 0.7) {
      color = 'text-yellow-600'
      label = 'Busy'
    }
    return (
      <span className={`text-xs font-medium ${color}`}>
        🏟 {overlap}/{courts} courts · {label}
      </span>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Matches</h1>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-gray-500">
          No matches yet. Post your availability to get matched with other players!
        </p>
      ) : (
        <div className="space-y-8">
          {sectionData.map(({ key, title, items }) => (
            <section key={key}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {title}
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({items.length})
                </span>
              </h2>

              {items.length === 0 ? (
                <p className="text-sm text-gray-400">None</p>
              ) : (
                <div className="space-y-3">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          {/* Opponents */}
                          <p className="font-medium text-gray-900">
                            {m.opponents.length > 0
                              ? m.opponents
                                  .map(
                                    (o) =>
                                      `${o.display_name}${o.ntrp_rating != null ? ` (${getNtrpLabel(o.ntrp_rating)})` : ''}`
                                  )
                                  .join(', ')
                              : 'TBD'}
                          </p>

                          {/* Date & time */}
                          <p className="text-sm text-gray-600">
                            {new Date(m.date + 'T00:00').toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            <span className="ml-2">
                              {m.start_time.slice(0, 5)} – {m.end_time.slice(0, 5)}
                            </span>
                          </p>

                          {/* Meta */}
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="capitalize text-gray-500">
                              {m.match_type}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(m.status)}`}
                            >
                              {m.status === 'proposed' && m.my_response === 'accepted'
                                ? 'awaiting opponent'
                                : m.status}
                            </span>
                            {getCrowdingIndicator(m.id)}
                          </div>

                          {/* Opponent notes from availability */}
                          {m.opponent_notes.length > 0 && (
                            <div className="text-sm text-gray-500 italic">
                              {m.opponent_notes.map((note, i) => (
                                <p key={i}>💬 {note}</p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 self-start shrink-0">
                          {key === 'pending' && (
                            <>
                              <button
                                onClick={() => respond(m.id, 'accepted')}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => respond(m.id, 'declined')}
                                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {key === 'upcoming' && (
                            <>
                              <a
                                href={generateGoogleCalendarUrl({
                                  date: m.date,
                                  start_time: m.start_time,
                                  end_time: m.end_time,
                                  match_type: m.match_type,
                                  opponents: m.opponents.map((o) => o.display_name),
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Google Cal
                              </a>
                              <button
                                onClick={() => {
                                  const ics = generateICalEvent({
                                    date: m.date,
                                    start_time: m.start_time,
                                    end_time: m.end_time,
                                    match_type: m.match_type,
                                    opponents: m.opponents.map((o) => o.display_name),
                                  })
                                  downloadICalFile(ics, `match-${m.id}`)
                                }}
                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                iCal ↓
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
