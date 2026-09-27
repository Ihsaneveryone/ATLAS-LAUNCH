import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncentiveBoomsaleRow } from './incentiveParser'
import { getTrackedProductArticleKey, seedNewlyQualifiedProducts, trackNewlyQualifiedProducts } from './incentiveProductTracker'

const product = (artikel: string) => ({ artikel }) as IncentiveBoomsaleRow
const trackerKey = 'atlas_incentive_product_tracker_v1'
const createStorage = (): Pick<Storage, 'getItem' | 'setItem'> => {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('trackNewlyQualifiedProducts', () => {
  let storage: Pick<Storage, 'getItem' | 'setItem'>

  beforeEach(() => {
    storage = createStorage()
    vi.restoreAllMocks()
  })

  it('uses the first successful list as a baseline without marking existing products new', () => {
    expect(trackNewlyQualifiedProducts([product('1001'), product('1002')], 1_000, storage)).toEqual(new Set())
    expect(trackNewlyQualifiedProducts([product('1001'), product('1002')], 2_000, storage)).toEqual(new Set())
  })

  it('marks a newly qualified product for less than three days', () => {
    trackNewlyQualifiedProducts([product('1001')], 1_000, storage)

    expect(trackNewlyQualifiedProducts([product('1001'), product('1002')], 2_000, storage)).toEqual(new Set(['1002']))
    expect(trackNewlyQualifiedProducts([product('1001'), product('1002')], 2_000 + 3 * 24 * 60 * 60 * 1000 - 1, storage))
      .toEqual(new Set(['1002']))
    expect(trackNewlyQualifiedProducts([product('1001'), product('1002')], 2_000 + 3 * 24 * 60 * 60 * 1000, storage))
      .toEqual(new Set())
  })

  it('marks a product as new again if it leaves and later re-enters the qualified list', () => {
    trackNewlyQualifiedProducts([product('1001')], 1_000, storage)
    trackNewlyQualifiedProducts([product('1001'), product('1002')], 2_000, storage)
    trackNewlyQualifiedProducts([product('1001')], 3_000, storage)

    expect(trackNewlyQualifiedProducts([product('1001'), product('1002')], 4_000, storage)).toEqual(new Set(['1002']))
  })

  it('normalizes article identifiers consistently for display', () => {
    expect(getTrackedProductArticleKey(' 10-01 ')).toBe('1001')
  })

  it('warns and returns no new products if browser storage is unavailable', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unavailableStorage = {
      getItem: () => { throw new Error('storage unavailable') },
      setItem: () => undefined,
    }

    expect(trackNewlyQualifiedProducts([product('1001')], 1_000, unavailableStorage)).toEqual(new Set())
    expect(warning).toHaveBeenCalledWith('[TV] Unable to read new product tracking data:', expect.any(Error))
  })

  it('persists its state in local storage', () => {
    trackNewlyQualifiedProducts([product('10-01')], 1_000, storage)

    expect(JSON.parse(storage.getItem(trackerKey) ?? '{}')).toMatchObject({
      qualifiedArticles: ['1001'],
      firstQualifiedAt: {},
    })
  })

  it('seeds a selected currently-qualified product once and expires its badge after three days', () => {
    trackNewlyQualifiedProducts([product('10669672')], 1_000, storage)

    expect(seedNewlyQualifiedProducts([product('10669672')], ['10669672'], 2_000, storage)).toEqual(new Set(['10669672']))
    expect(seedNewlyQualifiedProducts([product('10669672')], ['10669672'], 3_000, storage)).toEqual(new Set(['10669672']))
    expect(seedNewlyQualifiedProducts([product('10669672')], ['10669672'], 2_000 + 3 * 24 * 60 * 60 * 1000, storage)).toEqual(new Set())
  })

  it('does not seed an article until it qualifies', () => {
    trackNewlyQualifiedProducts([product('1001')], 1_000, storage)

    expect(seedNewlyQualifiedProducts([product('1001')], ['1002'], 2_000, storage)).toEqual(new Set())
    expect(JSON.parse(storage.getItem(trackerKey) ?? '{}').seededArticles).toEqual([])
  })
})
