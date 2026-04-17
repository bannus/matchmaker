import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { ntrpLevels } from '../utils/ntrp'
import { getOnboardingCourt, clearOnboardingCourt } from '../utils/onboardingCourt'
import type { MatchTypePreference } from '../types'

type Step = 'name' | 'rating' | 'match-type' | 'court-group'

interface CourtGroupOption {
  id: string
  name: string
  description: string | null
}

export function ProfileSetup() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('name')
  const [displayName, setDisplayName] = useState('')
  const [ntrpRating, setNtrpRating] = useState<number | null>(null)
  const [matchType, setMatchType] = useState<MatchTypePreference>('both')
  const [courtGroups, setCourtGroups] = useState<CourtGroupOption[]>([])
  const [selectedCourtGroup, setSelectedCourtGroup] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [expandedRating, setExpandedRating] = useState<number | null>(null)

  useEffect(() => {
    supabase
      .from('court_groups')
      .select('id, name, description')
      .then(({ data }) => {
        if (data) {
          setCourtGroups(data)

          // Pre-select court from QR code onboarding flow
          const onboardingCourtId = getOnboardingCourt()
          if (onboardingCourtId && data.some((g) => g.id === onboardingCourtId)) {
            setSelectedCourtGroup(onboardingCourtId)
          }
        }
      })
  }, [])

  // Pre-fill name from Google profile if available
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setDisplayName(user.user_metadata.full_name)
    }
  }, [user])

  const handleComplete = async () => {
    if (!user) return
    setSaving(true)
    setSaveError(null)

    const profileData = {
      id: user.id,
      display_name: displayName.trim(),
      ntrp_rating: ntrpRating,
      preferred_match_type: matchType,
      court_group_id: selectedCourtGroup,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('profiles').upsert(profileData as any)

    if (error) {
      setSaveError('Something went wrong saving your profile. Please try again.')
      setSaving(false)
      return
    }

    await refreshProfile()
    clearOnboardingCourt()
    navigate('/dashboard', { replace: true })
  }

  const steps: Step[] = ['name', 'rating', 'match-type', 'court-group']
  const currentIndex = steps.indexOf(step)
  const canGoNext = () => {
    switch (step) {
      case 'name':
        return displayName.trim().length >= 2
      case 'rating':
        return ntrpRating !== null
      case 'match-type':
        return true
      case 'court-group':
        return true
    }
  }

  const goNext = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex])
    } else {
      handleComplete()
    }
  }

  const goBack = () => {
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      setStep(steps[prevIndex])
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                i <= currentIndex ? 'bg-green-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Step 1: Name */}
          {step === 'name' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Welcome to Matchmaker! 🎾
              </h2>
              <p className="text-gray-600 mb-6">
                Let's set up your profile so we can find you great matches.
              </p>
              <label
                htmlFor="display-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                What should we call you?
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (canGoNext()) goNext()
                }}
              >
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name or nickname"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  autoFocus
                />
              </form>
              <p className="mt-2 text-xs text-gray-500">
                Your name is only shared with players you're matched with — never visible while browsing. You can change it later.
              </p>
            </div>
          )}

          {/* Step 2: NTRP Rating */}
          {step === 'rating' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                What's your playing level?
              </h2>
              <p className="text-gray-600 mb-4">
                Pick the level that best describes you. Don't worry about being
                exact — this just helps us find good matches. You can change it
                anytime.
              </p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {ntrpLevels.map((level) => (
                  <button
                    key={level.rating}
                    onClick={() => {
                      setNtrpRating(level.rating)
                      setExpandedRating(
                        expandedRating === level.rating ? null : level.rating
                      )
                    }}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      ntrpRating === level.rating
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {level.rating}
                        </span>
                        <span className="ml-2 text-gray-700">
                          {level.label}
                        </span>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {expandedRating === level.rating ? '▲' : '▼'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {level.shortDescription}
                    </p>
                    {expandedRating === level.rating && (
                      <ul className="mt-2 space-y-1">
                        {level.details.map((detail, i) => (
                          <li
                            key={i}
                            className="text-sm text-gray-500 flex items-start gap-2"
                          >
                            <span className="text-green-500 mt-0.5">•</span>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Match Type Preference */}
          {step === 'match-type' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                What type of matches?
              </h2>
              <p className="text-gray-600 mb-4">
                What are you usually looking for?
              </p>
              <div className="space-y-3">
                {([
                  {
                    value: 'singles' as const,
                    label: 'Singles',
                    desc: '1 vs 1',
                    emoji: '👤',
                  },
                  {
                    value: 'doubles' as const,
                    label: 'Doubles',
                    desc: '2 vs 2',
                    emoji: '👥',
                  },
                  {
                    value: 'both' as const,
                    label: 'Either',
                    desc: "I'm up for both!",
                    emoji: '🤝',
                  },
                ]).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMatchType(option.value)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors flex items-center gap-4 ${
                      matchType === option.value
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {option.label}
                      </div>
                      <div className="text-sm text-gray-600">
                        {option.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Court Group */}
          {step === 'court-group' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Where do you play?
                <span className="ml-2 text-sm font-normal text-gray-400">Optional</span>
              </h2>
              <p className="text-gray-600 mb-4">
                Pick your home courts so we can match you with nearby players.
                You can always change this later in your profile.
              </p>
              {courtGroups.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p>No court groups available yet.</p>
                  <p className="text-sm mt-1">
                    You can set this up later in your profile.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {courtGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedCourtGroup(group.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedCourtGroup === group.id
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        🏟️ {group.name}
                      </div>
                      {group.description && (
                        <div className="text-sm text-gray-600 mt-1">
                          {group.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {saveError && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            {currentIndex > 0 ? (
              <button
                onClick={goBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              {step === 'court-group' && selectedCourtGroup === null && courtGroups.length > 0 && (
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Skip for now
                </button>
              )}
              <button
                onClick={goNext}
                disabled={!canGoNext() || saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving
                  ? 'Saving...'
                  : currentIndex === steps.length - 1
                    ? 'Finish setup'
                    : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
