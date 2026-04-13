import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ntrpLevels, getNtrpLabel } from '../utils/ntrp'
import type { MatchTypePreference } from '../types'

interface CourtGroupOption {
  id: string
  name: string
}

export function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [ntrpRating, setNtrpRating] = useState<number | null>(null)
  const [matchType, setMatchType] = useState<MatchTypePreference>('both')
  const [notificationEmail, setNotificationEmail] = useState(true)
  const [notificationInApp, setNotificationInApp] = useState(true)
  const [courtGroupId, setCourtGroupId] = useState<string | null>(null)

  const [courtGroups, setCourtGroups] = useState<CourtGroupOption[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Populate form from profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setBio(profile.bio ?? '')
      setNtrpRating(profile.ntrp_rating)
      setMatchType(profile.preferred_match_type ?? 'both')
      setNotificationEmail(profile.notification_email)
      setNotificationInApp(profile.notification_in_app)
      setCourtGroupId(profile.court_group_id)
    }
  }, [profile])

  // Fetch court groups for dropdown
  useEffect(() => {
    supabase
      .from('court_groups')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setCourtGroups(data)
      })
  }, [])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setSaved(false)

    const updates = {
      id: user.id,
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      ntrp_rating: ntrpRating,
      preferred_match_type: matchType,
      notification_email: notificationEmail,
      notification_in_app: notificationInApp,
      court_group_id: courtGroupId,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('profiles').upsert(updates as any)

    if (!error) {
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading profile…</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Profile</h1>

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Basic Info</h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="display-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
                placeholder="Your name or nickname"
              />
            </div>
            <div>
              <label
                htmlFor="bio"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm resize-none"
                placeholder="Tell other players about yourself…"
              />
            </div>
          </div>
        </div>

        {/* Playing Preferences */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Playing Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="ntrp-rating"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                NTRP Rating
              </label>
              <select
                id="ntrp-rating"
                value={ntrpRating ?? ''}
                onChange={(e) =>
                  setNtrpRating(
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm bg-white"
              >
                <option value="">Not set</option>
                {ntrpLevels.map((level) => (
                  <option key={level.rating} value={level.rating}>
                    {getNtrpLabel(level.rating)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Match Type Preference
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'singles', label: 'Singles' },
                    { value: 'doubles', label: 'Doubles' },
                    { value: 'both', label: 'Both' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMatchType(option.value)}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      matchType === option.value
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Home Court */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Home Court</h2>
          <div>
            <label
              htmlFor="court-group"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Court Group
            </label>
            <select
              id="court-group"
              value={courtGroupId ?? ''}
              onChange={(e) =>
                setCourtGroupId(e.target.value || null)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm bg-white"
            >
              <option value="">None selected</option>
              {courtGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Email notifications
                </div>
                <div className="text-xs text-gray-500">
                  Receive match updates via email
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationInApp}
                onChange={(e) => setNotificationInApp(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  In-app notifications
                </div>
                <div className="text-xs text-gray-500">
                  See notifications within the app
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              ✓ Profile updated
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
