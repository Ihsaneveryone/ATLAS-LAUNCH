import { useEffect, useState } from 'react'
import type { User } from '../data/mockData'
import {
  getCachedYesterdayMgbReviews,
  getYesterdayJakartaDate,
  loadYesterdayMgbReviews,
  type MgbReview,
} from '../services/mgbReviewApi'
import { useMobile } from '../hooks/useMobile'

interface Props {
  user: User
  refreshKey: number
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function Photo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span style={{ color: '#b45309', fontSize: 9, lineHeight: 1.35, textAlign: 'center', padding: 4 }}>Foto tidak dapat dimuat</span>
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

function PhotoGroup({ title, photos }: { title: string; photos: string[] }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
        {[0, 1, 2].map(index => (
          <div key={index} style={{ aspectRatio: '1.2', minWidth: 0, overflow: 'hidden', borderRadius: 9, background: '#f0f4ff', border: '1px solid #e8edf8', display: 'grid', placeItems: 'center' }}>
            {photos[index] ? (
              <Photo src={photos[index]} alt={`${title} ${index + 1}`}/>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: 10 }}>Foto {index + 1}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewItem({ review, isMobile }: { review: MgbReview; isMobile: boolean }) {
  return (
    <article style={{ padding: isMobile ? '14px 0' : '18px 0', borderTop: '1px solid #e8edf8' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 800 }}>{review.name || 'Nama tidak tersedia'}</div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>NIK {review.nik} · {review.department}</div>
        </div>
        {(review.score || review.category) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {review.score && <span style={{ color: '#1e293b', fontSize: 15, fontWeight: 800 }}>Nilai MGB {review.score}</span>}
            {review.category && <span style={{ background: '#ecfdf5', color: '#047857', borderRadius: 8, padding: '4px 9px', fontSize: 12, fontWeight: 800 }}>Kategori {review.category}</span>}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        <PhotoGroup title="Foto MGB" photos={review.mgbPhotos}/>
        <PhotoGroup title="Foto Checker" photos={review.checkerPhotos}/>
      </div>
      {review.note && (
        <div style={{ marginTop: 13, borderRadius: 10, background: '#f8faff', padding: '10px 12px' }}>
          <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Catatan</div>
          <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{review.note}</div>
        </div>
      )}
    </article>
  )
}

export default function MgbReviewCard({ user, refreshKey }: Props) {
  const [initialResult] = useState(() => getCachedYesterdayMgbReviews(user))
  const [reviews, setReviews] = useState<MgbReview[]>(initialResult?.reviews ?? [])
  const [loading, setLoading] = useState(initialResult === null)
  const [error, setError] = useState(initialResult?.error ?? '')
  const isMobile = useMobile()
  const yesterday = getYesterdayJakartaDate()

  useEffect(() => {
    let active = true
    const cached = getCachedYesterdayMgbReviews(user)
    if (cached) {
      setReviews(cached.reviews)
      setError(cached.error)
      setLoading(false)
    } else {
      setLoading(true)
      setError('')
    }

    loadYesterdayMgbReviews(user, refreshKey > 0).then(result => {
      if (!active) return
      setReviews(result.reviews)
      setError(result.error)
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [refreshKey, user])

  return (
    <section style={{ width: '100%', margin: '0 0 14px' }}>
      <div style={{ background: '#fff', border: '1px solid #e8edf8', borderRadius: 16, padding: isMobile ? '14px' : '18px 22px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ color: '#1e293b', fontSize: 15, fontWeight: 800 }}>Penilaian MGB Departemen</div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>Data kemarin · {formatDate(yesterday)}</div>
          </div>
          {loading && <span aria-label="Memuat penilaian" style={{ color: '#94a3b8', fontSize: 12 }}>Memuat…</span>}
        </div>
        {error ? (
          <div role="alert" style={{ color: '#9a3412', background: '#fff7ed', borderRadius: 9, padding: '10px 12px', fontSize: 12 }}>
            Gagal memuat penilaian MGB: {error}
          </div>
        ) : !loading && reviews.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 12, padding: '12px 0 2px' }}>Belum ada penilaian checker dari departemen Anda untuk kemarin.</div>
        ) : reviews.map((review, index) => <ReviewItem key={`${review.date}-${review.nik}-${index}`} review={review} isMobile={isMobile}/>)}
      </div>
    </section>
  )
}
