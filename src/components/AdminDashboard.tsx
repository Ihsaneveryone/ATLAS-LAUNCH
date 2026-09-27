import { useState, useEffect, useRef, useCallback } from 'react'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import { formatRupiah, formatRupiahFull, type User } from '../data/mockData'
import { useAtlasData } from '../context/useAtlasData'
import { useMobile } from '../hooks/useMobile'
import { fetchAllYTD, fetchSIDDataSignature, type YTDEmployee } from '../services/rawDataApi'
import { niksMatch } from '../services/nik'
import { fetchPencapaianDept, type DeptPeriodData, type DeptTrendData } from '../services/deptApi'
import { getTrackerUrl, setTrackerUrl, writeMenuConfigToSheet } from '../services/loginTracker'
import { getMenuSettings, setMenuSetting } from './MenuPage'
import { useAdminSettings } from '../context/AdminSettingsContext'
import { DataLoadingOverlay } from './LoadingSkeletons'
import ColumnMappingPanel from './ColumnMappingPanel'
import { parseIncentiveSheets, type IncentiveBoomsaleRow, type IncentiveReceiptRow } from '../services/incentiveParser'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

type NavPage = 'today' | 'mtd' | 'fullmonth' | 'ytd' | 'dept' | 'tv' | 'receipt' | 'setting'
type SortKey = 'nama' | 'jobTitle' | 'sales' | 'achievement' | 'transaksi' | 'upt' | 'qty' | 'basketSize' | 'aur' | 'newMember'
type SortOrder = 'asc' | 'desc'
type RankingRow = { nama: string; jobTitle?: string; protectionQty?: number; achievement: number; value: number; rank?: number; target?: number }
type TVSlideKey = 'today' | 'mtd' | 'fullmonth' | 'dept' | 'receipt' | 'incentive_products'

const TV_DISPLAY_OPTIONS: Array<{ key: TVSlideKey; label: string; description: string }> = [
  { key: 'today', label: 'Performance Today', description: 'Ranking performa hari ini' },
  { key: 'mtd', label: 'Performance MTD', description: 'Ranking performa bulan berjalan' },
  { key: 'fullmonth', label: 'Performance Full Month', description: 'Ranking terhadap target satu bulan penuh' },
  { key: 'dept', label: 'Performance Departemen', description: 'Ringkasan dan tren performa departemen' },
  { key: 'receipt', label: 'Insentif Receipt', description: 'Progress qualifying receipt dan total insentif karyawan' },
  { key: 'incentive_products', label: 'Insentif Produk', description: 'Produk yang memenuhi target qty toko' },
]

function getTVDisplaySettings(): Record<TVSlideKey, boolean> {
  const saved = getMenuSettings()
  return {
    today: saved.tv_today !== false,
    mtd: saved.tv_mtd !== false,
    fullmonth: saved.tv_fullmonth !== false,
    dept: saved.tv_dept !== false,
    receipt: saved.tv_receipt !== false,
    incentive_products: saved.tv_incentive_products !== false,
  }
}

const S = {
  bg: '#f0f4ff', panel: '#fff', card: '#f8faff',
  border: '#e8edf8', text: '#1e293b', sub: '#64748b', muted: '#94a3b8',
  red: '#D93119',
}

function formatSettingValue(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}Jt`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}Rb`
  return `${value}`
}

function acPct(pct: number) {
  if (pct >= 100) return '#2563eb'
  if (pct >= 95)  return '#16a34a'
  if (pct >= 90)  return '#ca8a04'
  if (pct >= 80)  return '#db2777'
  return '#dc2626'
}
function bgPct(pct: number) {
  if (pct >= 100) return '#eff6ff'
  if (pct >= 95)  return '#f0fdf4'
  if (pct >= 90)  return '#fefce8'
  if (pct >= 80)  return '#fdf2f8'
  return '#fff1f2'
}

const ZONE_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  hijau:  { dot: '#16a34a', bg: '#dcfce7', text: '#166534' },
  biru:   { dot: '#2563eb', bg: '#dbeafe', text: '#1e3a8a' },
  kuning: { dot: '#ca8a04', bg: '#fef9c3', text: '#854d0e' },
  oranye: { dot: '#ea580c', bg: '#ffedd5', text: '#9a3412' },
  pink:   { dot: '#db2777', bg: '#fdf2f8', text: '#9d174d' },
  merah:  { dot: '#dc2626', bg: '#fee2e2', text: '#991b1b' },
}
function zoneStyle(raw: string) {
  const key = (raw ?? '').toLowerCase().split(' ')[0]
  return ZONE_COLORS[key] ?? { dot: S.muted, bg: S.card, text: S.muted }
}

