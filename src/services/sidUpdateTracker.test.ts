import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readSIDUpdateState, saveSIDUpdateState } from './sidUpdateTracker'

const storageKey = 'atlas_sid_update_tracker_v1'

function createStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('SID update tracking persistence', () => {
  let storage: Pick<Storage, 'getItem' | 'setItem'>

  beforeEach(() => {
    storage = createStorage()
    vi.restoreAllMocks()
  })

  it('starts with no previous signature', () => {
    expect(readSIDUpdateState(storage)).toEqual({ signature: null, updatedAt: null })
  })

  it('persists and restores the latest signature and detected update time', () => {
    const state = { signature: 'csv-signature-2', updatedAt: '2026-09-27T08:00:00.000Z' }

    saveSIDUpdateState(state, storage)

    expect(readSIDUpdateState(storage)).toEqual(state)
    expect(JSON.parse(storage.getItem(storageKey) ?? '{}')).toMatchObject({
      version: 1,
      signature: state.signature,
      updatedAt: state.updatedAt,
    })
  })

  it('keeps a baseline signature when there is no detected update time', () => {
    const state = { signature: 'initial-signature', updatedAt: null }
    saveSIDUpdateState(state, storage)

    expect(readSIDUpdateState(storage)).toEqual(state)
  })

  it('reports invalid persisted values and returns an empty baseline', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    storage.setItem(storageKey, '{invalid json')

    expect(readSIDUpdateState(storage)).toEqual({ signature: null, updatedAt: null })
    expect(warning).toHaveBeenCalledWith('[TV] Unable to read SID update tracking data:', expect.any(SyntaxError))
  })

  it('does not throw when browser storage is unavailable', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unavailableStorage = {
      getItem: () => { throw new Error('storage unavailable') },
      setItem: () => { throw new Error('storage unavailable') },
    }

    expect(readSIDUpdateState(unavailableStorage)).toEqual({ signature: null, updatedAt: null })
    expect(() => saveSIDUpdateState({ signature: 'sig', updatedAt: null }, unavailableStorage)).not.toThrow()
    expect(warning).toHaveBeenCalledTimes(2)
  })
})
