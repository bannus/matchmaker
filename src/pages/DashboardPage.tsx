import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getNtrpLabel } from '../utils/ntrp'

interface UpcomingMatch {
  id: string
  date: string
  start_time: string
  end_time: string
  match_type: string
  status: string
}

export function DashboardPage() {
  const { user, profile } = useAuth()
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([])
  const [openSlots, setOpenSlots] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const today = new Date().toISOString().split('T')[0]

      // Fetch upcoming matches
      const { data: playerRows } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('player_id', user.id)

      if (playerRows && playerRows.length > 0) {
        const matchIds = playerRows.map((r: { match_id: string }) => r.match_id)
        const { data: matches } = await supabase
          .from('matches')
          .select('id, date, start_time, end_time, match_type, status')
          .in('id', matchIds)
          .in('status', ['proposed', 'confirmed'])
          .gte('date', today)
          .order('date')
          .limit(5)
        setUpcomingMatches(matches || [])
      }

      // Count open availability
      const { count } = await supabase
        .from('availability')
        .select('id', { count: 'exact', head: true })
        .eq('player_id', user.id)
        .eq('status', 'open')
        .gte('date', today)
      setOpenSlots(count || 0)

      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome back, {profile?.display_name} 👋
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Profile summary card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Your Profile</h2>
            <Link to="/profile" className="text-sm text-green-600 hover:text-green-700">
              Edit
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Rating</span>
              <span className="font-medium text-gray-900">
                {profile?.ntrp_rating
                  ? getNtrpLabel(profile.ntrp_rating)
                  : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Preference</span>
              <span className="font-medium text-gray-900 capitalize">
                {profile?.preferred_match_type || 'Not set'}
              </span>
            </div>
          </div>
        </div>

        {/* Upcoming matches */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Upcoming Matches</h2>
            <Link to="/matches" className="text-sm text-green-600 hover:text-green-700">
              View all
            </Link>
          </div>
          {upcomingMatches.length === 0 ? (
            <p className="text-sm text-gray-500">
              No upcoming matches.{' '}
              <Link to="/availability" className="text-green-600 hover:underline">
                Post availability
              </Link>{' '}
              to get matched!
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {new Date(m.date + 'T00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {m.start_time.slice(0, 5)}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      m.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open availability */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Your Availability</h2>
            <Link to="/availability" className="text-sm text-green-600 hover:text-green-700">
              Manage
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            {openSlots > 0 ? (
              <>
                You have <strong className="text-gray-900">{openSlots}</strong>{' '}
                open availability slot{openSlots !== 1 ? 's' : ''} posted.
              </>
            ) : (
              <>
                No availability posted.{' '}
                <Link to="/availability" className="text-green-600 hover:underline">
                  Let others know when you're free!
                </Link>
              </>
            )}
          </p>
        </div>

        {/* Admin link (only for admins) */}
        {profile?.is_admin && (
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
            <h2 className="font-semibold text-purple-900 mb-3">🔧 Admin</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin"
                className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Dashboard
              </Link>
              <Link
                to="/admin/courts"
                className="text-sm px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
              >
                Courts
              </Link>
              <Link
                to="/admin/users"
                className="text-sm px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
              >
                Users
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
