import { useEffect, useMemo, useRef, useState } from 'react'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import { formatRupiahFull, type User } from '../data/mockData'
import { parseIncentiveSheets } from '../services/incentiveParser'
import { resolveScanResult } from '../services/incentiveScanner'
import { useMobile } from '../hooks/useMobile'

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource | Blob): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorInstance
  }
}

interface Props { user: User; onBack: () => void }

const S = { bg: '#f0f4ff', card: '#fff', border: '#e8edf8', muted: '#94a3b8', text: '#1e293b', sub: '#64748b' }

const CURRENT_MONTH_NAME = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date()).toUpperCase()

type SubPage = 'bersyarat' | 'tanpa_syarat' | 'toko' | 'lainnya' | 'boomsale' | 'receipt' | 'sku' | 'list'

type SummaryType = SubPage

interface IncentiveSummaryItem {
  name: string
  type: SummaryType
  achieved: number
  forecast: number
  extra?: string
}

const SHEET_NAMES = {
  conditional: 'INSENTIF BERSYARAT',
  unconditional: 'INSENTIF TANPA SYARAT',
  sku: 'SKU INSENTIF',
  syarat: 'SYARAT INSENTIF',
  boomsale: 'INSENTIF BOOMSALE',
  receipt: 'INSENTIF RECEIPT DEPT',
  compare: 'COPAS S2',
}

const LIST_INSENTIF_MENU: Array<{ type: Exclude<SubPage, 'bersyarat' | 'tanpa_syarat' | 'list'>; name: string; description: string; icon: string }> = [
  { type: 'lainnya', name: 'Insentif Lainnya', description: 'Proteksi, syarat lainnya, dan receipt dept.', icon: '🧩' },
  { type: 'boomsale', name: 'Produk Insentif Bulan Ini', description: 'Daftar produk insentif bulan ini.', icon: '💥' },
  { type: 'sku', name: 'SKU Insentif Lainnya', description: 'SKU insentif tambahan.', icon: '📦' },
]

function normalizeText(value: string) {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeLookup(value: string) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isLikelySameCode(leftValue: string, rightValue: string) {
  const left = normalizeLookup(leftValue)
  const right = normalizeLookup(rightValue)
  if (!left || !right) return false
  if (left === right) return true

  const minLength = Math.min(left.length, right.length)
  if (minLength >= 6 && (left.includes(right) || right.includes(left))) return true

  const leftDigits = left.replace(/\D+/g, '')
  const rightDigits = right.replace(/\D+/g, '')
  if (!leftDigits || !rightDigits) return false
  if (leftDigits === rightDigits) return true
  const minDigitLength = Math.min(leftDigits.length, rightDigits.length)
  return minDigitLength >= 6 && (leftDigits.endsWith(rightDigits) || rightDigits.endsWith(leftDigits))
}

function groupRowsByKey<T>(rows: T[], getKey: (row: T) => string) {
  const grouped = new Map<string, T[]>()
  rows.forEach(row => {
    const key = getKey(row) || 'Umum'
    const current = grouped.get(key) ?? []
    current.push(row)
    grouped.set(key, current)
  })
  return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right, 'id-ID'))
}

function filterSyaratRowsByKeyword(rows: Array<NonNullable<ReturnType<typeof parseIncentiveSheets>['syarat']['rows']>[number]>, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase()
  if (!normalizedKeyword) return rows
  return rows.filter(row => [row.jenis, row.syarat, row.note].some(value => normalizeText(value).toLowerCase().includes(normalizedKeyword)))
}

function useIncentiveData() {
  const [data, setData] = useState<ReturnType<typeof parseIncentiveSheets> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const sheetIds = Object.values(SHEET_NAMES)
        const sheets = await Promise.all(sheetIds.map(async sheet => {
          const res = await fetch(`https://docs.google.com/spreadsheets/d/1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_t=${Date.now()}`)
          const text = await res.text()
          if (!res.ok || text.trimStart().startsWith('<!')) return []
          return text.split('\n').filter(Boolean).map(line => {
            const cells: string[] = []
            let inQuote = false
            let cell = ''
            for (let i = 0; i < line.length; i++) {
              const c = line[i]
              if (c === '"') {
                if (inQuote && line[i + 1] === '"') { cell += '"'; i++ }
                else { inQuote = !inQuote }
              } else if (c === ',' && !inQuote) {
                cells.push(cell)
                cell = ''
              } else {
                cell += c
              }
            }
            cells.push(cell)
            return cells
          })
        }))

        const parsed = parseIncentiveSheets({
          [SHEET_NAMES.conditional]: sheets[0] ?? [],
          [SHEET_NAMES.unconditional]: sheets[1] ?? [],
          [SHEET_NAMES.sku]: sheets[2] ?? [],
          [SHEET_NAMES.syarat]: sheets[3] ?? [],
          [SHEET_NAMES.boomsale]: sheets[4] ?? [],
          [SHEET_NAMES.receipt]: sheets[5] ?? [],
          [SHEET_NAMES.compare]: sheets[6] ?? [],
        })
        if (!cancelled) setData(parsed)
      } catch (error) {
        console.warn('[INSENTIF] Error loading spreadsheet data:', error)
        if (!cancelled) setData(parseIncentiveSheets({}))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchData()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}

function normalizeNik(value: string) {
  return (value ?? '').trim().replace(/\D/g, '').replace(/^0+/, '')
}

function normalizeName(value: string) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function isNumericString(value: string) {
  return /^\s*[-+]?\d[\d.,\s]*$/.test(value)
}

function formatDisplayNik(value: string) {
  const raw = (value ?? '').trim()
  const match = raw.match(/\d+/)
  return match ? match[0] : raw
}

function isStatusFulfilled(status: string) {
  const normalized = (status || '').toLowerCase()
  return normalized.includes('terpenuhi') && !normalized.includes('belum')
}

function filterUserRows<T extends { nik?: string; nama?: string }>(rows: T[] | undefined, userNik: string, userName: string): T[] {
  const normalizedUserNik = normalizeNik(userNik)
  const normalizedUserName = normalizeName(userName)
  if (!normalizedUserNik && !normalizedUserName) return rows ?? []

  const result = (rows ?? []).filter(row => {
    const rowNik = normalizeNik(row.nik ?? '')
    const rowName = normalizeName(row.nama ?? '')

    const cleanNik = rowNik.split(' ').find(part => isNumericString(part)) ?? rowNik
    const cleanUserNik = normalizedUserNik.split(' ').find(part => isNumericString(part)) ?? normalizedUserNik

    const nikMatches = cleanNik && cleanUserNik && (cleanNik === cleanUserNik || cleanNik.endsWith(cleanUserNik) || cleanUserNik.endsWith(cleanNik))
    const nameMatches = normalizedUserName && (rowName === normalizedUserName || rowName.includes(normalizedUserName) || normalizedUserName.includes(rowName))
    
    // Prioritize NIK match: if NIK is provided and matches, include row
    if (normalizedUserNik && nikMatches) return true
    // Fallback to name match only if NIK is not provided or doesn't match
    if (!normalizedUserNik || !cleanUserNik) return nameMatches
    return false
  })
  
  return result
}

