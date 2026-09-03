import React, { useEffect, useState } from 'react'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import { formatRupiahFull, formatRupiah, type User } from '../data/mockData'
import { useAtlasData } from '../context/useAtlasData'
import { useMobile } from '../hooks/useMobile'
import { fullMonthTokoRow, jakartaDateParts, latestTokoRow, parseDateParts, todayTokoRow, type TokoRow } from '../services/tokoApi'
import { fetchPencapaianDept, type DeptPeriodData, type DeptTrendData } from '../services/deptApi'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'

interface Props { user: User; onBack: () => void }

type Tab = 'today' | 'mtd' | 'fullmonth' | 'trend' | 'dept'

const S = { bg: '#f0f4ff', card: '#fff', border: '#e8edf8', muted: '#94a3b8', text: '#1e293b', sub: '#64748b', red: '#D93119' }

function pct(actual: number, target: number) { return target > 0 ? (actual / target) * 100 : 0 }
function clr(p: number) {
  if (p >= 100) return '#2563eb' // blue
  if (p >= 95)  return '#059669' // green
  if (p >= 90)  return '#f59e0b' // yellow
  if (p >= 80)  return '#ec4899' // pink
  return '#D93119'              // red
}
function formatAchievement(pctValue: number) {
  if (!Number.isFinite(pctValue) || pctValue <= 0) return '0.0%'
  return `${pctValue.toFixed(1)}%`
}
function fmtVal(n: number, unit: string) {
  if (unit === 'Rp') return formatRupiah(n)
  return n.toLocaleString('id-ID')
}

// Parse day number from sheet date string (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD)
function parseDayNum(dateStr: string): number {
  if (!dateStr) return new Date().getDate()
  const parts = dateStr.split(/[-\/]/)
  if (parts.length === 3) {
    if (parts[0].length === 4) return parseInt(parts[2], 10) // YYYY-MM-DD
    return parseInt(parts[0], 10)                            // DD-MM-YYYY or DD/MM/YYYY
  }
  return new Date().getDate()
}

