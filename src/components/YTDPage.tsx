import React, { useState, useEffect } from 'react'
import type { User } from '../data/mockData'
import { fetchYTDData, type YTDEmployee, type YTDMonth } from '../services/rawDataApi'
import { formatRupiah } from '../data/mockData'
import { useMobile } from '../hooks/useMobile'
import { achievementColor } from '../services/achievementColor'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'

const S = { bg: '#f0f4ff', card: '#fff', border: '#e8edf8', text: '#1e293b', muted: '#94a3b8', sub: '#64748b' }

const ZONE_MAP: Record<string, { bg: string; text: string; accent: string; label: string }> = {
  hijau:  { bg: '#dcfce7', text: '#166534', accent: '#16a34a', label: 'Hijau'  },
  biru:   { bg: '#dbeafe', text: '#1e3a8a', accent: '#2563eb', label: 'Biru'   },
  kuning: { bg: '#fef9c3', text: '#854d0e', accent: '#ca8a04', label: 'Kuning' },
  oranye: { bg: '#ffedd5', text: '#9a3412', accent: '#ea580c', label: 'Oranye' },
  pink:   { bg: '#fdf2f8', text: '#9d174d', accent: '#db2777', label: 'Pink'   },
  merah:  { bg: '#fee2e2', text: '#991b1b', accent: '#dc2626', label: 'Merah'  },
  putih:  { bg: '#f8faff', text: '#475569', accent: '#94a3b8', label: 'Putih'  },
}

const QUAD_NOTES: Record<number, { headline: string; points: string[] }> = {
  1: {
    headline: 'Performa terbaik — TRX & BS di atas target.',
    points: ['Pertahankan konsistensi ini setiap bulannya.', 'Bagikan strategi Anda kepada rekan tim.'],
  },
  2: {
    headline: 'BS sudah baik. Fokus tingkatkan frekuensi transaksi.',
    points: ['Sapa dan layani lebih banyak pelanggan setiap hari.', 'Tawarkan produk lebih awal di setiap interaksi.'],
  },
  3: {
    headline: 'TRX sudah on-track. Fokus tingkatkan nilai per transaksi.',
    points: ['Rekomendasikan produk pelengkap di setiap transaksi.', 'Terapkan upselling — dorong pembelian lebih dari 1 item.'],
  },
  4: {
    headline: 'TRX & BS perlu perhatian segera.',
    points: ['Layani lebih banyak pelanggan untuk naikkan TRX.', 'Tawarkan produk tambahan untuk naikkan nilai BS.', 'Diskusikan rencana perbaikan dengan atasan Anda.'],
  },
}

const QUAD_MAP: Record<number, { label: string; desc: string; color: string; bg: string; icon: string; note: string }> = {
  1: { label: 'Kuadran I',   desc: 'TRX ACV ✓  •  BS ACV ✓',        color: '#16a34a', bg: '#dcfce7', icon: '🏆', note: '' },
  2: { label: 'Kuadran II',  desc: 'TRX tidak ACV  •  BS ACV ✓',     color: '#2563eb', bg: '#dbeafe', icon: '📈', note: '' },
  3: { label: 'Kuadran III', desc: 'TRX ACV ✓  •  BS tidak ACV',     color: '#d97706', bg: '#fef3c7', icon: '🎯', note: '' },
  4: { label: 'Kuadran IV',  desc: 'TRX tidak ACV  •  BS tidak ACV', color: '#dc2626', bg: '#fee2e2', icon: '⚡', note: '' },
}

function zoneInfo(raw: string) {
  const key = raw.toLowerCase().split(' ')[0]
  return ZONE_MAP[key] ?? { bg: '#f8faff', text: S.muted, accent: S.muted, label: raw || '—' }
}

function parseQ(raw: string): 1|2|3|4 {
  const m = raw.match(/(\d)/); const n = m ? +m[1] : 4
  return (n >= 1 && n <= 4 ? n : 4) as 1|2|3|4
}

