import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearOnboardingCourt } from '../utils/onboardingCourt'
import type { Profile } from '../types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signInWithGoogle: (courtGroupId?: string) => Promise<void>
  signInWithMagicLink: (email: string, courtGroupId?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    // Get initial session (recommended by Supabase docs)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    // Listen for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async (courtGroupId?: string) => {
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (courtGroupId) callbackUrl.searchParams.set('court', courtGroupId)

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    })
  }

  const signInWithMagicLink = async (email: string, courtGroupId?: string) => {
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (courtGroupId) callbackUrl.searchParams.set('court', courtGroupId)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    })
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clearOnboardingCourt()
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signInWithGoogle,
        signInWithMagicLink,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
