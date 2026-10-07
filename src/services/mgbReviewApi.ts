import type { User } from '../data/mockData'

const SHEET_ID = '1fb5npFi1sEBYH5GleyP8FNj9W5bqq2AQU6cbyIsnoRM'

export interface MgbReview {
  date: string
  nik: string
  name: string
  department: string
  mgbPhotos: string[]
  checkerPhotos: string[]
  score: string
  category: string
  note: string
}

export interface MgbReviewResult {
  reviews: MgbReview[]
  error: string
}

interface MgbReviewCacheEntry {
  result: MgbReviewResult
  expiresAt: number
}

interface MgbSheetRow {
  date: string
  nik: string
  name: string
  department: string
  mgbPhotos: string[]
  checkerNik: string
  checkerName: string
  checkerPhotos: string[]
  score: string
  category: string
  note: string
}

const CACHE_TTL_MS = 10_000
const reviewCache = new Map<string, MgbReviewCacheEntry>()
const reviewRequests = new Map<string, Promise<MgbReviewResult>>()

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let cells: string[] = []
  let cell = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const character = text[i]
    if (inQuote) {
      if (character === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        cell += character
      }
    } else if (character === '"') {
      inQuote = true
    } else if (character === ',') {
      cells.push(cell)
      cell = ''
    } else if (character === '\r') {
      continue
    } else if (character === '\n') {
      cells.push(cell)
      if (cells.some(value => value.trim())) rows.push(cells)
      cells = []
      cell = ''
    } else {
      cell += character
    }
  }

  if (cell !== '' || cells.length > 0) {
    cells.push(cell)
    if (cells.some(value => value.trim())) rows.push(cells)
  }
  return rows
}

function cell(row: string[], index: number): string {
  return (row[index] ?? '').trim()
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')
}

function normalizeNik(value: string): string {
  return value.trim().toLocaleUpperCase('id-ID')
}

export function parseMgbDate(value: string): string | null {
  const text = value.trim()
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  const year = Number(iso?.[1] ?? local?.[3])
  const month = Number(iso?.[2] ?? local?.[2])
  const day = Number(iso?.[3] ?? local?.[1])
  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getYesterdayJakartaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)
  const day = Number(parts.find(part => part.type === 'day')?.value)
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1))
  return [
    yesterday.getUTCFullYear(),
    String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
    String(yesterday.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function photoUrl(value: string): string {
  const formula = value.match(/^=IMAGE\(\s*"([^"]+)"/i)
  const source = (formula?.[1] ?? value).trim()
  if (!source) return ''

  const driveFile = source.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)
  const driveId = source.match(/[?&]id=([^&#]+)/i)
  const id = driveFile?.[1] ?? driveId?.[1]
  if (id && /drive\.google\.com/i.test(source)) {
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
  }
  return source.startsWith('//') ? `https:${source}` : source
}

function parseRows(rows: string[][]): MgbSheetRow[] {
  return rows.slice(1).map(row => ({
    date: cell(row, 0),
    nik: cell(row, 1),
    name: cell(row, 2),
    department: cell(row, 3),
    mgbPhotos: [4, 5, 6].map(index => photoUrl(cell(row, index))).filter(Boolean),
    checkerNik: cell(row, 9),
    checkerName: cell(row, 10),
    checkerPhotos: [11, 12, 13].map(index => photoUrl(cell(row, index))).filter(Boolean),
    score: cell(row, 14),
    category: cell(row, 15),
    note: cell(row, 16),
  })).filter(row => row.nik || row.department)
}

export function selectYesterdayMgbReviews(
  csv: string,
  user: User,
  yesterday = getYesterdayJakartaDate(),
): MgbReview[] {
  const sheetRows = parseRows(parseCsv(csv))
  const loginNik = normalizeNik(user.nik)
  const profile = sheetRows
    .filter(row => normalizeNik(row.nik) === loginNik && row.department)
    .reduce<MgbSheetRow | null>((latest, row) => {
      const date = parseMgbDate(row.date)
      const latestDate = latest ? parseMgbDate(latest.date) : null
      return date && (!latestDate || date > latestDate) ? row : latest
    }, null)
  const department = profile?.department || user.departmentUser || ''
  if (!department) return []

  return sheetRows
    .filter(row => {
      if (parseMgbDate(row.date) !== yesterday || normalize(row.department) !== normalize(department)) return false
      return Boolean(row.checkerNik || row.checkerName || row.checkerPhotos.length || row.score || row.category || row.note)
    })
    .map(row => ({
      date: row.date,
      nik: row.nik,
      name: row.name,
      department: row.department,
      mgbPhotos: row.mgbPhotos,
      checkerPhotos: row.checkerPhotos,
      score: row.score,
      category: row.category,
      note: row.note,
    }))
}

async function requestYesterdayMgbReviews(user: User): Promise<MgbReview[]> {
  const endpoint = import.meta.env.VITE_MGB_REVIEW_ENDPOINT?.trim()
  if (!endpoint) {
    throw new Error('Foto langsung dari cell memerlukan endpoint Apps Script. Atur VITE_MGB_REVIEW_ENDPOINT setelah Web App selesai di-deploy.')
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__atlasMgbCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const callbacks = window as Window & Record<string, (result: { data?: MgbReview[]; error?: string }) => void>
    const script = document.createElement('script')
    const url = new URL(endpoint)
    url.searchParams.set('nik', user.nik)
    url.searchParams.set('callback', callbackName)

    const cleanup = () => {
      window.clearTimeout(timeout)
      delete callbacks[callbackName]
      script.remove()
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Waktu tunggu Apps Script habis. Pastikan Web App sudah di-deploy dan URL endpoint benar.'))
    }, 30_000)

    callbacks[callbackName] = result => {
      cleanup()
      if (result.error) {
        reject(new Error(result.error))
        return
      }
      if (!Array.isArray(result.data)) {
        reject(new Error('Apps Script mengirim respons yang tidak sesuai.'))
        return
      }
      resolve(result.data)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('Tidak dapat menghubungi Apps Script. Periksa URL endpoint dan akses Web App.'))
    }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}

function userCacheKey(user: User): string {
  return normalizeNik(user.nik)
}

export function getCachedYesterdayMgbReviews(user: User): MgbReviewResult | null {
  const entry = reviewCache.get(userCacheKey(user))
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) reviewCache.delete(userCacheKey(user))
    return null
  }
  return entry.result
}

export function loadYesterdayMgbReviews(user: User, forceRefresh = false): Promise<MgbReviewResult> {
  const key = userCacheKey(user)
  const cached = getCachedYesterdayMgbReviews(user)
  if (!forceRefresh && cached) return Promise.resolve(cached)

  const activeRequest = reviewRequests.get(key)
  if (!forceRefresh && activeRequest) return activeRequest

  const request = requestYesterdayMgbReviews(user).then<MgbReviewResult>(
    reviews => ({ reviews, error: '' }),
    reason => ({ reviews: [], error: reason instanceof Error ? reason.message : String(reason) }),
  ).then(result => {
    reviewCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  }).finally(() => {
    if (reviewRequests.get(key) === request) reviewRequests.delete(key)
  })

  reviewRequests.set(key, request)
  return request
}

export async function prefetchYesterdayMgbReviews(user: User): Promise<MgbReviewResult> {
  let retryDelay = 5_000
  while (true) {
    const result = await loadYesterdayMgbReviews(user, true)
    if (!result.error) return result

    await new Promise(resolve => window.setTimeout(resolve, retryDelay))
    retryDelay = Math.min(retryDelay * 2, 30_000)
  }
}