function PctBar({ label, value }: { label: string; value: number }) {
  const color = achievementColor(value)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, background: '#e8edf8', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

function MonthCard({ m, isMobile }: { m: YTDMonth; isMobile: boolean }) {
  if (!m.hasData) return (
    <div style={{ background: '#f8faff', border: `1px dashed ${S.border}`, borderRadius: 14, padding: '12px', opacity: 0.4 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: S.muted, marginBottom: 4 }}>{m.month}</div>
      <div style={{ fontSize: 10, color: S.muted, textAlign: 'center', paddingTop: 6 }}>—</div>
    </div>
  )

  const zone = zoneInfo(m.colorZone)
  const qn   = parseQ(m.quadrant)
  const quad = QUAD_MAP[qn]

  return (
    <div style={{ background: S.card, border: `1.5px solid ${zone.accent}40`, borderRadius: 14, padding: isMobile ? '12px' : '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: S.text }}>{m.month}</span>
        <span style={{ fontSize: 9, fontWeight: 700, background: zone.bg, color: zone.text, padding: '2px 7px', borderRadius: 6 }}>{m.colorZone || zone.label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <PctBar label="Sales" value={m.sales} />
        <PctBar label="TRX"   value={m.trx}   />
        <PctBar label="BS"    value={m.bs}     />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', borderTop: `1px solid ${S.border}`, paddingTop: 8, marginBottom: 8 }}>
        {[
          { l: 'AUR', v: formatRupiah(m.aur),     u: '' },
          { l: 'UPT', v: m.upt.toFixed(1),         u: 'x' },
          { l: 'NM',  v: String(m.newMember),      u: 'org' },
          { l: 'Proteksi', v: String(m.proteksi), u: 'qty' },
        ].map(({ l, v, u }) => (
          <div key={l}>
            <div style={{ fontSize: 9, color: S.muted, fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: S.text }}>{v}<span style={{ fontSize: 9, color: S.muted }}> {u}</span></div>
          </div>
        ))}
      </div>
      <div style={{ background: quad.bg, borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 10 }}>{quad.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: quad.color }}>{m.quadrant || quad.label}</span>
      </div>
    </div>
  )
}

export function AzkoMascot({ colorZone, color }: { colorZone: string; color: string }) {
  const zone = (colorZone || '').toLowerCase().split(' ')[0]
  // level 1=terbaik(biru) … 5=terburuk(merah)
  const level: 1|2|3|4|5 =
    zone === 'biru'   ? 1 :
    zone === 'hijau'  ? 2 :
    zone === 'kuning' ? 3 :
    (zone === 'oranye' || zone === 'pink') ? 4 : 5

  const Face = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <svg viewBox="0 0 120 120" width="100%" style={{ maxWidth: 160 }}>
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.04"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill={`url(#${id})`}/>
      <circle cx="60" cy="60" r="46" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 6" opacity="0.22"/>
      <circle cx="60" cy="65" r="36" fill={color}/>
      <ellipse cx="48" cy="50" rx="14" ry="8" fill="#fff" opacity="0.1"/>
      {children}
    </svg>
  )

  const icons: Record<1|2|3|4|5, React.ReactNode> = {
    // ── Level 1: BIRU — Juara, mahkota + mata binar + senyum lebar
    1: (
      <Face id="mg1">
        {/* Mahkota */}
        <path d="M38 48 L42 36 L50 44 L60 32 L70 44 L78 36 L82 48 Z" fill="#FFD700"/>
        <circle cx="60" cy="32" r="3.5" fill="#fff" opacity="0.9"/>
        <circle cx="42" cy="36" r="2.5" fill="#fff" opacity="0.7"/>
        <circle cx="78" cy="36" r="2.5" fill="#fff" opacity="0.7"/>
        {/* Mata binar */}
        <ellipse cx="49" cy="63" rx="5.5" ry="6" fill="#fff"/>
        <ellipse cx="71" cy="63" rx="5.5" ry="6" fill="#fff"/>
        <circle cx="51" cy="63" r="3.2" fill={color}/>
        <circle cx="73" cy="63" r="3.2" fill={color}/>
        <circle cx="52" cy="61" r="1.3" fill="#fff"/>
        <circle cx="74" cy="61" r="1.3" fill="#fff"/>
        {/* Pipi blush */}
        <ellipse cx="41" cy="71" rx="5.5" ry="3" fill="#fff" opacity="0.22"/>
        <ellipse cx="79" cy="71" rx="5.5" ry="3" fill="#fff" opacity="0.22"/>
        {/* Senyum lebar */}
        <path d="M45 75 Q60 89 75 75" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/>
        {/* Bintang */}
        <path d="M12 28 l2 6 6 0-5 3.5 1.9 6L12 40l-4.9 3.5 1.9-6-5-3.5 6 0Z" fill="#FFD700" opacity="0.8"/>
        <path d="M104 18 l1.5 4.5 4.5 0-3.6 2.6 1.4 4.5L104 27l-3.8 2.6 1.4-4.5-3.6-2.6 4.5 0Z" fill="#FFD700" opacity="0.6"/>
        <path d="M16 84 l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill={color} opacity="0.3"/>
      </Face>
    ),
    // ── Level 2: HIJAU — Puas, thumbs-up + senyum percaya diri
    2: (
      <Face id="mg2">
        {/* Mata puas — sedikit menyipit bahagia */}
        <path d="M43 60 Q49 55 55 60" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
        <path d="M65 60 Q71 55 77 60" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
        {/* Senyum percaya diri */}
        <path d="M47 75 Q60 85 73 75" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
        {/* Pipi */}
        <ellipse cx="41" cy="71" rx="5" ry="2.8" fill="#fff" opacity="0.2"/>
        <ellipse cx="79" cy="71" rx="5" ry="2.8" fill="#fff" opacity="0.2"/>
        {/* Thumbs up kanan atas */}
        <g transform="translate(82,16)">
          <rect x="4" y="8" width="10" height="12" rx="3" fill="#fff" opacity="0.9"/>
          <path d="M4 8 Q4 1 9 1 Q14 1 14 8" fill="#fff" opacity="0.9"/>
          <rect x="0" y="13" width="4" height="8" rx="2" fill="#fff" opacity="0.65"/>
        </g>
        {/* Bintang kecil */}
        <path d="M14 40 l1.2 3.5 3.5 0-2.8 2 1.1 3.5L14 47l-3 2 1.1-3.5-2.8-2 3.5 0Z" fill="#FFD700" opacity="0.65"/>
        <path d="M16 80 l0.9 2.6 2.6 0.9-2.6 0.9-0.9 2.6-0.9-2.6-2.6-0.9 2.6-0.9Z" fill={color} opacity="0.28"/>
      </Face>
    ),
    // ── Level 3: KUNING — Agak senang tapi tidak sebesar Hijau, senyum tipis
    3: (
      <Face id="mg3">
        {/* Mata sedikit menyipit — ekspresi senang ringan */}
        <path d="M43 62 Q49 57.5 55 62" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
        <path d="M65 62 Q71 57.5 77 62" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
        <ellipse cx="49" cy="63.5" rx="3.5" ry="2.5" fill="#fff"/>
        <ellipse cx="71" cy="63.5" rx="3.5" ry="2.5" fill="#fff"/>
        {/* Senyum tipis — tidak selebar Hijau */}
        <path d="M49 76 Q60 82 71 76" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        {/* Pipi tipis */}
        <ellipse cx="41" cy="72" rx="4.5" ry="2.5" fill="#fff" opacity="0.15"/>
        <ellipse cx="79" cy="72" rx="4.5" ry="2.5" fill="#fff" opacity="0.15"/>
        {/* Bintang kecil — potensi */}
        <path d="M14 32 l1.4 4.2 4.2 0-3.4 2.5 1.3 4.2L14 40l-3.5 2.5 1.3-4.2-3.4-2.5 4.2 0Z" fill="#FFD700" opacity="0.55"/>
        <path d="M106 28 l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#FFD700" opacity="0.45"/>
        <path d="M10 80 l0.9 2.6 2.6 0.9-2.6 0.9-0.9 2.6-0.9-2.6-2.6-0.9 2.6-0.9Z" fill={color} opacity="0.25"/>
      </Face>
    ),
    // ── Level 4: ORANYE/PINK — Waspada, alis satu naik + mulut sedikit miring + tanda seru
    4: (
      <Face id="mg4">
        {/* Mata normal tapi satu menyipit sedikit */}
        <circle cx="49" cy="63" r="5" fill="#fff"/>
        <circle cx="71" cy="63" r="5" fill="#fff"/>
        <circle cx="50.5" cy="63" r="2.8" fill={color}/>
        <circle cx="72.5" cy="63" r="2.8" fill={color}/>
        <circle cx="51.5" cy="61.5" r="1.1" fill="#fff"/>
        <circle cx="73.5" cy="61.5" r="1.1" fill="#fff"/>
        {/* Alis kiri naik lebih, kanan sedikit — terlihat was-was tapi tidak panik */}
        <path d="M42 55 Q49 50 56 54" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M64 56 Q71 53 78 56" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85"/>
        {/* Mulut sedikit miring — agak khawatir tapi masih terkendali */}
        <path d="M48 77 Q57 74 72 78" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        {/* Tanda seru — peringatan */}
        <g transform="translate(82, 16)" opacity="0.85">
          <rect x="0" y="0" width="7" height="11" rx="2.5" fill="#FFD700"/>
          <circle cx="3.5" cy="16" r="3" fill="#FFD700"/>
        </g>
        {/* Dekorasi kecil */}
        <path d="M14 44 l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1Z" fill="#FFD700" opacity="0.5"/>
        <path d="M12 80 l0.9 2.6 2.6 0.9-2.6 0.9-0.9 2.6-0.9-2.6-2.6-0.9 2.6-0.9Z" fill={color} opacity="0.25"/>
      </Face>
    ),
    // ── Level 5: MERAH — Darurat, mata besar panik + mulut O + warning besar
    5: (
      <Face id="mg5">
        {/* Mata bulat besar — panik */}
        <circle cx="49" cy="63" r="7" fill="#fff"/>
        <circle cx="71" cy="63" r="7" fill="#fff"/>
        <circle cx="50.5" cy="63" r="4" fill={color}/>
        <circle cx="72.5" cy="63" r="4" fill={color}/>
        <circle cx="52" cy="60.5" r="1.6" fill="#fff"/>
        <circle cx="74" cy="60.5" r="1.6" fill="#fff"/>
        {/* Alis V turun tajam */}
        <path d="M41 53 Q49 60 57 53" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M63 53 Q71 60 79 53" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/>
        {/* Mulut O terbuka */}
        <ellipse cx="60" cy="79" rx="7.5" ry="5.5" fill="#fff" opacity="0.9"/>
        <ellipse cx="60" cy="79" rx="4.5" ry="3.2" fill={color}/>
        {/* Warning triangle besar */}
        <path d="M60 14 L78 40 L42 40 Z" fill="#FFD700" opacity="0.95"/>
        <rect x="57" y="20" width="6" height="11" rx="2.5" fill={color}/>
        <circle cx="60" cy="35" r="3" fill={color}/>
        {/* Garis getar efek darurat */}
        <path d="M7 60 Q12 54 17 60 Q12 66 7 60" fill={color} opacity="0.18"/>
        <path d="M103 60 Q108 54 113 60 Q108 66 103 60" fill={color} opacity="0.18"/>
        <path d="M10 82 l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1Z" fill="#FFD700" opacity="0.6"/>
      </Face>
    ),
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '12px 0 4px' }}>
      {icons[level]}
    </div>
  )
}

