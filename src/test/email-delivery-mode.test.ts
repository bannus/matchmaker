import { describe, expect, it } from 'vitest'
import {
  parseEmailDeliveryMode,
} from '../../supabase/functions/send-notification-email/delivery-mode.ts'

describe('parseEmailDeliveryMode', () => {
  it('defaults blank values to resend', () => {
    expect(parseEmailDeliveryMode(undefined)).toBe('resend')
    expect(parseEmailDeliveryMode(null)).toBe('resend')
    expect(parseEmailDeliveryMode('')).toBe('resend')
    expect(parseEmailDeliveryMode('   ')).toBe('resend')
  })

  it('accepts resend and log-only values case-insensitively', () => {
    expect(parseEmailDeliveryMode('resend')).toBe('resend')
    expect(parseEmailDeliveryMode(' ReSeNd ')).toBe('resend')
    expect(parseEmailDeliveryMode('log-only')).toBe('log-only')
    expect(parseEmailDeliveryMode(' LOG-ONLY ')).toBe('log-only')
  })

  it('rejects unknown values', () => {
    expect(parseEmailDeliveryMode('dev-mode')).toBeNull()
    expect(parseEmailDeliveryMode('stub')).toBeNull()
  })
})
