const STORAGE_KEY = 'atlas_sid_update_tracker_v1'

export interface SIDUpdateState {
  signature: string | null
  updatedAt: string | null
}

interface StoredSIDUpdateState {
  version: 1
  signature: string
  updatedAt: string | null
}

type TrackerStorage = Pick<Storage, 'getItem' | 'setItem'>

function getStorage(storage?: TrackerStorage): TrackerStorage {
  return storage ?? window.localStorage
}

function isStoredState(value: unknown): value is StoredSIDUpdateState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<StoredSIDUpdateState>
  return state.version === 1
    && typeof state.signature === 'string'
    && (state.updatedAt === null || typeof state.updatedAt === 'string')
}

export function readSIDUpdateState(storage?: TrackerStorage): SIDUpdateState {
  try {
    const stored = getStorage(storage).getItem(STORAGE_KEY)
    if (!stored) return { signature: null, updatedAt: null }

    const parsed: unknown = JSON.parse(stored)
    if (!isStoredState(parsed)) {
      console.warn('[TV] Invalid SID update tracking data; resetting its baseline.')
      return { signature: null, updatedAt: null }
    }
    return { signature: parsed.signature, updatedAt: parsed.updatedAt }
  } catch (error) {
    console.warn('[TV] Unable to read SID update tracking data:', error)
    return { signature: null, updatedAt: null }
  }
}

export function saveSIDUpdateState(state: SIDUpdateState, storage?: TrackerStorage): void {
  if (!state.signature) return

  try {
    const stored: StoredSIDUpdateState = {
      version: 1,
      signature: state.signature,
      updatedAt: state.updatedAt,
    }
    getStorage(storage).setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch (error) {
    console.warn('[TV] Unable to save SID update tracking data:', error)
  }
}
