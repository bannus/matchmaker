import { describe, expect, it } from 'vitest'
import { normalizeRequiredEnv } from '../../supabase/functions/_shared/env.ts'

describe('normalizeRequiredEnv', () => {
  it('returns a trimmed non-empty value', () => {
    expect(normalizeRequiredEnv('  secret-value  ')).toBe('secret-value')
  })

  it('returns null for nullish or blank values', () => {
    expect(normalizeRequiredEnv(undefined)).toBeNull()
    expect(normalizeRequiredEnv(null)).toBeNull()
    expect(normalizeRequiredEnv('')).toBeNull()
    expect(normalizeRequiredEnv('   ')).toBeNull()
  })
})
