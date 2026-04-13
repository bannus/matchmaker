import { describe, it, expect } from 'vitest'
import { generateGoogleCalendarUrl, generateICalEvent } from '../utils/calendar'

const baseEvent = {
  date: '2026-04-15',
  start_time: '10:00',
  end_time: '11:30',
  match_type: 'singles',
  opponents: ['Alice'],
}

describe('generateGoogleCalendarUrl', () => {
  it('returns a valid Google Calendar URL', () => {
    const url = generateGoogleCalendarUrl(baseEvent)
    expect(url).toContain('https://calendar.google.com/calendar/render')
    expect(url).toContain('action=TEMPLATE')
  })

  it('includes formatted date/time', () => {
    const url = generateGoogleCalendarUrl(baseEvent)
    expect(url).toContain('20260415T100000')
    expect(url).toContain('20260415T113000')
  })

  it('includes match type and opponent name in title', () => {
    const url = decodeURIComponent(generateGoogleCalendarUrl(baseEvent))
    expect(url).toContain('singles')
    expect(url).toContain('Alice')
  })

  it('includes location when provided', () => {
    const url = generateGoogleCalendarUrl({ ...baseEvent, location: 'Central Park Courts' })
    expect(url).toContain('location=')
    expect(url).toContain('Central')
    expect(url).toContain('Courts')
  })

  it('handles multiple opponents', () => {
    const url = decodeURIComponent(
      generateGoogleCalendarUrl({ ...baseEvent, match_type: 'doubles', opponents: ['Alice', 'Bob'] })
    )
    expect(url).toContain('Alice')
    expect(url).toContain('Bob')
  })
})

describe('generateICalEvent', () => {
  it('generates valid iCal format', () => {
    const ical = generateICalEvent(baseEvent)
    expect(ical).toContain('BEGIN:VCALENDAR')
    expect(ical).toContain('END:VCALENDAR')
    expect(ical).toContain('BEGIN:VEVENT')
    expect(ical).toContain('END:VEVENT')
  })

  it('includes correct date/time', () => {
    const ical = generateICalEvent(baseEvent)
    expect(ical).toContain('DTSTART:20260415T100000')
    expect(ical).toContain('DTEND:20260415T113000')
  })

  it('includes match details in summary', () => {
    const ical = generateICalEvent(baseEvent)
    expect(ical).toContain('SUMMARY:Tennis singles')
    expect(ical).toContain('Alice')
  })

  it('includes location when provided', () => {
    const ical = generateICalEvent({ ...baseEvent, location: 'Court 3' })
    expect(ical).toContain('LOCATION:Court 3')
  })

  it('omits location line when not provided', () => {
    const ical = generateICalEvent(baseEvent)
    expect(ical).not.toContain('LOCATION:')
  })

  it('uses CRLF line endings per iCal spec', () => {
    const ical = generateICalEvent(baseEvent)
    expect(ical).toContain('\r\n')
    // Should not have bare LF without CR
    const lines = ical.split('\r\n')
    expect(lines.length).toBeGreaterThan(5)
  })
})
