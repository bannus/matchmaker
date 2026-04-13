export type Sport = 'tennis' | 'pickleball' | 'badminton'
export type MatchType = 'singles' | 'doubles'
export type MatchTypePreference = 'singles' | 'doubles' | 'both'
export type AvailabilityStatus = 'open' | 'matched' | 'expired' | 'cancelled'
export type MatchStatus = 'proposed' | 'confirmed' | 'completed' | 'cancelled'
export type PlayerResponse = 'pending' | 'accepted' | 'declined'
export type NotificationType =
  | 'match_proposed'
  | 'match_confirmed'
  | 'match_cancelled'
  | 'match_declined'
  | 'system'

export interface CourtGroup {
  id: string
  name: string
  description: string | null
  location_lat: number | null
  location_lng: number | null
  timezone: string
  created_by: string
  created_at: string
}

export interface Court {
  id: string
  court_group_id: string
  name: string
  sport: Sport
  surface_type: string | null
  is_lit: boolean
  notes: string | null
  created_at: string
}

export interface Profile {
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

export interface Availability {
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

export interface Match {
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

export interface MatchPlayer {
  match_id: string
  player_id: string
  response: PlayerResponse
  responded_at: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown> | null
  read: boolean
  created_at: string
}
