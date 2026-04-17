const STORAGE_KEY = 'onboarding_court_group_id'
const TTL_MS = 60 * 60 * 1000 // 1 hour

interface StoredCourtContext {
  courtGroupId: string
  timestamp: number
}

export function storeOnboardingCourt(courtGroupId: string): void {
  const data: StoredCourtContext = {
    courtGroupId,
    timestamp: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getOnboardingCourt(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const data: StoredCourtContext = JSON.parse(raw)
    if (Date.now() - data.timestamp > TTL_MS) {
      clearOnboardingCourt()
      return null
    }
    return data.courtGroupId
  } catch {
    clearOnboardingCourt()
    return null
  }
}

export function clearOnboardingCourt(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// Validate that a string looks like a UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}
