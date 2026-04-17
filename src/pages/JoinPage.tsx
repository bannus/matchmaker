import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { storeOnboardingCourt, isValidUuid } from '../utils/onboardingCourt'

export function JoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const courtId = searchParams.get('court')
  const validCourtId = courtId && isValidUuid(courtId) ? courtId : null

  const [courtName, setCourtName] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!validCourtId)
  const [invalidCourt, setInvalidCourt] = useState(false)

  // Store court param and fetch court name
  useEffect(() => {
    if (!validCourtId) return

    storeOnboardingCourt(validCourtId)

    supabase
      .from('court_groups')
      .select('name')
      .eq('id', validCourtId)
      .single()
      .then(({ data }) => {
        if (data) {
          setCourtName(data.name)
        } else {
          setInvalidCourt(true)
        }
        setLoading(false)
      })
  }, [validCourtId])

  // Redirect logged-in users
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, user, navigate])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🎾 Matchmaker</h1>
          {courtName ? (
            <div className="mt-4">
              <p className="text-lg text-gray-700">
                Find tennis partners at
              </p>
              <p className="text-xl font-semibold text-green-700 mt-1">
                🏟️ {courtName}
              </p>
            </div>
          ) : (courtId && !validCourtId) || invalidCourt ? (
            <p className="mt-2 text-gray-600">
              This court link may be outdated. Sign in to browse all available courts.
            </p>
          ) : (
            <p className="mt-2 text-gray-600">
              Find tennis partners in your neighborhood
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 text-center mb-5">
            Sign in to get matched with players at your skill level
          </p>

          <button
            onClick={() => navigate(`/login${validCourtId ? `?court=${validCourtId}` : ''}`, { replace: true })}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Get Started
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Free to use · No spam · Just tennis
        </p>
      </div>
    </div>
  )
}
