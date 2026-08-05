import { useState } from 'react'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import { formatRupiahFull, formatRupiah } from '../data/mockData'
import type { User } from '../data/mockData'
import { useAtlasData } from '../context/useAtlasData'
import { useMobile } from '../hooks/useMobile'
import { latestTokoRow } from '../services/tokoApi'

export const MENU_SETTINGS_KEY = 'atlas_menu_settings'
export function getMenuSettings(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(MENU_SETTINGS_KEY) || '{}') } catch { return {} }
}
export function setMenuSetting(key: string, val: boolean) {
  const s = getMenuSettings(); s[key] = val
  localStorage.setItem(MENU_SETTINGS_KEY, JSON.stringify(s))
}

type MenuKey = 'performance' | 'forecasting' | 'toko' | 'spreadsheet' | 'admin'
interface Props { user: User; onNavigate: (m: MenuKey) => void; onLogout: () => void }

const S = { bg: '#f0f4ff', card: '#fff', border: '#e8edf8', muted: '#94a3b8', text: '#1e293b', sub: '#64748b' }

const MENUS = [
  {
    key: 'performance' as MenuKey,
    title: 'Performance Sales', subtitle: 'Individual (SID)',
    desc: 'Pencapaian penjualan hari ini, bulan ini, dan tahun ini — lengkap dengan ranking dan trend.',
    tags: ['Today', 'MTD', 'YTD', 'Ranking'], color: '#D93119', light: '#fff5f3',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="26" width="6" height="10" rx="2" fill="#D93119" opacity="0.3"/>
        <rect x="13" y="18" width="6" height="18" rx="2" fill="#D93119" opacity="0.6"/>
        <rect x="22" y="10" width="6" height="26" rx="2" fill="#D93119"/>
        <path d="M7 22L16 12L25 17L35 5" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="35" cy="5" r="3" fill="#f59e0b"/>
      </svg>
    ),
  },
  {
    key: 'forecasting' as MenuKey,
    title: 'Forecasting Insentif', subtitle: 'Toko · Proteksi · Produk Insentif Bulan Ini · Receipt',
    desc: 'Jelajahi daftar insentif toko, proteksi, produk insentif bulan ini, receipt, dan SKU lainnya secara terstruktur.',
    tags: ['Toko', 'Proteksi', 'Produk Insentif Bulan Ini', 'Receipt'], color: '#7c3aed', light: '#f5f3ff',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="14" stroke="#7c3aed" strokeWidth="2" opacity="0.2"/>
        <circle cx="20" cy="20" r="9"  stroke="#7c3aed" strokeWidth="2" opacity="0.45"/>
        <circle cx="20" cy="20" r="4.5" fill="#7c3aed"/>
        <path d="M20 6V9M20 31V34M6 20H9M31 20H34" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
      </svg>
    ),
  },
  {
    key: 'toko' as MenuKey,
    title: 'Pencapaian Toko', subtitle: 'Today · MTD · Full Month',
    desc: 'Traffic, transaksi, sales, proteksi, dan KPI toko secara keseluruhan hari ini dan bulan ini.',
    tags: ['Today', 'MTD', 'Full Month'], color: '#0e7490', light: '#ecfeff',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="5" y="14" width="30" height="22" rx="3" stroke="#0e7490" strokeWidth="2" opacity="0.25"/>
        <path d="M5 19h30" stroke="#0e7490" strokeWidth="1.5" opacity="0.4"/>
        <path d="M13 14V10a7 7 0 0114 0v4" stroke="#0e7490" strokeWidth="2" strokeLinecap="round"/>
        <rect x="15" y="23" width="10" height="7" rx="2" fill="#0e7490" opacity="0.6"/>
        <circle cx="20" cy="27" r="1.5" fill="#fff"/>
      </svg>
    ),
  },
  {
    key: 'spreadsheet' as MenuKey,
    title: 'Template Spreadsheet', subtitle: 'Panduan Input Data',
    desc: 'Format dan struktur file spreadsheet untuk update data karyawan, KPI, dan produk insentif.',
    tags: ['4 Sheet', 'Format', 'Contoh'], color: '#059669', light: '#f0fdf9', adminOnly: true,
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="6" width="28" height="28" rx="5" stroke="#059669" strokeWidth="2" opacity="0.25"/>
        <path d="M6 15h28M6 24h28M17 15v19" stroke="#059669" strokeWidth="2" opacity="0.5"/>
        <rect x="9" y="18" width="5" height="4" rx="1" fill="#059669" opacity="0.7"/>
        <rect x="9" y="27" width="5" height="3" rx="1" fill="#059669" opacity="0.5"/>
        <rect x="21" y="18" width="10" height="4" rx="1" fill="#059669" opacity="0.4"/>
        <rect x="21" y="27" width="7" height="3" rx="1" fill="#059669" opacity="0.3"/>
      </svg>
    ),
  },
  {
    key: 'admin' as MenuKey,
    title: 'Dashboard Manajer', subtitle: 'Semua Personil',
    desc: 'Pantau performa seluruh tim — Today, MTD, dan YTD — dalam satu tampilan ringkas untuk manajer.',
    tags: ['Today', 'MTD', 'YTD', 'Tim'], color: '#0e7490', light: '#ecfeff', adminOnly: true,
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="14" cy="13" r="5" stroke="#0e7490" strokeWidth="2" opacity="0.4"/>
        <circle cx="26" cy="13" r="5" stroke="#0e7490" strokeWidth="2" opacity="0.7"/>
        <path d="M6 32c0-5 4-8 8-8h12c4 0 8 3 8 8" stroke="#0e7490" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        <path d="M22 28l4 4 6-6" stroke="#0e7490" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

function TodayBar() {
  const { todayPerf: d, loading, dailyDate } = useAtlasData()
  const isMobile = useMobile()
  const pct = Math.min(d.achievement, 100)
  const color = d.achievement >= 100 ? '#059669' : d.achievement >= 75 ? '#D93119' : '#f59e0b'

  return (
    <div style={{ background: '#fff', borderBottom: `1px solid ${S.border}`, padding: isMobile ? '14px 16px' : '18px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {loading ? '⟳ Memuat…' : `Performance Hari Ini${dailyDate ? ` — ${dailyDate}` : ''}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ color: S.text, fontSize: isMobile ? 24 : 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatRupiahFull(d.actual)}</span>
          <span style={{ color: S.muted, fontSize: 13 }}>dari {formatRupiahFull(d.target)}</span>
          <span style={{ color, fontSize: 16, fontWeight: 800, background: `${color}15`, padding: '2px 10px', borderRadius: 8 }}>{d.achievement.toFixed(1)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 7, background: '#e8edf8', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 4, transition: 'width 1.2s ease' }}/>
          </div>
          <span style={{ color: S.muted, fontSize: 12, flexShrink: 0 }}>{formatRupiah(d.target)}</span>
        </div>
        {/* KPI pills */}
        <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'nowrap', marginTop: 12, overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? 2 : 0 }}>
          {d.kpis.slice(0, 5).map(k => {
            const kp = (k.value / k.target) * 100
            const kc = kp >= 100 ? '#059669' : kp >= 75 ? '#D93119' : '#f59e0b'
            return (
              <div key={k.label} style={{ textAlign: 'center', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 12, padding: isMobile ? '7px 10px' : '8px 14px', flexShrink: 0 }}>
                <div style={{ color: S.muted, fontSize: isMobile ? 9 : 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k.label}</div>
                <div style={{ color: S.text, fontSize: isMobile ? 13 : 14, fontWeight: 700 }}>
                  {k.unit === 'Rp' ? formatRupiah(k.value) : k.unit === 'x' ? `${k.value.toFixed(1)}×` : k.value}
                </div>
                <div style={{ color: kc, fontSize: 11, fontWeight: 700 }}>{kp.toFixed(0)}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TokoBar() {
  const { tokoRows, loading } = useAtlasData()
  const isMobile = useMobile()
  const row = latestTokoRow(tokoRows)
  if (!row && !loading) return null

  const salesAch = row && row.targetMTD > 0 ? (row.salesMTD / row.targetMTD) * 100 : 0
  const color    = salesAch >= 100 ? '#059669' : salesAch >= 75 ? '#0e7490' : '#f59e0b'

  const pills = row ? [
    { label: 'Proteksi MTD',   val: row.proteksiMTD.toLocaleString('id-ID'),   ach: row.targetProteksiMTD  > 0 ? row.proteksiMTD  / row.targetProteksiMTD  * 100 : null },
    { label: 'New Member MTD', val: row.newMemberMTD.toLocaleString('id-ID'),  ach: row.targetNewMemberMTD > 0 ? row.newMemberMTD / row.targetNewMemberMTD * 100 : null },
    { label: 'Online MTD',     val: formatRupiah(row.salesOnlineMTD),          ach: row.targetOnlineMTD    > 0 ? row.salesOnlineMTD / row.targetOnlineMTD   * 100 : null },
    { label: 'Offline MTD',    val: formatRupiah(row.salesMTD - row.salesOnlineMTD), ach: null },
    { label: 'Basket Size',    val: formatRupiah(row.basketSize),              ach: row.targetBasketSize   > 0 ? row.basketSize / row.targetBasketSize       * 100 : null },
  ] : []

  return (
    <div style={{ background: '#ecfeff', borderBottom: `1px solid #a5f3fc`, padding: isMobile ? '12px 16px' : '14px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ color: '#0e7490', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {loading ? '⟳ Memuat…' : `Pencapaian Toko MTD${row ? ` — ${row.date}` : ''}`}
        </div>
        {row && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ color: S.text, fontSize: isMobile ? 20 : 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatRupiahFull(row.salesMTD)}</span>
              <span style={{ color: S.muted, fontSize: 13 }}>dari {formatRupiahFull(row.targetMTD)}</span>
              <span style={{ color, fontSize: 15, fontWeight: 800, background: `${color}18`, padding: '2px 10px', borderRadius: 8 }}>{salesAch.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'nowrap', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? 2 : 0 }}>
              {pills.map(p => {
                const kc = p.ach === null ? S.muted : p.ach >= 100 ? '#059669' : p.ach >= 75 ? '#0e7490' : '#f59e0b'
                return (
                  <div key={p.label} style={{ textAlign: 'center', background: '#fff', border: '1px solid #a5f3fc', borderRadius: 12, padding: isMobile ? '7px 10px' : '8px 14px', flexShrink: 0 }}>
                    <div style={{ color: '#0e7490', fontSize: isMobile ? 9 : 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{p.label}</div>
                    <div style={{ color: S.text, fontSize: isMobile ? 13 : 14, fontWeight: 700 }}>{p.val}</div>
                    {p.ach !== null && <div style={{ color: kc, fontSize: 11, fontWeight: 700 }}>{p.ach.toFixed(0)}%</div>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MenuPage({ user, onNavigate, onLogout }: Props) {
  const { error, loading, reload, menuConfig } = useAtlasData()
  const isMobile = useMobile()
  const px = isMobile ? '16px' : '32px'
  const [menuSettings] = useState(getMenuSettings)

  return (
    <div style={{ minHeight: '100vh', background: S.bg }}>
      <header style={{ background: '#fff', borderBottom: `1px solid ${S.border}`, padding: `12px ${px}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={azkoLogo} alt="Azko" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center', boxShadow: '0 2px 10px rgba(217,49,25,0.25)' }}/>
            <span style={{ color: S.text, fontWeight: 800, fontSize: 14, letterSpacing: '0.06em' }}>ATLAS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isMobile && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: S.text, fontSize: 13, fontWeight: 600 }}>{user.nama}</div>
                <div style={{ color: S.muted, fontSize: 11 }}>{user.nik} · {user.jobTitle}</div>
              </div>
            )}
            <button onClick={() => reload(user.nik)} disabled={loading}
              style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: '#f8faff', color: S.muted, fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
              title="Refresh data">
              {loading ? '⟳' : '↻'}
            </button>
            <button onClick={onLogout}
              style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: '#f8faff', color: S.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Keluar
            </button>
          </div>
        </div>
        {isMobile && (
          <div style={{ marginTop: 6, color: S.muted, fontSize: 12 }}>
            {user.nama} <span style={{ opacity: 0.5 }}>· {user.jobTitle}</span>
          </div>
        )}
      </header>

      {error && (
        <div style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa', padding: `10px ${px}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#9a3412' }}>
          <span style={{ flex: 1 }}>⚠ {error}</span>
          <button onClick={() => reload(user.nik)} style={{ border: '1px solid #fed7aa', background: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#9a3412', cursor: 'pointer' }}>Coba Lagi</button>
        </div>
      )}

      <TodayBar/>
      <TokoBar/>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 16px' : '36px 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: S.text, fontSize: isMobile ? 20 : 24, fontWeight: 800, marginBottom: 4 }}>Halo, {user.nama} 👋</h2>
          <p style={{ color: S.muted, fontSize: 13 }}>Pilih menu untuk mulai memantau performa penjualan</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
          {MENUS.filter(m => !m.adminOnly || user.role === 'admin').map(m => {
            // Sheet (global semua device) → localStorage (lokal device) → default enabled
            const isLocked = m.key in menuConfig
              ? menuConfig[m.key] === false
              : menuSettings[m.key] === false
            return (
            <button key={m.key}
              onClick={() => { if (!isLocked) onNavigate(m.key) }}
              style={{ background: isLocked ? '#f8faff' : S.card, border: `1.5px solid ${isLocked ? '#e2e8f4' : S.border}`, borderRadius: 20, padding: isMobile ? '20px 18px' : '26px 24px', textAlign: 'left', cursor: isLocked ? 'default' : 'pointer', transition: 'all 0.2s', boxShadow: isLocked ? 'none' : '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 16 : 0, opacity: isLocked ? 0.55 : 1, position: 'relative', overflow: 'hidden' }}>
              {isLocked && (
                <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: '3px 8px' }}>
                  <span style={{ fontSize: 11 }}>🔒</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: S.muted }}>Segera Hadir</span>
                </div>
              )}
              <div style={{ width: 48, height: 48, borderRadius: 14, background: isLocked ? '#f1f5f9' : m.light, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? 0 : 16, flexShrink: 0 }}>
                {m.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: isLocked ? S.muted : S.text, fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{m.title}</div>
                <div style={{ color: isLocked ? S.muted : m.color, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: isMobile ? 0 : 8 }}>{m.subtitle}</div>
                {!isMobile && <p style={{ color: S.sub, fontSize: 13, lineHeight: 1.65, marginBottom: 16 }}>{m.desc}</p>}
                {!isMobile && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.tags.map(t => (
                      <span key={t} style={{ background: m.light, color: m.color, border: `1px solid ${m.color}25`, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {isMobile && !isLocked && <span style={{ color: S.muted, fontSize: 18 }}>›</span>}
            </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
