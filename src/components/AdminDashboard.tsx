import { useState, useEffect } from 'react'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import { formatRupiah, formatRupiahFull, type User } from '../data/mockData'
import { useAtlasData } from '../context/useAtlasData'
import { useMobile } from '../hooks/useMobile'
import { fetchAllYTD, type YTDEmployee } from '../services/rawDataApi'
import { fetchPencapaianDept, type DeptPeriodData } from '../services/deptApi'
import { getTrackerUrl, setTrackerUrl, writeMenuConfigToSheet } from '../services/loginTracker'
import { getMenuSettings, setMenuSetting } from './MenuPage'
import { useAdminSettings } from '../context/AdminSettingsContext'
import ColumnMappingPanel from './ColumnMappingPanel'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

type NavPage = 'today' | 'mtd' | 'fullmonth' | 'ytd' | 'dept' | 'setting'
type SortKey = 'nama' | 'jobTitle' | 'sales' | 'achievement' | 'transaksi' | 'upt' | 'qty' | 'basketSize' | 'aur' | 'newMember'
type SortOrder = 'asc' | 'desc'

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

interface Props { user: User; onLogout: () => void }

export default function AdminDashboard({ user, onLogout }: Props) {
  const { todayPerf, mtdPerf, loading, dailyDate, reload, users, reloadMenuConfig, menuConfig, teamTodayTrend, teamMtdTrend, teamTodayEmployees, teamMtdEmployees } = useAtlasData()
  const { settings, updateTargetFormula, updateLayout } = useAdminSettings()
  const [page, setPage]             = useState<NavPage>('today')
  const [ytdAll, setYtdAll]         = useState<YTDEmployee[]>([])
  const [ytdLoading, setYtdLoading] = useState(false)
  const [deptSbd, setDeptSbd]       = useState<DeptPeriodData | null>(null)
  const [deptMtd, setDeptMtd]       = useState<DeptPeriodData | null>(null)
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptLoaded, setDeptLoaded]   = useState(false)
  const [trackerUrl, setTrackerUrlState] = useState(getTrackerUrl)
  const [trackerSaved, setTrackerSaved]  = useState(false)
  const [menuCfg, setMenuCfg] = useState(getMenuSettings)
  const [jobFilter, setJobFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('achievement')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const isMobile = useMobile()

  // Declare these early to avoid temporal dead zone issues
  const targetFormula = settings.targetFormula
  const layout = settings.layout

  useEffect(() => {
    setYtdLoading(true)
    fetchAllYTD().then(d => { setYtdAll(d); setYtdLoading(false) })
  }, [])

  useEffect(() => {
    if (page !== 'dept' || deptLoaded) return
    setDeptLoading(true)
    fetchPencapaianDept()
      .then(r => { setDeptSbd(r.sbd); setDeptMtd(r.mtd); setDeptLoaded(true) })
      .finally(() => setDeptLoading(false))
  }, [page, deptLoaded])

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
    const fmTarget = r.target ? Math.round(r.target * fmScale) : 0
    return {
      ...r,
      target: fmTarget,
      achievement: fmTarget > 0 ? parseFloat(((r.value / fmTarget) * 100).toFixed(1)) : 0,
    }
  }).sort((a, b) => b.achievement - a.achievement).map((r, i) => ({ ...r, rank: i + 1 }))

  const dailyTarget = targetFormula.dailyTarget > 0 ? targetFormula.dailyTarget : todayPerf.target
  const monthlyTarget = targetFormula.monthlyTarget > 0 ? targetFormula.monthlyTarget * (targetFormula.monthlyMultiplier || 1) : mtdPerf.target
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
      const targetSales = Math.round(row.targetSales * fmScale)
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
  const avgUpt = filteredEmployeeRows.length > 0
    ? filteredEmployeeRows.reduce((sum, row) => sum + row.upt, 0) / filteredEmployeeRows.length
    : 0
  const avgAur = filteredEmployeeRows.length > 0
    ? filteredEmployeeRows.reduce((sum, row) => sum + row.aur, 0) / filteredEmployeeRows.length
    : 0

  // Hanya karyawan terdaftar (role=user) yang masuk YTD
  const totalKaryawan = users.filter(u => u.role === 'user').length
  const validUserNiks = new Set(users.filter(u => u.role === 'user').map(u => u.nik))
  const ytdValid      = ytdAll.filter(e => validUserNiks.has(e.nik))

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
  const NAV = [
    { key: 'today'     as NavPage, label: 'Today',      icon: '📅', sub: dailyDate    },
    { key: 'mtd'       as NavPage, label: 'MTD',        icon: '📊', sub: 'Berjalan'   },
    { key: 'fullmonth' as NavPage, label: 'Full Month', icon: '📆', sub: 'Target Penuh'},
    { key: 'ytd'       as NavPage, label: 'YTD',        icon: '🎯', sub: 'Tahunan'    },
    { key: 'dept'      as NavPage, label: 'Departemen', icon: '🏬', sub: 'SBD & MTD'   },
    { key: 'setting'   as NavPage, label: 'Pengaturan', icon: '⚙️',  sub: 'Konfigurasi' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>

      {/* ── Sidebar (desktop) / Top nav (mobile) ───────────────────────────── */}
      {!isMobile ? (
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
      ) : (
        /* Mobile top header */
        <header style={{ background: S.panel, borderBottom: `1px solid ${S.border}`, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <img src={azkoLogo} alt="Azko" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: S.text }}>ATLAS</div>
              <div style={{ fontSize: 10, color: S.muted }}>{user.nama}</div>
            </div>
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
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, padding: isMobile ? '16px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Konten Laporan (Today / MTD / Full Month / YTD) ─────────── */}
        {page !== 'setting' && <>

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
        {page !== 'ytd' && (
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

        {/* ── Tab: Pengaturan ─────────────────────────────────────────── */}
        {page === 'setting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.text, marginBottom: 4 }}>Pengaturan</div>

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
