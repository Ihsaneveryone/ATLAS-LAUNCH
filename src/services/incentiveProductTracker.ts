import type { IncentiveBoomsaleRow } from './incentiveParser'

const STORAGE_KEY = 'atlas_incentive_product_tracker_v1'
const NEW_PRODUCT_DURATION_MS = 3 * 24 * 60 * 60 * 1000

interface ProductTrackerState {
  version: 1
  qualifiedArticles: string[]
  firstQualifiedAt: Record<string, number>
  seededArticles?: string[]
}

function articleKey(article: string): string {
  return article.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function isTrackerState(value: unknown): value is ProductTrackerState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<ProductTrackerState>
  return state.version === 1
    && Array.isArray(state.qualifiedArticles)
    && state.qualifiedArticles.every((article) => typeof article === 'string')
    && !!state.firstQualifiedAt
    && typeof state.firstQualifiedAt === 'object'
    && Object.values(state.firstQualifiedAt).every((timestamp) => typeof timestamp === 'number' && Number.isFinite(timestamp))
    && (state.seededArticles === undefined || (Array.isArray(state.seededArticles) && state.seededArticles.every((article) => typeof article === 'string')))
}

export function trackNewlyQualifiedProducts(
  products: IncentiveBoomsaleRow[],
  now = Date.now(),
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): Set<string> {
  const currentArticles = [...new Set(products.map((product) => articleKey(product.artikel)).filter(Boolean))]
  let trackerStorage: Pick<Storage, 'getItem' | 'setItem'>
  let storedValue: string | null

  try {
    trackerStorage = storage ?? window.localStorage
    storedValue = trackerStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[TV] Unable to read new product tracking data:', error)
    return new Set()
  }

  let previousState: ProductTrackerState | null = null
  if (storedValue !== null) {
    try {
      const parsed: unknown = JSON.parse(storedValue)
      if (isTrackerState(parsed)) previousState = parsed
      else console.warn('[TV] Invalid new product tracking data; resetting its baseline.')
    } catch (error) {
      console.warn('[TV] Unable to parse new product tracking data; resetting its baseline:', error)
    }
  }

  const previousArticles = new Set(previousState?.qualifiedArticles ?? [])
  const currentSet = new Set(currentArticles)
  const firstQualifiedAt: Record<string, number> = {}

  if (previousState) {
    for (const article of currentArticles) {
      const firstSeen = previousState.firstQualifiedAt[article]
      if (firstSeen !== undefined && now >= firstSeen && now - firstSeen < NEW_PRODUCT_DURATION_MS) {
        firstQualifiedAt[article] = firstSeen
      } else if (!previousArticles.has(article)) {
        firstQualifiedAt[article] = now
      }
    }
  }

  const nextState: ProductTrackerState = {
    version: 1,
    qualifiedArticles: currentArticles,
    firstQualifiedAt,
    seededArticles: previousState?.seededArticles ?? [],
  }
  try {
    trackerStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  } catch (error) {
    console.warn('[TV] Unable to save new product tracking data:', error)
  }

  return new Set(Object.keys(firstQualifiedAt).filter((article) => currentSet.has(article)))
}

export function seedNewlyQualifiedProducts(
  products: IncentiveBoomsaleRow[],
  articles: string[],
  now = Date.now(),
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): Set<string> {
  let trackerStorage: Pick<Storage, 'getItem' | 'setItem'>
  let storedValue: string | null
  try {
    trackerStorage = storage ?? window.localStorage
    storedValue = trackerStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[TV] Unable to read new product tracking data:', error)
    return new Set()
  }

  if (storedValue === null) return new Set()

  let state: ProductTrackerState
  try {
    const parsed: unknown = JSON.parse(storedValue)
    if (!isTrackerState(parsed)) return new Set()
    state = parsed
  } catch (error) {
    console.warn('[TV] Unable to parse new product tracking data:', error)
    return new Set()
  }

  const eligibleArticles = new Set(products.map((product) => articleKey(product.artikel)).filter(Boolean))
  const seededArticles = new Set(state.seededArticles ?? [])
  const newlySeeded = new Set<string>()

  for (const rawArticle of articles) {
    const article = articleKey(rawArticle)
    if (!article || !eligibleArticles.has(article) || seededArticles.has(article)) continue
    state.firstQualifiedAt[article] = now
    seededArticles.add(article)
    newlySeeded.add(article)
  }

  if (newlySeeded.size > 0) {
    state.seededArticles = [...seededArticles]
    try {
      trackerStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.warn('[TV] Unable to save new product tracking data:', error)
    }
  }

  return new Set([...seededArticles].filter((article) => {
    const firstSeen = state.firstQualifiedAt[article]
    return eligibleArticles.has(article)
      && firstSeen !== undefined
      && now >= firstSeen
      && now - firstSeen < NEW_PRODUCT_DURATION_MS
  }))
}

export function getTrackedProductArticleKey(article: string): string {
  return articleKey(article)
}
