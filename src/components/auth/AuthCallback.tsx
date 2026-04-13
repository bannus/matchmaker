import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let handled = false

    const redirect = async (userId: string) => {
      if (handled) return
      handled = true
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, ntrp_rating')
        .eq('id', userId)
        .single()

      if (!profile || profile.ntrp_rating === null) {
        navigate('/profile/setup', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }

    const handleCallback = async () => {
      // Check for token_hash in URL params (magic link / email confirmation)
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as 'email' | 'magiclink') || 'magiclink',
        })
        if (error) {
          setError(error.message)
          return
        }
        if (data.session) {
          redirect(data.session.user.id)
          return
        }
      }

      // Fallback: check for hash fragment (OAuth redirect) or existing session
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'SIGNED_IN' && session) {
            redirect(session.user.id)
          }
        }
      )

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        redirect(session.user.id)
      }

      // Clean up subscription after 10s timeout
      setTimeout(() => {
        if (!handled) {
          subscription.unsubscribe()
          setError('Sign-in timed out. Please try again.')
        }
      }, 10000)
    }

    handleCallback()
  }, [navigate, searchParams])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="text-green-600 underline"
          >
            Return to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
        <p className="mt-4 text-gray-600">Signing you in...</p>
      </div>
    </div>
  )
}
