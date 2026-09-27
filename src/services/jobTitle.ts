export function normalizeJobTitle(value?: string): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''

  const key = raw.toUpperCase().replace(/\s+/g, ' ')
  const map: Record<string, string> = {
    SPV: 'SUPERVISOR',
    SUPERVISOR: 'SUPERVISOR',
    ADV: 'ADVISOR',
    ADVISOR: 'ADVISOR',
    CCR: 'CASHIER',
    CASHIER: 'CASHIER',
    CS: 'CUSTOMER SERVICE',
    'CUSTOMER SERVICE': 'CUSTOMER SERVICE',
  }

  return map[key] ?? raw
}
