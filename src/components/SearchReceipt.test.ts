import { describe, expect, it } from 'vitest'
import { codeContainsFilter } from './SearchReceipt'

describe('Search Receipt code filters', () => {
  it('matches article codes when the filter includes punctuation', () => {
    expect(codeContainsFilter('A321', 'A321.')).toBe(true)
  })

  it('matches receipt numbers regardless of common separators', () => {
    expect(codeContainsFilter('RC-001.25', 'rc00125')).toBe(true)
  })
})
