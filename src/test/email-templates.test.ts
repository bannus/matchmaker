import { describe, it, expect } from 'vitest'
import { render } from '../../supabase/functions/send-notification-email/templates.ts'

const baseCtx = {
  recipientName: 'Alice',
  appUrl: 'https://example.test',
  whenLabel: 'Apr 26 at 10:00 AM',
  opponentName: 'Bob',
  courtGroupName: 'Community Park',
}

describe('email templates', () => {
  it('match_proposed renders subject, opponent name, when label, and CTA link', () => {
    const out = render('match_proposed', baseCtx)
    expect(out.subject.toLowerCase()).toContain('proposed')
    expect(out.html).toContain('Bob')
    expect(out.html).toContain('Apr 26 at 10:00 AM')
    expect(out.html).toContain('https://example.test/matches')
    expect(out.text).toContain('https://example.test/matches')
  })

  it('match_confirmed mentions confirmation', () => {
    const out = render('match_confirmed', baseCtx)
    expect(out.subject.toLowerCase()).toContain('confirmed')
    expect(out.html).toContain('confirmed')
  })

  it('match_cancelled and match_declined include CTA', () => {
    for (const t of ['match_cancelled', 'match_declined'] as const) {
      const out = render(t, baseCtx)
      expect(out.html).toContain('https://example.test/matches')
      expect(out.text).toContain('https://example.test/matches')
    }
  })

  it('always includes a manage-preferences link in the footer', () => {
    const out = render('match_proposed', baseCtx)
    expect(out.html).toContain('https://example.test/profile')
    expect(out.text).toContain('https://example.test/profile')
  })

  it('escapes HTML in user-supplied fields to prevent injection', () => {
    const out = render('match_proposed', {
      ...baseCtx,
      recipientName: '<script>alert(1)</script>',
      opponentName: 'Mallory" onmouseover="x',
    })
    expect(out.html).not.toContain('<script>alert(1)</script>')
    expect(out.html).toContain('&lt;script&gt;')
    expect(out.html).not.toMatch(/onmouseover="x/)
  })

  it('handles missing match context without crashing', () => {
    const out = render('match_proposed', {
      recipientName: 'Alice',
      appUrl: 'https://example.test',
      whenLabel: null,
      opponentName: null,
      courtGroupName: null,
    })
    expect(out.subject).toBeTruthy()
    expect(out.html).toContain('https://example.test/matches')
  })

  it('falls back to a generic greeting when recipient name is empty', () => {
    const out = render('match_proposed', { ...baseCtx, recipientName: '' })
    expect(out.html.toLowerCase()).toContain('hi there')
    expect(out.text.toLowerCase()).toContain('hi there')
  })
})
