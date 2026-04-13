export interface MatchForCategorization {
  status: string
  date: string
  my_response: string
}

export type MatchCategory = 'pending' | 'upcoming' | 'past' | 'uncategorized'

export function categorizeMatch(match: MatchForCategorization, today: string): MatchCategory {
  // Pending: proposed matches where I haven't responded yet
  if (match.status === 'proposed' && match.my_response === 'pending') {
    return 'pending'
  }

  // Upcoming: confirmed future matches, or matches I accepted but opponent hasn't
  if (
    (match.status === 'confirmed' && match.date >= today) ||
    (match.status === 'proposed' && match.my_response === 'accepted')
  ) {
    return 'upcoming'
  }

  // Past: completed, cancelled, or confirmed matches in the past
  if (
    match.status === 'completed' ||
    match.status === 'cancelled' ||
    (match.status === 'confirmed' && match.date < today)
  ) {
    return 'past'
  }

  return 'uncategorized'
}

export function categorizeMatches<T extends MatchForCategorization>(matches: T[], today: string) {
  const pending = matches.filter((m) => categorizeMatch(m, today) === 'pending')
  const upcoming = matches.filter((m) => categorizeMatch(m, today) === 'upcoming')
  const past = matches.filter((m) => categorizeMatch(m, today) === 'past')
  return { pending, upcoming, past }
}