interface KPICardProps { label: string; actual: number; target: number; unit: string; noTarget?: boolean; tag?: string }
function KPICard({ label, actual, target, unit, noTarget, tag }: KPICardProps) {
  const p     = noTarget ? 100 : pct(actual, target)
  const color = noTarget ? S.sub : clr(p)
  const isMobile = useMobile()
  return (
    <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: isMobile ? '14px 16px' : '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', position: 'relative' }}>
      {tag && <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', borderRadius: 6, padding: '2px 6px', letterSpacing: '0.05em' }}>{tag}</span>}
      <div style={{ color: S.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ color: S.text, fontSize: isMobile ? 18 : 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{fmtVal(actual, unit)}</div>
      {!noTarget && (
        <>
          <div style={{ height: 5, background: '#e8edf8', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(p, 100)}%`, background: color, borderRadius: 3, transition: 'width 1s ease' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color, fontWeight: 700 }}>{p.toFixed(1)}%</span>
            <span style={{ color: S.muted }}>Target: {fmtVal(target, unit)}</span>
          </div>
        </>
      )}
    </div>
  )
}

function DonutRing({ p, color }: { p: number; color: string }) {
  const r = 50, circ = 2 * Math.PI * r
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e8edf8" strokeWidth="10"/>
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(p, 100) / 100)}
        strokeLinecap="round" transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color}88)` }}/>
    </svg>
  )
}

// ─── TODAY ───────────────────────────────────────────────────────────────────
function TodayView({ row }: { row: TokoRow }) {
  const salesPct = pct(row.salesDaily, row.targetDaily)
  const color    = clr(salesPct)
  const isMobile = useMobile()

  const kpis: KPICardProps[] = [
    { label: 'Traffic',         actual: row.traffic,        target: row.targetTraffic,    unit: 'orang' },
    { label: 'Transaksi',       actual: row.transaksi,      target: row.targetTransaksi,  unit: 'trx'   },
    { label: 'New Member',      actual: row.newMember,      target: row.targetNewMember,  unit: 'org'   },
    { label: 'Instant Upgrade', actual: row.instantUpgrade, target: 0,                   unit: 'trx', noTarget: true },
    { label: 'Proteksi',        actual: row.proteksi,       target: row.targetProteksi,   unit: 'trx'   },
    { label: 'Sales Online',    actual: row.salesOnline,    target: row.targetOnline,     unit: 'Rp'    },
    { label: 'Sales Offline',   actual: row.salesOffline,   target: 0,                   unit: 'Rp', noTarget: true },
    { label: 'Basket Size',     actual: row.basketSize,     target: row.targetBasketSize, unit: 'Rp'    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '20px' : '28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
          <DonutRing p={salesPct} color={color}/>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color, fontSize: 20, fontWeight: 900 }}>{salesPct.toFixed(0)}%</span>
            <span style={{ color: S.muted, fontSize: 10 }}>Today</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Sales Hari Ini — {row.date}</div>
          <div style={{ color: S.text, fontSize: isMobile ? 20 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{formatRupiahFull(row.salesDaily)}</div>
          <div style={{ color: S.muted, fontSize: 13, marginBottom: 16 }}>dari target {formatRupiahFull(row.targetDaily)}</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Sales',   val: row.salesDaily,  c: color   },
              { label: 'Target',  val: row.targetDaily, c: S.sub   },
              { label: 'Offline', val: row.salesOffline,c: '#7c3aed' },
              { label: 'Online',  val: row.salesOnline, c: '#0e7490' },
            ].map(r => (
              <div key={r.label}>
                <div style={{ color: S.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{r.label}</div>
                <div style={{ color: r.c, fontSize: 14, fontWeight: 800 }}>{formatRupiah(r.val)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
        {kpis.map(k => <KPICard key={k.label} {...k}/>)}
      </div>
    </div>
  )
}

// Shared header card + grid layout untuk MTD dan Full Month
function PerfHeader({ donut, title, main, sub }: { donut: React.ReactElement; title: string; main: string; sub: string }) {
  const isMobile = useMobile()
  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '20px' : '28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      {donut}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{title}</div>
        <div style={{ color: S.text, fontSize: isMobile ? 20 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{main}</div>
        <div style={{ color: S.muted, fontSize: 13 }}>{sub}</div>
      </div>
    </div>
  )
}

// ─── MTD ─────────────────────────────────────────────────────────────────────
// col L, AJ, AO, AW = target MTD yg sudah prorated sesuai tanggal berjalan → pakai langsung
function MTDView({ row, workingDays }: { row: TokoRow; workingDays: number }) {
  const salesPct = pct(row.salesMTD, row.targetMTD)
  const color    = clr(salesPct)
  const isMobile = useMobile()

  const kpis: KPICardProps[] = [
    { label: 'Traffic MTD',    actual: row.trafficMTD,                    target: row.targetTrafficMTD,   unit: 'orang' },
    { label: 'Transaksi MTD',  actual: row.transaksiMTD,                  target: row.targetTransaksiMTD, unit: 'trx'   },
    { label: 'Proteksi MTD',   actual: row.proteksiMTD,                   target: row.targetProteksiMTD,  unit: 'trx'   },
    { label: 'New Member MTD', actual: row.newMemberMTD,                  target: row.targetNewMemberMTD, unit: 'org'   },
    { label: 'Online MTD',     actual: row.salesOnlineMTD,                target: row.targetOnlineMTD,    unit: 'Rp'    },
    { label: 'Offline MTD',    actual: row.salesMTD - row.salesOnlineMTD, target: 0,                      unit: 'Rp', noTarget: true },
    { label: 'Basket Size MTD',actual: row.basketSizeMTD,                 target: row.targetBasketSizeMTD,unit: 'Rp'    },
  ]

  const donut = (
    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
      <DonutRing p={salesPct} color={color}/>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color, fontSize: 20, fontWeight: 900 }}>{salesPct.toFixed(0)}%</span>
        <span style={{ color: S.muted, fontSize: 10 }}>MTD</span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PerfHeader donut={donut} title={`Sales MTD — Hari ke-${workingDays}`} main={formatRupiahFull(row.salesMTD)} sub={`dari target MTD ${formatRupiahFull(row.targetMTD)}`}/>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
        {kpis.map(k => <KPICard key={k.label} {...k}/>)}
      </div>
    </div>
  )
}

// ─── FULL MONTH ───────────────────────────────────────────────────────────────
// Target Full Month diambil langsung dari baris rekap akhir bulan.
function FullMonthView({ row, targetRow }: { row: TokoRow; targetRow: TokoRow }) {
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const currentDay  = Math.max(1, parseDayNum(row.date))
  const acv          = Math.round(row.salesMTD / currentDay)

  const fmTarget            = targetRow.targetMTD
  const fmTargetTraffic     = targetRow.targetTrafficMTD
  const fmTargetTransaksi   = targetRow.targetTransaksiMTD
  const fmTargetProteksi    = targetRow.targetProteksiMTD
  const fmTargetNM          = targetRow.targetNewMemberMTD
  const fmTargetOnline      = targetRow.targetOnlineMTD
  const fmTargetBasketSize  = targetRow.targetBasketSizeMTD

  const achPct   = pct(row.salesMTD, fmTarget)
  const color    = clr(achPct)
  const isMobile = useMobile()

  const kpis: KPICardProps[] = [
    { label: 'Target Full Month', actual: fmTarget,                          target: 0,                   unit: 'Rp',  noTarget: true },
    { label: 'ACV Harian',        actual: acv,                               target: 0,                   unit: 'Rp',  noTarget: true },
    { label: 'Traffic FM',        actual: row.trafficMTD,                    target: fmTargetTraffic,     unit: 'orang' },
    { label: 'Transaksi FM',      actual: row.transaksiMTD,                  target: fmTargetTransaksi,   unit: 'trx'   },
    { label: 'Proteksi FM',       actual: row.proteksiMTD,                   target: fmTargetProteksi,    unit: 'trx'   },
    { label: 'New Member FM',     actual: row.newMemberMTD,                  target: fmTargetNM,          unit: 'org'   },
    { label: 'Online FM',         actual: row.salesOnlineMTD,                target: fmTargetOnline,      unit: 'Rp'    },
    { label: 'Offline MTD',       actual: row.salesMTD - row.salesOnlineMTD, target: 0,                   unit: 'Rp',  noTarget: true },
    { label: 'Basket Size FM',    actual: row.basketSizeMTD,                 target: fmTargetBasketSize,  unit: 'Rp'    },
  ]

  const donut = (
    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
      <DonutRing p={achPct} color={color}/>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color, fontSize: 20, fontWeight: 900 }}>{achPct.toFixed(0)}%</span>
        <span style={{ color: S.muted, fontSize: 10 }}>Full Month</span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PerfHeader donut={donut} title={`Full Month — Hari ke-${currentDay} dari ${daysInMonth}`} main={formatRupiahFull(row.salesMTD)} sub={`dari target full month ${formatRupiahFull(fmTarget)}`}/>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
        {kpis.map(k => <KPICard key={k.label} {...k}/>)}
      </div>
    </div>
  )
}

// ─── TREND ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000)     return `${(n/1_000_000).toFixed(0)}Jt`
  if (n >= 1_000)         return `${(n/1_000).toFixed(0)}Rb`
  return `${n}`
}

function TrendView({ rows }: { rows: TokoRow[] }) {
  const isMobile = useMobile()
  const [metric, setMetric] = useState<'sales'|'traffic'|'transaksi'|'proteksi'|'newmember'|'online'>('sales')
  const today = jakartaDateParts()

  // Tampilkan trend hanya sampai tanggal hari ini agar tanggal masa depan tidak
  // membuat garis aktual terlihat turun ke nol sampai akhir bulan.
  const data = rows
    .filter(r => {
      const date = parseDateParts(r.date)
      return date && date.year === today.year && date.month === today.month && date.day <= today.day && (r.targetDaily > 0 || r.salesDaily > 0)
    })
    .map(r => ({
      day:        parseDayNum(r.date),
      date:       r.date,
      sales:      r.salesDaily,
      tgtSales:   r.targetDaily,
      traffic:    r.traffic,
      tgtTraffic: r.targetTraffic,
      transaksi:  r.transaksi,
      tgtTrx:     r.targetTransaksi,
      proteksi:   r.proteksi,
      tgtProt:    r.targetProteksi,
      newMember:  r.newMember,
      tgtNM:      r.targetNewMember,
      online:     r.salesOnline,
      tgtOnline:  r.targetOnline,
    }))

  const metrics = [
    { key: 'sales',      label: 'Sales',       color: '#D93119', tgtKey: 'tgtSales',   valKey: 'sales'     },
    { key: 'traffic',    label: 'Traffic',      color: '#0e7490', tgtKey: 'tgtTraffic', valKey: 'traffic'   },
    { key: 'transaksi',  label: 'Transaksi',    color: '#7c3aed', tgtKey: 'tgtTrx',     valKey: 'transaksi' },
    { key: 'proteksi',   label: 'Proteksi',     color: '#059669', tgtKey: 'tgtProt',    valKey: 'proteksi'  },
    { key: 'newmember',  label: 'New Member',   color: '#f59e0b', tgtKey: 'tgtNM',      valKey: 'newMember' },
    { key: 'online',     label: 'Online',       color: '#0284c7', tgtKey: 'tgtOnline',  valKey: 'online'    },
  ] as const

  const cur = metrics.find(m => m.key === metric)!
  const isMoney = metric === 'sales' || metric === 'online'

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const actual = payload.find((p: any) => p.dataKey === cur.valKey)?.value ?? 0
    const target = payload.find((p: any) => p.dataKey === cur.tgtKey)?.value ?? 0
    const pNum = target > 0 ? (actual / target * 100) : null
    const pStr = pNum !== null ? pNum.toFixed(1) : '-'
    const pctColor = pNum !== null ? clr(pNum) : S.muted
    return (
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: S.text, marginBottom: 6 }}>Hari ke-{label}</div>
        <div style={{ color: cur.color, fontWeight: 700 }}>Aktual: {isMoney ? formatRupiah(actual) : actual.toLocaleString('id-ID')}</div>
        <div style={{ color: S.muted }}>Target: {isMoney ? formatRupiah(target) : target.toLocaleString('id-ID')}</div>
        <div style={{ color: pctColor, fontWeight: 700 }}>{pStr}%</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {metrics.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key as typeof metric)}
            style={{ padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${metric === m.key ? m.color : S.border}`, background: metric === m.key ? m.color : S.card, color: metric === m.key ? '#fff' : S.sub, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Line chart */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '16px' : '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Trend {cur.label} Harian — Bulan Ini
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={S.border}/>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: S.muted }} tickLine={false}/>
            <YAxis tickFormatter={isMoney ? fmt : (v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} tick={{ fontSize: 11, fill: S.muted }} tickLine={false} axisLine={false} width={50}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Legend formatter={(v) => v === cur.valKey ? 'Aktual' : 'Target'} wrapperStyle={{ fontSize: 12 }}/>
            <Line type="monotone" dataKey={cur.tgtKey} stroke={S.border} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Target"/>
            <Line type="monotone" dataKey={cur.valKey} stroke={cur.color} strokeWidth={2.5} dot={{ r: 3, fill: cur.color }} activeDot={{ r: 5 }} name="Aktual"/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bar chart pencapaian % */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '16px' : '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          % Pencapaian {cur.label} per Hari
        </div>
        <ResponsiveContainer width="100%" height={200}>
          {
            (() => {
              const barData = data.map(d => ({ day: d.day, pct: (d as any)[cur.tgtKey] > 0 ? parseFloat(((d as any)[cur.valKey] / (d as any)[cur.tgtKey] * 100).toFixed(1)) : 0 }))
              return (
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={S.border} vertical={false}/>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: S.muted }} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: S.muted }} tickLine={false} axisLine={false} width={36} tickFormatter={v => `${v}%`}/>
                  <Tooltip formatter={(v) => [`${v}%`, 'Pencapaian']} labelFormatter={l => `Hari ke-${l}`}/>
                  <ReferenceLine y={100} stroke={clr(100)} strokeDasharray="4 3" strokeWidth={1.5}/>
                  <Bar dataKey="pct" radius={[4,4,0,0]} label={false}>
                    {barData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={clr(entry.pct)} />
                    ))}
                  </Bar>
                </BarChart>
              )
            })()
          }
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DeptMetricRow({ label, value, target, zoneTotal }: { label: string; value: number; target?: number; zoneTotal?: number }) {
  const isMobile = useMobile()
  const pct = target && target > 0 ? (value / target) * 100 : zoneTotal && zoneTotal > 0 ? (value / zoneTotal) * 100 : 0
  const color = pct >= 100 ? '#2563eb' : pct >= 95 ? '#059669' : pct >= 90 ? '#f59e0b' : pct >= 80 ? '#ec4899' : '#D93119'

  return (
    <div style={{ marginTop: isMobile ? 6 : 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 3 : 6 }}>
        <div style={{ color: S.text, fontSize: isMobile ? 10 : 12, fontWeight: 700, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ textAlign: 'right', minWidth: 'fit-content' }}>
          <div style={{ color: S.text, fontSize: isMobile ? 10 : 12, fontWeight: 800 }}>{formatRupiah(value)}</div>
          <div style={{ color: target && target > 0 ? color : S.muted, fontSize: isMobile ? 8 : 10, fontWeight: 700 }}>{formatAchievement(pct)}</div>
        </div>
      </div>
      <div style={{ height: isMobile ? 5 : 6, background: '#e8edf8', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 999, transition: 'width 0.8s ease' }} />
      </div>
        {target && target > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginTop: isMobile ? 3 : 4, fontSize: isMobile ? 8 : 10, color: S.muted, overflow: 'hidden' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Target {formatRupiah(target)}</span>
            <span style={{ minWidth: 'fit-content' }}>{pct.toFixed(1)}%</span>
          </div>
        )}
    </div>
  )
}

function DeptPeriodCard({ title, subtitle, data, accent, hideTarget }: { title: string; subtitle: string; data: DeptPeriodData | null; accent: string; hideTarget?: boolean }) {
  const isMobile = useMobile()
  if (!data) {
    return (
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '18px' : '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ color: S.text, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{title}</div>
        <div style={{ color: S.muted, fontSize: 12 }}>{subtitle}</div>
        <div style={{ marginTop: 18, color: S.muted, fontSize: 13 }}>Data belum tersedia.</div>
      </div>
    )
  }

  const zoneCount = data.zones.length
  const topZone = data.zones.length > 0 ? [...data.zones].sort((a, b) => b.value - a.value)[0] : null

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '14px' : '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderTop: `4px solid ${accent}` }}>
      {isMobile ? (
        // Mobile Layout - Horizontal & Compact
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: S.muted, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{title}</div>
              <div style={{ color: S.text, fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em' }}>{formatRupiahFull(data.total)}</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 'fit-content' }}>
              <div style={{ color: accent, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Zona</div>
              <div style={{ color: S.text, fontSize: 20, fontWeight: 900 }}>{zoneCount}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: S.muted, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{subtitle}{topZone && ` • Top: ${topZone.zone}`}</div>
        </div>
      ) : (
        // Desktop Layout
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start', gap: 24, marginBottom: 18 }}>
          <div>
            <div style={{ color: S.muted, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{title}</div>
            <div style={{ color: S.text, fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8 }}>{formatRupiahFull(data.total)}</div>
            <div style={{ color: S.muted, fontSize: 12 }}>{subtitle}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: accent, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Zona Aktif</div>
            <div style={{ color: S.text, fontSize: 32, fontWeight: 900 }}>{zoneCount}</div>
            {topZone && <div style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>Top: {topZone.zone}</div>}
          </div>
        </div>
      )}

      {!hideTarget && typeof data.target === 'number' && data.target > 0 && (
        <div style={{ marginBottom: isMobile ? 14 : 18, padding: isMobile ? '10px 12px' : '12px 14px', borderRadius: 14, background: '#f8fbff', border: `1px solid ${S.border}`, display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? '1fr auto' : undefined, justifyContent: isMobile ? undefined : 'space-between', gap: isMobile ? 12 : 12, flexWrap: isMobile ? undefined : 'wrap' }}>
          <div>
            <div style={{ color: S.muted, fontSize: isMobile ? 9 : 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Target</div>
            <div style={{ color: S.text, fontSize: isMobile ? 13 : 15, fontWeight: 800 }}>{formatRupiahFull(data.target)}</div>
          </div>
          <div style={{ textAlign: isMobile ? 'right' : 'right' }}>
            <div style={{ color: S.muted, fontSize: isMobile ? 9 : 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pencapaian</div>
              <div style={{ color: accent, fontSize: isMobile ? 16 : 18, fontWeight: 900 }}>{formatAchievement(data.achievement ?? 0)}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 12 }}>
        {data.zones.map((zone, zoneIndex) => {
          const zonePct = zone.target && zone.target > 0 ? (zone.value / zone.target) * 100 : data.total > 0 ? (zone.value / data.total) * 100 : 0
          // Different background colors for each zone
          const zoneColors = [
            { bg: '#fef3f0', border: '#fde1d8' }, // Hobbies & Lifestyle - warm coral
            { bg: '#f0f4fd', border: '#d8e4fd' }, // Home Improvement - cool blue
            { bg: '#f0fdf4', border: '#d1fce1' }, // Home Living - soft green
          ]
          const zoneColor = zoneColors[zoneIndex % zoneColors.length]
          return (
            <div key={zone.zone} style={{ background: zoneColor.bg, border: `1px solid ${zoneColor.border}`, borderRadius: isMobile ? 12 : 16, padding: isMobile ? '10px' : '14px', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: isMobile ? 6 : 8, marginBottom: isMobile ? 8 : 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: accent, fontSize: isMobile ? 9 : 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: isMobile ? 3 : 3 }}>Zona</div>
                  <div style={{ color: S.text, fontSize: isMobile ? 13 : 15, fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{zone.zone}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 'fit-content', paddingLeft: isMobile ? 8 : 0 }}>
                  <div style={{ color: S.text, fontSize: isMobile ? 13 : 16, fontWeight: 900 }}>{formatRupiahFull(zone.value)}</div>
                  <div style={{ color: zone.target && zone.target > 0 ? accent : S.muted, fontSize: isMobile ? 10 : 11, fontWeight: 700 }}>{formatAchievement(zonePct)}</div>
                </div>
              </div>
              <div style={{ height: isMobile ? 6 : 7, background: zoneColor.border, borderRadius: 999, overflow: 'hidden', marginBottom: isMobile ? 10 : 12 }}>
                <div style={{ height: '100%', width: `${Math.min(zonePct, 100)}%`, background: accent, borderRadius: 999, transition: 'width 0.8s ease' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 6 : 8 }}>
                {zone.departments.map(item => (
                  <DeptMetricRow key={item.label} label={item.label} value={item.value} target={item.target} zoneTotal={zone.value} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeptTrendCard({ trend }: { trend: DeptTrendData | null }) {
  const isMobile = useMobile()
  const [deptIndex, setDeptIndex] = useState(0)
  const [metric, setMetric] = useState<'achievement' | 'sales'>('achievement')

  const hasData = !!trend && trend.labels.length > 0 && trend.points.length > 0
  const safeIndex = hasData ? Math.min(deptIndex, trend!.labels.length - 1) : 0

  useEffect(() => {
    if (!trend || trend.labels.length === 0) return
    if (deptIndex >= trend.labels.length) setDeptIndex(0)
  }, [deptIndex, trend])

  if (!hasData) {
    return (
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '16px' : '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ color: S.text, fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Trend Pencapaian Departemen</div>
        <div style={{ color: S.muted, fontSize: 12 }}>Data trend per tanggal belum tersedia.</div>
      </div>
    )
  }

  const selectedDept = trend.labels[safeIndex]
  const chartData = trend.points.map(point => ({
    day: point.day,
    date: point.date,
    sales: point.deptValues[safeIndex] ?? 0,
    achievement: point.deptAchievements[safeIndex] ?? 0,
  }))

  const latest = chartData[chartData.length - 1]
  const latestAch = latest?.achievement ?? 0
  const latestSales = latest?.sales ?? 0

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '16px' : '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ color: S.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Departemen</div>
          <div style={{ color: S.text, fontSize: 16, fontWeight: 900 }}>Trend per Tanggal</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setMetric('achievement')}
            style={{ padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${metric === 'achievement' ? '#D93119' : S.border}`, background: metric === 'achievement' ? '#D93119' : '#fff', color: metric === 'achievement' ? '#fff' : S.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            % Pencapaian
          </button>
          <button
            onClick={() => setMetric('sales')}
            style={{ padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${metric === 'sales' ? '#0e7490' : S.border}`, background: metric === 'sales' ? '#0e7490' : '#fff', color: metric === 'sales' ? '#fff' : S.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            Sales Aktual
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 10, alignItems: 'end', marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, color: S.muted, fontWeight: 700 }}>Pilih Departemen</span>
          <select
            value={safeIndex}
            onChange={e => setDeptIndex(Number(e.target.value))}
            style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${S.border}`, fontSize: 12, color: S.text, background: '#fff' }}
          >
            {trend.labels.map((label, idx) => (
              <option key={label} value={idx}>{label}</option>
            ))}
          </select>
        </label>
        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <div style={{ color: S.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Update Terakhir</div>
          <div style={{ color: S.text, fontSize: 12, fontWeight: 700 }}>{selectedDept}</div>
          <div style={{ color: metric === 'achievement' ? clr(latestAch) : '#0e7490', fontSize: 12, fontWeight: 800 }}>
            {metric === 'achievement' ? `${latestAch.toFixed(1)}%` : formatRupiah(latestSales)}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: S.muted }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: S.muted }}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={metric === 'achievement' ? (v) => `${v}%` : fmt}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'achievement') return [`${Number(value).toFixed(1)}%`, '% Pencapaian']
              return [formatRupiah(Number(value)), 'Sales Aktual']
            }}
            labelFormatter={(label) => {
              const point = chartData.find(item => item.day === Number(label))
              return point ? `Hari ${label} (${point.date})` : `Hari ${label}`
            }}
          />
          {metric === 'achievement' && <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 3" />}
          <Line
            type="monotone"
            dataKey={metric}
            stroke={metric === 'achievement' ? '#D93119' : '#0e7490'}
            strokeWidth={2.5}
            dot={{ r: 3, fill: metric === 'achievement' ? '#D93119' : '#0e7490' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function DeptView({ sbd, mtd, trend, loading, error }: { sbd: DeptPeriodData | null; mtd: DeptPeriodData | null; trend: DeptTrendData | null; loading: boolean; error: string | null }) {
  const isMobile = useMobile()
  if (loading) {
    return <div style={{ textAlign: 'center', color: S.muted, fontSize: 14, padding: 40 }}>⟳ Memuat data departemen…</div>
  }

  if (error && !sbd && !mtd) {
    return (
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: isMobile ? '18px' : '24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🏷️</div>
        <div style={{ color: S.text, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Data departemen belum bisa dibaca</div>
        <div style={{ color: S.muted, fontSize: 13 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <DeptPeriodCard
          title="Pencapaian Sales SBD Dept"
          subtitle={sbd?.date ? `Tanggal ${sbd.date}` : 'Data harian terbaru'}
          data={sbd}
          accent="#D93119"
          hideTarget={true}
        />
        <DeptPeriodCard
          title="Pencapaian Sales MTD Dept"
          subtitle="Akumulasi bulan berjalan"
          data={mtd}
          accent="#0e7490"
        />
        <DeptTrendCard trend={trend} />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PencapaianToko({ user, onBack }: Props) {
  const { tokoRows, loading } = useAtlasData()
  const [tab, setTab] = useState<Tab>('today')
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptError, setDeptError] = useState<string | null>(null)
  const [deptSbd, setDeptSbd] = useState<DeptPeriodData | null>(null)
  const [deptMtd, setDeptMtd] = useState<DeptPeriodData | null>(null)
  const [deptTrend, setDeptTrend] = useState<DeptTrendData | null>(null)
  const isMobile  = useMobile()
  const todayRow     = todayTokoRow(tokoRows)   // TODAY & Full Month → data hari ini
  const latest       = latestTokoRow(tokoRows)  // MTD → H-1
  const workingDays  = latest    ? parseDayNum(latest.date)    : Math.max(1, new Date().getDate() - 1) // H-1
  const fullMonthTarget = fullMonthTokoRow(tokoRows)

  useEffect(() => {
    let cancelled = false
    setDeptLoading(true)
    setDeptError(null)
    fetchPencapaianDept()
      .then(result => {
        if (cancelled) return
        setDeptSbd(result.sbd)
        setDeptMtd(result.mtd)
        setDeptTrend(result.trend)
        setDeptLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setDeptError(err instanceof Error ? err.message : String(err))
        setDeptLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'today',     label: 'Today'      },
    { key: 'mtd',       label: 'MTD'        },
    { key: 'fullmonth', label: 'Full Month' },
    { key: 'trend',     label: 'Trend'      },
    { key: 'dept',      label: 'Departemen' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: S.bg }}>
      <header style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '12px 16px' : '14px 32px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <img src={azkoLogo} alt="Azko" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center', boxShadow: '0 2px 8px rgba(217,49,25,0.25)' }}/>
        <span style={{ color: S.text, fontWeight: 800, fontSize: 14, letterSpacing: '0.06em' }}>ATLAS</span>
        <div style={{ width: 1, height: 20, background: S.border }}/>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = S.text }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = S.muted }}
        >← Menu</button>
        <div style={{ width: 1, height: 20, background: S.border }}/>
        <span style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>Pencapaian Toko</span>
        {!isMobile && <span style={{ color: S.muted, fontSize: 12, marginLeft: 'auto' }}>{user.nama}</span>}
      </header>

      <div style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '0 16px' : '0 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: isMobile ? '12px 14px' : '14px 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: tab === t.key ? S.red : S.muted, borderBottom: `2.5px solid ${tab === t.key ? S.red : 'transparent'}`, transition: 'all 0.18s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px' : '28px 32px' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: S.muted, fontSize: 14, padding: 40 }}>⟳ Memuat data toko…</div>
        )}
        {!loading && !todayRow && !latest && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
            <div style={{ color: S.text, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Data belum tersedia</div>
            <div style={{ color: S.muted, fontSize: 13 }}>Sheet "Pencapaian Toko" belum terisi atau belum bisa diakses.</div>
          </div>
        )}
        {!loading && (todayRow || latest || tokoRows.length > 0) && (
          <>
            {tab === 'today'     && todayRow           && <TodayView     row={todayRow}/>}
            {tab === 'mtd'       && latest             && <MTDView       row={latest}   workingDays={workingDays}/>}
            {tab === 'fullmonth' && todayRow && fullMonthTarget && <FullMonthView row={todayRow} targetRow={fullMonthTarget}/>}
            {tab === 'trend'     && tokoRows.length > 0 && <TrendView     rows={tokoRows}/>} 
            {tab === 'dept'      && <DeptView sbd={deptSbd} mtd={deptMtd} trend={deptTrend} loading={deptLoading} error={deptError} />}
          </>
        )}
      </main>
    </div>
  )
}
