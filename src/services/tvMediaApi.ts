export const TV_MEDIA_FOLDER_URL = 'https://drive.google.com/drive/folders/164ITV_OLwMXw9LtWYY6Fo_JmmfzFQMda'

export interface TvMediaSlide {
  id: string
  name: string
  mimeType: string
  updatedAt: string
  url: string
}

interface TvMediaResponse {
  data?: unknown
  error?: string
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
      || !(mimeType.startsWith('image/') || mimeType === 'application/pdf')
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
      url,
    }]
  })
}

export async function fetchTvMedia(): Promise<TvMediaSlide[]> {
  const endpoint = import.meta.env.VITE_TV_MEDIA_ENDPOINT?.trim()
  if (!endpoint) {
    throw new Error('Endpoint Apps Script TV Media belum dikonfigurasi.')
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__atlasTvMediaCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const url = new URL(endpoint)
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
