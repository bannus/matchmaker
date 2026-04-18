import { createContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types'

export interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signInWithGoogle: (courtGroupId?: string) => Promise<void>
  signInWithMagicLink: (email: string, courtGroupId?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
