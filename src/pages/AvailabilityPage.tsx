import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getNtrpLabel } from '../utils/ntrp'
import { PostAvailabilityForm } from '../components/availability/PostAvailabilityForm'
import type { Availability, MatchTypePreference } from '../types'

type Tab = 'mine' | 'browse'

interface BrowseSlot {
  id: string
  date: string
  start_time: string
  end_time: string
  match_type: MatchTypePreference
  notes: string | null
  ntrp_rating: number | null
}

export function AvailabilityPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<Tab>('mine')
  const [mySlots, setMySlots] = useState<Availability[]>([])
  const [browseSlots, setBrowseSlots] = useState<BrowseSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchMySlots = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('availability')
      .select('*')
      .eq('player_id', user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    setMySlots(data ?? [])
  }, [user])

  const fetchBrowseSlots = useCallback(async () => {
    if (!user || !profile?.court_group_id) return
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('availability')
      .select('id, date, start_time, end_time, match_type, notes, player_id, profiles:player_id(ntrp_rating)')
      .eq('court_group_id', profile.court_group_id)
      .eq('status', 'open')
      .neq('player_id', user.id)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }) as any

    const mapped: BrowseSlot[] = (data ?? []).map((row: any) => ({
      id: row.id,
      date: row.date,
      start_time: row.start_time,
      end_time: row.end_time,
      match_type: row.match_type,
      notes: row.notes,
      ntrp_rating: row.profiles?.ntrp_rating ?? null,
    }))
    setBrowseSlots(mapped)
  }, [user, profile])

  useEffect(() => {
    setLoading(true)
    const load = tab === 'mine' ? fetchMySlots : fetchBrowseSlots
    load().finally(() => setLoading(false))
  }, [tab, fetchMySlots, fetchBrowseSlots])

  const cancelSlot = async (id: string) => {
    await supabase
      .from('availability')
      .update({ status: 'cancelled' as const })
      .eq('id', id)
    fetchMySlots()
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'open':
        return 'bg-green-100 text-green-800'
      case 'matched':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-500'
      case 'expired':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
        {tab === 'mine' && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            + Add Availability
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          ['mine', 'My Availability'],
          ['browse', 'Browse'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tab === 'mine' ? (
        /* ── My Availability ── */
        mySlots.length === 0 ? (
          <p className="text-sm text-gray-500">
            No availability posted yet. Tap "Add Availability" to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {mySlots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">
                      {new Date(slot.date + 'T00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                      <span className="ml-2 text-gray-500 font-normal">
                        {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="capitalize text-gray-600">
                        {slot.match_type}
                      </span>
                      {slot.status === 'matched' && slot.match_id ? (
                        <Link
                          to="/matches"
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(slot.status)} hover:underline cursor-pointer`}
                        >
                          matched → view
                        </Link>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(slot.status)}`}
                        >
                          {slot.status}
                        </span>
                      )}
                    </div>
                    {slot.notes && (
                      <p className="text-sm text-gray-500">{slot.notes}</p>
                    )}
                  </div>

                  {slot.status === 'open' && (
                    <button
                      onClick={() => cancelSlot(slot.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 self-start"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : /* ── Browse ── */
      browseSlots.length === 0 ? (
        <p className="text-sm text-gray-500">
          No open availability from other players in your court group right now.
        </p>
      ) : (
        <div className="space-y-3">
          {browseSlots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">
                    🎾 Player
                    {slot.ntrp_rating != null && (
                      <span className="ml-2 text-sm text-gray-500 font-normal">
                        {getNtrpLabel(slot.ntrp_rating)}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(slot.date + 'T00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    <span className="ml-2">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </span>
                  </p>
                  <p className="text-sm capitalize text-gray-500">
                    {slot.match_type}
                  </p>
                  {slot.notes && (
                    <p className="text-sm text-gray-400 italic">{slot.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PostAvailabilityForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            fetchMySlots()
          }}
        />
      )}
    </div>
  )
}