const QUAD_COLORS: Record<string, string> = { '1': '#16a34a', '2': '#2563eb', '3': '#d97706', '4': '#dc2626' }
function quadColor(raw: string) { const m = (raw ?? '').match(/(\d)/); return QUAD_COLORS[m?.[1] ?? '4'] ?? S.muted }

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }: { label: string; value: string; sub: string; accent: string; icon: string }) {
  return (
    <div style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, padding: '20px', borderLeft: `4px solid ${accent}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontSize: 20 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: S.muted }}>{sub}</div>
    </div>
  )
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 3, height: 18, background: S.red, borderRadius: 2, flexShrink: 0, alignSelf: 'center' }}/>
      <div style={{ fontSize: 14, fontWeight: 800, color: S.text }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: S.muted }}>{sub}</div>}
    </div>
  )
}

function TVSlideshow({
  todayRanking,
  mtdRanking,
  fullMonthRanking,
  receiptRows,
  receiptLoading,
  onSlideEnd,
  sidUpdatedAt,
  visibleSlides,
  deptSbd,
  deptMtd,
  deptTrend,
  dailyDate,
}: {
  todayRanking: Array<{ nama: string; jobTitle?: string; protectionQty?: number; achievement: number; value: number; rank?: number }>
  mtdRanking: Array<{ nama: string; jobTitle?: string; protectionQty?: number; achievement: number; value: number; rank?: number }>
  fullMonthRanking: Array<{ nama: string; jobTitle?: string; protectionQty?: number; achievement: number; value: number; rank?: number }>
  receiptRows: IncentiveReceiptRow[]
  receiptLoading: boolean
  onSlideEnd: () => void
  sidUpdatedAt: Date | null
  visibleSlides: Record<TVSlideKey, boolean>
  deptSbd: DeptPeriodData | null
  deptMtd: DeptPeriodData | null
  deptTrend: DeptTrendData | null
  dailyDate: string
}) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [transitionSlide, setTransitionSlide] = useState<number | null>(null)
  const [eligibleProducts, setEligibleProducts] = useState<IncentiveBoomsaleRow[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const onSlideEndRef = useRef(onSlideEnd)

  useEffect(() => {
    onSlideEndRef.current = onSlideEnd
  }, [onSlideEnd])

  useEffect(() => {
    let cancelled = false
    const loadProducts = async () => {
      try {
        const sheetId = '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38'
        const sheetNames = ['INSENTIF BOOMSALE', 'COPAS S2']
        const rows = await Promise.all(sheetNames.map(async (sheet) => {
          const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_t=${Date.now()}`
          const response = await fetch(url, { cache: 'no-store' })
          const text = await response.text()
          if (!response.ok || text.trimStart().startsWith('<!')) return []
          return parseCsv(text)
        }))
        const parsed = parseIncentiveSheets({
          'INSENTIF BOOMSALE': rows[0] ?? [],
          'COPAS S2': rows[1] ?? [],
        })
        const qualified = parsed.boomsale.rows
          .filter((product) => (product.targetQty ?? 0) > 0 && (product.actualQty ?? 0) >= (product.targetQty ?? 0))
          .sort((left, right) => (right.actualQty ?? 0) - (left.actualQty ?? 0) || left.name.localeCompare(right.name, 'id-ID'))
        if (!cancelled) setEligibleProducts(qualified)
      } catch (error) {
        console.warn('[TV] Error loading qualified incentive products:', error)
        if (!cancelled) setEligibleProducts([])
      } finally {
        if (!cancelled) setProductsLoading(false)
      }
    }
    void loadProducts()
    return () => { cancelled = true }
  }, [])

  const chunkRanking = (rows: RankingRow[], size = 20) => {
    if (!rows.length) return [[]] as RankingRow[][]
    const pages: RankingRow[][] = []
    for (let i = 0; i < rows.length; i += size) {
      pages.push(rows.slice(i, i + size))
    }
    return pages
  }

  const chunkProducts = (rows: IncentiveBoomsaleRow[], size = 16) => {
    if (!rows.length) return [[]] as IncentiveBoomsaleRow[][]
    const pages: IncentiveBoomsaleRow[][] = []
    for (let index = 0; index < rows.length; index += size) pages.push(rows.slice(index, index + size))
    return pages
  }

  const eligibleProductPages = chunkProducts(eligibleProducts)
  const sortedReceiptRows = [...receiptRows].sort((left, right) => right.qualifyingReceipt - left.qualifyingReceipt || right.totalValueReceipt - left.totalValueReceipt)
  const receiptPages: IncentiveReceiptRow[][] = []
  for (let index = 0; index < sortedReceiptRows.length; index += 12) receiptPages.push(sortedReceiptRows.slice(index, index + 12))
  if (receiptPages.length === 0) receiptPages.push([])

  const contentSlides: Array<{
    key: string
    label: string
    subtitle: string
    pageNumber?: string
    ranking: RankingRow[]
    fullRanking?: RankingRow[]
    receipts?: IncentiveReceiptRow[]
    products?: IncentiveBoomsaleRow[]
  }> = [
    ...[
      { key: 'today' as const, label: 'PERFORMANCE TODAY', subtitle: '', ranking: chunkRanking(todayRanking) },
      { key: 'mtd' as const, label: 'PERFORMANCE MONTH TO DATE (MTD)', subtitle: '', ranking: chunkRanking(mtdRanking) },
      { key: 'fullmonth' as const, label: 'PERFORMANCE FULL MONTH ( SATU BULAN)', subtitle: '', ranking: chunkRanking(fullMonthRanking) },
    ].filter(group => visibleSlides[group.key]).flatMap((group) =>
      group.ranking.map((page, idx) => ({
        key: `${group.key}-${idx}`,
        label: group.label,
        subtitle: group.ranking.length > 1 ? `${group.subtitle} • Hal ${idx + 1}/${group.ranking.length}` : group.subtitle,
        pageNumber: `${idx + 1}/${group.ranking.length}`,
        ranking: page,
        fullRanking: group.ranking.flat(),
      }))
    ),
    ...(visibleSlides.dept ? [{ key: 'dept', label: 'PERFORMANCE DEPARTEMEN', subtitle: 'SBD vs MTD', ranking: [] as Array<{ nama: string; achievement: number; value: number; rank?: number }> }] : []),
    ...(visibleSlides.receipt ? receiptPages.map((rows, index) => ({
      key: `receipt-${index}`,
      label: 'INSENTIF RECEIPT',
      subtitle: '',
      pageNumber: `${index + 1}/${receiptPages.length}`,
      ranking: [] as RankingRow[],
      receipts: rows,
    })) : []),
    ...(visibleSlides.incentive_products ? eligibleProductPages.map((products, index) => ({
      key: `incentive-products-${index}`,
      label: 'INSENTIF PRODUK S&K TERPENUHI',
      subtitle: '',
      pageNumber: `${index + 1}/${eligibleProductPages.length}`,
      ranking: [] as RankingRow[],
      products,
    })) : []),
  ]
  const slides = [
    {
      key: 'welcome',
      label: '',
      subtitle: 'PERFORMANCE SALES ID & INSENTIF',
      ranking: [] as RankingRow[],
    },
    ...contentSlides,
  ]

  const [deptTrendIndex, setDeptTrendIndex] = useState(0)
  const [deptZoneIndex, setDeptZoneIndex] = useState(0)

  useEffect(() => {
    if (activeSlide >= slides.length) {
      setActiveSlide(0)
      setTransitionSlide(null)
    }
  }, [activeSlide, slides.length])

  const active = slides[activeSlide] ?? {
    key: 'empty',
    label: 'TV DISPLAY NONAKTIF',
    subtitle: '',
    ranking: [] as RankingRow[],
  }
  const receiptGridColumns = 'minmax(150px, 1.55fr) minmax(108px, 0.9fr) minmax(118px, 0.95fr) minmax(130px, 1.05fr) minmax(145px, 1.15fr) minmax(145px, 1.15fr) minmax(145px, 1.15fr) minmax(104px, 0.9fr)'
  const rankedList = [...(active.fullRanking ?? active.ranking)].sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0))
  const topTen = rankedList.slice(0, 10)
  const bottomTen = [...rankedList].slice(-10).map((row, index) => ({
    ...row,
    actualRank: row.rank ?? rankedList.length - 9 + index,
  }))
  const bottomTenRankSet = new Set(bottomTen.map((row) => row.rank ?? row.actualRank ?? 0))
  const totalTim = rankedList.reduce((sum: number, row: RankingRow) => sum + row.value, 0)
  const avgAch = rankedList.reduce((sum: number, row: RankingRow) => sum + row.achievement, 0) / Math.max(rankedList.length, 1)
  const topLeader = rankedList[0]
  const bottomLeader = rankedList[rankedList.length - 1]
  const deptPrimary = deptMtd ?? deptSbd
  const deptSecondary = deptSbd ?? deptMtd
  const sbdDeptRows = deptSbd?.departments?.filter((item) => item.kind !== 'zone') ?? []
  const mtdDeptRows = deptMtd?.departments?.filter((item) => item.kind !== 'zone') ?? []
  const getDeptAchievement = (item: { achievement?: number; target?: number; value: number }) => {
    if (typeof item.achievement === 'number') return item.achievement
    if (item.target && item.target > 0) return (item.value / item.target) * 100
    return 0
  }
  const getAchievementBadgeStyle = (achievement?: number) => {
    if (typeof achievement !== 'number') return { color: '#cbd5e1', background: 'rgba(148, 163, 184, 0.12)' }
    if (achievement > 100) return { color: '#ffffff', background: '#2563eb' }
    if (achievement >= 95) return { color: '#ffffff', background: '#16a34a' }
    if (achievement >= 90) return { color: '#422006', background: '#eab308' }
    if (achievement >= 80) return { color: '#ffffff', background: '#db2777' }
    return { color: '#ffffff', background: '#dc2626' }
  }
  const topDept = [...mtdDeptRows].sort((left, right) => getDeptAchievement(right) - getDeptAchievement(left))[0] ?? null
  const bottomDept = [...mtdDeptRows].sort((left, right) => getDeptAchievement(left) - getDeptAchievement(right))[0] ?? null
  const deptTrendSeries = (deptTrend?.points ?? []).map(point => ({
    date: point.date,
    total: point.deptValues.reduce((sum, value) => sum + value, 0),
    avgAchievement: point.deptAchievements.length
      ? point.deptAchievements.reduce((sum, value) => sum + value, 0) / point.deptAchievements.length
      : 0,
  }))
  const zoneOrder = ['Hobbies & Lifestyle', 'Home Improvement', 'Home Living']
  const inferDeptZone = (label: string) => {
    const normalized = label.toLowerCase()
    if (/(automotive|lg aquapet|outdoor comfort|sports & health|travels|trendy goods)/i.test(normalized)) return 'Hobbies & Lifestyle'
    if (/(electrical|fans|lighting|locker|paint|plumbing|safes|tools)/i.test(normalized)) return 'Home Improvement'
    if (/(appliances|cleaning|home comfort|home storage|kitchenware)/i.test(normalized)) return 'Home Living'
    return label
  }

  const deptZoneGroups = Array.from(
    new Set([
      ...((deptSbd?.departments ?? []).map((dept) => dept.zone || inferDeptZone(dept.label))),
      ...((deptMtd?.departments ?? []).map((dept) => dept.zone || inferDeptZone(dept.label))),
    ]),
  )
    .sort((left, right) => {
      const leftIndex = zoneOrder.indexOf(left)
      const rightIndex = zoneOrder.indexOf(right)
      const leftRank = leftIndex === -1 ? 999 : leftIndex
      const rightRank = rightIndex === -1 ? 999 : rightIndex
      return leftRank - rightRank
    })
    .map((zoneName) => {
      const sbdZone = deptSbd?.zones?.find((zone) => zone.zone === zoneName) ?? null
      const mtdZone = deptMtd?.zones?.find((zone) => zone.zone === zoneName) ?? null
      const deptRows = Array.from(
        new Set([
          ...((sbdZone?.departments ?? []) .map((dept) => dept.label)),
          ...((mtdZone?.departments ?? []) .map((dept) => dept.label)),
          ...((deptSbd?.departments ?? []).filter((dept) => dept.kind !== 'zone' && (dept.zone || inferDeptZone(dept.label)) === zoneName).map((dept) => dept.label)),
          ...((deptMtd?.departments ?? []).filter((dept) => dept.kind !== 'zone' && (dept.zone || inferDeptZone(dept.label)) === zoneName).map((dept) => dept.label)),
        ]),
      ).map((label) => {
        const sbd = (sbdZone?.departments ?? []).find((item) => item.label === label)
          ?? (deptSbd?.departments ?? []).find((item) => item.kind !== 'zone' && (item.zone || inferDeptZone(item.label)) === zoneName && item.label === label)
          ?? null
        const mtd = (mtdZone?.departments ?? []).find((item) => item.label === label)
          ?? (deptMtd?.departments ?? []).find((item) => item.kind !== 'zone' && (item.zone || inferDeptZone(item.label)) === zoneName && item.label === label)
          ?? null
        return { label, sbd, mtd }
      }).sort((left, right) =>
        getDeptAchievement(right.mtd ?? { value: 0 }) - getDeptAchievement(left.mtd ?? { value: 0 })
        || getDeptAchievement(right.sbd ?? { value: 0 }) - getDeptAchievement(left.sbd ?? { value: 0 }),
      )
      const trendIndexes = deptRows
        .map((dept) => deptTrend?.labels.findIndex((label) => label === dept.label) ?? -1)
        .filter((index) => index >= 0)
      return { zoneName, sbdZone, mtdZone, deptRows, trendIndexes }
    })
  const deptCycleDuration = deptZoneGroups.reduce(
    (duration, zone) => duration + (zone.trendIndexes.length > 0 ? zone.trendIndexes.length * 3000 : 7000),
    0,
  )
  const activeDeptZone = deptZoneGroups[deptZoneIndex % Math.max(deptZoneGroups.length, 1)] ?? null

  useEffect(() => {
    if (transitionSlide !== null || slides.length === 0) return

    const activeSlideKey = slides[activeSlide]?.key
    const isDeptSlide = activeSlideKey === 'dept'
    const isProductSlide = activeSlideKey?.startsWith('incentive-products-') ?? false
    const isReceiptSlide = activeSlideKey?.startsWith('receipt-') ?? false
    const duration = isDeptSlide ? Math.max(deptCycleDuration, 7000) : isProductSlide ? 12000 : isReceiptSlide ? 5000 : 7000
    const timer = window.setTimeout(() => {
      onSlideEndRef.current()
      const nextSlide = activeSlide === slides.length - 1 ? 0 : activeSlide + 1
      if (slides[nextSlide]?.key === 'welcome' || slides[activeSlide]?.label === slides[nextSlide]?.label) {
        setActiveSlide(nextSlide)
        return
      }

      setTransitionSlide(nextSlide)
      window.setTimeout(() => {
        setActiveSlide(nextSlide)
        setTransitionSlide(null)
      }, 1600)
    }, duration)

    return () => window.clearTimeout(timer)
  }, [
    activeSlide,
    transitionSlide,
    slides.length,
    deptCycleDuration,
    visibleSlides.today,
    visibleSlides.mtd,
    visibleSlides.fullmonth,
    visibleSlides.dept,
    visibleSlides.receipt,
    visibleSlides.incentive_products,
  ])

  useEffect(() => {
    if (slides[activeSlide]?.key !== 'dept') return
    setDeptZoneIndex(0)
    setDeptTrendIndex(deptZoneGroups[0]?.trendIndexes[0] ?? 0)
  }, [activeSlide])

  useEffect(() => {
    if (slides[activeSlide]?.key !== 'dept' || deptZoneGroups.length === 0) return

    const currentZoneIndex = deptZoneIndex % deptZoneGroups.length
    const currentZone = deptZoneGroups[currentZoneIndex]
    const trendIndexes = currentZone?.trendIndexes ?? []
    if (trendIndexes.length === 0) {
      const timer = window.setTimeout(() => {
        if (currentZoneIndex === deptZoneGroups.length - 1) return
        setDeptZoneIndex((currentZoneIndex + 1) % deptZoneGroups.length)
      }, 7000)
      return () => window.clearTimeout(timer)
    }

    const trendPosition = trendIndexes.indexOf(deptTrendIndex)
    if (trendPosition < 0) {
      setDeptTrendIndex(trendIndexes[0])
      return
    }

    const timer = window.setTimeout(() => {
      if (trendPosition < trendIndexes.length - 1) {
        setDeptTrendIndex(trendIndexes[trendPosition + 1])
        return
      }

      if (currentZoneIndex === deptZoneGroups.length - 1) return

      const nextZoneIndex = currentZoneIndex + 1
      const nextZone = deptZoneGroups[nextZoneIndex]
      setDeptZoneIndex(nextZoneIndex)
      setDeptTrendIndex(nextZone?.trendIndexes[0] ?? 0)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [activeSlide, slides.length, deptZoneIndex, deptTrendIndex, deptTrend?.labels.length, deptSbd, deptMtd])

  const activeTrendIndex = Math.min(deptTrendIndex, Math.max((deptTrend?.labels.length ?? 1) - 1, 0))
  const activeTrendLabel = deptTrend?.labels[activeTrendIndex] ?? 'Dept'
  const activeTrendColor = ['#e1261c', '#f2c511', '#7852d6', '#ff7b68', '#a78bfa', '#d6ad18'][activeTrendIndex % 6]
  const deptTrendByDepartmentSeries = (deptTrend?.points ?? []).map((point) => ({
    date: point.date,
    value: point.deptValues[Math.min(activeTrendIndex, Math.max((point.deptValues.length ?? 1) - 1, 0))] ?? 0,
  }))
  const getRankBadgeStyle = (rank?: number, isBottom10 = false) => {
    if (isBottom10) return {
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.34), rgba(127, 29, 29, 0.24))',
      color: '#fee2e2',
      border: '1px solid rgba(248, 113, 113, 0.42)',
      boxShadow: '0 0 10px rgba(248, 113, 113, 0.2)',
    }
    if (rank === 1) return {
      background: 'linear-gradient(135deg, rgba(180, 145, 255, 0.96), rgba(104, 70, 199, 0.82))',
      color: '#21172f',
      border: '1px solid rgba(196, 181, 253, 0.95)',
      boxShadow: '0 0 16px rgba(120, 82, 214, 0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
    }
    if (rank === 2) return {
      background: 'linear-gradient(135deg, rgba(226, 232, 240, 0.98), rgba(148, 163, 184, 0.8))',
      color: '#0f172a',
      border: '1px solid rgba(203, 213, 225, 0.95)',
      boxShadow: '0 0 16px rgba(148, 163, 184, 0.45), inset 0 1px 0 rgba(255,255,255,0.6)',
    }
    if (rank === 3) return {
      background: 'linear-gradient(135deg, rgba(180, 145, 255, 0.96), rgba(104, 70, 199, 0.82))',
      color: '#21172f',
      border: '1px solid rgba(196, 181, 253, 0.95)',
      boxShadow: '0 0 16px rgba(120, 82, 214, 0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
    }
    return {
      background: 'rgba(148, 163, 184, 0.12)',
      color: '#cbd5e1',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      boxShadow: 'none',
    }
  }
  const getBottomRankBadgeStyle = (rank?: number) => ({
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.34), rgba(127, 29, 29, 0.24))',
    color: '#fee2e2',
    border: '1px solid rgba(248, 113, 113, 0.42)',
    boxShadow: rank === 1 ? '0 0 10px rgba(248, 113, 113, 0.24)' : 'none',
  })

  return (
    <>
      <style>{`
        @keyframes tvSlideIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div style={{ position: 'relative', minHeight: '100vh', height: '100vh', background: 'radial-gradient(circle at top left, #3b2020 0%, #1d171a 36%, #100e12 100%)', borderRadius: 0, overflow: 'hidden', border: 'none', boxShadow: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(225,38,28,0.12), rgba(242,197,17,0.05), rgba(104,70,199,0.08))' }} />

        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', gridTemplateRows: 'auto auto 1fr', padding: '10px 18px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, letterSpacing: '0.16em', fontSize: 10, textTransform: 'uppercase' }}>ATLAS</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ color: '#cbd5e1', fontSize: 10, fontWeight: 700 }}>LIVE</span>
              <div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 18px rgba(34, 197, 94, 0.9)' }} />
              <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700 }}>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <div style={{ color: '#f8fafc', fontSize: 17, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{active.label}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {active.pageNumber ? (
                <div style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(39,27,31,0.82)', border: '1px solid rgba(242,197,17,0.3)', color: '#fff8e1', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>
                  {active.pageNumber}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 6 }}>
                {slides.map((slide, index) => (
                  <span key={slide.key} style={{ width: index === activeSlide ? 28 : 10, height: 8, borderRadius: 999, background: index === activeSlide ? '#e1261c' : 'rgba(214,195,190,0.34)', boxShadow: index === activeSlide ? '0 0 12px rgba(225,38,28,0.72)' : 'none', transition: 'all 0.25s ease' }} />
                ))}
              </div>
            </div>
          </div>

          {contentSlides.length === 0 ? (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#cbd5e1', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
              Semua tampilan TV sedang dinonaktifkan oleh admin.
            </div>
          ) : transitionSlide !== null ? (
            <div style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              background: 'radial-gradient(circle at center, rgba(55,30,34,0.88), rgba(16,14,18,0.98))',
              borderRadius: 20,
              border: '1px solid rgba(148,163,184,0.25)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
              animation: 'tvSlideIn 0.5s ease',
            }}>
              <div style={{ textAlign: 'center', color: '#f8fafc' }}>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1.1, textTransform: 'uppercase' }}>{slides[transitionSlide]?.label}</div>
              </div>
            </div>
          ) : (
          <div key={`${active.key}-${activeSlide}`} style={{ animation: 'tvSlideIn 0.7s cubic-bezier(0.22, 1, 0.36, 1)', willChange: 'transform, opacity', minHeight: 0, overflow: 'hidden', height: '100%' }}>
            {active.key === 'welcome' ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: 0, overflow: 'hidden', borderRadius: 16, border: '1px solid rgba(214,195,190,0.16)', background: 'rgba(29,21,25,0.72)' }}>
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ color: '#d6ad18', fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 16 }}>
                    AZKO ROYAL PLAZA SURABAYA
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: 'clamp(28px, 4.2vw, 54px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.12, textTransform: 'uppercase' }}>
                    Performance Sales ID
                    <br />
                    <span style={{ color: '#e7c84b' }}>&amp; Insentif</span>
                  </div>
                  <div style={{ width: 40, height: 2, margin: '22px auto', borderRadius: 99, background: '#d6ad18' }} />
                  <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, letterSpacing: '0.04em' }}>
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', marginTop: 14 }}>
                    Terakhir diperbarui: {sidUpdatedAt
                      ? sidUpdatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : 'Belum ada perubahan data SID terdeteksi'}
                  </div>
                </div>
              </div>
            ) : active.key.startsWith('receipt-') ? (
              <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 8, height: '100%', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px' }}>
                  <div style={{ color: '#f8df83', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {receiptLoading ? 'Memuat insentif receipt...' : `${receiptRows.length} karyawan`}
                  </div>
                </div>
                {receiptLoading ? (
                  <div style={{ display: 'grid', placeItems: 'center', color: '#cbd5e1', fontSize: 14 }}>Memuat data insentif receipt...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0, overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(214,195,190,0.2)', background: 'rgba(29,21,25,0.88)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: receiptGridColumns, alignItems: 'center', gap: 12, padding: '14px 18px', color: '#e4d8d5', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(45,31,35,0.95)', borderBottom: '1px solid rgba(214,195,190,0.2)' }}>
                      <div>Nama & NIK</div>
                      <div style={{ textAlign: 'right' }}>Qualifying Receipt</div>
                      <div style={{ textAlign: 'right' }}>Target Minimal Cair</div>
                      <div>Progress</div>
                      <div style={{ textAlign: 'right' }}>Total Value Receipt</div>
                      <div style={{ textAlign: 'right' }}>Insentif / Receipt</div>
                      <div style={{ textAlign: 'right' }}>Total Insentif</div>
                      <div style={{ textAlign: 'center' }}>Status</div>
                    </div>
                    {(active.receipts ?? []).length === 0 ? (
                      <div style={{ display: 'grid', placeItems: 'center', color: '#cbd5e1', fontSize: 13 }}>Data Insentif Receipt belum tersedia.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateRows: `repeat(${(active.receipts ?? []).length}, minmax(0, 1fr))`, minHeight: 0 }}>
                        {(active.receipts ?? []).map((row, index) => {
                          const eligible = row.status.toLowerCase().includes('eligible') && !row.status.toLowerCase().includes('non')
                          const progress = Math.min(100, Math.max(0, row.progressToMinimal))
                          return (
                            <div key={`${row.nik}-${row.no}-${index}`} style={{ display: 'grid', gridTemplateColumns: receiptGridColumns, alignItems: 'center', gap: 12, padding: '8px 18px', color: '#f8fafc', fontSize: 12, borderBottom: index === (active.receipts?.length ?? 0) - 1 ? 'none' : '1px solid rgba(214,195,190,0.12)', background: index % 2 === 0 ? 'rgba(45,31,35,0.45)' : 'transparent', minHeight: 0 }}>
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.nama || 'Nama belum tersedia'}</div>
                                <div style={{ marginTop: 3, color: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}>{row.nik || 'NIK belum tersedia'}</div>
                              </div>
                              <div style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{row.qualifyingReceipt.toLocaleString('id-ID')} <span style={{ color: '#94a3b8', fontSize: 10 }}>Receipt</span></div>
                              <div style={{ textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{row.targetMinimalCair.toLocaleString('id-ID')} <span style={{ color: '#94a3b8', fontSize: 10 }}>Receipt</span></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                <div style={{ flex: 1, minWidth: 18, height: 6, background: 'rgba(148,163,184,0.2)', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ width: `${progress}%`, height: '100%', background: eligible ? '#10b981' : '#f97316', borderRadius: 99 }} />
                                </div>
                                <span style={{ color: eligible ? '#6ee7b7' : '#fdba74', fontSize: 11, fontWeight: 800 }}>{progress.toFixed(0)}%</span>
                              </div>
                              <div style={{ textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{formatRupiahFull(row.totalValueReceipt)}</div>
                              <div style={{ textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{formatRupiahFull(row.incentivePerReceipt)}</div>
                              <div style={{ textAlign: 'right', color: '#6ee7b7', fontWeight: 900, whiteSpace: 'nowrap' }}>{formatRupiahFull(row.totalIncentive)}</div>
                              <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                                <span style={{ maxWidth: '100%', color: eligible ? '#6ee7b7' : '#fdba74', background: eligible ? 'rgba(16,185,129,0.14)' : 'rgba(249,115,22,0.14)', border: `1px solid ${eligible ? 'rgba(110,231,183,0.32)' : 'rgba(253,186,116,0.32)'}`, borderRadius: 999, padding: '5px 10px', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.status || 'BELUM ADA STATUS'}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : active.key.startsWith('incentive-products-') ? (
              <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 8, height: '100%', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 2px' }}>
                  <div style={{ color: '#a7f3d0', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {productsLoading ? 'Memuat produk...' : `${eligibleProducts.length} produk memenuhi target qty toko`}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 8, fontWeight: 700 }}>Qty aktual toko ≥ target</div>
                </div>
                {productsLoading ? (
                  <div style={{ display: 'grid', placeItems: 'center', color: '#cbd5e1', fontSize: 14 }}>Memuat data produk insentif...</div>
                ) : (active.products ?? []).length === 0 ? (
                  <div style={{ display: 'grid', placeItems: 'center', background: 'rgba(39,27,31,0.78)', border: '1px solid rgba(214,195,190,0.18)', borderRadius: 16, color: '#e7deda', fontSize: 14 }}>
                    Belum ada produk yang memenuhi target qty toko.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gridTemplateRows: 'repeat(4, minmax(0, 1fr))', gap: 7, minHeight: 0 }}>
                    {(active.products ?? []).map((product) => (
                      <article key={product.artikel} style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) 44px', gap: 4, minWidth: 0, minHeight: 0, overflow: 'hidden', padding: 5, boxSizing: 'border-box', borderRadius: 12, background: 'linear-gradient(150deg, rgba(45,31,35,0.96), rgba(29,21,25,0.94))', border: '1px solid rgba(214,195,190,0.22)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden', borderRadius: 8, background: '#f8fafc', padding: 3, boxSizing: 'border-box' }}>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name || product.artikel} style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', objectPosition: 'center', flexShrink: 0 }} />
                          ) : (
                            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Gambar tidak tersedia</div>
                          )}
                        </div>
                          <div style={{ minWidth: 0, minHeight: 0, display: 'grid', gridTemplateRows: '8px minmax(0, 1fr) 14px', gap: 2, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, color: '#94a3b8', fontSize: 6.5, lineHeight: '8px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', minWidth: 0, overflow: 'hidden' }}>
                            <span>Artikel {product.artikel || '—'}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.category || product.departemen || 'Produk Insentif'}</span>
                          </div>
                          <div style={{ minHeight: 0, color: '#f8fafc', fontSize: 7.8, fontWeight: 900, lineHeight: 1.12, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>
                            {product.name || product.artikel}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minHeight: 0 }}>
                            <span style={{ color: '#bbf7d0', fontSize: 6.5, fontWeight: 800, whiteSpace: 'nowrap' }}>QTY TOKO</span>
                            <span style={{ color: '#064e3b', background: '#6ee7b7', borderRadius: 5, padding: '1px 4px', fontSize: 7, lineHeight: '11px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                              {product.actualQty ?? 0} / {product.targetQty ?? 0} ✓
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : active.key !== 'dept' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 0.85fr)', gap: 8, height: '100%', minWidth: 0 }}>
                <div style={{ background: 'rgba(38, 27, 31, 0.84)', border: '1px solid rgba(214,195,190,0.2)', borderRadius: 16, padding: 8, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                    <div style={{ background: 'linear-gradient(135deg, rgba(242,197,17,0.2), rgba(38,27,31,0.92))', border: '1px solid rgba(242,197,17,0.35)', borderRadius: 14, padding: '5px 8px 7px', overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 16px rgba(184,140,0,0.1)' }}>
                      <div style={{ fontSize: 'clamp(10px, 0.78vw, 13px)', color: '#f8df83', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 2, fontWeight: 800 }}>Top Performance</div>
                      <div style={{ fontSize: 'clamp(12px, 0.95vw, 16px)', fontWeight: 900, color: '#f8fafc', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%' }}>{topLeader?.nama ?? '—'}</div>
                      <div style={{ marginTop: 3, fontSize: 'clamp(17px, 1.5vw, 24px)', fontWeight: 900, color: '#fff1a8', lineHeight: 1, letterSpacing: '-0.04em' }}>{topLeader?.achievement.toFixed(1) ?? '0.0'}%</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(225,38,28,0.2), rgba(38,27,31,0.92))', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: '5px 8px 7px', overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 16px rgba(225,38,28,0.08)' }}>
                      <div style={{ fontSize: 'clamp(10px, 0.78vw, 13px)', color: '#fecaca', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 2, fontWeight: 800 }}>Bottom Performance</div>
                      <div style={{ fontSize: 'clamp(12px, 0.95vw, 16px)', fontWeight: 900, color: '#f8fafc', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%' }}>{bottomLeader?.nama ?? '—'}</div>
                      <div style={{ marginTop: 3, fontSize: 'clamp(17px, 1.5vw, 24px)', fontWeight: 900, color: '#fee2e2', lineHeight: 1, letterSpacing: '-0.04em' }}>{bottomLeader?.achievement.toFixed(1) ?? '0.0'}%</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 0, minHeight: 0, minWidth: 0, alignContent: 'start' }}>
                    <div style={{ display: 'grid', gridTemplateRows: `clamp(22px, 2.8vh, 30px) repeat(${active.ranking.length}, minmax(0, 1fr))`, gap: 2, minHeight: 0, minWidth: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1.65fr) minmax(0, 0.7fr) minmax(22px, 0.48fr) minmax(38px, 0.82fr) minmax(38px, 0.82fr) minmax(32px, 0.62fr)', alignItems: 'center', gap: 3, color: '#e4d8d5', fontSize: 'clamp(9px, 0.78vw, 13px)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px', lineHeight: 1, background: 'rgba(45,31,35,0.75)', border: '1px solid rgba(214,195,190,0.18)', borderRadius: 5, boxSizing: 'border-box' }}>
                        <div style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', borderRadius: 3, background: 'rgba(148,163,184,0.12)', color: '#cbd5e1', fontWeight: 900, fontSize: 'clamp(9px, 0.65vw, 11px)' }}>#</div>
                        <div style={{ textAlign: 'left', paddingLeft: 1 }}>Nama</div>
                        <div style={{ textAlign: 'left', paddingLeft: 1 }}>Job Title</div>
                        <div style={{ textAlign: 'right' }}>Proteksi</div>
                        <div style={{ textAlign: 'right' }}>Target</div>
                        <div style={{ textAlign: 'right' }}>Sales</div>
                        <div style={{ textAlign: 'right' }}>Ach</div>
                      </div>
                      {active.ranking.map((row, index) => {
                        const displayRank = row.rank ?? index + 1
                        const isBottom10Row = bottomTenRankSet.has(displayRank)
                        return (
                          <div key={`${row.nama}-${index}`} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1.65fr) minmax(0, 0.7fr) minmax(22px, 0.48fr) minmax(38px, 0.82fr) minmax(38px, 0.82fr) minmax(32px, 0.62fr)', alignItems: 'center', gap: 3, background: 'rgba(29,21,25,0.88)', border: '1px solid rgba(214,195,190,0.14)', borderRadius: 5, padding: '0 4px', overflow: 'hidden', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', lineHeight: 1 }}>
                            <div style={{ width: 16, height: 16, display: 'grid', placeItems: 'center', borderRadius: 4, fontWeight: 900, fontSize: 'clamp(9px, 0.65vw, 11px)', ...getRankBadgeStyle(displayRank, isBottom10Row) }}>{displayRank}</div>
                            <div style={{ minWidth: 0, overflow: 'hidden', color: '#f8fafc', fontSize: 'clamp(11px, 0.92vw, 15px)', fontWeight: 800, whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1 }}>{row.nama}</div>
                            <div style={{ minWidth: 0, overflow: 'hidden', color: '#cbd5e1', fontSize: 'clamp(9px, 0.75vw, 13px)', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1 }}>{row.jobTitle || '—'}</div>
                            <div style={{ minWidth: 0, color: '#a7f3d0', fontSize: 'clamp(9px, 0.75vw, 13px)', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>{(row.protectionQty ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}</div>
                            <div style={{ minWidth: 0, color: '#cbd5e1', fontSize: 'clamp(9px, 0.75vw, 13px)', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>{formatRupiah(row.target ?? 0)}</div>
                            <div style={{ minWidth: 0, color: '#cbd5e1', fontSize: 'clamp(9px, 0.75vw, 13px)', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>{formatRupiah(row.value)}</div>
                            <div style={{ minWidth: 0, textAlign: 'center', fontSize: 'clamp(9px, 0.75vw, 13px)', fontWeight: 900, padding: '3px', borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1, ...getAchievementBadgeStyle(row.achievement) }}>{row.achievement.toFixed(1)}%</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 3, alignContent: 'stretch', gridTemplateRows: '1fr 1fr', height: '100%' }}>
                  <div style={{ background: 'linear-gradient(180deg, rgba(225,38,28,0.12), rgba(38,27,31,0.78))', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 14, padding: 6, display: 'grid', gridTemplateRows: 'auto 1fr', gap: 2, minHeight: 0 }}>
                    <div style={{ color: '#fca5a5', fontSize: 'clamp(10px, 0.78vw, 13px)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 0 }}>Leader Board</div>
                    <div style={{ display: 'grid', gridTemplateRows: 'repeat(10, minmax(0, 1fr))', gap: 2, minHeight: 0 }}>
                      {topTen.map((row, index) => (
                        <div key={`leader-${row.nama}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: index === topTen.length - 1 ? 'none' : '1px solid rgba(148,163,184,0.1)', minHeight: 0 }}>
                          <div style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 'clamp(9px, 0.68vw, 12px)', ...getRankBadgeStyle(row.rank ?? index + 1) }}>{row.rank ?? index + 1}</div>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'visible' }}>
                            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 'clamp(10px, 0.82vw, 14px)', lineHeight: 1.15, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{row.nama}</div>
                            <div style={{ color: '#94a3b8', fontSize: 'clamp(9px, 0.68vw, 11px)' }}>{formatRupiah(row.value)}</div>
                          </div>
                          <div style={{ flexShrink: 0, fontWeight: 900, fontSize: 'clamp(9px, 0.78vw, 13px)', padding: '3px 5px', borderRadius: 5, ...getAchievementBadgeStyle(row.achievement) }}>{row.achievement.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: 'linear-gradient(180deg, rgba(120,82,214,0.12), rgba(38,27,31,0.82))', border: '1px solid rgba(196,181,253,0.18)', borderRadius: 14, padding: 6, display: 'grid', gridTemplateRows: 'auto 1fr', gap: 2, minHeight: 0 }}>
                    <div style={{ color: '#fca5a5', fontSize: 'clamp(10px, 0.78vw, 13px)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 0 }}>Bottom 10 Performance</div>
                    <div style={{ display: 'grid', gridTemplateRows: 'repeat(10, minmax(0, 1fr))', gap: 2, minHeight: 0 }}>
                      {bottomTen.map((row, index) => (
                        <div key={`bottom-${row.nama}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: index === bottomTen.length - 1 ? 'none' : '1px solid rgba(148,163,184,0.1)', minHeight: 0 }}>
                          <div style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 'clamp(9px, 0.68vw, 12px)', ...getBottomRankBadgeStyle(row.actualRank) }}>{row.actualRank}</div>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'visible' }}>
                            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 'clamp(10px, 0.82vw, 14px)', lineHeight: 1.15, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{row.nama}</div>
                            <div style={{ color: '#94a3b8', fontSize: 'clamp(9px, 0.68vw, 11px)' }}>{formatRupiah(row.value)}</div>
                          </div>
                          <div style={{ flexShrink: 0, fontWeight: 900, fontSize: 'clamp(9px, 0.78vw, 13px)', padding: '3px 5px', borderRadius: 5, ...getAchievementBadgeStyle(row.achievement) }}>{row.achievement.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 10, height: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(242,197,17,0.18), rgba(38,27,31,0.9))', border: '1px solid rgba(242,197,17,0.32)', borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 16px rgba(184,140,0,0.08)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#f8df83', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Top Departemen</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topDept?.label ?? '—'}</div>
                      <div style={{ color: '#cbd5e1', fontSize: 8, marginTop: 3 }}>{topDept?.zone || 'Zona tidak tersedia'} · Sales MTD {formatRupiahFull(topDept?.value ?? 0)}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ display: 'inline-block', padding: '3px 7px', borderRadius: 6, fontSize: 14, fontWeight: 900, ...getAchievementBadgeStyle(topDept ? getDeptAchievement(topDept) : undefined) }}>{topDept ? getDeptAchievement(topDept).toFixed(1) : '—'}%</div>
                    </div>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, rgba(225,38,28,0.16), rgba(38,27,31,0.9))', border: '1px solid rgba(252,165,165,0.3)', borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 16px rgba(225,38,28,0.07)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#fecaca', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Bottom Departemen</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bottomDept?.label ?? '—'}</div>
                      <div style={{ color: '#cbd5e1', fontSize: 8, marginTop: 3 }}>{bottomDept?.zone || 'Zona tidak tersedia'} · Sales MTD {formatRupiahFull(bottomDept?.value ?? 0)}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ display: 'inline-block', padding: '3px 7px', borderRadius: 6, fontSize: 14, fontWeight: 900, ...getAchievementBadgeStyle(bottomDept ? getDeptAchievement(bottomDept) : undefined) }}>{bottomDept ? getDeptAchievement(bottomDept).toFixed(1) : '—'}%</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr) 170px', gap: 8, height: '100%', minHeight: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'auto', gap: 8, minHeight: 0, alignContent: 'start' }}>
                    {activeDeptZone ? [activeDeptZone].map((zoneGroup) => (
                      <div key={zoneGroup.zoneName} style={{ background: 'rgba(38, 27, 31, 0.84)', border: '1px solid rgba(214,195,190,0.2)', borderRadius: 14, padding: 12, display: 'grid', gridTemplateRows: 'auto auto', alignContent: 'start', minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, padding: '0 2px', gap: 6 }}>
                          <div style={{ color: '#f8fafc', fontSize: 11, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 0 }}>{zoneGroup.zoneName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <div style={{ color: '#94a3b8', fontSize: 8, fontWeight: 800 }}>ZONA {deptZoneIndex + 1}/{deptZoneGroups.length}</div>
                            <div style={{ color: '#cbd5e1', fontSize: 8.5, fontWeight: 700, opacity: 0.9 }}>
                              {((zoneGroup.sbdZone?.value ?? 0) > 0 || (zoneGroup.mtdZone?.value ?? 0) > 0) ? `${zoneGroup.sbdZone?.achievement ?? 0}% / ${zoneGroup.mtdZone?.achievement ?? 0}%` : '—'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 4, minWidth: 0, alignContent: 'start' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.4fr) minmax(0, 1.25fr) minmax(0, 0.65fr) minmax(0, 1.25fr) minmax(0, 0.65fr)', gap: 10, color: '#cbd5e1', fontSize: 8, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 3px' }}>
                            <div>Dept</div>
                            <div style={{ textAlign: 'right' }}>SBD</div>
                            <div style={{ textAlign: 'center' }}>ACV</div>
                            <div style={{ textAlign: 'right' }}>MTD</div>
                            <div style={{ textAlign: 'center' }}>ACV</div>
                          </div>

                          <div style={{ display: 'grid', gap: 1, alignContent: 'start', gridAutoRows: 'min-content' }}>
                            {zoneGroup.deptRows.map((dept) => (
                              <div key={`${zoneGroup.zoneName}-${dept.label}-row`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.4fr) minmax(0, 1.25fr) minmax(0, 0.65fr) minmax(0, 1.25fr) minmax(0, 0.65fr)', gap: 10, alignItems: 'center', padding: '5px 3px', borderTop: '1px solid rgba(148,163,184,0.08)', minHeight: 0 }}>
                                <div style={{ color: '#f8fafc', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept.label}</div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', color: '#f8fafc', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  <span>{dept.sbd ? formatRupiahFull(dept.sbd.value) : '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 24,
                                    padding: '1px 4px',
                                    borderRadius: 999,
                                    fontSize: 7,
                                    fontWeight: 800,
                                    letterSpacing: '0.02em',
                                    ...getAchievementBadgeStyle(dept.sbd?.achievement),
                                    border: '1px solid rgba(255,255,255,0.12)'
                                  }}>
                                    {dept.sbd && dept.sbd.achievement !== undefined ? `${dept.sbd.achievement.toFixed(1)}%` : '—'}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', color: '#dbeafe', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  <span>{dept.mtd ? formatRupiahFull(dept.mtd.value) : '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 24,
                                    padding: '1px 4px',
                                    borderRadius: 999,
                                    fontSize: 7,
                                    fontWeight: 800,
                                    letterSpacing: '0.02em',
                                    ...getAchievementBadgeStyle(dept.mtd?.achievement),
                                    border: '1px solid rgba(255,255,255,0.12)'
                                  }}>
                                    {dept.mtd && dept.mtd.achievement !== undefined ? `${dept.mtd.achievement.toFixed(1)}%` : '—'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )) : null}
                  </div>

                  <div style={{ background: 'rgba(38,27,31,0.84)', border: '1px solid rgba(214,195,190,0.18)', borderRadius: 16, padding: 8, display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', minHeight: 0, height: '100%', boxSizing: 'border-box' }}>
                    <div style={{ color: '#cbd5e1', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dept Trend</div>
                    <div style={{ marginBottom: 8, color: '#f8fafc', fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeTrendColor, boxShadow: `0 0 12px ${activeTrendColor}` }} />
                      {activeTrendLabel}
                    </div>
                    <div style={{ height: '100%', minHeight: 0 }}>
                      {deptTrendByDepartmentSeries.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={deptTrendByDepartmentSeries} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="deptTrendFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={activeTrendColor} stopOpacity={0.5} />
                                <stop offset="100%" stopColor={activeTrendColor} stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" />
                            <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 7 }} minTickGap={12} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#cbd5e1', fontSize: 7 }} axisLine={false} tickLine={false} width={42} tickFormatter={value => `${Math.round(value / 1000000)} jt`} />
                            <Tooltip
                              formatter={(value: number) => [formatRupiahFull(Number(value)), activeTrendLabel]}
                              labelStyle={{ color: '#e2e8f0', fontSize: 10 }}
                              contentStyle={{ background: 'rgba(29,21,25,0.97)', border: '1px solid rgba(214,195,190,0.25)', borderRadius: 10 }}
                            />
                            <Area type="monotone" dataKey="value" stroke={activeTrendColor} strokeWidth={2} fill="url(#deptTrendFill)" dot={{ r: 2, fill: activeTrendColor }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1', fontSize: 10 }}>Data trend belum tersedia</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </>
  )
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let cells: string[] = []
  let cell = ''
  let inQuote = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (inQuote && text[index + 1] === '"') { cell += '"'; index += 1 }
      else inQuote = !inQuote
    } else if (character === ',' && !inQuote) {
      cells.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !inQuote) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      cells.push(cell)
      if (cells.some(value => value.trim())) rows.push(cells)
      cells = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (cell || cells.length) {
    cells.push(cell)
    if (cells.some(value => value.trim())) rows.push(cells)
  }
  return rows
}

function AdminReceiptTable({ rows, loading, isMobile }: { rows: IncentiveReceiptRow[]; loading: boolean; isMobile: boolean }) {
  const sortedRows = [...rows].sort((left, right) => right.qualifyingReceipt - left.qualifyingReceipt || right.totalValueReceipt - left.totalValueReceipt)

  return (
    <div style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
        <SectionTitle title="Insentif Receipt" sub={`${rows.length} user terdaftar`} />
        <div style={{ fontSize: 12, color: S.muted }}>Monitoring seluruh user dari sheet INSENTIF RECEIPT.</div>
      </div>
      {loading ? <div style={{ padding: 48, textAlign: 'center', color: S.muted }}>⟳ Memuat data insentif receipt...</div> : !rows.length ? <div style={{ padding: 48, textAlign: 'center', color: S.muted }}>Data Insentif Receipt belum tersedia.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 1060 : 1240 }}>
            <thead>
              <tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                {['Nama & NIK', 'Qualifying Receipt', 'Target Minimal Cair', 'Progress', 'Total Value Receipt', 'Insentif / Receipt', 'Total Insentif', 'Status'].map(header => (
                  <th key={header} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => {
                const eligible = row.status.toLowerCase().includes('eligible') && !row.status.toLowerCase().includes('non')
                const progress = Math.min(100, Math.max(0, row.progressToMinimal))
                return (
                  <tr key={`${row.nik}-${row.no}-${index}`} style={{ borderBottom: `1px solid ${S.border}`, background: index % 2 === 0 ? '#fff' : S.bg }}>
                    <td style={{ padding: '13px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: S.text }}>{row.nama || 'Nama belum tersedia'}</div>
                      <div style={{ fontSize: 10, color: S.muted, fontFamily: 'monospace', marginTop: 2 }}>{row.nik || 'NIK belum tersedia'}</div>
                    </td>
                    <td style={{ padding: '13px 14px', color: S.text, fontSize: 13, fontWeight: 700 }}>{row.qualifyingReceipt.toLocaleString('id-ID')} Receipt</td>
                    <td style={{ padding: '13px 14px', color: S.text, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.targetMinimalCair.toLocaleString('id-ID')} Receipt</td>
                    <td style={{ padding: '13px 14px', minWidth: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 7, background: '#e8edf8', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: eligible ? '#10b981' : '#f97316', borderRadius: 99 }} /></div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: eligible ? '#047857' : '#c2410c' }}>{progress.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 14px', color: S.text, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRupiahFull(row.totalValueReceipt)}</td>
                    <td style={{ padding: '13px 14px', color: S.text, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRupiahFull(row.incentivePerReceipt)}</td>
                    <td style={{ padding: '13px 14px' }}><span style={{ display: 'inline-block', color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '7px 10px', fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap' }}>{formatRupiahFull(row.totalIncentive)}</span></td>
                    <td style={{ padding: '13px 14px' }}><span style={{ color: eligible ? '#047857' : '#b42318', background: eligible ? '#ecfdf5' : '#fff1f2', border: `1px solid ${eligible ? '#86efac' : '#fca5a5'}`, borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{row.status || 'BELUM ADA STATUS'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface Props { user: User; onLogout: () => void }

export default function AdminDashboard({ user, onLogout }: Props) {
  const { todayPerf, mtdPerf, loading, dailyDate, reload, users, reloadMenuConfig, menuConfig, teamTodayTrend, teamMtdTrend, teamTodayEmployees, teamMtdEmployees } = useAtlasData()
  const { settings, updateTargetFormula, updateLayout } = useAdminSettings()
  const [page, setPage]             = useState<NavPage>('today')
  const [ytdAll, setYtdAll]         = useState<YTDEmployee[]>([])
  const [ytdLoading, setYtdLoading] = useState(false)
  const [deptSbd, setDeptSbd]       = useState<DeptPeriodData | null>(null)
  const [deptMtd, setDeptMtd]       = useState<DeptPeriodData | null>(null)
  const [deptTrend, setDeptTrend]   = useState<DeptTrendData | null>(null)
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptLoaded, setDeptLoaded]   = useState(false)
  const [receiptRows, setReceiptRows] = useState<IncentiveReceiptRow[]>([])
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptLoaded, setReceiptLoaded] = useState(false)
  const [trackerUrl, setTrackerUrlState] = useState(getTrackerUrl)
  const [trackerSaved, setTrackerSaved]  = useState(false)
  const [menuCfg, setMenuCfg] = useState(getMenuSettings)
  const [tvDisplaySettings, setTVDisplaySettings] = useState<Record<TVSlideKey, boolean>>(getTVDisplaySettings)
  const [jobFilter, setJobFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('achievement')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidUpdatedAt, setSIDUpdatedAt] = useState<Date | null>(null)
  const sidSignatureRef = useRef<string | null>(null)
  const sidCheckInProgressRef = useRef(false)
  const isMobile = useMobile()

  // Declare these early to avoid temporal dead zone issues
  const targetFormula = settings.targetFormula
  const layout = settings.layout

  const checkForSIDUpdates = useCallback(async () => {
    if (sidCheckInProgressRef.current) return
    sidCheckInProgressRef.current = true
    try {
      const nextSignature = await fetchSIDDataSignature()
      const previousSignature = sidSignatureRef.current
      sidSignatureRef.current = nextSignature
      if (previousSignature && previousSignature !== nextSignature) {
        await reload(user.nik)
        setSIDUpdatedAt(new Date())
      }
    } catch (error) {
      console.error('[TV] Gagal memeriksa perubahan data SID:', error)
    } finally {
      sidCheckInProgressRef.current = false
    }
  }, [reload, user.nik])

  useEffect(() => {
    if (page === 'tv') void checkForSIDUpdates()
  }, [page, checkForSIDUpdates])

  useEffect(() => {
    setTVDisplaySettings(current => {
      const next = { ...current }
      for (const { key } of TV_DISPLAY_OPTIONS) {
        const configKey = `tv_${key}`
        if (configKey in menuConfig) next[key] = menuConfig[configKey]
      }
      return next
    })
  }, [menuConfig])

  useEffect(() => {
    setYtdLoading(true)
    fetchAllYTD().then(d => { setYtdAll(d); setYtdLoading(false) })
  }, [])

  useEffect(() => {
    if (deptLoaded) return
    setDeptLoading(true)
    fetchPencapaianDept()
      .then(r => {
        setDeptSbd(r.sbd)
        setDeptMtd(r.mtd)
        setDeptTrend(r.trend)
        setDeptLoaded(true)
      })
      .finally(() => setDeptLoading(false))
  }, [deptLoaded])

  useEffect(() => {
    if ((page !== 'receipt' && page !== 'tv') || receiptLoaded) return
    let cancelled = false
    setReceiptLoading(true)
    const loadReceiptData = async () => {
      try {
        const sheetNames = ['INSENTIF RECEIPT', 'INSENTIF RECEIPT DEPT']
        const sheetRows = await Promise.all(sheetNames.map(async sheet => {
          const response = await fetch(`https://docs.google.com/spreadsheets/d/1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_t=${Date.now()}`)
          const text = await response.text()
          return response.ok && !text.trimStart().startsWith('<!') ? parseCsv(text) : []
        }))
        const parsed = parseIncentiveSheets({
          'INSENTIF RECEIPT': sheetRows[0].length ? sheetRows[0] : sheetRows[1],
        })
        if (!cancelled) setReceiptRows(parsed.receipt.rows)
      } catch (error) {
        console.warn('[ADMIN] Error loading receipt incentive data:', error)
        if (!cancelled) setReceiptRows([])
      } finally {
        if (!cancelled) {
          setReceiptLoaded(true)
          setReceiptLoading(false)
        }
      }
    }
    void loadReceiptData()
    return () => { cancelled = true }
  }, [page, receiptLoaded])

  useEffect(() => {
    const handleMappingsChanged = () => {
      reload(user.nik)
    }
    window.addEventListener('atlas-column-mappings-changed', handleMappingsChanged)
    return () => window.removeEventListener('atlas-column-mappings-changed', handleMappingsChanged)
  }, [reload, user.nik])

  // Full Month: pakai ranking MTD tapi achievement dihitung vs full month target
  // Scale factor: prorated MTD target → full month target
  const fmScale = (mtdPerf.targetMTD && mtdPerf.targetMTD > 0)
    ? mtdPerf.target / mtdPerf.targetMTD
    : 1
  const fullMonthRanking = (mtdPerf.ranking ?? []).map(r => {
    const fmTarget = r.fullMonthTarget ?? (r.target ? Math.round(r.target * fmScale) : 0)
    return {
      ...r,
      target: fmTarget,
      achievement: fmTarget > 0 ? parseFloat(((r.value / fmTarget) * 100).toFixed(1)) : 0,
    }
  }).sort((a, b) => b.achievement - a.achievement).map((r, i) => ({ ...r, rank: i + 1 }))

  const dailyTarget = targetFormula.dailyTarget > 0 ? targetFormula.dailyTarget : todayPerf.target
  const monthlyTarget = mtdPerf.target > 0
    ? mtdPerf.target
    : targetFormula.monthlyTarget * (targetFormula.monthlyMultiplier || 1)
  const effectiveTarget = page === 'today' ? dailyTarget : monthlyTarget
  const pd = page === 'mtd' ? { ...mtdPerf, target: monthlyTarget, achievement: monthlyTarget > 0 ? parseFloat(((mtdPerf.actual / monthlyTarget) * 100).toFixed(1)) : 0 }
    : page === 'fullmonth' ? { ...mtdPerf, target: monthlyTarget, achievement: monthlyTarget > 0 ? parseFloat(((mtdPerf.actual / monthlyTarget) * 100).toFixed(1)) : 0 }
    : { ...todayPerf, target: dailyTarget, achievement: dailyTarget > 0 ? parseFloat(((todayPerf.actual / dailyTarget) * 100).toFixed(1)) : 0 }
  const ranking = page === 'fullmonth'
    ? fullMonthRanking
    : (pd.ranking ?? []).map(r => {
        const target = r.target && r.target > 0 ? r.target : effectiveTarget
        return {
          ...r,
          target,
          achievement: target > 0 ? parseFloat(((r.value / target) * 100).toFixed(1)) : 0,
        }
      }).sort((a, b) => b.achievement - a.achievement).map((r, i) => ({ ...r, rank: i + 1 }))

  const teamTotal  = ranking.reduce((s, r) => s + r.value, 0)
  const teamTarget = ranking.reduce((s, r) => s + (r.target ?? 0), 0)
  const teamAchievement = teamTarget > 0 ? parseFloat(((teamTotal / teamTarget) * 100).toFixed(1)) : 0
  const avgAch     = ranking.length ? ranking.reduce((s, r) => s + r.achievement, 0) / ranking.length : 0
  const top        = ranking[0]
  const bottom     = ranking[ranking.length - 1]

  const fullMonthEmployeeRows = teamMtdEmployees
    .map(row => {
      const targetSales = row.fullMonthTargetSales ?? Math.round(row.targetSales * fmScale)
      const targetTrx = Math.round(row.targetTransaksi * fmScale)
      const targetBs = Math.round(row.targetBasketSize * fmScale)
      return {
        ...row,
        targetSales,
        targetTransaksi: targetTrx,
        targetBasketSize: targetBs,
        achievement: targetSales > 0 ? parseFloat(((row.sales / targetSales) * 100).toFixed(1)) : 0,
      }
    })
    .sort((a, b) => b.achievement - a.achievement || b.sales - a.sales)
    .map((row, i) => ({ ...row, rank: i + 1 }))

  const employeeRows = page === 'today'
    ? teamTodayEmployees
    : page === 'mtd'
      ? teamMtdEmployees
      : fullMonthEmployeeRows

  const jobTitleOptions = Array.from(new Set(employeeRows.map(row => row.jobTitle || 'Tanpa Jabatan'))).sort((a, b) => a.localeCompare(b, 'id'))

  useEffect(() => {
    if (jobFilter !== 'all' && !jobTitleOptions.includes(jobFilter)) {
      setJobFilter('all')
    }
  }, [jobFilter, jobTitleOptions])

  const filteredEmployeeRows = employeeRows.filter(row => {
    if (jobFilter === 'all') return true
    return (row.jobTitle || 'Tanpa Jabatan') === jobFilter
  })

  const sortedEmployeeRows = [...filteredEmployeeRows].sort((a, b) => {
    if (sortKey === 'nama' || sortKey === 'jobTitle') {
      const av = (sortKey === 'nama' ? a.nama : (a.jobTitle || 'Tanpa Jabatan')).toLowerCase()
      const bv = (sortKey === 'nama' ? b.nama : (b.jobTitle || 'Tanpa Jabatan')).toLowerCase()
      const cmp = av.localeCompare(bv, 'id')
      return sortOrder === 'asc' ? cmp : -cmp
    }
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp = Number(av) - Number(bv)
    return sortOrder === 'asc' ? cmp : -cmp
  }).map((row, i) => ({ ...row, rank: i + 1 }))

  const applySort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    const textKey = key === 'nama' || key === 'jobTitle'
    setSortOrder(textKey ? 'asc' : 'desc')
  }

  const totalTrx = filteredEmployeeRows.reduce((sum, row) => sum + row.transaksi, 0)
  const sellingEmployeeRows = filteredEmployeeRows.filter(row => row.sales > 0)
  const avgUpt = sellingEmployeeRows.length > 0
    ? sellingEmployeeRows.reduce((sum, row) => sum + row.upt, 0) / sellingEmployeeRows.length
    : 0
  const avgAur = sellingEmployeeRows.length > 0
    ? sellingEmployeeRows.reduce((sum, row) => sum + row.aur, 0) / sellingEmployeeRows.length
    : 0

  // Hanya karyawan terdaftar (role=user) yang masuk YTD
  const totalKaryawan = users.filter(u => u.role === 'user').length
  const validUserNiks = users.filter(u => u.role === 'user').map(u => u.nik)
  const ytdValid      = ytdAll.filter(e => validUserNiks.some(nik => niksMatch(nik, e.nik)))

  const zoneDist    = ytdValid.reduce<Record<string, number>>((acc, e) => {
    const k = (e.ytdColorZone ?? '').toLowerCase().split(' ')[0] || 'lainnya'
    acc[k] = (acc[k] ?? 0) + 1; return acc
  }, {})
  const avgScore    = ytdValid.length ? ytdValid.reduce((s, e) => s + e.ytdScore, 0) / ytdValid.length : 0
  const avgSalesYTD = ytdValid.length ? ytdValid.reduce((s, e) => s + e.ytdSalesPct, 0) / ytdValid.length : 0
  const sortedYTD   = [...ytdValid].sort((a, b) => b.ytdSalesPct - a.ytdSalesPct)
  const zoneOrder   = ['hijau', 'biru', 'kuning', 'oranye', 'pink', 'merah']

  const primaryColor = layout.primaryColor || S.red
  const cardRadius = layout.cardRadius || 18

  const toggleFullscreen = async () => {
    const root = document.documentElement
    try {
      if (!document.fullscreenElement) {
        if (root.requestFullscreen) await root.requestFullscreen()
        return
      }
      if (document.exitFullscreen) await document.exitFullscreen()
    } catch (error) {
      console.warn('[ADMIN] Fullscreen toggle failed:', error)
    }
  }

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  const NAV = [
    { key: 'today'     as NavPage, label: 'Today',      icon: '📅', sub: dailyDate    },
    { key: 'mtd'       as NavPage, label: 'MTD',        icon: '📊', sub: 'Berjalan'   },
    { key: 'fullmonth' as NavPage, label: 'Full Month', icon: '📆', sub: 'Target Penuh'},
    { key: 'ytd'       as NavPage, label: 'YTD',        icon: '🎯', sub: 'Tahunan'    },
    { key: 'dept'      as NavPage, label: 'Departemen', icon: '🏬', sub: 'SBD & MTD'   },
    { key: 'tv'        as NavPage, label: 'TV Display', icon: '📺', sub: 'Slide otomatis' },
    { key: 'receipt'   as NavPage, label: 'Insentif Receipt', icon: '🧾', sub: 'Semua user' },
    { key: 'setting'   as NavPage, label: 'Pengaturan', icon: '⚙️',  sub: 'Konfigurasi' },
  ]

  const isDisplayMode = page === 'tv'

  return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', flexDirection: isDisplayMode || isMobile ? 'column' : 'row' }}>
      {loading && <DataLoadingOverlay />}

      {!isDisplayMode && !isMobile ? (
        <aside style={{
          width: 220, flexShrink: 0, background: S.panel, borderRight: `1px solid ${S.border}`,
          display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
        }}>
          {/* Logo */}
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${S.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src={azkoLogo} alt="Azko" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }}/>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: S.text, letterSpacing: '0.06em' }}>ATLAS</div>
                <div style={{ fontSize: 10, color: S.muted }}>Dashboard Manajer</div>
              </div>
            </div>
            <div style={{ background: S.bg, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.text }}>{user.nama}</div>
              <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{user.jobTitle} · {user.nik}</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, paddingLeft: 8 }}>Laporan</div>
            {NAV.map(n => (
              <button key={n.key} onClick={() => setPage(n.key)} style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: page === n.key ? `${primaryColor}12` : 'transparent',
                transition: 'all 0.15s',
                borderLeft: `3px solid ${page === n.key ? primaryColor : 'transparent'}`,
              }}
                onMouseEnter={e => { if (page !== n.key) (e.currentTarget as HTMLElement).style.background = S.bg }}
                onMouseLeave={e => { if (page !== n.key) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: page === n.key ? primaryColor : S.text }}>{n.label}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{n.sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Bottom */}
          <div style={{ padding: '16px 12px', borderTop: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={toggleFullscreen}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: isFullscreen ? '#fef2f2' : S.bg, color: isFullscreen ? '#b91c1c' : S.sub, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {isFullscreen ? '⤢ Exit Fullscreen' : '⛶ Fullscreen'}
            </button>
            <button onClick={() => reload(user.nik)} disabled={loading}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.bg, color: S.sub, fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? '⟳ Memuat…' : '↻ Refresh Data'}
            </button>
            <button onClick={onLogout}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Keluar
            </button>
          </div>
        </aside>
      ) : null}

      {!isDisplayMode && isMobile ? (
        /* Mobile top header */
        <header style={{ background: S.panel, borderBottom: `1px solid ${S.border}`, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <img src={azkoLogo} alt="Azko" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: S.text }}>ATLAS</div>
              <div style={{ fontSize: 10, color: S.muted }}>{user.nama}</div>
            </div>
            <button onClick={toggleFullscreen}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: isFullscreen ? '#fef2f2' : S.bg, color: isFullscreen ? '#b91c1c' : S.muted, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
              {isFullscreen ? '⤢' : '⛶'}
            </button>
            <button onClick={() => reload(user.nik)} disabled={loading}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.bg, color: S.muted, fontSize: 13, cursor: 'pointer' }}>
              {loading ? '⟳' : '↻'}
            </button>
            <button onClick={onLogout}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, fontSize: 12, cursor: 'pointer' }}>
              Keluar
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {NAV.map(n => (
              <button key={n.key} onClick={() => setPage(n.key)} style={{
                flex: 1, padding: '8px 6px', borderRadius: 10, border: `1.5px solid ${page === n.key ? S.red : S.border}`,
                background: page === n.key ? `${primaryColor}10` : 'transparent',
                color: page === n.key ? primaryColor : S.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        </header>
      ) : null}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, padding: isDisplayMode ? 0 : isMobile ? '16px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: isDisplayMode ? 0 : 16 }}>

        {page === 'tv' && (
          <TVSlideshow
            todayRanking={(todayPerf.ranking ?? []).map(r => ({ ...r, achievement: Number.isFinite(r.achievement) ? r.achievement : 0 }))}
            mtdRanking={(mtdPerf.ranking ?? []).map(r => ({ ...r, achievement: Number.isFinite(r.achievement) ? r.achievement : 0 }))}
            fullMonthRanking={fullMonthRanking.map(r => ({ ...r, achievement: Number.isFinite(r.achievement) ? r.achievement : 0 }))}
            receiptRows={receiptRows.filter(row => users.some(account => account.role === 'user' && niksMatch(account.nik, row.nik)))}
            receiptLoading={receiptLoading}
            onSlideEnd={checkForSIDUpdates}
            sidUpdatedAt={sidUpdatedAt}
            visibleSlides={tvDisplaySettings}
            deptSbd={deptSbd}
            deptMtd={deptMtd}
            deptTrend={deptTrend}
            dailyDate={dailyDate}
          />
        )}

        {/* ── Konten Laporan (Today / MTD / Full Month / YTD) ─────────── */}
        {page !== 'setting' && page !== 'receipt' && page !== 'tv' && <>

        {/* Page title */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: S.text, letterSpacing: '-0.02em' }}>
                {NAV.find(n => n.key === page)?.label}
              </div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                {page === 'today' ? `Data per ${dailyDate}` : page === 'mtd' ? 'Kumulatif bulan berjalan vs target harian × hari berjalan' : page === 'fullmonth' ? 'Achievement vs target penuh satu bulan' : 'Performa tahunan karyawan'}
              </div>
            </div>
            {loading && <div style={{ fontSize: 12, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: 8 }}>⟳ Memuat data…</div>}
          </div>
        )}

        {/* ── TODAY / MTD ─────────────────────────────────────────────────── */}
        {page !== 'ytd' && page !== 'dept' && (
          <>
            {/* Summary stats */}
            {layout.showSummaryCards && <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
              <StatCard label="Total Penjualan Tim" value={formatRupiah(teamTotal)} sub={`${ranking.length} personil`} accent={primaryColor} icon="💰" />
              <StatCard label="Target Tim" value={formatRupiah(teamTarget)} sub={page === 'today' ? 'target harian total' : 'target MTD total'} accent="#0f766e" icon="🎯" />
              <StatCard label="Achievement Tim" value={`${teamAchievement.toFixed(1)}%`} sub="total hasil / total target" accent={acPct(teamAchievement)} icon="📈" />
              <StatCard label="Rata-rata Personil" value={`${avgAch.toFixed(1)}%`} sub="achievement rata-rata" accent={acPct(avgAch)} icon="👥" />
            </div>}

            {/* Top & needs attention */}
            {layout.showTopPerformers && top && bottom && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 18, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏆</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Top Performer</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#14532d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{top.nama}</div>
                    <div style={{ fontSize: 11, color: '#166534' }}>{top.jobTitle}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}>{top.achievement.toFixed(1)}%</div>
                    <div style={{ fontSize: 11, color: '#166534' }}>{formatRupiah(top.value)}</div>
                  </div>
                </div>
                <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 18, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>⚡</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Perlu Dorongan</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#7c2d12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bottom.nama}</div>
                    <div style={{ fontSize: 11, color: '#9a3412' }}>{bottom.jobTitle}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#ea580c' }}>{bottom.achievement.toFixed(1)}%</div>
                    <div style={{ fontSize: 11, color: '#9a3412' }}>{formatRupiah(bottom.value)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Trend chart */}
            {false && (() => {
              const trend = page === 'today'
                ? teamTodayTrend
                : page === 'mtd'
                  ? teamMtdTrend
                  : (mtdPerf.monthlyTrend ?? mtdPerf.dailyTrend ?? [])
              if (trend.length < 1) return null
              return (
                <div style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, padding: isMobile ? '16px' : '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <SectionTitle title={page === 'today' ? 'Trend Harian Tim' : page === 'mtd' ? 'Trend MTD Tim' : 'Trend Bulanan Tim'} sub="total penjualan vs target" />
                  <div style={{ height: isMobile ? 180 : 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="adminGradAct" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#D93119" stopOpacity={0.2}/>
                            <stop offset="100%" stopColor="#D93119" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="adminGradTgt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.1}/>
                            <stop offset="100%" stopColor="#94a3b8" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e8edf8"/>
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}/>
                        <YAxis tickFormatter={v => formatRupiah(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={isMobile ? 46 : 60}/>
                        <Tooltip
                          contentStyle={{ background: '#fff', border: '1px solid #e8edf8', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                          formatter={(val: any, name: any) => [formatRupiah(Number(val)), name === 'actual' ? 'Aktual Tim' : 'Target']}
                          labelStyle={{ color: '#64748b', fontWeight: 600, marginBottom: 4 }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }}
                          formatter={(v: string) => v === 'actual' ? 'Aktual Tim' : 'Target'} />
                        <Area type="monotone" dataKey="actual" stroke="#D93119" strokeWidth={2.5} fill="url(#adminGradAct)" dot={{ fill: '#D93119', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }}/>
                        <Area type="monotone" dataKey="target" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" fill="url(#adminGradTgt)" dot={false}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

            {/* Ringkasan operasional tim */}
            {layout.showRankingTable && <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10 }}>
              <StatCard label="Total TRX Tim" value={totalTrx.toLocaleString('id-ID')} sub="akumulasi personil" accent="#0f766e" icon="🧾" />
              <StatCard label="Rata-rata UPT" value={avgUpt.toFixed(1)} sub="item per transaksi" accent="#7c3aed" icon="📦" />
              <StatCard label="Rata-rata AUR" value={formatRupiah(Math.round(avgAur))} sub="nilai rata-rata item" accent="#b45309" icon="💳" />
            </div>}

            {/* Full detail table */}
            {layout.showRankingTable && <div style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: `${cardRadius}px`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <SectionTitle title="Summary Semua Karyawan" sub={page === 'today' ? `${dailyDate} · monitor detail harian` : page === 'mtd' ? 'monitor akumulasi bulan berjalan' : 'monitor posisi menuju target full month'} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Biru ≥100%', c: '#2563eb', bg: '#eff6ff', count: filteredEmployeeRows.filter(r => r.achievement >= 100).length },
                    { label: 'Hijau ≥95%', c: '#16a34a', bg: '#f0fdf4', count: filteredEmployeeRows.filter(r => r.achievement >= 95 && r.achievement < 100).length },
                    { label: 'Kuning ≥90%', c: '#ca8a04', bg: '#fefce8', count: filteredEmployeeRows.filter(r => r.achievement >= 90 && r.achievement < 95).length },
                    { label: 'Pink ≥80%', c: '#db2777', bg: '#fdf2f8', count: filteredEmployeeRows.filter(r => r.achievement >= 80 && r.achievement < 90).length },
                    { label: 'Merah <80%', c: '#dc2626', bg: '#fff1f2', count: filteredEmployeeRows.filter(r => r.achievement < 80).length },
                  ].filter(b => b.count > 0).map(b => (
                    <span key={b.label} style={{ fontSize: 10, fontWeight: 700, color: b.c, background: b.bg, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{b.label}: {b.count}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '10px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fbfdff' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: S.sub }}>Filter Jabatan</span>
                <select
                  value={jobFilter}
                  onChange={e => setJobFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 12, color: S.text, background: '#fff' }}
                >
                  <option value="all">Semua Jabatan ({employeeRows.length})</option>
                  {jobTitleOptions.map(job => {
                    const count = employeeRows.filter(row => (row.jobTitle || 'Tanpa Jabatan') === job).length
                    return <option key={job} value={job}>{job} ({count})</option>
                  })}
                </select>
                <span style={{ fontSize: 11, color: S.muted }}>Sort aktif: {sortKey} ({sortOrder})</span>
                <span style={{ fontSize: 11, color: S.muted }}>Tampil: {sortedEmployeeRows.length} personil</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
                  <thead>
                    <tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                      <th style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>#</th>
                      <th onClick={() => applySort('nama')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        Nama & NIK {sortKey === 'nama' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('jobTitle')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        Jabatan {sortKey === 'jobTitle' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('sales')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        Sales {sortKey === 'sales' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('achievement')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        Ach {sortKey === 'achievement' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('transaksi')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        TRX {sortKey === 'transaksi' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('upt')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        UPT {sortKey === 'upt' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('qty')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        Qty {sortKey === 'qty' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('basketSize')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        BS {sortKey === 'basketSize' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('aur')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        AUR {sortKey === 'aur' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => applySort('newMember')} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        New Member {sortKey === 'newMember' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEmployeeRows.map((r, i) => {
                      const color = acPct(r.achievement)
                      const medals = ['🥇', '🥈', '🥉']
                      const salesGap = r.targetSales - r.sales
                      const trxGap = r.targetTransaksi - r.transaksi
                      return (
                        <tr key={r.nik} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? '#fff' : S.bg }}>
                          <td style={{ padding: '11px 14px', fontSize: 14, textAlign: 'center', minWidth: 36 }}>
                            {medals[i] ?? <span style={{ color: S.muted, fontSize: 11, fontWeight: 700 }}>#{r.rank}</span>}
                          </td>
                          <td style={{ padding: '11px 14px', minWidth: 180 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{r.nama}</div>
                            <div style={{ fontSize: 10, color: S.muted, fontFamily: 'monospace', marginTop: 1 }}>{r.nik}</div>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: 11, color: S.sub, whiteSpace: 'nowrap' }}>{r.jobTitle || '—'}</td>
                          <td style={{ padding: '11px 14px', minWidth: 180 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: S.text, whiteSpace: 'nowrap' }}>{formatRupiahFull(r.sales)}</div>
                            <div style={{ fontSize: 10, color: S.muted, marginTop: 1, whiteSpace: 'nowrap' }}>
                              Tgt {formatRupiah(r.targetSales)} · {salesGap > 0 ? `Gap ${formatRupiah(salesGap)}` : `+${formatRupiah(Math.abs(salesGap))}`}
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', minWidth: 150 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 7, background: '#e8edf8', borderRadius: 4, overflow: 'hidden', minWidth: 50 }}>
                                <div style={{ height: '100%', width: `${Math.min(r.achievement, 100)}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                              </div>
                              <span style={{ background: bgPct(r.achievement), color, fontWeight: 800, fontSize: 12, padding: '3px 9px', borderRadius: 7, flexShrink: 0, whiteSpace: 'nowrap' }}>{r.achievement.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', minWidth: 120 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{r.transaksi.toLocaleString('id-ID')}</div>
                            <div style={{ fontSize: 10, color: trxGap > 0 ? '#dc2626' : '#16a34a' }}>
                              Tgt {r.targetTransaksi.toLocaleString('id-ID')} · {trxGap > 0 ? `-${trxGap.toLocaleString('id-ID')}` : `+${Math.abs(trxGap).toLocaleString('id-ID')}`}
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: acPct(r.upt * 20) }}>{r.upt.toFixed(1)}x</td>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: S.sub }}>{r.qty.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '11px 14px', minWidth: 140 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: S.text }}>{formatRupiah(r.basketSize)}</div>
                            <div style={{ fontSize: 10, color: S.muted }}>Tgt {formatRupiah(r.targetBasketSize)}</div>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: S.text }}>{formatRupiah(r.aur)}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: r.newMember > 0 ? '#0e7490' : S.muted, background: r.newMember > 0 ? '#ecfeff' : '#f8fafc', border: `1px solid ${r.newMember > 0 ? '#a5f3fc' : S.border}`, borderRadius: 999, padding: '3px 8px' }}>
                              {r.newMember.toLocaleString('id-ID')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>}
          </>
        )}

        {/* ── YTD ──────────────────────────────────────────────────────────── */}
        {page === 'ytd' && (
          <>
            {ytdLoading && <div style={{ textAlign: 'center', padding: 80, color: S.muted }}>⟳ Memuat data YTD semua personil…</div>}
            {!ytdLoading && ytdAll.length === 0 && <div style={{ textAlign: 'center', padding: 80, color: S.muted }}>📊 Data YTD belum tersedia.</div>}

            {!ytdLoading && ytdAll.length > 0 && (
              <>
                {/* YTD summary */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
                  <StatCard label="Total Karyawan" value={String(totalKaryawan)} sub={`${ytdValid.length} ada data YTD`} accent={S.red} icon="👥" />
                  <StatCard label="Avg Score" value={avgScore.toFixed(2)} sub={`rata-rata dari ${ytdValid.length} personil`} accent="#7c3aed" icon="⭐" />
                  <StatCard label="Avg Sales YTD" value={`${avgSalesYTD.toFixed(1)}%`} sub="rata-rata pencapaian" accent={acPct(avgSalesYTD)} icon="📊" />
                  <StatCard label="Kuadran I" value={String(ytdValid.filter(e => e.ytdQuadrant.includes('1')).length)} sub={`dari ${ytdValid.length} personil`} accent="#16a34a" icon="🏆" />
                </div>

                {/* Zone & Quadrant distribution */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  {/* Zone */}
                  <div style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    <SectionTitle title="Color Zone SID" sub="distribusi tim" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {zoneOrder.filter(k => zoneDist[k]).map(k => {
                        const z     = zoneStyle(k)
                        const count = zoneDist[k]
                        const pct   = (count / ytdAll.length) * 100
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: z.dot, flexShrink: 0 }}/>
                            <div style={{ width: 70, fontSize: 12, fontWeight: 700, color: z.text, textTransform: 'capitalize' }}>{k}</div>
                            <div style={{ flex: 1, height: 10, background: '#e8edf8', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: z.dot, borderRadius: 5, transition: 'width 0.8s ease' }} />
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: z.text, minWidth: 16 }}>{count}</div>
                            <div style={{ fontSize: 10, color: S.muted, minWidth: 30 }}>{pct.toFixed(0)}%</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Quadrant */}
                  <div style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    <SectionTitle title="Distribusi Kuadran" sub="posisi karyawan" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {(['1','2','3','4'] as const).map(q => {
                        const count = ytdAll.filter(e => e.ytdQuadrant.includes(q)).length
                        const color = QUAD_COLORS[q]
                        const descs: Record<string, string> = { '1':'TRX✓ · BS✓', '2':'TRX✓ · BS✗', '3':'TRX✗ · BS✓', '4':'TRX✗ · BS✗' }
                        const names: Record<string, [string,string]> = { '1':['Excellent','#16a34a'], '2':['Good TRX','#2563eb'], '3':['Good BS','#d97706'], '4':['Needs Work','#dc2626'] }
                        const [nm] = names[q]
                        return (
                          <div key={q} style={{ background: `${color}10`, border: `1.5px solid ${color}25`, borderRadius: 14, padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Q{q}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: S.sub }}>{nm}</div>
                              </div>
                              <div style={{ fontSize: 28, fontWeight: 900, color }}>{count}</div>
                            </div>
                            <div style={{ fontSize: 10, color: S.muted }}>{descs[q]}</div>
                            <div style={{ height: 3, background: '#e8edf8', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(count / ytdAll.length) * 100}%`, background: color, borderRadius: 2 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* YTD staff table */}
                <div style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionTitle title="Detail Semua Personil" />
                    <span style={{ fontSize: 11, color: S.muted, background: S.bg, padding: '3px 10px', borderRadius: 8 }}>sort by Sales%</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                      <thead>
                        <tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                          {['Nama','Zone','Kuadran','Score','Sales YTD','Avg Sales','Avg TRX','Avg BS'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedYTD.map((e, i) => {
                          const z  = zoneStyle(e.ytdColorZone)
                          const qc = quadColor(e.ytdQuadrant)
                          return (
                            <tr key={e.nik} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? '#fff' : S.bg }}>
                              <td style={{ padding: '13px 16px' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{e.nama}</div>
                                <div style={{ fontSize: 10, color: S.muted, fontFamily: 'monospace', marginTop: 1 }}>{e.nik}</div>
                              </td>
                              <td style={{ padding: '13px 16px' }}>
                                <span style={{ background: z.bg, color: z.text, fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{e.ytdColorZone || '—'}</span>
                              </td>
                              <td style={{ padding: '13px 16px' }}>
                                <span style={{ color: qc, fontWeight: 800, fontSize: 12 }}>{e.ytdQuadrant || '—'}</span>
                              </td>
                              <td style={{ padding: '13px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 40, height: 5, background: '#e8edf8', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${(e.ytdScore / 5) * 100}%`, background: acPct((e.ytdScore / 5) * 100), borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: acPct((e.ytdScore / 5) * 100) }}>{e.ytdScore}</span>
                                </div>
                              </td>
                              <td style={{ padding: '13px 16px' }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: acPct(e.ytdSalesPct) }}>{e.ytdSalesPct.toFixed(1)}%</span>
                              </td>
                              <td style={{ padding: '13px 16px', fontSize: 12, fontWeight: 600, color: acPct(e.avgSales) }}>{e.avgSales.toFixed(1)}%</td>
                              <td style={{ padding: '13px 16px', fontSize: 12, fontWeight: 600, color: acPct(e.avgTrx) }}>{e.avgTrx.toFixed(1)}%</td>
                              <td style={{ padding: '13px 16px', fontSize: 12, fontWeight: 600, color: acPct(e.avgBS) }}>{e.avgBS.toFixed(1)}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        </>} {/* end konten laporan */}

        {/* ── Tab: Departemen ─────────────────────────────────────────── */}
        {page === 'dept' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.text }}>Pencapaian Departemen</div>
            {deptLoading && <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⟳ Memuat data departemen…</div>}
            {!deptLoading && [{ data: deptSbd, title: 'SBD (Sales By Day)', accent: '#D93119', subtitle: deptSbd?.date ? `Tanggal ${deptSbd.date}` : 'Data harian' }, { data: deptMtd, title: 'MTD Dept', accent: '#0e7490', subtitle: 'Akumulasi bulan berjalan' }].map(({ data, title, accent, subtitle }) => {
              if (!data) return <div key={title} style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, padding: 24, color: S.muted }}>Data {title} belum tersedia.</div>
              return (
                <div key={title} style={{ background: S.panel, border: `1.5px solid ${S.border}`, borderRadius: 18, padding: isMobile ? 16 : 24, borderTop: `4px solid ${accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: S.text }}>{formatRupiahFull(data.total)}</div>
                      <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{subtitle}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase' }}>Zona Aktif</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: S.text }}>{data.zones.length}</div>
                      {data.achievement && <div style={{ fontSize: 12, fontWeight: 700, color: acPct(data.achievement) }}>{data.achievement.toFixed(1)}%</div>}
                    </div>
                  </div>
                  {data.target && data.target > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: S.muted, marginBottom: 4 }}>
                        <span>Target: {formatRupiahFull(data.target)}</span>
                        <span>{data.achievement?.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 8, background: S.border, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(data.achievement ?? 0, 100)}%`, background: accent, borderRadius: 999 }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
                    {data.zones.map((zone, zi) => {
                      const zc = [{ bg: '#fef3f0', border: '#fde1d8' }, { bg: '#f0f4fd', border: '#d8e4fd' }, { bg: '#f0fdf4', border: '#d1fce1' }][zi % 3]
                      const pct = zone.target && zone.target > 0 ? (zone.value / zone.target) * 100 : data.total > 0 ? (zone.value / data.total) * 100 : 0
                      return (
                        <div key={zone.zone} style={{ background: zc.bg, border: `1px solid ${zc.border}`, borderRadius: 14, padding: 14, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Zona</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: S.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.zone}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 900, color: S.text }}>{formatRupiahFull(zone.value)}</div>
                              {zone.achievement && <div style={{ fontSize: 10, fontWeight: 700, color: acPct(zone.achievement) }}>{zone.achievement.toFixed(1)}%</div>}
                            </div>
                          </div>
                          <div style={{ height: 5, background: zc.border, borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: accent, borderRadius: 999 }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {zone.departments.map(dept => (
                              <div key={dept.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                <div style={{ fontSize: 10, color: S.sub, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.label}</div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: S.text }}>{formatRupiah(dept.value)}</div>
                                  {dept.achievement != null && <div style={{ fontSize: 9, color: acPct(dept.achievement) }}>{dept.achievement.toFixed(0)}%</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {page === 'receipt' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.text }}>Insentif Receipt</div>
            <AdminReceiptTable rows={receiptRows.filter(row => users.some(account => account.role === 'user' && niksMatch(account.nik, row.nik)))} loading={receiptLoading} isMobile={isMobile} />
          </div>
        )}

        {/* ── Tab: Pengaturan ─────────────────────────────────────────── */}
        {page === 'setting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.text, marginBottom: 4 }}>Pengaturan</div>

            {/* Visibilitas TV Display */}
            <div style={{ padding: '22px 24px', background: '#fff', borderRadius: 18, border: `1.5px solid ${S.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Visibilitas TV Display</div>
              <div style={{ fontSize: 12, color: S.sub, marginBottom: 16 }}>Pilih tampilan yang ingin ditayangkan. Pengaturan dapat diaktifkan kembali kapan saja.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TV_DISPLAY_OPTIONS.map(({ key, label, description }) => {
                  const isOn = tvDisplaySettings[key]
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: S.bg, border: `1.5px solid ${S.border}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{label}</div>
                        <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{description}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isOn ? '#16a34a' : S.muted, minWidth: 28 }}>
                        {isOn ? 'ON' : 'OFF'}
                      </span>
                      <button
                        role="switch"
                        aria-checked={isOn}
                        aria-label={`${label} ${isOn ? 'aktif' : 'nonaktif'}`}
                        onClick={() => {
                          const newValue = !isOn
                          const settingKey = `tv_${key}`
                          setMenuSetting(settingKey, newValue)
                          setMenuCfg(getMenuSettings())
                          setTVDisplaySettings(current => ({ ...current, [key]: newValue }))
                          void writeMenuConfigToSheet(`TV_${key.toUpperCase()}`, newValue).then(() => {
                            setTimeout(() => reloadMenuConfig(), 3000)
                          })
                        }}
                        style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', background: isOn ? S.red : '#cbd5e1', transition: 'background 0.2s', flexShrink: 0 }}
                      >
                        <span style={{ position: 'absolute', top: 3, left: isOn ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}/>
                      </button>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 12, padding: '12px 14px', background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12, fontSize: 11, color: '#0369a1', lineHeight: 1.7 }}>
                Pengaturan tersimpan di device ini dan dikirim ke sheet <strong>SETTING</strong> agar berlaku di TV display pada device lain. Perubahan pada device lain diperbarui otomatis setelah sinkronisasi.
              </div>
            </div>

            {/* Visibilitas Menu */}
            <div style={{ padding: '22px 24px', background: '#fff', borderRadius: 18, border: `1.5px solid ${S.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Visibilitas Menu</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { key: 'performance',  label: 'Performance Sales',    desc: 'Individual (SID) — Today, MTD, YTD, Ranking' },
                  { key: 'forecasting',  label: 'Forecasting Insentif', desc: 'Bersyarat & Tanpa Syarat' },
                ] as const).map(({ key, label, desc }) => {
                  // Sheet (global) → localStorage (local fallback)
                  const isOn = key in menuConfig ? menuConfig[key] !== false : menuCfg[key] !== false
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: S.bg, border: `1.5px solid ${S.border}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{label}</div>
                        <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{desc}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isOn ? '#16a34a' : S.muted, minWidth: 28 }}>
                        {isOn ? 'ON' : 'OFF'}
                      </span>
                      <button
                        onClick={() => {
  const newVal = !isOn
  setMenuSetting(key, newVal)
  setMenuCfg(getMenuSettings())
  writeMenuConfigToSheet(`MENU_${key.toUpperCase()}`, newVal).then(() => {
    // Re-fetch dari sheet setelah Apps Script selesai menulis (delay 3s)
    setTimeout(() => reloadMenuConfig(), 3000)
  })
}}
                        style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', background: isOn ? S.red : '#cbd5e1', transition: 'background 0.2s', flexShrink: 0 }}
                      >
                        <span style={{ position: 'absolute', top: 3, left: isOn ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}/>
                      </button>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 12, padding: '12px 14px', background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', marginBottom: 6 }}>💡 Cara kerja global (semua device)</div>
                <div style={{ fontSize: 11, color: '#0369a1', lineHeight: 1.8 }}>
                  Toggle di atas otomatis kirim ke Apps Script → Apps Script update sheet <strong>SETTING</strong>.<br/>
                  Semua device refresh otomatis setiap <strong>60 detik</strong>.<br/>
                  <span style={{ fontWeight: 700 }}>Pastikan Apps Script sudah diupdate</span> dengan kode handler <code style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 10 }}>action=menuConfig</code>.<br/>
                  <br/>
                  Atau edit manual di sheet <strong>SETTING</strong>:<br/>
                  <code style={{ background: '#e0f2fe', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 10, display: 'block', marginTop: 4 }}>
                    CONFIG | MENU_FORECASTING | FALSE | Kunci menu forecasting
                  </code>
                  <code style={{ background: '#e0f2fe', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 10, display: 'block', marginTop: 4 }}>
                    CONFIG | MENU_PERFORMANCE | FALSE | Kunci menu performance
                  </code>
                  <span style={{ opacity: 0.8 }}>Ganti FALSE → TRUE untuk membuka kembali.</span>
                </div>
              </div>
            </div>

            {/* Target Formula & Layout */}
            <div style={{ padding: '22px 24px', background: '#fff', borderRadius: `${cardRadius}px`, border: `1.5px solid ${S.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Rumus Target & Tampilan</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: S.text }}>Target harian default</label>
                <input
                  type="number"
                  value={targetFormula.dailyTarget}
                  onChange={e => updateTargetFormula({ dailyTarget: Number(e.target.value || 0) })}
                  style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}` }}
                />
                <label style={{ fontSize: 12, fontWeight: 700, color: S.text }}>Target bulanan default</label>
                <input
                  type="number"
                  value={targetFormula.monthlyTarget}
                  onChange={e => updateTargetFormula({ monthlyTarget: Number(e.target.value || 0) })}
                  style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}` }}
                />
                <label style={{ fontSize: 12, fontWeight: 700, color: S.text }}>Multiplier target bulanan</label>
                <input
                  type="number"
                  step="0.1"
                  value={targetFormula.monthlyMultiplier}
                  onChange={e => updateTargetFormula({ monthlyMultiplier: Number(e.target.value || 1) })}
                  style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}` }}
                />
                <label style={{ fontSize: 12, fontWeight: 700, color: S.text }}>Mode pencapaian</label>
                <select
                  value={targetFormula.achievementMode}
                  onChange={e => updateTargetFormula({ achievementMode: e.target.value as 'actual_vs_target' | 'daily_prorated' })}
                  style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}` }}
                >
                  <option value="actual_vs_target">Actual vs Target</option>
                  <option value="daily_prorated">Daily Prorated</option>
                </select>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: S.text }}>Warna utama</label>
                  <input type="color" value={layout.primaryColor} onChange={e => updateLayout({ primaryColor: e.target.value })} />
                  <label style={{ fontSize: 12, fontWeight: 700, color: S.text }}>Warna aksen</label>
                  <input type="color" value={layout.accentColor} onChange={e => updateLayout({ accentColor: e.target.value })} />
                  <label style={{ fontSize: 12, fontWeight: 700, color: S.text }}>Radius card</label>
                  <input type="range" min="10" max="30" value={layout.cardRadius} onChange={e => updateLayout({ cardRadius: Number(e.target.value) })} />
                  <div style={{ fontSize: 11, color: S.muted }}>Nilai saat ini: {layout.cardRadius}px</div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: S.text }}>
                    <input type="checkbox" checked={layout.showSummaryCards} onChange={() => updateLayout({ showSummaryCards: !layout.showSummaryCards })} />
                    Tampilkan ringkasan
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: S.text }}>
                    <input type="checkbox" checked={layout.showTopPerformers} onChange={() => updateLayout({ showTopPerformers: !layout.showTopPerformers })} />
                    Top performer
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: S.text }}>
                    <input type="checkbox" checked={layout.showTrendChart} onChange={() => updateLayout({ showTrendChart: !layout.showTrendChart })} />
                    Chart tren
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: S.text }}>
                    <input type="checkbox" checked={layout.showRankingTable} onChange={() => updateLayout({ showRankingTable: !layout.showRankingTable })} />
                    Tabel ranking
                  </label>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: S.sub }}>
                Preview target aktif: {formatSettingValue(targetFormula.dailyTarget)} / {formatSettingValue(targetFormula.monthlyTarget)} · mode {targetFormula.achievementMode === 'daily_prorated' ? 'prorated' : 'langsung'}
              </div>
            </div>

            {/* Login Tracker */}
            <div style={{ padding: '22px 24px', background: '#fff', borderRadius: `${cardRadius}px`, border: `1.5px solid ${S.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Login Tracker</div>
              <div style={{ fontSize: 12, color: S.sub, marginBottom: 14 }}>Catat NIK, nama, dan tanggal login karyawan ke Google Sheets via Apps Script.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={trackerUrl}
                  onChange={e => { setTrackerUrlState(e.target.value); setTrackerSaved(false) }}
                  placeholder="Paste Apps Script URL di sini…"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 11, color: S.text, outline: 'none', fontFamily: 'monospace', background: S.bg }}
                />
                <button
                  onClick={() => { setTrackerUrl(trackerUrl); setTrackerSaved(true); setTimeout(() => setTrackerSaved(false), 2000) }}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: S.red, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {trackerSaved ? '✓ Tersimpan' : 'Simpan'}
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: trackerUrl ? '#16a34a' : S.muted, fontWeight: 600 }}>
                {trackerUrl ? '✓ Tracker aktif di device ini — login tercatat ke sheet DATA LOGIN' : 'Belum dikonfigurasi di device ini'}
              </div>
              <div style={{ marginTop: 12, padding: '12px 14px', background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', marginBottom: 6 }}>💡 Agar berlaku di semua device</div>
                <div style={{ fontSize: 11, color: '#0369a1', lineHeight: 1.7 }}>
                  Tambahkan baris berikut di sheet <strong>SETTING</strong>:<br/>
                  <code style={{ background: '#e0f2fe', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 10 }}>
                    CONFIG | LOGIN_TRACKER_URL | &lt;Apps Script URL&gt; | URL login tracker
                  </code><br/>
                  <span style={{ opacity: 0.8 }}>URL dari sheet akan dipakai otomatis di semua device tanpa perlu setting manual.</span>
                </div>
              </div>
            </div>

            {/* Column Mapping Configuration */}
            <ColumnMappingPanel />
          </div>
        )}

      </div>
    </div>
  )
}
