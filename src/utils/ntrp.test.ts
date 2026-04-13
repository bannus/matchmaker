import { describe, it, expect } from 'vitest'
import { getNtrpLabel, ntrpLevels } from '../utils/ntrp'

describe('ntrpLevels', () => {
  it('contains levels from 1.5 to 5.0 in 0.5 increments', () => {
    const ratings = ntrpLevels.map((l) => l.rating)
    expect(ratings).toEqual([1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0])
  })

  it('every level has a label, description, and at least one detail', () => {
    for (const level of ntrpLevels) {
      expect(level.label).toBeTruthy()
      expect(level.shortDescription).toBeTruthy()
      expect(level.details.length).toBeGreaterThan(0)
    }
  })
})

describe('getNtrpLabel', () => {
  it('returns formatted label for known rating', () => {
    expect(getNtrpLabel(3.5)).toBe('3.5 — Strong Intermediate')
    expect(getNtrpLabel(1.5)).toBe('1.5 — New Player')
    expect(getNtrpLabel(5.0)).toBe('5 — Tournament Player')
  })

  it('returns raw number string for unknown rating', () => {
    expect(getNtrpLabel(2.7)).toBe('2.7')
    expect(getNtrpLabel(6.0)).toBe('6')
  })
})
