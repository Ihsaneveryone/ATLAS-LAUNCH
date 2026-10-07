import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPencapaianDept } from './deptApi'

function csvResponse(text: string) {
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/csv' } })
}

describe('fetchPencapaianDept', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reads department names, dates, and sales from the configured sheet ranges', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 7, 12))

    const dateHeader = Array(33).fill('')
    for (let day = 1; day <= 31; day++) dateHeader[day] = `${String(day).padStart(2, '0')}-10-2026`

    const departmentRows = Array.from({ length: 22 }, (_, index) => {
      const row = Array(33).fill('')
      row[0] = index === 0 ? 'HOBBIES & LIFESTYLE' : `Department ${index}`
      if (index === 1) {
        for (let day = 1; day <= 7; day++) row[day] = String(day)
      }
      return row
    })
    const salesRange = [dateHeader, ...departmentRows].map(row => row.join(',')).join('\n')

    const targetRows = Array.from({ length: 31 }, (_, index) => {
      const row = Array(23).fill('')
      row[2] = `10/${String(index + 1).padStart(2, '0')}/2026`
      row.fill('1000', 3)
      return row.join(',')
    }).join('\n')

    const requestedRanges: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const range = new URL(String(input)).searchParams.get('range') ?? ''
      requestedRanges.push(range)
      if (range === 'M76:AS98') return csvResponse(salesRange)
      if (range === 'U3:AQ33') return csvResponse(targetRows)
      return csvResponse('')
    }))

    const result = await fetchPencapaianDept()

    expect(requestedRanges).toEqual(expect.arrayContaining(['M76:AS98', 'U3:AQ33']))
    expect(result.sbd?.total).toBe(7)
    expect(result.sbd?.departments.find(department => department.label === 'Department 1')?.value).toBe(7)
    expect(result.mtd?.total).toBe(28)
    expect(result.trend.points.at(-1)).toMatchObject({ date: '07-10-2026', day: 7 })
  })
})
