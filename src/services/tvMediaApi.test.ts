import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTvSocialVideos, getYouTubeVideoId, parseTvMediaList } from './tvMediaApi'

describe('parseTvMediaList', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps supported Drive image, PDF, and video files and ignores unsupported entries', () => {
    expect(parseTvMediaList([
      { id: 'image-1', name: 'Poster.jpg', mimeType: 'image/jpeg', updatedAt: '2026-10-09T00:00:00Z', url: 'https://drive.google.com/uc?id=image-1' },
      { id: 'pdf-1', name: 'Schedule.pdf', mimeType: 'application/pdf', updatedAt: '2026-10-09T00:00:00Z', url: 'https://drive.google.com/file/d/pdf-1/preview' },
      { id: 'video-1', name: 'Promo.mp4', mimeType: 'video/mp4', updatedAt: '2026-10-09T00:00:00Z', durationSeconds: 91, url: 'https://drive.google.com/file/d/video-1/preview' },
      { id: 'sheet-1', name: 'Notes.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: 'https://drive.google.com/file/d/sheet-1' },
      { id: 'broken-image', name: 'Missing URL.png', mimeType: 'image/png' },
      { id: 'external-image', name: 'External.png', mimeType: 'image/png', url: 'https://example.com/image.png' },
      null,
    ])).toEqual([
      { id: 'image-1', name: 'Poster.jpg', mimeType: 'image/jpeg', updatedAt: '2026-10-09T00:00:00Z', url: 'https://lh3.googleusercontent.com/d/image-1=w1920' },
      { id: 'pdf-1', name: 'Schedule.pdf', mimeType: 'application/pdf', updatedAt: '2026-10-09T00:00:00Z', url: 'https://drive.google.com/file/d/pdf-1/preview' },
      { id: 'video-1', name: 'Promo.mp4', mimeType: 'video/mp4', updatedAt: '2026-10-09T00:00:00Z', durationSeconds: 91, url: 'https://drive.usercontent.google.com/download?id=video-1&export=download' },
    ])
  })

  it('omits missing or invalid video duration metadata', () => {
    expect(parseTvMediaList([
      { id: 'missing', name: 'Processing.mp4', mimeType: 'video/mp4', url: 'https://drive.google.com/file/d/missing/preview' },
      { id: 'invalid', name: 'Invalid.mp4', mimeType: 'video/mp4', durationSeconds: 0, url: 'https://drive.google.com/file/d/invalid/preview' },
      { id: 'valid', name: 'Valid.mp4', mimeType: 'video/mp4', durationSeconds: 12.2, url: 'https://drive.google.com/file/d/valid/preview' },
    ])).toEqual([
      { id: 'missing', name: 'Processing.mp4', mimeType: 'video/mp4', updatedAt: '', url: 'https://drive.usercontent.google.com/download?id=missing&export=download' },
      { id: 'invalid', name: 'Invalid.mp4', mimeType: 'video/mp4', updatedAt: '', url: 'https://drive.usercontent.google.com/download?id=invalid&export=download' },
      { id: 'valid', name: 'Valid.mp4', mimeType: 'video/mp4', updatedAt: '', durationSeconds: 13, url: 'https://drive.usercontent.google.com/download?id=valid&export=download' },
    ])
  })

  it('rejects an invalid media payload', () => {
    expect(() => parseTvMediaList({ error: 'Drive is unavailable' })).toThrow('daftar media TV yang tidak sesuai')
  })

  it('resolves TikTok and YouTube links from the MEDIA TV sheet in sheet order', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('"LINK VIDEO"\n"https://vt.tiktok.com/ZSbG9TSNe/"\n"https://youtu.be/eXPb1DY83Zo?si=test"\n"https://www.tiktok.com/@azko/video/1234567890123456789"', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        html: '<blockquote data-video-id="7694569713191505172"></blockquote>',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        html: '<blockquote data-video-id="1234567890123456789"></blockquote>',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTvSocialVideos()).resolves.toEqual([
      { provider: 'tiktok', id: '7694569713191505172' },
      { provider: 'youtube', id: 'eXPb1DY83Zo' },
      { provider: 'tiktok', id: '1234567890123456789' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uses the fallback TikTok video when the MEDIA TV sheet has no social links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 200 })))

    await expect(fetchTvSocialVideos()).resolves.toEqual([])
  })

  it('accepts standard YouTube watch, short, and shorts URLs', () => {
    expect(getYouTubeVideoId('https://youtu.be/eXPb1DY83Zo?si=test')).toBe('eXPb1DY83Zo')
    expect(getYouTubeVideoId('https://www.youtube.com/watch?v=eXPb1DY83Zo')).toBe('eXPb1DY83Zo')
    expect(getYouTubeVideoId('https://youtube.com/shorts/eXPb1DY83Zo')).toBe('eXPb1DY83Zo')
    expect(getYouTubeVideoId('https://example.com/watch?v=eXPb1DY83Zo')).toBeNull()
  })
})
