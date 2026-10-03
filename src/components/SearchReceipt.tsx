import { useCallback, useEffect, useState } from 'react'
import { fetchCopasS2TableData } from '../services/rawDataApi'
import { canonicalNik } from '../services/nik'
import { useMobile } from '../hooks/useMobile'
import type { User } from '../data/mockData'

type ReceiptRecord = {
  id: number
  cells: string[]
  nik: string
  date: string
}

interface Props {
  user: User
  onBack: () => void
}

const receiptHeaders = [
  'NIK', 'NAMA', 'TANGGAL', 'NO RECEIPT', 'ARTIKEL', 'DEPARTEMEN',
  'KODE DEPT', 'QTY', 'HARGA', 'DISCOUNT', 'INCLUDE PPN', 'EXCLUDE PPN',
]
const pageSize = 50
const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: 40,
  padding: '0 11px',
  border: '1px solid #dbe3ef',
  borderRadius: 7,
  background: '#fff',
  color: '#172b4d',
  fontSize: 13,
  outlineColor: '#0e7490',
}
const monthNumbers: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
  aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10',
  october: '10', nov: '11', november: '11', dec: '12', december: '12',
}

function buildRecords(rows: string[][]): ReceiptRecord[] {
  let lastNik = ''
  return rows.map((row, id) => {
    const nama = (row[1] ?? '').trim()
    const explicitNik = (row[0] ?? '').trim()
    if (nama.toUpperCase() === 'NONAME') lastNik = ''
    else if (/^(I\d{5}|\d{4,})$/i.test(explicitNik)) lastNik = explicitNik

    return {
      id,
      cells: receiptHeaders.map((_, index) => row[index] ?? ''),
      nik: nama.toUpperCase() === 'NONAME' ? '' : lastNik,
      date: (row[2] ?? '').trim(),
    }
  })
}

export function codeContainsFilter(value: string, filter: string): boolean {
  const query = filter.trim().toLowerCase()
  if (!query) return true
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedQuery = normalize(query)
  return normalizedQuery
    ? normalize(value).includes(normalizedQuery)
    : value.toLowerCase().includes(query)
}

function matchesSelectedDate(value: string, selectedDate: string): boolean {
  if (!selectedDate) return true
  const [year, month, day] = selectedDate.split('-')
  const raw = value.trim().split(/[ T]/)[0]
  const parts = raw.split(/[/.\-]/)
  if (parts.length !== 3) return raw.toLowerCase().includes(selectedDate.toLowerCase())

  if (parts[0].length === 4) {
    return parts[0] === year && parts[1].padStart(2, '0') === month && parts[2].padStart(2, '0') === day
  }

  const first = parts[0].padStart(2, '0')
  const monthPart = parts[1].toLowerCase()
  const second = monthNumbers[monthPart] ?? monthNumbers[monthPart.slice(0, 3)] ?? monthPart.padStart(2, '0')
  const rawYear = parts[2]
  return rawYear === year && ((first === day && second === month) || (first === month && second === day))
}

function parseAmount(value: string): number {
  let normalized = value.replace(/[^\d,.-]/g, '')
  if (!normalized) return 0

  const commaIndex = normalized.lastIndexOf(',')
  const dotIndex = normalized.lastIndexOf('.')
  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized = commaIndex > dotIndex
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '')
  } else if (commaIndex >= 0) {
    const decimalDigits = normalized.length - commaIndex - 1
    normalized = decimalDigits === 3 ? normalized.replace(/,/g, '') : normalized.replace(',', '.')
  } else if (dotIndex >= 0 && normalized.length - dotIndex - 1 === 3) {
    normalized = normalized.replace(/\./g, '')
  }

  return Number(normalized) || 0
}