function QuadrantMatrix({ qn }: { qn: 1|2|3|4 }) {
  // Q1=kiri atas, Q2=kanan atas, Q3=kanan bawah, Q4=kiri bawah
  const POS: Record<number, { x: number; y: number }> = {
    1: { x: 75, y: 25 },
    2: { x: 75, y: 75 },
    3: { x: 25, y: 25 },
    4: { x: 25, y: 75 },
  }
  const { x: dotX, y: dotY } = POS[qn]
  const q = QUAD_MAP[qn]
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', background: '#f8faff', borderRadius: 14, border: `1.5px solid ${S.border}`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1.5px dashed #c7d5ee' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1.5px dashed #c7d5ee' }} />
        {([1,2,3,4] as const).map(qi => {
          const { x: lx, y: ly } = POS[qi]
          return <div key={qi} style={{ position: 'absolute', left: `${lx}%`, top: `${ly}%`, transform: 'translate(-50%,-50%)', fontSize: 10, fontWeight: 800, color: QUAD_MAP[qi].color, opacity: qn === qi ? 0.9 : 0.2 }}>Q{qi}</div>
        })}
        <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 8, color: S.muted, fontWeight: 700 }}>BS →</div>
        <div style={{ position: 'absolute', left: 4, top: 6, fontSize: 8, color: S.muted, fontWeight: 700 }}>TRX ↑</div>
        <div style={{ position: 'absolute', left: `${dotX}%`, top: `${dotY}%`, transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: '50%', background: q.color, boxShadow: `0 0 0 4px ${q.color}30`, zIndex: 2, transition: 'all 0.8s ease' }} />
      </div>
    </div>
  )
}

