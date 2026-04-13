// Supabase-generated database types
// In production, generate this with: npx supabase gen types typescript --local
// For now, we define the shape manually to match our schema

import type {
  Sport,
  MatchType,
  MatchTypePreference,
  AvailabilityStatus,
  MatchStatus,
  PlayerResponse,
  NotificationType,
} from './models'

export interface Database {
  public: {
    Tables: {
      court_groups: {
        Row: {
          id: string
          name: string
          description: string | null
          location_lat: number | null
          location_lng: number | null
          timezone: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          timezone?: string
          created_by: string
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          location_lat?: number | null
          location_lng?: number | null
          timezone?: string
        }
      }
      courts: {
        Row: {
          id: string
          court_group_id: string
          name: string
          sport: Sport
          surface_type: string | null
          is_lit: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          court_group_id: string
          name: string
          sport?: Sport
          surface_type?: string | null
          is_lit?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          sport?: Sport
          surface_type?: string | null
          is_lit?: boolean
          notes?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          bio: string | null
          ntrp_rating: number | null
          preferred_match_type: MatchTypePreference
          notification_email: boolean
          notification_in_app: boolean
          court_group_id: string | null
          is_admin: boolean
          is_banned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          bio?: string | null
          ntrp_rating?: number | null
          preferred_match_type?: MatchTypePreference
          notification_email?: boolean
          notification_in_app?: boolean
          court_group_id?: string | null
          is_admin?: boolean
          is_banned?: boolean
        }
        Update: {
          display_name?: string
          bio?: string | null
          ntrp_rating?: number | null
          preferred_match_type?: MatchTypePreference
          notification_email?: boolean
          notification_in_app?: boolean
          court_group_id?: string | null
        }
      }
      availability: {
        Row: {
          id: string
          player_id: string
          court_group_id: string
          date: string
          start_time: string
          end_time: string
          match_type: MatchTypePreference
          status: AvailabilityStatus
          notes: string | null
          recurrence_rule: string | null
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          court_group_id: string
          date: string
          start_time: string
          end_time: string
          match_type?: MatchTypePreference
          status?: AvailabilityStatus
          notes?: string | null
          recurrence_rule?: string | null
        }
        Update: {
          date?: string
          start_time?: string
          end_time?: string
          match_type?: MatchTypePreference
          status?: AvailabilityStatus
          notes?: string | null
          recurrence_rule?: string | null
        }
      }
      matches: {
        Row: {
          id: string
          court_group_id: string
          match_type: MatchType
          date: string
          start_time: string
          end_time: string
          status: MatchStatus
          court_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          court_group_id: string
          match_type: MatchType
          date: string
          start_time: string
          end_time: string
          status?: MatchStatus
          court_id?: string | null
        }
        Update: {
          status?: MatchStatus
          court_id?: string | null
        }
      }
      match_players: {
        Row: {
          match_id: string
          player_id: string
          response: PlayerResponse
          responded_at: string | null
        }
        Insert: {
          match_id: string
          player_id: string
          response?: PlayerResponse
          responded_at?: string | null
        }
        Update: {
          response?: PlayerResponse
          responded_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          body: string
          data: Record<string, unknown> | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          title: string
          body: string
          data?: Record<string, unknown> | null
          read?: boolean
        }
        Update: {
          read?: boolean
        }
      }
    }
  }
}
