import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { MatchTypePreference } from '../../types'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function PostAvailabilityForm({ onClose, onCreated }: Props) {
  const { user, profile } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [matchType, setMatchType] = useState<MatchTypePreference>('both')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = (): string | null => {
    if (date < today) return 'Date must be today or later.'
    if (endTime <= startTime) return 'End time must be after start time.'
    if (!profile?.court_group_id) return 'You must join a court group first.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('availability').insert({
      player_id: user!.id,
      court_group_id: profile!.court_group_id!,
      date,
      start_time: startTime,
      end_time: endTime,
      match_type: matchType,
      notes: notes.trim() || null,
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Post Availability
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              required
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                required
              />
            </div>
          </div>

          {/* Match type */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              Match Type
            </legend>
            <div className="flex gap-4">
              {(['singles', 'doubles', 'both'] as MatchTypePreference[]).map(
                (type) => (
                  <label key={type} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="matchType"
                      value={type}
                      checked={matchType === type}
                      onChange={() => setMatchType(type)}
                      className="accent-green-600"
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                )
              )}
            </div>
          </fieldset>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Looking for a competitive rally partner"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'Post Availability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
