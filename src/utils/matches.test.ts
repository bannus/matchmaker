import { describe, it, expect } from 'vitest'
import { categorizeMatch, categorizeMatches } from '../utils/matches'

const TODAY = '2026-04-14'
const FUTURE = '2026-04-20'
const PAST = '2026-04-10'

function makeMatch(overrides: Partial<{ status: string; date: string; my_response: string }>) {
  return {
    status: 'proposed',
    date: FUTURE,
    my_response: 'pending',
    ...overrides,
  }
}

describe('categorizeMatch', () => {
  describe('pending', () => {
    it('proposed match where I have not responded', () => {
      expect(categorizeMatch(makeMatch({ status: 'proposed', my_response: 'pending' }), TODAY)).toBe('pending')
    })

    it('proposed match where I declined is NOT pending', () => {
      expect(categorizeMatch(makeMatch({ status: 'proposed', my_response: 'declined' }), TODAY)).not.toBe('pending')
    })
  })

  describe('upcoming', () => {
    it('confirmed match in the future', () => {
      expect(categorizeMatch(makeMatch({ status: 'confirmed', date: FUTURE }), TODAY)).toBe('upcoming')
    })

    it('confirmed match today', () => {
      expect(categorizeMatch(makeMatch({ status: 'confirmed', date: TODAY }), TODAY)).toBe('upcoming')
    })

    it('proposed match where I accepted (awaiting opponent)', () => {
      expect(categorizeMatch(makeMatch({ status: 'proposed', my_response: 'accepted' }), TODAY)).toBe('upcoming')
    })
  })

  describe('past', () => {
    it('completed match', () => {
      expect(categorizeMatch(makeMatch({ status: 'completed', date: PAST }), TODAY)).toBe('past')
    })

    it('cancelled match', () => {
      expect(categorizeMatch(makeMatch({ status: 'cancelled', date: FUTURE }), TODAY)).toBe('past')
    })

    it('confirmed match in the past', () => {
      expect(categorizeMatch(makeMatch({ status: 'confirmed', date: PAST }), TODAY)).toBe('past')
    })
  })

  describe('edge cases', () => {
    it('every match falls into exactly one category', () => {
      const combos = [
        { status: 'proposed', my_response: 'pending' },
        { status: 'proposed', my_response: 'accepted' },
        { status: 'proposed', my_response: 'declined' },
        { status: 'confirmed', date: FUTURE },
        { status: 'confirmed', date: PAST },
        { status: 'completed' },
        { status: 'cancelled' },
      ]

      for (const combo of combos) {
        const result = categorizeMatch(makeMatch(combo), TODAY)
        expect(['pending', 'upcoming', 'past', 'uncategorized']).toContain(result)
      }
    })

    it('declined proposal does not vanish (categorized as past or uncategorized)', () => {
      const result = categorizeMatch(makeMatch({ status: 'proposed', my_response: 'declined' }), TODAY)
      // A declined proposal should either be cancelled (past) by the respond() handler,
      // or at minimum not disappear from all categories
      expect(result).not.toBe('pending')
      expect(result).not.toBe('upcoming')
    })
  })
})

describe('categorizeMatches', () => {
  it('separates a mixed list into correct buckets', () => {
    const matches = [
      makeMatch({ status: 'proposed', my_response: 'pending' }),
      makeMatch({ status: 'confirmed', date: FUTURE }),
      makeMatch({ status: 'proposed', my_response: 'accepted' }),
      makeMatch({ status: 'cancelled' }),
      makeMatch({ status: 'completed', date: PAST }),
    ]

    const { pending, upcoming, past } = categorizeMatches(matches, TODAY)

    expect(pending).toHaveLength(1)
    expect(upcoming).toHaveLength(2) // confirmed + accepted-awaiting
    expect(past).toHaveLength(2) // cancelled + completed
  })

  it('returns empty arrays when no matches', () => {
    const { pending, upcoming, past } = categorizeMatches([], TODAY)
    expect(pending).toHaveLength(0)
    expect(upcoming).toHaveLength(0)
    expect(past).toHaveLength(0)
  })
})