function ConditionalRowCard({ row, userNik }: { row: NonNullable<ReturnType<typeof parseIncentiveSheets>['conditional']['rows']>[number]; userNik: string }) {
  const achievedValue = row.items.reduce((sum, item) => {
    return sum + (isStatusFulfilled(item.status || '') ? item.amount : 0)
  }, 0)
  const potentialValue = row.items.reduce((sum, item) => {
    return sum + (!isStatusFulfilled(item.status || '') && item.amount ? item.amount : 0)
  }, 0)

  const displayNik = formatDisplayNik(userNik || row.nik || '')

  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: '#0f172a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Insentif Bersyarat</div>
          <div style={{ color: S.text, fontWeight: 800, fontSize: 15 }}>{row.nama || row.nik}</div>
          <div style={{ color: S.muted, fontSize: 12 }}>NIK {displayNik || 'belum tersedia'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#D93119', fontWeight: 800, fontSize: 14 }}>{formatRupiahFull(achievedValue)}</div>
          <div style={{ color: S.muted, fontSize: 11 }}>Cair</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {potentialValue > 0 ? (
          <span style={{ background: '#f0fdf9', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>Potensial {formatRupiahFull(potentialValue)}</span>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
        {row.items.map(item => (
          <div key={`${item.label}-${item.amount}-${item.status}`} style={{ background: '#f8fafc', borderRadius: 18, padding: '16px', minHeight: 110, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ color: S.muted, fontSize: 11, marginBottom: 8, fontWeight: 700 }}>{item.label || 'Insentif'}</div>
              <div style={{ color: S.text, fontSize: 18, fontWeight: 800 }}>{formatRupiahFull(item.amount)}</div>
            </div>
            <div style={{ color: item.status ? '#334155' : '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{item.status || 'Belum Ada Status'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SoldIncentiveRecapCard({ rows, isMobile }: { rows: Array<{ sku: string; name: string; qty: number; category: string; requirement: string; source: string; targetQty?: number; imageUrl?: string; storeQty?: number; storeTargetQty?: number; syaratStatus: 'Syarat Terpenuhi' | 'Belum Terpenuhi' }>; isMobile: boolean }) {
  const groupedRows = useMemo(() => {
    const grouped = new Map<string, Array<{ sku: string; name: string; qty: number; category: string; requirement: string; source: string; targetQty?: number; imageUrl?: string; storeQty?: number; storeTargetQty?: number; syaratStatus: 'Syarat Terpenuhi' | 'Belum Terpenuhi' }>>()
    rows.forEach(row => {
      const key = normalizeText(row.category || 'Tanpa Kategori') || 'Tanpa Kategori'
      const current = grouped.get(key) ?? []
      current.push(row)
      grouped.set(key, current)
    })
    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right, 'id-ID'))
      .map(([category, items]) => ({ category, items }))
  }, [rows])

  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#0f172a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Rekap Produk Insentif Terjual</div>
          <div style={{ color: S.muted, fontSize: 12 }}>Menampilkan produk insentif yang sudah dijual oleh user.</div>
        </div>
        <div style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
          {rows.length} produk
        </div>
      </div>

      {!rows.length ? (
        <div style={{ padding: '14px 16px', background: '#f8fafc', border: `1px solid ${S.border}`, borderRadius: 12, color: S.sub, fontSize: 13 }}>
          Belum ada produk insentif terjual untuk user ini pada data COPAS S2.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groupedRows.map(group => (
            <div key={group.category} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ color: S.text, fontSize: 14, fontWeight: 800 }}>{group.category}</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {group.items.map(item => {
                  const resolvedTarget = item.storeTargetQty ?? item.targetQty
                  const resolvedActual = item.storeQty ?? 0
                  const progressPercent = resolvedTarget ? Math.min(100, (resolvedActual / resolvedTarget) * 100) : 0
                  const progressLabel = resolvedTarget ? `${resolvedActual} / ${resolvedTarget}` : `${resolvedActual}`
                  return (
                    <div key={`${item.sku}-${item.name}-${item.category}`} style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>SKU/Artikel {item.sku || '—'}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: S.text, lineHeight: 1.4 }}>{item.name || item.sku}</div>
                          <div style={{ color: S.sub, fontSize: 12, marginTop: 4 }}>{item.requirement || 'Syarat belum tersedia'}</div>
                        </div>
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.sku} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 16, border: `1px solid ${S.border}`, background: '#f8fafc' }} /> : null}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{item.category || 'Tanpa Kategori'}</span>
                        <span style={{ background: '#ecfeff', color: '#0e7490', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{item.source}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px', padding: '10px 12px', borderRadius: 14, background: '#f8fafc' }}>
                        <div style={{ color: S.muted, fontSize: 12 }}>Status</div>
                        <div style={{ color: item.syaratStatus === 'Syarat Terpenuhi' ? '#15803d' : '#9a3412', fontWeight: 700, textAlign: 'right' }}>{item.syaratStatus}</div>
                        <div style={{ color: S.muted, fontSize: 12 }}>Qty User</div>
                        <div style={{ color: S.text, fontWeight: 700, textAlign: 'right' }}>{item.qty}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: S.muted, fontSize: 12 }}>Qty Penjualan Toko</span>
                          <span style={{ color: S.text, fontSize: 12, fontWeight: 700 }}>{progressLabel}</span>
                        </div>
                        {resolvedTarget ? (
                          <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progressPercent}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', borderRadius: 999 }} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UnconditionalRowCard({ row, userNik }: { row: NonNullable<ReturnType<typeof parseIncentiveSheets>['unconditional']['rows']>[number]; userNik: string }) {
  const categoryLabel = row.category && !/^\d+$/.test(row.category) ? row.category : ''
  const displayNik = formatDisplayNik(userNik || row.nik || '')

  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {categoryLabel ? (
            <>
              <div style={{ color: S.text, fontWeight: 800, fontSize: 15 }}>{categoryLabel}</div>
              <div style={{ color: S.muted, fontSize: 12, marginTop: 6 }}>{row.nama ? `${row.nama} • ` : ''}NIK {displayNik || 'belum tersedia'}</div>
            </>
          ) : (
            <>
              <div style={{ color: S.text, fontWeight: 800, fontSize: 15 }}>{row.nama || row.nik}</div>
              <div style={{ color: S.muted, fontSize: 12 }}>NIK {displayNik || 'belum tersedia'}</div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#7c3aed', fontWeight: 800, fontSize: 14 }}>{formatRupiahFull(row.value)}</div>
          <div style={{ color: S.muted, fontSize: 11 }}>Pasti diperoleh</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {row.items.map(item => (
          <div key={`${item.label}-${item.amount}`} style={{ background: '#f8fafc', borderRadius: 18, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ color: S.muted, fontSize: 11, marginBottom: 8, fontWeight: 700 }}>{item.label || 'Insentif'}</div>
              <div style={{ color: S.text, fontSize: 18, fontWeight: 800 }}>{formatRupiahFull(item.amount)}</div>
            </div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Pasti diperoleh</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkuRowCard({ row }: { row: NonNullable<ReturnType<typeof parseIncentiveSheets>['sku']['rows']>[number] }) {
  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: S.text, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{row.name || row.sku}</div>
            <div style={{ color: S.muted, fontSize: 12 }}>SKU: {row.sku || '—'}</div>
          </div>
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.name || row.sku} style={{ width: '100%', maxWidth: 96, height: 96, objectFit: 'cover', borderRadius: 16, border: `1px solid ${S.border}`, background: '#f8fafc' }} />
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ color: S.sub, fontSize: 13, lineHeight: 1.5 }}>{row.requirement || '—'}</div>
        {row.incentiveValue > 0 ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#7c3aed', fontWeight: 800, fontSize: 16 }}>{formatRupiahFull(row.incentiveValue)}</div>
            <div style={{ color: S.muted, fontSize: 11 }}>{row.per ? `Per ${row.per}` : 'Per qty'}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SyaratRowCard({ row }: { row: NonNullable<ReturnType<typeof parseIncentiveSheets>['syarat']['rows']>[number] }) {
  const progressPercent = row.targetQty ? Math.min(100, ((row.acvValue ?? 0) / row.targetQty) * 100) : 0

  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>{row.jenis || 'Syarat Insentif'}</div>
          <div style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>{row.note || 'Tanpa catatan khusus'}</div>
        </div>
      </div>
      <div style={{ color: S.text, fontSize: 14, lineHeight: 1.7 }}>{row.syarat || 'Tidak ada deskripsi syarat'}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>ACV / Target</span>
        <span style={{ background: '#ecfdf5', color: '#059669', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{row.acvValue ?? 0} / {row.targetQty ?? 0}</span>
      </div>
      {row.targetQty ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ color: S.muted, fontSize: 12 }}>Pencapaian</span>
            <span style={{ color: S.text, fontSize: 12, fontWeight: 700 }}>{progressPercent.toFixed(0)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, background: 'linear-gradient(90deg, #2563eb, #38bdf8)', borderRadius: 999 }} />
          </div>
        </div>
      ) : null}
      {row.articleList.length ? (
        <div style={{ color: S.sub, fontSize: 12, lineHeight: 1.6 }}>
          Artikel: {row.articleList.join(' / ')}
        </div>
      ) : null}
      <div style={{ color: S.text, fontWeight: 700, fontSize: 13 }}>Value per Qty: {formatRupiahFull(row.incentiveValuePerQty)}</div>
    </div>
  )
}

function BoomsaleRowCard({ row }: { row: NonNullable<ReturnType<typeof parseIncentiveSheets>['boomsale']['rows']>[number] }) {
  const progressPercent = row.targetQty ? Math.min(100, ((row.actualQty ?? 0) / row.targetQty) * 100) : 0
  const progressLabel = row.targetQty ? `${row.actualQty ?? 0} / ${row.targetQty}` : null
  const incentiveLabel = row.incentiveIsPercentage ? `${row.incentivePercent}%` : 'Value'
  const incentiveValue = row.incentiveIsPercentage ? row.incentiveValue : row.incentiveNominal || row.incentiveValue

  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Artikel {row.artikel || '—'}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: S.text, lineHeight: 1.4 }}>{row.name || row.artikel}</div>
          <div style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>{row.departemen || 'Departemen tidak tersedia'}</div>
        </div>
        {row.imageUrl ? <img src={row.imageUrl} alt={row.name || row.artikel} style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 16, border: `1px solid ${S.border}`, background: '#f8fafc' }} /> : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{row.category || 'Tanpa Kategori'}</span>
        {progressLabel ? <span style={{ background: '#ecfdf5', color: '#059669', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{progressLabel}</span> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px', padding: '10px 12px', borderRadius: 14, background: '#f8fafc' }}>
        <div style={{ color: S.muted, fontSize: 12 }}>Harga</div>
        <div style={{ color: S.text, fontWeight: 700, textAlign: 'right' }}>{formatRupiahFull(row.price)}</div>
        <div style={{ color: S.muted, fontSize: 12 }}>Insentif</div>
        <div style={{ color: S.text, fontWeight: 700, textAlign: 'right' }}>{incentiveLabel}</div>
        <div style={{ color: S.muted, fontSize: 12 }}>Value</div>
        <div style={{ color: S.text, fontWeight: 700, textAlign: 'right' }}>{formatRupiahFull(incentiveValue)}</div>
      </div>

      {row.targetQty ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ color: S.muted, fontSize: 12 }}>Qty Penjualan Toko</span>
            <span style={{ color: S.text, fontSize: 12, fontWeight: 700 }}>{progressLabel}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, background: 'linear-gradient(90deg, #fb923c, #f97316)', borderRadius: 999 }} />
          </div>
        </div>
      ) : null}

      {row.remark ? <div style={{ color: S.sub, fontSize: 12, lineHeight: 1.6, padding: '8px 10px', borderRadius: 12, background: '#fff7ed' }}>{row.remark}</div> : null}
    </div>
  )
}

function ReceiptInfoTable({ rows, isMobile }: { rows: NonNullable<ReturnType<typeof parseIncentiveSheets>['receipt']['rows']>; isMobile: boolean }) {
  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>Informasi Insentif Receipt Dept</div>
          <div style={{ color: S.muted, fontSize: 12 }}>Menampilkan minimum receipt value dan persentase insentif per departemen.</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 520 : 680 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${S.border}` }}>
              {['No', 'Dept Group', 'Minimum Receipt Value', 'Incentive %'].map(header => (
                <th key={header} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.no || row.departemen}-${index}`} style={{ borderBottom: `1px solid ${S.border}`, background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ padding: '13px 16px', color: S.sub, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.no || index + 1}</td>
                <td style={{ padding: '13px 16px', color: S.text, fontSize: 13, fontWeight: 700 }}>{row.departemen || 'Departemen Receipt'}</td>
                <td style={{ padding: '13px 16px', color: S.text, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRupiahFull(row.targetValue)}</td>
                <td style={{ padding: '13px 16px', color: '#0f172a', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.percentage.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({ item, onClick }: { item: IncentiveSummaryItem; onClick: () => void }) {
  const isBersyarat = item.type === 'bersyarat'
  const isSku = item.type === 'sku'
  const isList = item.type === 'list'

  const color = isBersyarat ? '#dc2626' : isSku ? '#059669' : isList ? '#0f5d95' : '#4338ca'
  const light = isBersyarat ? '#fef2f2' : isSku ? '#ecfdf5' : isList ? '#eff6ff' : '#eef2ff'
  const border = isBersyarat ? '#fecaca' : isSku ? '#bbf7d0' : isList ? '#bfdbfe' : '#c7d2fe'

  const icon = isList ? '📋' : isSku ? '📦' : isBersyarat ? '🔥' : '✨'
  const subtitle = isList ? 'Buka daftar submenu insentif' : isSku ? 'Detail SKU' : 'Ringkasan insentif'

  return (
    <button onClick={onClick} style={{ background: light, border: `1px solid ${border}`, borderRadius: 22, padding: '22px 24px', boxShadow: '0 10px 24px rgba(15,23,42,0.05)', transition: 'transform 0.18s, border-color 0.18s', cursor: 'pointer', textAlign: 'left', width: '100%' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = color }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.borderColor = border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: S.text, fontWeight: 800, fontSize: 15 }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: 'rgba(255,255,255,0.4)', display: 'grid', placeItems: 'center', fontSize: 14 }}>{icon}</span>
            <span>{item.name}</span>
          </div>
          <div style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>{subtitle}</div>
        </div>
        <span style={{ color: S.muted, fontSize: 20 }}>›</span>
      </div>
      {isList ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: S.text, fontSize: 20, fontWeight: 800 }}>Cek Daftar Insentif Disini</div>
            {item.extra ? <div style={{ color: S.muted, fontSize: 12 }}>{item.extra}</div> : null}
          </div>
      ) : isSku ? (
        <div style={{ marginTop: 8, color: S.muted, fontSize: 13 }}>Ringkasan tersedia — buka detail SKU</div>
      ) : (
        <div style={{ color: S.text, fontSize: 20, fontWeight: 800 }}>{formatRupiahFull(item.achieved)}</div>
      )}
      {isSku ? <div style={{ marginTop: 12, color: color, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lihat detail SKU</div> : null}
    </button>
  )
}

function ScanArticlePanel({ data, isMobile }: { data: ReturnType<typeof parseIncentiveSheets> | null; isMobile: boolean }) {
  const [manualCode, setManualCode] = useState('')
  const [scanResult, setScanResult] = useState<ReturnType<typeof resolveScanResult> | null>(null)
  const [cameraStatus, setCameraStatus] = useState('Siap untuk scan barcode produk')
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('BarcodeDetector' in window) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'] })
      } catch {
        detectorRef.current = null
      }
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false)
      setCameraStatus('Browser ini belum mendukung kamera. Anda bisa memasukkan kode manual.')
    }
  }, [])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setIsCameraOpen(false)
    setIsScanning(false)
  }

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false)
      setCameraStatus('Browser ini belum mendukung kamera. Anda bisa memasukkan kode manual.')
      return
    }

    if (!detectorRef.current) {
      setCameraSupported(false)
      setCameraStatus('Browser ini belum mendukung deteksi barcode. Anda bisa memasukkan kode manual.')
      return
    }

    setCameraSupported(true)
    setCameraStatus('Membuka kamera...')
    setIsScanning(true)
    setIsCameraOpen(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCameraStatus('Arahkan kamera ke barcode produk...')
    } catch {
      stopCamera()
      setCameraStatus('Kamera tidak bisa dibuka. Coba masukkan kode manual.')
    }
  }

  useEffect(() => {
    if (!isCameraOpen || !videoRef.current || !detectorRef.current) return

    let cancelled = false
    let timeoutId: number | undefined

    const detectLoop = async () => {
      if (cancelled || !isCameraOpen || !videoRef.current) return

      const video = videoRef.current
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          try {
            const detected = await detectorRef.current?.detect(canvas)
            const code = detected?.[0]?.rawValue?.trim()
            if (code) {
              setManualCode(code)
              const result = resolveScanResult(code, data)
              setScanResult(result)
              setCameraStatus(result.summary)
              stopCamera()
              return
            }
          } catch {
            // ignore frame errors and continue scanning
          }
        }
      }

      if (!cancelled && isCameraOpen) {
        timeoutId = window.setTimeout(detectLoop, 900)
      }
    }

    void detectLoop()

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [isCameraOpen, data])

  const handleManualCheck = () => {
    const code = manualCode.trim()
    if (!code) {
      setScanResult(null)
      setCameraStatus('Masukkan kode atau pindai barcode terlebih dahulu.')
      return
    }
    const result = resolveScanResult(code, data)
    setScanResult(result)
    setCameraStatus(result.summary)
  }

  return (
    <div style={{ borderRadius: 24, padding: isMobile ? '18px 16px' : '22px 24px', background: '#ffffff', border: '1px solid #e8edf8', boxShadow: '0 16px 36px rgba(15, 23, 42, 0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: '#4338ca', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Scan Artikel</div>
          <div style={{ color: S.text, fontSize: 18, fontWeight: 800 }}>Cek apakah produk ini punya insentif</div>
          <div style={{ color: S.muted, fontSize: 13, marginTop: 6 }}>Pindai barcode lewat kamera atau masukkan kode manual. Hasil akan menunjukkan SKU, kategori, syarat, dan nilai insentif bila ada.</div>
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: '#eef2ff', display: 'grid', placeItems: 'center', fontSize: 22 }}>📷</div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, marginBottom: 12 }}>
        <input
          value={manualCode}
          onChange={event => setManualCode(event.target.value)}
          placeholder="Masukkan SKU / artikel / barcode"
          style={{ flex: 1, border: `1px solid ${S.border}`, borderRadius: 14, padding: '12px 14px', fontSize: 14, color: S.text, background: '#f8fafc' }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleManualCheck} style={{ borderRadius: 14, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>Cek Kode</button>
          {isCameraOpen ? (
            <button type="button" onClick={stopCamera} style={{ borderRadius: 14, border: `1px solid ${S.border}`, background: S.card, color: S.text, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>Stop Kamera</button>
          ) : (
            <button type="button" onClick={() => { void openCamera() }} style={{ borderRadius: 14, border: '1px solid #c7d2fe', background: '#4338ca', color: '#fff', padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>Buka Kamera</button>
          )}
        </div>
      </div>

      {!cameraSupported ? (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: '#fffbeb', color: '#92400e', fontSize: 12, border: '1px solid #fde68a' }}>
          Browser Anda belum mendukung scan kamera. Anda tetap bisa menulis kode manual untuk cek insentif.
        </div>
      ) : null}

      <div style={{ marginBottom: 12, color: S.muted, fontSize: 12, fontWeight: 600 }}>{cameraStatus}</div>

      <div style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${S.border}`, background: '#f8fafc', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        {isCameraOpen ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 280, objectFit: 'cover', background: '#0f172a' }} />
        ) : (
          <div style={{ color: S.muted, padding: '24px 16px', textAlign: 'center', fontSize: 14 }}>Preview kamera akan tampil di sini setelah Anda menyalakan kamera.</div>
        )}
      </div>

      {scanResult ? (
        <div style={{ borderRadius: 18, padding: '14px 16px', border: scanResult.isIncentive ? '1px solid #bbf7d0' : '1px solid #fde68a', background: scanResult.isIncentive ? '#f0fdf9' : '#fffbeb' }}>
          <div style={{ color: scanResult.isIncentive ? '#15803d' : '#92400e', fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            {scanResult.isIncentive ? 'Produk ini terdaftar sebagai insentif' : 'Produk ini belum terdaftar sebagai insentif'}
          </div>
          <div style={{ color: S.text, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{scanResult.summary}</div>

          {scanResult.skuMatch ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: S.text, fontWeight: 800 }}>{scanResult.skuMatch.name}</div>
              <div style={{ color: S.sub, fontSize: 13 }}>SKU: {scanResult.skuMatch.sku}</div>
              <div style={{ color: S.sub, fontSize: 13 }}>Syarat: {scanResult.skuMatch.requirement || '—'}</div>
              <div style={{ color: '#7c3aed', fontWeight: 800 }}>{formatRupiahFull(scanResult.skuMatch.incentiveValue)} {scanResult.skuMatch.per ? `per ${scanResult.skuMatch.per}` : ''}</div>
            </div>
          ) : null}

          {scanResult.boomsaleMatch ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: S.text, fontWeight: 800 }}>{scanResult.boomsaleMatch.name}</div>
              <div style={{ color: S.sub, fontSize: 13 }}>Artikel: {scanResult.boomsaleMatch.artikel}</div>
              <div style={{ color: S.sub, fontSize: 13 }}>Kategori: {scanResult.boomsaleMatch.category || '—'}</div>
              <div style={{ color: S.sub, fontSize: 13 }}>Departemen: {scanResult.boomsaleMatch.departemen || '—'}</div>
              <div style={{ color: '#ea580c', fontWeight: 800 }}>{scanResult.boomsaleMatch.incentivePercent}% / {formatRupiahFull(scanResult.boomsaleMatch.incentiveValue)}</div>
            </div>
          ) : null}

          {scanResult.matchingSyaratRows.length ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: S.text, fontWeight: 800, marginBottom: 6 }}>Syarat terkait</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scanResult.matchingSyaratRows.map((row, index) => (
                  <div key={`${row.jenis}-${index}`} style={{ borderRadius: 12, padding: '10px 12px', background: '#fff', border: `1px solid ${S.border}` }}>
                    <div style={{ color: S.text, fontWeight: 700 }}>{row.jenis}</div>
                    <div style={{ color: S.sub, fontSize: 12, marginTop: 4 }}>{row.syarat}</div>
                    {row.note ? <div style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>{row.note}</div> : null}
                    <div style={{ color: '#7c3aed', fontSize: 12, fontWeight: 700, marginTop: 4 }}>{formatRupiahFull(row.incentiveValuePerQty)} per qty</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SubPageView({ type, data, user, isMobile, onBack: goBack, onSelectSubPage }: { type: SubPage; data: ReturnType<typeof parseIncentiveSheets> | null; user: User; isMobile: boolean; onBack: () => void; onSelectSubPage: (type: Exclude<SubPage, 'list'>) => void }) {
  const [skuQuery, setSkuQuery] = useState('')
  const [skuSort, setSkuSort] = useState<'sku' | 'name'>('sku')
  const [skuOrder, setSkuOrder] = useState<'asc' | 'desc'>('asc')
  const [boomsaleQuery, setBoomsaleQuery] = useState('')
  const [boomsaleCategory, setBoomsaleCategory] = useState('all')
  const [boomsaleDept, setBoomsaleDept] = useState('all')

  const isBersyarat = type === 'bersyarat'
  const isSku = type === 'sku'
  const isList = type === 'list'
  const isBoomsale = type === 'boomsale'
  const isReceipt = type === 'receipt'
  const isToko = type === 'toko'
  const isLainnya = type === 'lainnya'

  const color = isBersyarat ? '#D93119' : isSku ? '#059669' : isBoomsale ? '#f97316' : isReceipt ? '#0f172a' : isLainnya ? '#7c3aed' : isToko ? '#1d4ed8' : '#7c3aed'
  const title = isBersyarat ? 'Insentif Bersyarat' : isSku ? 'SKU Insentif' : isBoomsale ? 'Produk Insentif Bulan Ini' : isReceipt ? 'Insentif Receipt Dept' : isLainnya ? 'Insentif Lainnya' : isToko ? 'Insentif Toko' : isList ? 'Daftar Insentif' : 'Insentif Tanpa Syarat'
  const subtitle = isBersyarat ? 'Data individu dari sheet INSENTIF BERSYARAT' : isSku ? '' : isBoomsale ? `Data sheet PRODUK INSENTIF ${CURRENT_MONTH_NAME}` : isReceipt ? 'Data sheet INSENTIF RECEIPT DEPT' : isLainnya ? 'Gabungan proteksi, syarat lainnya, dan receipt dept' : isToko ? 'Syarat insentif toko dari sheet SYARAT INSENTIF' : isList ? 'Pilih kategori insentif dari submenu' : 'Data individu dari sheet INSENTIF TANPA SYARAT'

  const syaratRows = data?.syarat.rows ?? []
  const tokoRows = filterSyaratRowsByKeyword(syaratRows, 'toko')
  const proteksiRows = filterSyaratRowsByKeyword(syaratRows, 'proteksi')
  const syaratLainnyaRows = syaratRows.filter(row => {
    const text = `${row.jenis} ${row.syarat} ${row.note}`.toLowerCase()
    return !text.includes('toko') && !text.includes('proteksi')
  })
  const lainnyaRows = [...proteksiRows, ...syaratLainnyaRows]
  const boomsaleRows = data?.boomsale.rows ?? []
  const salesRows = data?.sales.rows ?? []
  const receiptRows = data?.receipt.rows ?? []
  const conditionalRows = filterUserRows(data?.conditional.rows, user.nik, user.nama)
  const unconditionalRows = filterUserRows(data?.unconditional.rows, user.nik, user.nama)
  const rows = isBersyarat ? conditionalRows : isSku ? data?.sku.rows ?? [] : isBoomsale ? boomsaleRows : isReceipt ? receiptRows : isLainnya ? lainnyaRows : isToko ? tokoRows : unconditionalRows

  const skuRows = isSku ? (data?.sku.rows ?? []) : []
  const filteredSkuRows = skuRows.filter(row => {
    const query = skuQuery.trim().toLowerCase()
    if (!query) return true
    return row.sku.toLowerCase().includes(query) || row.name.toLowerCase().includes(query)
  })
  const sortedSkuRows = [...filteredSkuRows].sort((a, b) => {
    const left = (a[skuSort] || '').toLowerCase()
    const right = (b[skuSort] || '').toLowerCase()
    if (left === right) return 0
    return skuOrder === 'asc' ? (left < right ? -1 : 1) : (left > right ? -1 : 1)
  })

  const syaratGroups = (isToko || isLainnya)
    ? groupRowsByKey(isToko ? tokoRows : lainnyaRows, row => row.jenis || 'Jenis Insentif Lainnya')
    : []
  const hasRows = isLainnya ? (lainnyaRows.length > 0 || receiptRows.length > 0) : Boolean(rows?.length)
  const boomsaleCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(boomsaleRows.map(row => (row.category || 'Tanpa Kategori').trim()).filter(Boolean)))
    return categories.sort((a, b) => a.localeCompare(b, 'id-ID'))
  }, [boomsaleRows])
  const boomsaleDeptOptions = useMemo(() => {
    const departments = Array.from(new Set(boomsaleRows.map(row => (row.departemen || '').trim()).filter(Boolean)))
    return departments.sort((a, b) => a.localeCompare(b, 'id-ID'))
  }, [boomsaleRows])
  const filteredBoomsaleRows = useMemo(() => {
    const query = boomsaleQuery.trim().toLowerCase()
    return boomsaleRows.filter(row => {
      const haystack = [row.artikel, row.name, row.departemen, row.category].join(' ').toLowerCase()
      const matchesQuery = !query || haystack.includes(query)
      const matchesCategory = boomsaleCategory === 'all' || (row.category || 'Tanpa Kategori') === boomsaleCategory
      const matchesDept = boomsaleDept === 'all' || row.departemen === boomsaleDept
      return matchesQuery && matchesCategory && matchesDept
    })
  }, [boomsaleRows, boomsaleQuery, boomsaleCategory, boomsaleDept])
  const boomsaleGroups = isBoomsale ? groupRowsByKey(filteredBoomsaleRows, row => row.category || 'Tanpa Kategori') : []
  const soldIncentiveRows = useMemo(() => {
    const normalizedUserNik = normalizeNik(user.nik)
    const normalizedUserName = normalizeName(user.nama)
    const userSales = salesRows.filter(row => {
      if (row.qty <= 0) return false

      const rowNik = normalizeNik(row.nik)
      const rowName = normalizeName(row.nama)
      const nikMatches = rowNik && normalizedUserNik && (rowNik === normalizedUserNik || rowNik.endsWith(normalizedUserNik) || normalizedUserNik.endsWith(rowNik))
      if (nikMatches) return true

      // Fallback to name when sales row does not have a reliable NIK value.
      if (!rowNik && normalizedUserName) {
        return rowName === normalizedUserName || rowName.includes(normalizedUserName) || normalizedUserName.includes(rowName)
      }

      return false
    })
    if (!userSales.length) return []

    const skuRows = data?.sku.rows ?? []
    const grouped = new Map<string, { sku: string; name: string; qty: number; category: string; requirement: string; source: string; targetQty?: number; imageUrl?: string; storeQty?: number; storeTargetQty?: number; syaratStatus: 'Syarat Terpenuhi' | 'Belum Terpenuhi' }>()

    userSales.forEach(sale => {
      const lookupArtikel = normalizeLookup(sale.artikel)
      const lookupName = normalizeLookup(sale.productName)
      const lookupUserName = normalizeLookup(user.nama)
      const boomsaleMatch = boomsaleRows.find(row => {
        const rowArtikel = normalizeLookup(row.artikel)
        const rowName = normalizeLookup(row.name)
        const matchesArtikel = isLikelySameCode(rowArtikel, lookupArtikel)
        const matchesName = lookupName && (rowName === lookupName || rowName.includes(lookupName) || lookupName.includes(rowName))
        if (lookupArtikel) return matchesArtikel
        return Boolean(matchesName)
      })
      const skuMatch = skuRows.find(row => {
        const rowSku = normalizeLookup(row.sku)
        const rowName = normalizeLookup(row.name)
        const matchesSku = isLikelySameCode(rowSku, lookupArtikel)
        const matchesName = lookupName && (rowName === lookupName || rowName.includes(lookupName) || lookupName.includes(rowName))
        if (lookupArtikel) return matchesSku
        return Boolean(matchesName)
      })
      if (!skuMatch && !boomsaleMatch) return
      const syaratMatch = syaratRows.find(row => {
        const list = row.articleList.map(item => normalizeLookup(item))
        return lookupArtikel ? list.some(article => isLikelySameCode(article, lookupArtikel)) : false
      })

      const sku = sale.artikel || skuMatch?.sku || boomsaleMatch?.artikel || ''
      const fallbackProductName = lookupName && lookupName !== lookupUserName ? sale.productName : ''
      const name = boomsaleMatch?.name || skuMatch?.name || fallbackProductName || sale.artikel
      const category = boomsaleMatch?.category || syaratMatch?.jenis || 'Tanpa Kategori'
      const requirement = skuMatch?.requirement || syaratMatch?.syarat || boomsaleMatch?.remark || '-'
      const source = boomsaleMatch ? 'Produk Bulanan' : 'SKU Insentif'
      const targetQty = boomsaleMatch?.targetQty || syaratMatch?.targetQty
      const imageUrl = boomsaleMatch?.imageUrl || skuMatch?.imageUrl || ''
      const storeQty = boomsaleMatch?.actualQty ?? 0
      const storeTargetQty = boomsaleMatch?.targetQty
      const syaratStatus: 'Syarat Terpenuhi' | 'Belum Terpenuhi' = storeTargetQty ? (storeQty >= storeTargetQty ? 'Syarat Terpenuhi' : 'Belum Terpenuhi') : 'Belum Terpenuhi'
      const key = normalizeLookup(`${sku}-${name}-${category}`)

      const previous = grouped.get(key)
      if (previous) {
        previous.qty += sale.qty
      } else {
        grouped.set(key, { sku, name, qty: sale.qty, category, requirement, source, targetQty, imageUrl, storeQty, storeTargetQty, syaratStatus })
      }
    })

    return Array.from(grouped.values()).sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty
      return a.name.localeCompare(b.name, 'id-ID')
    })
  }, [salesRows, user.nik, user.nama, data?.sku.rows, boomsaleRows, syaratRows])

  return (
    <div style={{ minHeight: '100vh', background: S.bg }}>
      <header style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '10px 14px' : '14px 32px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <img src={azkoLogo} alt="Azko" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center', boxShadow: '0 2px 8px rgba(217,49,25,0.25)' }}/>
        <span style={{ color: S.text, fontWeight: 800, fontSize: 14, letterSpacing: '0.06em' }}>ATLAS</span>
        <div style={{ width: 1, height: 20, background: S.border }}/>
        <button onClick={goBack} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = S.text }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = S.muted }}
        >← Forecasting Insentif</button>
        <div style={{ width: 1, height: 20, background: S.border }}/>
        <span style={{ color, fontWeight: 700, fontSize: 14 }}>{title}</span>
        <span style={{ color: S.muted, fontSize: 12, marginLeft: 'auto' }}>{user.nama}</span>
      </header>

      <main style={{ maxWidth: '100%', margin: '0 auto', padding: isMobile ? '18px 14px' : '32px 24px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: S.text, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>{title}</h2>
          <p style={{ color: S.muted, fontSize: 14 }}>{subtitle}</p>
        </div>

        {isSku ? (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: isMobile ? 'stretch' : 'center' }}>
            <input
              value={skuQuery}
              onChange={event => setSkuQuery(event.target.value)}
              placeholder="Cari SKU atau nama produk"
              style={{ width: '100%', minWidth: 0, border: `1px solid ${S.border}`, borderRadius: 14, padding: '12px 14px', fontSize: 14, color: S.text, background: S.card }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: isMobile ? 'stretch' : 'flex-start' }}>
              <button type="button" onClick={() => setSkuSort('sku')} style={{ flex: isMobile ? '1 1 100%' : undefined, borderRadius: 14, border: `1px solid ${skuSort === 'sku' ? color : S.border}`, background: skuSort === 'sku' ? color : S.card, color: skuSort === 'sku' ? '#fff' : S.text, padding: '10px 14px', cursor: 'pointer' }}>Sort SKU</button>
              <button type="button" onClick={() => setSkuSort('name')} style={{ flex: isMobile ? '1 1 100%' : undefined, borderRadius: 14, border: `1px solid ${skuSort === 'name' ? color : S.border}`, background: skuSort === 'name' ? color : S.card, color: skuSort === 'name' ? '#fff' : S.text, padding: '10px 14px', cursor: 'pointer' }}>Sort Nama</button>
              <button type="button" onClick={() => setSkuOrder(prev => prev === 'asc' ? 'desc' : 'asc')} style={{ flex: isMobile ? '1 1 100%' : undefined, borderRadius: 14, border: `1px solid ${S.border}`, background: S.card, color: S.text, padding: '10px 14px', cursor: 'pointer' }}>{skuOrder === 'asc' ? 'A→Z' : 'Z→A'}</button>
            </div>
          </div>
        ) : null}

        {isBoomsale ? (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: isMobile ? 'stretch' : 'center' }}>
            <input
              value={boomsaleQuery}
              onChange={event => setBoomsaleQuery(event.target.value)}
              placeholder="Cari artikel, nama produk, departemen, atau kategori"
              style={{ flex: 1, minWidth: 220, border: `1px solid ${S.border}`, borderRadius: 14, padding: '12px 14px', fontSize: 14, color: S.text, background: S.card }}
            />
            <select value={boomsaleCategory} onChange={event => setBoomsaleCategory(event.target.value)} style={{ minWidth: 180, border: `1px solid ${S.border}`, borderRadius: 14, padding: '12px 14px', fontSize: 14, color: S.text, background: S.card }}>
              <option value="all">Semua kategori</option>
              {boomsaleCategoryOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={boomsaleDept} onChange={event => setBoomsaleDept(event.target.value)} style={{ minWidth: 180, border: `1px solid ${S.border}`, borderRadius: 14, padding: '12px 14px', fontSize: 14, color: S.text, background: S.card }}>
              <option value="all">Semua departemen</option>
              {boomsaleDeptOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            {(boomsaleQuery || boomsaleCategory !== 'all' || boomsaleDept !== 'all') ? (
              <button type="button" onClick={() => { setBoomsaleQuery(''); setBoomsaleCategory('all'); setBoomsaleDept('all') }} style={{ borderRadius: 14, border: `1px solid ${S.border}`, background: S.card, color: S.text, padding: '12px 14px', cursor: 'pointer' }}>Reset Filter</button>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isList && !hasRows ? (
            <div style={{ padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, color: '#92400e', fontSize: 13 }}>
              Data belum tersedia. Pastikan sheet memiliki data dan nama sheet sesuai.
            </div>
          ) : isList ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {LIST_INSENTIF_MENU.map(item => (
                <button key={item.type} type="button" onClick={() => onSelectSubPage(item.type)}
                  style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, padding: 18, textAlign: 'left', cursor: 'pointer', transition: 'transform 0.15s', display: 'flex', flexDirection: 'column', gap: 12 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center', fontSize: 16 }}>{item.icon}</span>
                    <div>
                      <div style={{ color: S.text, fontWeight: 800, fontSize: 15 }}>{item.name}</div>
                      <div style={{ color: S.muted, fontSize: 12 }}>{item.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : isToko ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {syaratGroups.map(([groupName, groupRows]) => (
                <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ color: S.text, fontSize: 14, fontWeight: 800 }}>{groupName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {groupRows.map((row, index) => <SyaratRowCard key={`${row.jenis}-${index}`} row={row} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : isLainnya ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {syaratGroups.length ? syaratGroups.map(([groupName, groupRows]) => (
                <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ color: S.text, fontSize: 14, fontWeight: 800 }}>{groupName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {groupRows.map((row, index) => <SyaratRowCard key={`${row.jenis}-${index}`} row={row} />)}
                  </div>
                </div>
              )) : null}
              {receiptRows.length ? <ReceiptInfoTable rows={receiptRows} isMobile={isMobile} /> : null}
            </div>
          ) : isBoomsale ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredBoomsaleRows.length === 0 ? (
                <div style={{ padding: '16px 20px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, color: '#9a2c00', fontSize: 13 }}>
                  Tidak ada produk yang cocok dengan filter yang dipilih.
                </div>
              ) : boomsaleGroups.map(([categoryName, categoryRows]) => (
                <div key={categoryName} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ color: S.text, fontSize: 14, fontWeight: 800 }}>{categoryName}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    {categoryRows.map((row, index) => <BoomsaleRowCard key={`${row.artikel}-${index}`} row={row} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : isReceipt ? (
            <ReceiptInfoTable rows={receiptRows} isMobile={isMobile} />
          ) : isSku ? (
            sortedSkuRows.map((row, index) => <SkuRowCard key={`${row.sku}-${index}`} row={row} />)
          ) : isBersyarat ? (
            <>
              {conditionalRows.map((row, index) => <ConditionalRowCard key={`${(row as any).nik}-${index}`} row={row as any} userNik={user.nik} />)}
              <SoldIncentiveRecapCard rows={soldIncentiveRows} isMobile={isMobile} />
            </>
          ) : (
            unconditionalRows.map((row, index) => <UnconditionalRowCard key={`${(row as any).nik}-${index}`} row={row as any} userNik={user.nik} />)
          )}
        </div>
      </main>
    </div>
  )
}

export default function ForecastingInsentif({ user, onBack }: Props) {
  const [subPage, setSubPage] = useState<SubPage | null>(null)
  const { data, loading } = useIncentiveData()
  const isMobile = useMobile(720)

  const summary = useMemo<IncentiveSummaryItem[]>(() => {
    if (!data) return []

    const conditionalRows = filterUserRows(data.conditional.rows, user.nik, user.nama)
    const unconditionalRows = filterUserRows(data.unconditional.rows, user.nik, user.nama)
    const conditionalAchieved = conditionalRows.reduce((sum, row) => sum + row.items.filter(item => isStatusFulfilled(item.status || '')).reduce((subSum, item) => subSum + item.amount, 0), 0)
    const conditionalPotential = conditionalRows.reduce((sum, row) => sum + row.items.filter(item => !isStatusFulfilled(item.status || '')).reduce((subSum, item) => subSum + item.amount, 0), 0)
    const unconditionalAchieved = unconditionalRows.reduce((sum, row) => sum + row.value, 0)

    return [
      {
        name: 'Insentif Bersyarat',
        type: 'bersyarat',
        achieved: conditionalAchieved,
        forecast: conditionalPotential,
      },
      {
        name: 'Insentif Tanpa Syarat',
        type: 'tanpa_syarat',
        achieved: unconditionalAchieved,
        forecast: 0,
      },
      {
        name: 'Daftar Insentif',
        type: 'list',
        achieved: 5,
        forecast: 0,
        extra: 'Submenu: Toko, Insentif Lainnya, Produk Insentif Bulan Ini, SKU Lainnya',
      },
    ]
  }, [data, user.nik, user.nama])

  const totalPotential =
  summary.find(item => item.type === 'bersyarat')?.forecast ?? 0

const totalAchieved = summary
  .filter(item => item.type !== 'sku' && item.type !== 'list')
  .reduce((sum, item) => sum + item.achieved, 0)

const totalProjected = totalAchieved + totalPotential

  if (subPage) {
    return <SubPageView type={subPage} data={data} user={user} isMobile={isMobile} onBack={() => setSubPage(null)} onSelectSubPage={setSubPage} />
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg }}>
      <header style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '16px 18px' : '14px 32px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' }}>
          <img src={azkoLogo} alt="Azko" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center', boxShadow: '0 2px 8px rgba(217,49,25,0.25)' }}/>
          <span style={{ color: S.text, fontWeight: 800, fontSize: 14, letterSpacing: '0.06em' }}>ATLAS</span>
          <div style={{ width: 1, height: 20, background: S.border }} />
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0, transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = S.text }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = S.muted }}
          >← Menu</button>
        </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: isMobile ? 'flex-start' : 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>FORECASTING INSENTIF</span>
            <span style={{ color: S.muted, fontSize: 12 }}>{user.nama}</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: isMobile ? '100%' : 1100, margin: '0 auto', padding: isMobile ? '18px 14px' : '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.65fr 1fr', gap: 20, alignItems: 'stretch' }}>
          <div style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 100%)', minHeight: 260, padding: isMobile ? '22px 20px' : '28px 30px', boxShadow: '0 20px 50px rgba(67, 56, 202, 0.18)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
            <div style={{ position: 'absolute', right: -40, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.14)' }} />
            <div style={{ position: 'absolute', right: 20, bottom: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)' }} />
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-start', gap: 20 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12 }}>Total Insentif Anda</div>
                <div style={{ color: '#ffffff', fontSize: 36, fontWeight: 900, lineHeight: 1.05, maxWidth: 360 }}>{formatRupiahFull(totalProjected)}</div>
              </div>
              <div style={{ display: 'inline-flex', flexShrink: 0, alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: '10px 14px', color: '#ffffff', fontSize: 12, fontWeight: 700, marginTop: isMobile ? 12 : 0, whiteSpace: 'nowrap' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.24)', display: 'grid', placeItems: 'center' }}>👤</span>
                NIK {user.nik}
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '12px 16px', color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', fontSize: 14 }}>↗</span>
              Total keseluruhan insentif
            </div>
          </div>
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ borderRadius: 24, padding: '24px 22px', background: '#ecfdf5', border: '1px solid #bbf7d0', boxShadow: '0 12px 28px rgba(16, 185, 129, 0.12)', minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'grid', placeItems: 'center', fontSize: 18 }}>✓</div>
                  <div style={{ color: '#15803d', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Insentif Cair</div>
                </div>
                <div style={{ color: '#0f172a', fontSize: 30, fontWeight: 900, marginBottom: 10 }}>{formatRupiahFull(totalAchieved)}</div>
              </div>
              <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.65 }}>Insentif yang sudah memenuhi syarat dan siap dicairkan.</div>
            </div>
            <div style={{ borderRadius: 24, padding: '24px 22px', background: '#ffedd5', border: '1px solid #fed7aa', boxShadow: '0 12px 28px rgba(251, 146, 60, 0.12)', minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff7ed', color: '#ea580c', display: 'grid', placeItems: 'center', fontSize: 18 }}>⏳</div>
                  <div style={{ color: '#9a3412', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Potensial Insentif</div>
                </div>
                <div style={{ color: '#0f172a', fontSize: 30, fontWeight: 900, marginBottom: 10 }}>{formatRupiahFull(totalPotential)}</div>
              </div>
              <div style={{ color: '#6b4226', fontSize: 13, lineHeight: 1.65 }}>Insentif yang masih bersyarat dan belum terpenuhi.</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ScanArticlePanel data={data} isMobile={isMobile} />
          <div>
            <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Ringkasan per Tipe Insentif</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {loading ? (
                <div style={{ gridColumn: '1 / -1', padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, color: '#92400e', fontSize: 13 }}>
                  Memuat data insentif dari sheet...
                </div>
              ) : summary.map(item => (
                <SummaryCard key={item.type} item={item} onClick={() => setSubPage(item.type)} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
