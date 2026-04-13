import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getNtrpLabel } from '../utils/ntrp'
import type { Profile } from '../types'

export function AdminUsersPage() {
  const { profile: currentProfile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!currentProfile?.is_admin) {
      setLoading(false)
      return
    }
    fetchUsers()
  }, [currentProfile])

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers((data as Profile[]) || [])
    setLoading(false)
  }

  const toggleBan = async (userId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'unban' : 'ban'
    if (!confirm(`Are you sure you want to ${action} this user?`)) return

    await supabase
      .from('profiles')
      .update({ is_banned: !currentlyBanned } as Record<string, unknown>)
      .eq('id', userId)
    fetchUsers()
  }

  if (!currentProfile?.is_admin) {
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

  const filteredUsers = users.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.id.includes(search)
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Manage Users</h1>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Rating
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Preference
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Joined
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {user.display_name}
                      {user.is_admin && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.ntrp_rating
                      ? getNtrpLabel(user.ntrp_rating)
                      : 'Not set'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {user.preferred_match_type}
                  </td>
                  <td className="px-4 py-3">
                    {user.is_banned ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        Banned
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!user.is_admin && (
                      <button
                        onClick={() => toggleBan(user.id, user.is_banned)}
                        className={`text-xs px-3 py-1 rounded ${
                          user.is_banned
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {user.is_banned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        {search ? ' matching search' : ' total'}
      </p>
    </div>
  )
}
