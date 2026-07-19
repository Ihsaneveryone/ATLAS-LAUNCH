import { describe, expect, it } from 'vitest'
import { buildTodayPerf, buildMTDPerf, type DailySalesRow, type MTDRow } from './sheetsApi'
import { niksMatch, getNikVariants } from './nik'

describe('NIK matching', () => {
  it('getNikVariants should handle I01902 format correctly', () => {
    const variants = getNikVariants('I01902')
    expect(variants).toContain('I01902')
    expect(variants).toContain('101902')
    expect(variants).toContain('01902')
  })

  it('getNikVariants should handle 101902 format correctly', () => {
    const variants = getNikVariants('101902')
    expect(variants).toContain('101902')
    expect(variants).toContain('01902')
  })

  it('niksMatch should match I01902 with 101902', () => {
    expect(niksMatch('I01902', '101902')).toBe(true)
    expect(niksMatch('101902', 'I01902')).toBe(true)
  })

  it('uses the matching row when the current NIK uses an alternate format', () => {
    const rows: DailySalesRow[] = [
      {
        nik: '999999',
        nama: 'Other',
        jobTitle: 'Sales',
        totalSales: 100_000,
        targetSales: 200_000,
        transaksi: 1,
        qtyItem: 1,
        aur: 100_000,
        upt: 1,
        basketSize: 100_000,
        proteksi: 0,
        instantUpgrade: 0,
        newMember: 0,
      },
      {
        nik: '101902',
        nama: 'GWEN MALIKA',
        jobTitle: 'Sales',
        totalSales: 300_000,
        targetSales: 600_000,
        transaksi: 3,
        qtyItem: 3,
        aur: 100_000,
        upt: 1,
        basketSize: 100_000,
        proteksi: 0,
        instantUpgrade: 0,
        newMember: 0,
      },
    ]

    const perf = buildTodayPerf(rows, 'I01902')

    expect(perf.actual).toBe(300_000)
    expect(perf.target).toBe(600_000)
  })

  it('uses the matching MTD row when the current NIK uses an alternate format', () => {
    const rows: MTDRow[] = [
      {
        nik: '999999',
        nama: 'Other',
        jobTitle: 'Sales',
        sales: 100_000,
        target: 200_000,
        transaksi: 1,
        basketSize: 100_000,
        proteksi: 0,
        newMember: 0,
        instantUpgrade: 0,
        total5Strategy: 0,
        offCuti: 0,
      },
      {
        nik: '101902',
        nama: 'GWEN MALIKA',
        jobTitle: 'Sales',
        sales: 300_000,
        target: 600_000,
        transaksi: 3,
        basketSize: 100_000,
        proteksi: 0,
        newMember: 0,
        instantUpgrade: 0,
        total5Strategy: 0,
        offCuti: 0,
      },
    ]

    const perf = buildMTDPerf(rows, 'I01902', '01/07/2026', '31/07/2026')

    expect(perf.actual).toBe(300_000)
    expect(perf.target).toBe(600_000)
  })
})