export function YTDContent({ ytd, isMobile }: { ytd: YTDEmployee; isMobile: boolean }) {
  const zone = zoneInfo(ytd.ytdColorZone)
  const qn   = parseQ(ytd.ytdQuadrant)
  const quad = QUAD_MAP[qn]

  return (
    <>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ gridColumn: isMobile ? 'span 2' : undefined, background: zone.bg, border: `2px solid ${zone.accent}40`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: zone.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Color Zone SID — YTD</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: zone.accent, marginBottom: 4 }}>{ytd.ytdColorZone || zone.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: zone.text }}>Sales YTD {ytd.ytdSalesPct.toFixed(1)}%</div>
        </div>

        <div style={{ background: quad.bg, border: `2px solid ${quad.color}30`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: quad.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Kuadran YTD</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: quad.color, marginBottom: 12 }}>{quad.icon} {ytd.ytdQuadrant || quad.label}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ label: 'TRX', acv: qn === 1 || qn === 3 }, { label: 'BS', acv: qn === 1 || qn === 2 }].map(({ label, acv }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: acv ? '#16a34a18' : '#dc262618', border: `1px solid ${acv ? '#16a34a40' : '#dc262640'}` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: acv ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: acv ? '#16a34a' : '#dc2626' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: acv ? '#16a34a' : '#dc2626' }}>{acv ? '✓' : '✗'}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Score YTD</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: achievementColor((ytd.ytdScore / 5) * 100), lineHeight: 1, marginBottom: 4 }}>{ytd.ytdScore}</div>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>dari 5</div>
          <div style={{ height: 6, background: '#e8edf8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(ytd.ytdScore / 5) * 100}%`, background: achievementColor((ytd.ytdScore / 5) * 100), borderRadius: 3 }} />
          </div>
        </div>

        <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Rata-rata Bulanan</div>
          {[['Sales', ytd.avgSales], ['TRX', ytd.avgTrx], ['BS', ytd.avgBS]].map(([l, v]) => (
            <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: S.sub, fontWeight: 600 }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: achievementColor(Number(v)) }}>{Number(v).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quadrant + Monthly cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: S.text, marginBottom: 12 }}>Posisi Kuadran</div>
          <QuadrantMatrix qn={qn} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {([1,2,3,4] as const).map(qi => (
              <div key={qi} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderRadius: 8, background: qn === qi ? `${QUAD_MAP[qi].color}12` : 'transparent', border: qn === qi ? `1px solid ${QUAD_MAP[qi].color}30` : '1px solid transparent' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: QUAD_MAP[qi].color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: QUAD_MAP[qi].color }}>{QUAD_MAP[qi].label}</div>
                  <div style={{ fontSize: 9, color: S.muted }}>{QUAD_MAP[qi].desc}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Coaching note */}
          {(() => {
            const n = QUAD_NOTES[qn]
            return (
              <div style={{ marginTop: 8, borderLeft: `3px solid ${quad.color}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: quad.color, marginBottom: 6 }}>{n.headline}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {n.points.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ color: quad.color, opacity: 0.5, fontSize: 10, marginTop: 1, flexShrink: 0 }}>›</span>
                      <span style={{ fontSize: 10, color: quad.color, opacity: 0.85, lineHeight: 1.5 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          {/* Maskot Azko — ekspresi berdasarkan Color Zone SID */}
          <AzkoMascot colorZone={ytd.ytdColorZone || 'merah'} color={zone.accent} />
        </div>

        <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: isMobile ? 16 : 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: S.text, marginBottom: 16 }}>
            Detail per Bulan
            <span style={{ fontSize: 11, color: S.muted, fontWeight: 400 }}> — Sales · TRX · BS · AUR · UPT · NM · Proteksi</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10 }}>
            {(ytd.months || []).map((m, i) => <MonthCard key={i} m={m} isMobile={isMobile} />)}
          </div>
        </div>
      </div>

      {/* Trend bars */}
      <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: S.text, marginBottom: 16 }}>Trend Performa Bulanan</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(ytd.months || []).map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: isMobile ? 30 : 38, fontSize: 11, fontWeight: 700, color: S.sub, flexShrink: 0 }}>{m.month}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {!m.hasData ? (
                  <div style={{ fontSize: 10, color: S.muted, fontStyle: 'italic' }}>Belum ada data</div>
                ) : (
                <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ flex: 1, height: 14, background: '#e8edf8', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(m.sales, 130) / 1.3}%`, background: achievementColor(m.sales), borderRadius: 7, transition: 'width 1s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
                      {m.sales >= 40 && <span style={{ fontSize: 8, fontWeight: 800, color: '#fff' }}>{m.sales.toFixed(0)}%</span>}
                    </div>
                  </div>
                  {m.sales < 40 && <span style={{ fontSize: 11, fontWeight: 800, color: achievementColor(m.sales), flexShrink: 0 }}>{m.sales.toFixed(1)}%</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: achievementColor(m.trx) }}>TRX {m.trx.toFixed(1)}%</span>
                  <span style={{ fontSize: 9, color: achievementColor(m.bs) }}>BS {m.bs.toFixed(1)}%</span>
                  <span style={{ fontSize: 9, color: S.muted }}>UPT {m.upt.toFixed(1)}×</span>
                  <span style={{ fontSize: 9, color: S.muted }}>AUR {formatRupiah(m.aur)}</span>
                  <span style={{ fontSize: 9, color: S.muted }}>NM {m.newMember}</span>
                  <span style={{ fontSize: 9, color: S.muted }}>Proteksi {m.proteksi}</span>
                </div>
                </>
                )}
              </div>
              {m.hasData && <div style={{ width: 8, height: 8, borderRadius: '50%', background: QUAD_MAP[parseQ(m.quadrant)].color, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Trend line chart */}
      {(() => {
        const chartData = (ytd.months || [])
          .filter(m => m.hasData)
          .map(m => ({ name: m.month, Sales: m.sales, TRX: m.trx, BS: m.bs }))
        if (chartData.length < 2) return null

        const CustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null
          return (
            <div style={{ background: '#fff', border: '1px solid #e8edf8', borderRadius: 12, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
              <div style={{ fontWeight: 700, color: '#64748b', marginBottom: 6 }}>{label}</div>
              {payload.map((p: any) => (
                <div key={p.dataKey} style={{ color: p.color, marginBottom: 3 }}>
                  {p.dataKey}: <b>{Number(p.value).toFixed(1)}%</b>
                </div>
              ))}
            </div>
          )
        }

        return (
          <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: isMobile ? '16px' : 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.text, marginBottom: 16 }}>
              Trend Performa Bulanan
              <span style={{ fontSize: 10, color: S.muted, fontWeight: 400, marginLeft: 8 }}>Sales % · TRX % · BS %</span>
            </div>
            <div style={{ height: isMobile ? 200 : 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e8edf8"/>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={38} domain={[0, 'auto']}/>
                  <Tooltip content={<CustomTooltip />}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }}/>
                  <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="5 4" strokeOpacity={0.5}
                    label={{ value: '100%', position: 'right', fontSize: 9, fill: '#16a34a' }}/>
                  <Line type="monotone" dataKey="Sales" stroke="#D93119" strokeWidth={2.5} dot={{ fill: '#D93119', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }}/>
                  <Line type="monotone" dataKey="TRX"   stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }}/>
                  <Line type="monotone" dataKey="BS"    stroke="#ca8a04" strokeWidth={2} dot={{ fill: '#ca8a04', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="6 3"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })()}
    </>
  )
}

export default function YTDPage({ user }: { user: User }) {
  const [ytd, setYtd]         = useState<YTDEmployee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const isMobile = useMobile()

  useEffect(() => {
    setLoading(true); setError(null)
    fetchYTDData(user.nik)
      .then(d => { setYtd(d); setLoading(false) })
      .catch(e => { setError(e?.message ?? 'Gagal memuat'); setLoading(false) })
  }, [user.nik])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px' : '28px 32px' }}>
      {loading && <div style={{ textAlign: 'center', padding: 80, color: S.muted }}>⟳ Memuat data YTD…</div>}
      {error   && <div style={{ textAlign: 'center', padding: 60, color: '#dc2626' }}>⚠ {error}</div>}
      {!loading && !ytd && !error && <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>📊 Data YTD belum tersedia untuk NIK ini.</div>}
      {ytd && <YTDContent ytd={ytd} isMobile={isMobile} />}
    </div>
  )
}
