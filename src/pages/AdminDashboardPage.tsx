import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Stats {
  totalUsers: number
  activeUsers: number
  totalMatches: number
  confirmedMatches: number
  openAvailability: number
  courtGroups: number
}

export function AdminDashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      const [users, matches, availability, groups] = await Promise.all([
        supabase.from('profiles').select('id, is_banned', { count: 'exact' }),
        supabase.from('matches').select('id, status', { count: 'exact' }),
        supabase
          .from('availability')
          .select('id', { count: 'exact' })
          .eq('status', 'open'),
        supabase.from('court_groups').select('id', { count: 'exact' }),
      ])

      const totalUsers = users.count || 0
      const activeUsers =
        (users.data as { id: string; is_banned: boolean }[] | null)?.filter(
          (u) => !u.is_banned
        ).length || 0
      const totalMatches = matches.count || 0
      const confirmedMatches =
        (matches.data as { id: string; status: string }[] | null)?.filter(
          (m) => m.status === 'confirmed' || m.status === 'completed'
        ).length || 0

      setStats({
        totalUsers,
        activeUsers,
        totalMatches,
        confirmedMatches,
        openAvailability: availability.count || 0,
        courtGroups: groups.count || 0,
      })
      setLoading(false)
    }

    fetchStats()
  }, [profile])

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-2">🔒</p>
        <p className="text-gray-600">
          Access denied. Admin privileges required.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  const statCards = [
    { label: 'Registered Users', value: stats?.totalUsers || 0, icon: '👥' },
    { label: 'Active Users', value: stats?.activeUsers || 0, icon: '✅' },
    { label: 'Total Matches', value: stats?.totalMatches || 0, icon: '🎾' },
    {
      label: 'Confirmed Matches',
      value: stats?.confirmedMatches || 0,
      icon: '🤝',
    },
    {
      label: 'Open Availability',
      value: stats?.openAvailability || 0,
      icon: '📅',
    },
    { label: 'Court Groups', value: stats?.courtGroups || 0, icon: '🏟️' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Admin Dashboard
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{card.icon}</span>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {card.value}
                </p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/admin/courts"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Manage Courts
          </a>
          <a
            href="/admin/users"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            Manage Users
          </a>
        </div>
      </div>
    </div>
  )
}