const formatSales = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export default function SearchReceipt({ user, onBack }: Props) {
  const isMobile = useMobile()
  const [records, setRecords] = useState<ReceiptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nikFilter, setNikFilter] = useState('')
  const [receiptFilter, setReceiptFilter] = useState('')
  const [articleFilter, setArticleFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCopasS2TableData()
      setRecords(buildRecords(data.rows))
      setPage(1)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const normalizedNik = nikFilter.trim()
  const normalizedCanonicalNik = normalizedNik ? canonicalNik(normalizedNik).toLowerCase() : ''
  const filteredRecords = records.filter(record => {
    if (normalizedNik) {
      const recordNik = record.nik.toLowerCase()
      const canonicalRecordNik = canonicalNik(record.nik).toLowerCase()
      if (!recordNik.includes(normalizedNik.toLowerCase()) && !canonicalRecordNik.includes(normalizedCanonicalNik)) return false
    }
    if (!codeContainsFilter(record.cells[3] ?? '', receiptFilter)) return false
    if (!codeContainsFilter(record.cells[4] ?? '', articleFilter)) return false
    if (dateFilter && !matchesSelectedDate(record.date, dateFilter)) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const visibleRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize)
  const filteredSales = filteredRecords.reduce((total, record) => total + parseAmount(record.cells[11] ?? ''), 0)
  const hasFilters = Boolean(nikFilter || receiptFilter || articleFilter || dateFilter)

  const clearFilters = () => {
    setNikFilter('')
    setReceiptFilter('')
    setArticleFilter('')
    setDateFilter('')
    setPage(1)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', color: '#172b4d' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #dfe6ef', padding: isMobile ? '12px 16px' : '14px 28px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} title="Kembali ke menu" aria-label="Kembali ke menu" style={{ width: 36, height: 36, border: '1px solid #dbe3ef', borderRadius: 7, background: '#fff', color: '#475569', fontSize: 20, cursor: 'pointer' }}>‹</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>ATLAS · {user.nama}</div>
            <h1 style={{ margin: 0, fontSize: 18, lineHeight: 1.3, fontWeight: 800 }}>Search Receipt</h1>
          </div>
          <button onClick={() => void loadData()} disabled={loading} style={{ height: 36, padding: '0 12px', border: '1px solid #dbe3ef', borderRadius: 7, background: '#fff', color: '#334155', fontSize: 12, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: '0 auto', padding: isMobile ? 14 : 24 }}>
        <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(150px, 1fr))', gap: 10, alignItems: 'end', marginBottom: 14 }}>
          <label style={{ display: 'grid', gap: 5, color: '#475569', fontSize: 11, fontWeight: 700 }}>
            NIK · kolom A
            <input value={nikFilter} onChange={event => { setNikFilter(event.target.value); setPage(1) }} placeholder="Cari NIK" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 5, color: '#475569', fontSize: 11, fontWeight: 700 }}>
            No Receipt · kolom D
            <input value={receiptFilter} onChange={event => { setReceiptFilter(event.target.value); setPage(1) }} placeholder="Cari nomor receipt" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 5, color: '#475569', fontSize: 11, fontWeight: 700 }}>
            Artikel · kolom E
            <input value={articleFilter} onChange={event => { setArticleFilter(event.target.value); setPage(1) }} placeholder="Cari artikel" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 5, color: '#475569', fontSize: 11, fontWeight: 700 }}>
            Tanggal transaksi · kolom C
            <input type="date" value={dateFilter} onChange={event => { setDateFilter(event.target.value); setPage(1) }} style={inputStyle} />
          </label>
        </section>

        <div style={{ minHeight: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ color: '#64748b', fontSize: 12 }}>
            {loading ? 'Mengambil data COPAS S2…' : `${filteredRecords.length.toLocaleString('id-ID')} hasil dari ${records.length.toLocaleString('id-ID')} baris`}
            {!loading && <span> · COPAS S2 A:L</span>}
          </div>
          {hasFilters && <button onClick={clearFilters} style={{ border: 0, background: 'transparent', color: '#0e7490', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Hapus filter</button>}
        </div>

        {error && (
          <div role="alert" style={{ marginBottom: 12, padding: 12, border: '1px solid #fecaca', borderRadius: 7, background: '#fff7f7', color: '#991b1b', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>{error}</span>
            <button onClick={() => void loadData()} style={{ border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', background: '#fff', color: '#991b1b', fontWeight: 700, cursor: 'pointer' }}>Coba lagi</button>
          </div>
        )}

        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 270px)', minHeight: 260, border: '1px solid #dbe3ef', borderRadius: 7, background: '#fff' }}>
          <table style={{ width: '100%', minWidth: 1420, borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#edf3f8' }}>
              <tr>
                {receiptHeaders.map((header, index) => (
                  <th key={header} style={{ position: 'sticky', top: 0, padding: '10px 11px', borderBottom: '1px solid #dbe3ef', textAlign: 'left', whiteSpace: 'nowrap', color: '#334155', fontWeight: 800 }}>
                    <span style={{ color: '#0e7490' }}>{String.fromCharCode(65 + index)}</span>{' · '}{header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map(record => (
                <tr key={record.id} style={{ background: record.id % 2 === 0 ? '#fff' : '#f9fbfd' }}>
                  {record.cells.slice(0, 12).map((cell, index) => (
                    <td key={`${record.id}-${index}`} style={{ padding: '9px 11px', borderBottom: '1px solid #eef2f6', whiteSpace: 'nowrap', color: '#334155', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }} title={cell}>{cell || '—'}</td>
                  ))}
                </tr>
              ))}
              {!loading && !error && visibleRecords.length === 0 && (
                <tr><td colSpan={receiptHeaders.length} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>Tidak ada data yang cocok dengan filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, padding: '14px 16px', border: '1px solid #cbdde3', borderRadius: 7, background: '#edf7f8' }}>
          <div>
            <div style={{ color: '#526a72', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em' }}>TOTAL SALES ID · JUMLAH KOLOM L</div>
            <div style={{ marginTop: 3, color: '#526a72', fontSize: 11 }}>Berdasarkan {filteredRecords.length.toLocaleString('id-ID')} baris hasil filter</div>
          </div>
          <strong style={{ color: '#0e5968', fontSize: isMobile ? 17 : 21, textAlign: 'right' }}>{formatSales.format(filteredSales)}</strong>
        </section>

        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 12, color: '#64748b', fontSize: 12 }}>
          <span>Halaman {page} dari {pageCount} · {pageSize} baris per halaman</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} style={{ height: 34, padding: '0 11px', border: '1px solid #dbe3ef', borderRadius: 6, background: '#fff', color: '#334155', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Sebelumnya</button>
            <button onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={page >= pageCount} style={{ height: 34, padding: '0 11px', border: '1px solid #dbe3ef', borderRadius: 6, background: '#fff', color: '#334155', cursor: page >= pageCount ? 'not-allowed' : 'pointer', opacity: page >= pageCount ? 0.5 : 1 }}>Berikutnya</button>
          </div>
        </footer>
      </main>
    </div>
  )
}
