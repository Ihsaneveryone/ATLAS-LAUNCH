import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchPencapaianToko, todayTokoRow } from './tokoApi'

function csvResponse(text: string) {
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/csv' } })
}

describe('fetchPencapaianToko', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('reads daily Proteksi/New Member/Instant Upgrade from columns F/G/H', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse([
      'TITLE,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
      '01/07/2026,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
      'HEADER,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
      '1,01-07-2026,3,1232,343,14,2,4,100,200,0,300,400,0,500,600,700,800,0,900,1000,0,1100,1200,0,1300,1400,1500,1600,1700,1800,1900,0,2000,2100,0,2200,2300,2400,2500,2600,2700,2800,2900,3000,3100,3200,3300,3400,3500',
    ].join('\n'))))

    const rows = await fetchPencapaianToko()

    expect(rows[0]).toMatchObject({
      proteksi: 14,
      newMember: 2,
      instantUpgrade: 4,
    })
  })

  it('prioritizes the complete current date over a later day in the same month', () => {
    vi.setSystemTime(new Date(2026, 8, 1))

    const rows = [
      { date: '01-09-2026', salesDaily: 100, salesMTD: 100 },
      { date: '30-09-2026', salesDaily: 100, salesMTD: 100 },
    ] as Parameters<typeof todayTokoRow>[0]

    expect(todayTokoRow(rows)?.date).toBe('01-09-2026')
  })
})