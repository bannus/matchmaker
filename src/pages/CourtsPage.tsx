import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { CourtGroup, Court, Sport } from '../types'

const sportEmoji: Record<Sport, string> = {
  tennis: '🎾',
  pickleball: '🏓',
  badminton: '🏸',
}

interface CourtGroupWithCourts extends CourtGroup {
  courts: Court[]
}

export function CourtsPage() {
  const [groups, setGroups] = useState<CourtGroupWithCourts[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: groupData } = await supabase
        .from('court_groups')
        .select('*')
        .order('name')

      const { data: courtData } = await supabase
        .from('courts')
        .select('*')
        .order('name')

      if (groupData) {
        const courtsByGroup = new Map<string, Court[]>()
        for (const court of courtData ?? []) {
          const list = courtsByGroup.get(court.court_group_id) ?? []
          list.push(court)
          courtsByGroup.set(court.court_group_id, list)
        }

        setGroups(
          groupData.map((g) => ({
            ...g,
            courts: courtsByGroup.get(g.id) ?? [],
          }))
        )
      }
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading courts…</div>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Courts</h1>
        <p className="text-gray-500">No court locations have been added yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Courts</h1>

      <div className="space-y-6">
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Group header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    🏟️ {group.name}
                  </h2>
                  {group.description && (
                    <p className="text-sm text-gray-600 mt-0.5">
                      {group.description}
                    </p>
                  )}
                </div>
                <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                  {group.courts.length}{' '}
                  {group.courts.length === 1 ? 'court' : 'courts'}
                </span>
              </div>
            </div>

            {/* Courts list */}
            {group.courts.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-500 text-center">
                No courts listed for this location yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {group.courts.map((court) => (
                  <div
                    key={court.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {sportEmoji[court.sport]}
                        </span>
                        <span className="font-medium text-gray-900 truncate">
                          {court.name}
                        </span>
                      </div>
                      {court.notes && (
                        <p className="text-sm text-gray-500 mt-0.5 ml-7">
                          {court.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-7 sm:ml-0 flex-wrap">
                      <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 capitalize">
                        {court.sport}
                      </span>
                      {court.surface_type && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 capitalize">
                          {court.surface_type}
                        </span>
                      )}
                      {court.is_lit && (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                          💡 Lit
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
