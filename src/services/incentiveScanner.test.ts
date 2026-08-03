import { describe, expect, it } from 'vitest'
import { resolveScanResult } from './incentiveScanner'
import type { ParsedIncentiveData } from './incentiveParser'

describe('resolveScanResult', () => {
  it('matches a scanned SKU to incentive data and related syarat rows', () => {
    const data: ParsedIncentiveData = {
      conditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
      unconditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
      sku: {
        rows: [
          {
            sku: 'SKU-001',
            name: 'Produk A',
            requirement: 'Beli 10 unit',
            incentiveValue: 500000,
            per: 'unit',
            imageUrl: '',
          },
        ],
        totalTarget: 0,
        totalAchieved: 0,
      },
      syarat: {
        rows: [
          {
            jenis: 'Proteksi',
            syarat: 'Beli 10 unit produk A',
            note: 'Syarat utama',
            articleList: ['SKU-001'],
            acvValue: 0,
            incentiveValuePerQty: 50000,
            fields: [],
          },
        ],
      },
      boomsale: {
        rows: [
          {
            artikel: 'ART-900',
            name: 'Produk Boom',
            departemen: 'Food',
            price: 10000,
            priceSource: 'e',
            incentivePercent: 5,
            incentiveNominal: 0,
            incentiveValue: 500,
            incentiveIsPercentage: true,
            remark: 'Boomsale',
            category: 'Promosi',
            imageUrl: '',
            fields: [],
          },
        ],
      },
      receipt: { rows: [] },
    }

    const result = resolveScanResult('sku-001', data)

    expect(result.isIncentive).toBe(true)
    expect(result.skuMatch?.sku).toBe('SKU-001')
    expect(result.matchingSyaratRows).toHaveLength(1)
    expect(result.matchingSyaratRows[0].jenis).toBe('Proteksi')
  })

  it('returns a no-match result when no incentive data matches the scanned code', () => {
    const data: ParsedIncentiveData = {
      conditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
      unconditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
      sku: { rows: [], totalTarget: 0, totalAchieved: 0 },
      syarat: { rows: [] },
      boomsale: { rows: [] },
      receipt: { rows: [] },
    }

    const result = resolveScanResult('UNKNOWN-123', data)

    expect(result.isIncentive).toBe(false)
    expect(result.skuMatch).toBeNull()
    expect(result.boomsaleMatch).toBeNull()
  })
})
