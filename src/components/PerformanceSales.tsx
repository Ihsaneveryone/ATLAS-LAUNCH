import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import { formatRupiah, formatRupiahFull, type PerformanceData, type KPIItem, type User } from '../data/mockData'
import { useAtlasData } from '../context/useAtlasData'
import { useMobile } from '../hooks/useMobile'
import { useAdminSettings } from '../context/AdminSettingsContext'
import YTDPage, { AzkoMascot } from './YTDPage'

type Period = 'today' | 'mtd' | 'fullmonth' | 'ytd'
interface Props { user: User; onBack: () => void }

const S = { bg: '#f0f4ff', card: '#fff', border: '#e8edf8', muted: '#94a3b8', text: '#1e293b', sub: '#64748b' }
const PERIODS = [
  { key: 'today'     as Period, label: 'Today', labelMobile: 'Today', sub: 'Hari Ini'     },
  { key: 'mtd'       as Period, label: 'MTD',   labelMobile: 'MTD',   sub: 'Berjalan'     },
  { key: 'fullmonth' as Period, label: 'Full Month', labelMobile: 'Full', sub: 'Target Penuh' },
  { key: 'ytd'       as Period, label: 'YTD',   labelMobile: 'YTD',   sub: 'Tahun Ini'   },
]

function pctToZone(pct: number): string {
  if (pct >= 100) return 'biru'
  if (pct >= 95)  return 'hijau'
  if (pct >= 90)  return 'kuning'
  if (pct >= 80)  return 'oranye'
  return 'merah'
}
function ac(pct: number) {
  if (pct >= 100) return '#2563eb' // blue
  if (pct >= 95)  return '#059669' // green
  if (pct >= 90)  return '#f59e0b' // yellow
  if (pct >= 80)  return '#ec4899' // pink
  return '#D93119'                // red
}
function lightBg(pct: number) {
  if (pct >= 100) return '#eff6ff'
  if (pct >= 95)  return '#f0fdf4'
  if (pct >= 90)  return '#fefce8'
  if (pct >= 80)  return '#fdf2f8'
  return '#fff1f2'
}

function Ring({ pct, size = 140 }: { pct: number; size?: number }) {
  const r = size * 0.386, c = 2 * Math.PI * r, color = ac(pct)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8edf8" strokeWidth="11"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="11"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(pct, 100) / 100) * c}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color}60)` }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color, fontSize: size * (pct >= 100 ? 0.155 : 0.186), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>{pct.toFixed(1)}%</span>
        <span style={{ color: S.muted, fontSize: size * 0.079, marginTop: 3 }}>Pencapaian</span>
      </div>
    </div>
  )
}

const KPI_SHORT: Record<string, string> = {
  'Instant Upgrade': 'Inst. Upgrade',
  'Total 5 Strategy': 'Total 5 Strat',
}
function KPICard({ label, value, target, unit, noTarget, isMobile }: KPIItem & { isMobile: boolean }) {
  const pct   = noTarget ? 0 : (value / target) * 100
  const color = noTarget ? '#64748b' : ac(pct)
  const disp  = unit === 'Rp' ? formatRupiah(value) : unit === 'x' ? value.toFixed(1) : unit === 'iu' ? `${value} IU` : unit === 'qty' ? `${value} qty` : String(value)
  const tDisp = unit === 'Rp' ? formatRupiah(target) : unit === 'x' ? target.toFixed(1) : unit === 'iu' ? `${target} IU` : unit === 'qty' ? `${target} qty` : String(target)
  const displayLabel = isMobile ? (KPI_SHORT[label] ?? label) : label
  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 14, padding: isMobile ? '14px' : '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: S.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{displayLabel}</span>
        {!noTarget && <span style={{ color, fontSize: 11, fontWeight: 800, background: lightBg(pct), padding: '2px 7px', borderRadius: 6 }}>{Math.min(pct, 999).toFixed(0)}%</span>}
      </div>
      <div style={{ color: S.text, fontSize: isMobile ? 18 : 22, fontWeight: 800, marginBottom: noTarget ? 0 : 8 }}>
        {disp} <span style={{ fontSize: 12, color: S.muted, fontWeight: 500 }}>{unit !== 'Rp' && unit !== 'x' && unit !== 'iu' && unit !== 'qty' ? unit : ''}</span>
      </div>
      {!noTarget && <>
        <div style={{ height: 5, background: '#e8edf8', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: 'width 0.9s ease' }}/>
        </div>
        <div style={{ color: S.muted, fontSize: 11 }}>Target <span style={{ color: S.sub }}>{tDisp} {unit !== 'Rp' && unit !== 'x' && unit !== 'iu' && unit !== 'qty' ? unit : ''}</span></div>
      </>}
    </div>
  )
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
      <p style={{ color: S.muted, marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>{p.name === 'actual' ? 'Aktual' : 'Target'}: <b>{formatRupiah(p.value)}</b></p>)}
    </div>
  )
}

