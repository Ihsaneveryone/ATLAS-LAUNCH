export const TV_MEDIA_FOLDER_URL = 'https://drive.google.com/drive/folders/164ITV_OLwMXw9LtWYY6Fo_JmmfzFQMda'
const TV_MEDIA_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyIL8ZMvUw81mrYBVUKpN2DqelSJm7wkgtR-5vHkeLvDbu0qORZxhc86RBdRp5hUrme/exec'
const TV_SETTINGS_SHEET_ID = '1CBz9oPc9FMiEu545NX-wJZl_fzUsX_rqggtVwaAlM7k'
const TV_SETTINGS_MEDIA_GID = '1579358833'

export interface TvMediaSlide {
  id: string
  name: string
  mimeType: string
  updatedAt: string
  url: string
  durationSeconds?: number
}

interface TvMediaResponse {
  data?: unknown
  error?: string
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some(value => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (cell || row.length) {
    row.push(cell)
    if (row.some(value => value.trim())) rows.push(row)
  }
  return rows
}

export async function fetchTvTikTokPostIds(): Promise<string[]> {
  const sheetUrl = new URL(`https://docs.google.com/spreadsheets/d/${TV_SETTINGS_SHEET_ID}/gviz/tq`)
  sheetUrl.searchParams.set('tqx', 'out:csv')
  sheetUrl.searchParams.set('gid', TV_SETTINGS_MEDIA_GID)
  sheetUrl.searchParams.set('_t', String(Date.now()))

  const sheetController = new AbortController()
  const sheetTimeout = globalThis.setTimeout(() => sheetController.abort(), 15_000)
  let response: Response
  let csv: string
  try {
    response = await fetch(sheetUrl, { cache: 'no-store', signal: sheetController.signal })
    csv = await response.text()
  } finally {
    globalThis.clearTimeout(sheetTimeout)
  }
  if (!response.ok || csv.trimStart().startsWith('<!')) {
    throw new Error('Sheet MEDIA TV tidak dapat dibaca. Pastikan spreadsheet dapat dilihat oleh Atlas.')
  }

  const links = parseCsvRows(csv)
    .flat()
    .map(value => value.trim())
    .filter(value => /^https?:\/\/(?:www\.)?(?:vt\.|vm\.)?tiktok\.com\//i.test(value))
  const uniqueLinks = [...new Set(links)]
  const postIds = await Promise.all(uniqueLinks.map(async (link) => {
    const embedUrl = new URL('https://www.tiktok.com/oembed')
    embedUrl.searchParams.set('url', link)
    const embedController = new AbortController()
    const embedTimeout = globalThis.setTimeout(() => embedController.abort(), 15_000)
    let embedResponse: Response
    try {
      embedResponse = await fetch(embedUrl, { cache: 'no-store', signal: embedController.signal })
    } finally {
      globalThis.clearTimeout(embedTimeout)
    }
    if (!embedResponse.ok) throw new Error(`TikTok tidak dapat membaca link dari sheet (HTTP ${embedResponse.status}).`)

    const embedData: unknown = await embedResponse.json()
    if (typeof embedData !== 'object' || embedData === null || !('html' in embedData) || typeof embedData.html !== 'string') {
      throw new Error('TikTok mengirim data embed dengan format yang tidak sesuai.')
    }
    const postId = embedData.html.match(/data-video-id=["'](\d+)["']/)?.[1]
    if (!postId) throw new Error('ID video tidak ditemukan pada salah satu link TikTok di sheet MEDIA TV.')
    return postId
  }))
  return [...new Set(postIds)]
}

export function parseTvMediaList(value: unknown): TvMediaSlide[] {
  if (!Array.isArray(value)) throw new Error('Apps Script mengirim daftar media TV yang tidak sesuai.')

  return value.flatMap((entry): TvMediaSlide[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const item = entry as Record<string, unknown>
    const { id, name, mimeType, updatedAt, url } = item
    if (
      typeof id !== 'string'
      || typeof name !== 'string'
      || typeof mimeType !== 'string'
      || typeof url !== 'string'
      || !(mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType === 'application/pdf')
    ) return []

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return []
    }
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'drive.google.com') return []

    return [{
      id,
      name,
      mimeType,
      updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
      ...(typeof item.durationSeconds === 'number' && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0
        ? { durationSeconds: Math.ceil(item.durationSeconds) }
        : {}),
      url: mimeType.startsWith('image/')
        ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1920`
        : mimeType.startsWith('video/')
          ? `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`
        : url,
    }]
  })
}

export async function fetchTvMedia(): Promise<TvMediaSlide[]> {
  return new Promise((resolve, reject) => {
    const callbackName = `__atlasTvMediaCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const url = new URL(TV_MEDIA_ENDPOINT)
    url.searchParams.set('action', 'listTvMedia')
    url.searchParams.set('callback', callbackName)
    url.searchParams.set('t', String(Date.now()))

    const cleanup = () => {
      window.clearTimeout(timeout)
      Reflect.deleteProperty(window, callbackName)
      script.remove()
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Waktu tunggu daftar media TV dari Apps Script habis.'))
    }, 30_000)

    Object.defineProperty(window, callbackName, {
      configurable: true,
      value: (result: TvMediaResponse) => {
        cleanup()
        if (result.error) {
          reject(new Error(result.error))
          return
        }
        try {
          resolve(parseTvMediaList(result.data))
        } catch (error) {
          reject(error)
        }
      },
    })
    script.onerror = () => {
      cleanup()
      reject(new Error('Tidak dapat memuat daftar media TV dari Apps Script.'))
    }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}
