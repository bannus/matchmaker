import { describe, it, expect } from 'vitest'
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../../supabase/functions/send-notification-email/unsubscribe-token.ts'

const SECRET = 'test-secret-do-not-use-in-prod'

describe('unsubscribe-token', () => {
  it('round-trips a valid token', async () => {
    const token = await signUnsubscribeToken('user-1', 'match_proposed', SECRET)
    const payload = await verifyUnsubscribeToken(token, SECRET)
    expect(payload).not.toBeNull()
    expect(payload!.uid).toBe('user-1')
    expect(payload!.type).toBe('match_proposed')
    expect(typeof payload!.iat).toBe('number')
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signUnsubscribeToken('user-1', 'match_proposed', SECRET)
    const payload = await verifyUnsubscribeToken(token, 'other-secret')
    expect(payload).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signUnsubscribeToken('user-1', 'match_proposed', SECRET)
    const [, sig] = token.split('.')
    // Replace payload with a different user but keep the original signature.
    const fakePayload = btoa(
      JSON.stringify({ uid: 'attacker', type: 'match_proposed', iat: 0 }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const tampered = `${fakePayload}.${sig}`
    const payload = await verifyUnsubscribeToken(tampered, SECRET)
    expect(payload).toBeNull()
  })

  it('rejects malformed tokens', async () => {
    expect(await verifyUnsubscribeToken('', SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken('only-one-part', SECRET)).toBeNull()
    expect(
      await verifyUnsubscribeToken('a.b.c', SECRET),
    ).toBeNull()
  })

  it('rejects tokens carrying an unknown type', async () => {
    // Forge a token where the *signature is valid* but the type is not one of
    // the four allowed values. The verifier should still reject on the
    // type-allowlist check.
    const payload = btoa(JSON.stringify({ uid: 'u', type: 'system', iat: 1 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    // Sign that payload manually with the correct key.
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sigBytes = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
    )
    let bin = ''
    for (let i = 0; i < sigBytes.length; i++) bin += String.fromCharCode(sigBytes[i])
    const sig = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = `${payload}.${sig}`
    expect(await verifyUnsubscribeToken(token, SECRET)).toBeNull()
  })
})
