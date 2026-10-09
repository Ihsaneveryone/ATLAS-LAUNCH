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
      const day = index + 1
      const row = Array(24).fill('')
      row[1] = `10/${String(index + 1).padStart(2, '0')}/2026`
      row[2] = String(day * 700)
      row[9] = String(day * 800)
      row[18] = String(day * 500)
      for (const targetIndex of [
        ...Array.from({ length: 6 }, (_, item) => item + 3),
        ...Array.from({ length: 8 }, (_, item) => item + 10),
        ...Array.from({ length: 4 }, (_, item) => item + 19),
      ]) {
        row[targetIndex] = String(day * 100)
      }
      return row.join(',')
    }).join('\n')

    const requestedRanges: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const range = new URL(String(input)).searchParams.get('range') ?? ''
      requestedRanges.push(range)
      if (range === 'M76:AS98') return csvResponse(salesRange)
      if (range === 'U3:AR33') return csvResponse(targetRows)
      return csvResponse('')
    }))

    const result = await fetchPencapaianDept()

    expect(requestedRanges).toEqual(expect.arrayContaining(['M76:AS98', 'U3:AR33']))
    expect(result.sbd?.total).toBe(7)
    expect(result.sbd?.departments.find(department => department.label === 'Department 1')?.value).toBe(7)
    expect(result.sbd?.departments.find(department => department.label === 'Department 1')?.achievement).toBe(7)
    expect(result.sbd?.zones.find(zone => zone.zone === 'Hobbies & Lifestyle')?.target).toBe(700)
    expect(result.sbd?.zones.find(zone => zone.zone === 'Hobbies & Lifestyle')?.achievement).toBe(1)
    expect(result.sbd?.zones.find(zone => zone.zone === 'Home Improvement')?.target).toBe(800)
    expect(result.sbd?.zones.find(zone => zone.zone === 'Home Living')?.target).toBe(500)
    expect(result.sbd?.departments.at(-1)?.target).toBe(100)
    expect(result.sbd?.departments.at(-1)?.achievement).toBe(0)
    expect(result.mtd?.total).toBe(28)
    expect(result.mtd?.departments.find(department => department.label === 'Department 1')?.achievement).toBe(4)
    expect(result.mtd?.departments.at(-1)?.target).toBe(700)
    expect(result.mtd?.departments.at(-1)?.achievement).toBe(0)
    expect(result.mtd?.zones.find(zone => zone.zone === 'Hobbies & Lifestyle')?.target).toBe(4900)
    expect(result.trend.points.at(-1)).toMatchObject({ date: '07-10-2026', day: 7 })
  })
})
