interface CalendarEvent {
  date: string       // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string   // HH:MM
  match_type: string
  opponents: string[]
  location?: string
}

function formatDateTimeForGoogle(date: string, time: string): string {
  // Google Calendar expects: 20260415T100000
  const d = date.replace(/-/g, '')
  const t = time.replace(/:/g, '') + '00'
  return `${d}T${t}`
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const title = `Tennis ${event.match_type} — ${event.opponents.join(', ')}`
  const start = formatDateTimeForGoogle(event.date, event.start_time)
  const end = formatDateTimeForGoogle(event.date, event.end_time)
  const details = `${event.match_type.charAt(0).toUpperCase() + event.match_type.slice(1)} match with ${event.opponents.join(' & ')}\n\nOrganized via Matchmaker 🎾`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details,
    ...(event.location ? { location: event.location } : {}),
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function generateICalEvent(event: CalendarEvent): string {
  const title = `Tennis ${event.match_type} — ${event.opponents.join(', ')}`
  const start = formatDateTimeForGoogle(event.date, event.start_time)
  const end = formatDateTimeForGoogle(event.date, event.end_time)
  const description = `${event.match_type.charAt(0).toUpperCase() + event.match_type.slice(1)} match with ${event.opponents.join(' & ')}. Organized via Matchmaker.`
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Matchmaker//Tennis//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    ...(event.location ? [`LOCATION:${event.location}`] : []),
    `DTSTAMP:${now}`,
    `UID:${crypto.randomUUID()}@matchmaker`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadICalFile(icsContent: string, filename: string) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
