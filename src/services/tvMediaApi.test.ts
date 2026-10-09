import { describe, expect, it } from 'vitest'
import { parseTvMediaList } from './tvMediaApi'

describe('parseTvMediaList', () => {
  it('keeps supported Drive image/PDF files and ignores unsupported entries', () => {
    expect(parseTvMediaList([
      { id: 'image-1', name: 'Poster.jpg', mimeType: 'image/jpeg', updatedAt: '2026-10-09T00:00:00Z', url: 'https://drive.google.com/uc?id=image-1' },
      { id: 'pdf-1', name: 'Schedule.pdf', mimeType: 'application/pdf', updatedAt: '2026-10-09T00:00:00Z', url: 'https://drive.google.com/file/d/pdf-1/preview' },
      { id: 'sheet-1', name: 'Notes.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: 'https://drive.google.com/file/d/sheet-1' },
      { id: 'broken-image', name: 'Missing URL.png', mimeType: 'image/png' },
      { id: 'external-image', name: 'External.png', mimeType: 'image/png', url: 'https://example.com/image.png' },
      null,
    ])).toEqual([
      { id: 'image-1', name: 'Poster.jpg', mimeType: 'image/jpeg', updatedAt: '2026-10-09T00:00:00Z', url: 'https://lh3.googleusercontent.com/d/image-1=w1920' },
      { id: 'pdf-1', name: 'Schedule.pdf', mimeType: 'application/pdf', updatedAt: '2026-10-09T00:00:00Z', url: 'https://drive.google.com/file/d/pdf-1/preview' },
    ])
  })

  it('rejects an invalid media payload', () => {
    expect(() => parseTvMediaList({ error: 'Drive is unavailable' })).toThrow('daftar media TV yang tidak sesuai')
  })
})