function RankingRow({ row, i, isMobile }: { row: PerformanceData['ranking'][0]; i: number; isMobile: boolean }) {
  const color = ac(row.achievement)
  return (
    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
      <td style={{ padding: isMobile ? '12px 12px' : '14px 20px', fontSize: 18 }}>
        {['🥇','🥈','🥉'][i] ?? <span style={{ color: S.muted, fontSize: 12, fontWeight: 700 }}>#{row.rank}</span>}
      </td>
      <td style={{ padding: isMobile ? '12px 8px' : '14px 16px' }}>
        <div style={{ color: S.text, fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>{row.nama}</div>
        {!isMobile && <div style={{ color: S.muted, fontSize: 11, marginTop: 2 }}><span style={{ fontFamily: 'monospace' }}>{row.nik}</span> · {row.jobTitle}</div>}
        {isMobile && <div style={{ color: S.muted, fontSize: 11, marginTop: 1 }}>{row.jobTitle}</div>}
      </td>
      {!isMobile && (
        <td style={{ padding: '14px 16px', textAlign: 'right', color: S.sub, fontSize: 13, fontFamily: 'monospace' }}>{formatRupiahFull(row.value)}</td>
      )}
      <td style={{ padding: isMobile ? '12px 12px' : '14px 20px', textAlign: 'right' }}>
        <span style={{ color, fontWeight: 800, fontSize: isMobile ? 13 : 14, background: lightBg(row.achievement), padding: '3px 8px', borderRadius: 7 }}>{row.achievement.toFixed(1)}%</span>
        {isMobile && <div style={{ color: S.muted, fontSize: 10, marginTop: 2, textAlign: 'right' }}>{formatRupiah(row.value)}</div>}
      </td>
    </tr>
  )
}

export default function PerformanceSales({ user, onBack }: Props) {
  const { todayPerf, mtdPerf, loading, error } = useAtlasData()
  const { settings } = useAdminSettings()
  const [period, setPeriod] = useState<Period>('today')
  const isMobile = useMobile()
  const targetFormula = settings.targetFormula
  const layout = settings.layout
  const primaryColor = layout.primaryColor || '#D93119'
  const cardRadius = layout.cardRadius || 18

  const monthlyTarget = mtdPerf.target > 0
    ? mtdPerf.target
    : targetFormula.monthlyTarget > 0
      ? targetFormula.monthlyTarget * (targetFormula.monthlyMultiplier || 1)
      : mtdPerf.target
  const todayTarget = todayPerf.target > 0
    ? todayPerf.target
    : targetFormula.dailyTarget > 0
      ? targetFormula.dailyTarget
      : todayPerf.target

  // Full Month: sama actual/trend dengan MTD, tapi achievement vs target penuh
  const fullMonthAch = monthlyTarget > 0
    ? parseFloat(((mtdPerf.actual / monthlyTarget) * 100).toFixed(1))
    : 0
  // Scale factor: MTD prorated → full month target
  const fmScale = (mtdPerf.targetMTD && mtdPerf.targetMTD > 0)
    ? mtdPerf.target / mtdPerf.targetMTD
    : 1
  // KPI targets scaled to full month
  const fullMonthKPIs = mtdPerf.kpis.map(k => ({
    ...k,
    target: k.noTarget ? k.target : Math.round(k.target * fmScale),
  }))
  // Ranking recalculated vs full month target per person
  const fullMonthRanking = (mtdPerf.ranking ?? []).map(r => {
    const fmTarget = r.target ? Math.round(r.target * fmScale) : 0
    return {
      ...r,
      target: fmTarget,
      achievement: fmTarget > 0 ? parseFloat(((r.value / fmTarget) * 100).toFixed(1)) : 0,
    }
  }).sort((a, b) => b.achievement - a.achievement).map((r, i) => ({ ...r, rank: i + 1 }))

  const fullMonthData: PerformanceData = {
    ...mtdPerf,
    achievement: fullMonthAch,
    target: monthlyTarget,
    targetMTD: monthlyTarget,
    kpis: fullMonthKPIs,
    ranking: fullMonthRanking,
  }

  const todayData: PerformanceData = {
    ...todayPerf,
    target: todayTarget,
    achievement: todayTarget > 0 ? parseFloat(((todayPerf.actual / todayTarget) * 100).toFixed(1)) : 0,
  }
  const mtdTarget = (mtdPerf.targetMTD ?? 0) > 0 ? (mtdPerf.targetMTD ?? 0) : monthlyTarget
  const mtdData: PerformanceData = {
    ...mtdPerf,
    target: mtdTarget,
    achievement: mtdTarget > 0 ? parseFloat(((mtdPerf.actual / mtdTarget) * 100).toFixed(1)) : 0,
  }

  const data = period === 'today' ? todayData : period === 'mtd' ? mtdData : fullMonthData
  const trend = data.dailyTrend ?? data.monthlyTrend ?? []
  const mainColor = ac(data.achievement)
  const px = isMobile ? '16px' : '32px'

  return (
    <div style={{ minHeight: '100vh', background: S.bg }}>
      {/* Header */}
      <header style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: `12px ${px}`, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={azkoLogo} alt="Azko" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center' }}/>
          <span style={{ color: S.text, fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>ATLAS</span>
          <div style={{ width: 1, height: 18, background: S.border }}/>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0 }}>← Menu</button>
          {!isMobile && <>
            <div style={{ width: 1, height: 18, background: S.border }}/>
            <span style={{ color: S.text, fontWeight: 700, fontSize: 13 }}>Performance Sales</span>
            <span style={{ color: S.muted, fontSize: 12 }}>{user.nama}</span>
          </>}
          <div style={{ flex: 1 }}/>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: 2, padding: 3, background: S.bg, borderRadius: 10, border: `1px solid ${S.border}` }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: isMobile ? '6px 12px' : '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: isMobile ? 12 : 13, transition: 'all 0.18s',
                background: period === p.key ? primaryColor : 'transparent',
                color: period === p.key ? '#fff' : S.muted,
                boxShadow: period === p.key ? `0 2px 8px ${primaryColor}35` : 'none',
              }}>{isMobile ? p.labelMobile : p.label}</button>
            ))}
          </div>
        </div>
        {isMobile && (
          <div style={{ marginTop: 5, color: S.muted, fontSize: 11 }}>
            {user.nama} · {user.jobTitle}
          </div>
        )}
      </header>

      {loading && <div style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: `8px ${px}`, fontSize: 13, color: '#2563eb' }}>⟳ Memuat data…</div>}
      {error && <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: `8px ${px}`, fontSize: 13, color: '#92400e' }}>⚠ {error}</div>}

      {period === 'ytd' && <YTDPage user={user} />}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px' : '28px 32px', display: period === 'ytd' ? 'none' : 'flex', flexDirection: 'column', gap: 14 }}>


        {/* Achievement card */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: `${cardRadius}px`, padding: isMobile ? '16px' : '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'relative' }}>
          {/* Maskot kecil — hiasan kanan atas (desktop only) */}
          {!isMobile && (
            <div style={{ position: 'absolute', top: 10, right: 18, width: 52, opacity: 0.88, pointerEvents: 'none' }}>
              <AzkoMascot colorZone={pctToZone(data.achievement)} color={mainColor}/>
            </div>
          )}{/* Mobile mascot rendered inline inside the ring row below */}
          <div style={{ color: S.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            {PERIODS.find(p => p.key === period)?.label} · {PERIODS.find(p => p.key === period)?.sub} — {(() => { const d = new Date(); if (period === 'mtd' || period === 'fullmonth') d.setDate(d.getDate() - 1); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) })()}
          </div>
          {isMobile ? (
            /* Mobile: ring kiri, mascot tengah, bar kanan */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Ring pct={data.achievement} size={100}/>
                <div style={{ width: 46, flexShrink: 0 }}>
                  <AzkoMascot colorZone={pctToZone(data.achievement)} color={mainColor}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 7, background: '#e8edf8', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(data.achievement, 100)}%`, background: mainColor, borderRadius: 4, transition: 'width 1s ease' }}/>
                  </div>
                </div>
              </div>
              {(() => {
                const gap      = data.target - data.actual
                const gapMTD   = (data.targetMTD ?? data.target) - data.actual
                const gColor   = (g: number) => g > 0 ? '#dc2626' : '#16a34a'
                const gVal     = (g: number) => g > 0 ? `−${formatRupiah(g)}` : `+${formatRupiah(Math.abs(g))}`
                const items =
                  period === 'mtd' ? [
                    { label: 'Aktual',       val: formatRupiah(data.actual),              c: S.text        },
                    { label: 'Target MTD',   val: formatRupiah(data.targetMTD ?? 0),      c: '#0369a1'     },
                    { label: 'ACV/hari',     val: formatRupiah(data.acv),                 c: '#7c3aed'     },
                    { label: 'Gap vs MTD',   val: gVal(gapMTD),                           c: gColor(gapMTD)},
                  ] : period === 'fullmonth' ? [
                    { label: 'Aktual',       val: formatRupiah(data.actual),              c: S.text        },
                    { label: 'Target Bulan', val: formatRupiah(data.target),              c: S.muted       },
                    { label: 'ACV/hari',     val: formatRupiah(data.acv),                 c: '#7c3aed'     },
                    { label: 'Gap Bulan',    val: gVal(gap),                              c: gColor(gap)   },
                  ] : [
                    { label: 'Aktual',       val: formatRupiah(data.actual),              c: S.text        },
                    { label: 'Target',       val: formatRupiah(data.target),              c: S.muted       },
                    { label: 'ACV/hari',     val: formatRupiah(data.acv),                 c: '#7c3aed'     },
                    { label: 'Sisa Gap',     val: gVal(gap),                              c: gColor(gap)   },
                  ]
                const cols = 'repeat(2, 1fr)'
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6 }}>
                    {items.map(item => (
                      <div key={item.label} style={{ background: S.bg, borderRadius: 10, padding: '10px', border: `1px solid ${S.border}` }}>
                        <div style={{ color: S.muted, fontSize: 9, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, lineHeight: 1.3 }}>{item.label}</div>
                        <div style={{ color: item.c, fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          ) : (
            /* Desktop: ring kiri, info kanan */
            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <Ring pct={data.achievement} size={140}/>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: '#e8edf8', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(data.achievement, 100)}%`, background: mainColor, borderRadius: 4, transition: 'width 1s ease' }}/>
                </div>
                {(() => {
                  const gap    = data.target - data.actual
                  const gapMTD = (data.targetMTD ?? data.target) - data.actual
                  const gColor = (g: number) => g > 0 ? '#dc2626' : '#16a34a'
                  const gVal   = (g: number) => g > 0 ? `−${formatRupiahFull(g)}` : `+${formatRupiahFull(Math.abs(g))}`
                  const items =
                    period === 'mtd' ? [
                      { label: 'Aktual',       val: formatRupiahFull(data.actual),          c: S.text         },
                      { label: 'Target MTD',   val: formatRupiahFull(data.targetMTD ?? 0), c: '#0369a1'      },
                      { label: 'ACV/hari',     val: formatRupiahFull(data.acv),             c: '#7c3aed'      },
                      { label: 'Gap vs MTD',   val: gVal(gapMTD),                           c: gColor(gapMTD) },
                    ] : period === 'fullmonth' ? [
                      { label: 'Aktual',       val: formatRupiahFull(data.actual),   c: S.text    },
                      { label: 'Target Bulan', val: formatRupiahFull(data.target),   c: S.muted   },
                      { label: 'ACV/hari',     val: formatRupiahFull(data.acv),      c: '#7c3aed' },
                      { label: 'Gap Full Month',        val: gVal(gap),                       c: gColor(gap) },
                    ] : [
                      { label: 'Aktual',   val: formatRupiahFull(data.actual),  c: S.text    },
                      { label: 'Target',   val: formatRupiahFull(data.target),  c: S.muted   },
                      { label: 'ACV/hari', val: formatRupiahFull(data.acv),     c: '#7c3aed' },
                      { label: 'Sisa Gap', val: gVal(gap),                      c: gColor(gap) },
                    ]
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {items.map(item => (
                        <div key={item.label} style={{ background: S.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${S.border}` }}>
                          <div style={{ color: S.muted, fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, lineHeight: 1.4 }}>{item.label}</div>
                          <div style={{ color: item.c, fontSize: 13, fontWeight: 800 }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* KPI grid */}
        <div>
          <div style={{ color: S.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Pencapaian per KPI</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(165px, 1fr))', gap: 10 }}>
            {data.kpis.map(k => <KPICard key={k.label} {...k} isMobile={isMobile}/>)}
          </div>
        </div>

        {/* Chart */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: `${cardRadius}px`, padding: isMobile ? '16px' : '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ color: S.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            {period === 'today' ? 'Trend Harian' : period === 'mtd' ? 'Trend MTD Harian' : 'Trend Bulanan'}
          </div>
          <div style={{ height: isMobile ? 160 : 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D93119" stopOpacity={0.18}/>
                    <stop offset="100%" stopColor="#D93119" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{ fill: S.muted, fontSize: 10 }} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={v => formatRupiah(v)} tick={{ fill: S.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={isMobile ? 40 : 48}/>
                <Tooltip content={<ChartTip/>}/>
                <ReferenceLine y={trend[0]?.target} stroke="#f59e0b" strokeDasharray="5 4" strokeOpacity={0.6}/>
                <Area type="monotone" dataKey="actual" stroke="#D93119" strokeWidth={2.5} fill="url(#gr)" dot={{ fill: '#D93119', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#D93119' }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking — hanya NIK terdaftar di USERS */}
        {data.ranking.length > 0 && (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: `${cardRadius}px`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <span style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>Ranking — {PERIODS.find(p => p.key === period)?.label}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.bg }}>
                  <th style={{ padding: '8px 12px', color: S.muted, fontSize: 10, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase' }}>#</th>
                  <th style={{ padding: '8px 8px', color: S.muted, fontSize: 10, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase' }}>Nama</th>
                  {!isMobile && <th style={{ padding: '8px 16px', color: S.muted, fontSize: 10, fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' }}>Sales</th>}
                  <th style={{ padding: '8px 12px', color: S.muted, fontSize: 10, fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((row, i) => <RankingRow key={`${row.nik}_${i}`} row={row} i={i} isMobile={isMobile}/>)}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  )
}
