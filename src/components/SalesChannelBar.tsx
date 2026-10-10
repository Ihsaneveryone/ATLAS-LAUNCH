import { formatRupiahFull } from '../data/mockData'

interface Props {
  contributions: Record<'online' | 'offline', number>
  totalSales: number
  periodLabel: string
  isMobile: boolean
  cardRadius?: number
}

const CHANNELS = [
  { key: 'offline' as const, label: 'OFFLINE', color: '#16a34a' },
  { key: 'online' as const, label: 'ONLINE', color: '#eab308' },
]

export default function SalesChannelBar({
  contributions,
  totalSales,
  periodLabel,
  isMobile,
  cardRadius = 16,
}: Props) {
  const total = CHANNELS.reduce((sum, channel) => sum + contributions[channel.key], 0)

  return (
    <section style={{ background: '#fff', border: '1px solid #e8edf8', borderRadius: `${cardRadius}px`, padding: isMobile ? '16px' : '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bar Penjualan Online · Offline</div>
        <div style={{ color: '#64748b', fontSize: 11 }}>{periodLabel} · Total {formatRupiahFull(totalSales)}</div>
      </div>
      <div aria-label="Komposisi penjualan online dan offline" style={{ display: 'flex', width: '100%', height: 30, overflow: 'hidden', borderRadius: 8, background: '#edf1f5', boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.12)' }}>
        {CHANNELS.map(channel => {
          const amount = contributions[channel.key]
          const percentage = total > 0 ? amount / total * 100 : 0
          return (
            <div
              key={channel.key}
              title={`${channel.label}: ${formatRupiahFull(amount)} (${percentage.toFixed(1)}%)`}
              style={{ flex: `0 0 ${percentage}%`, minWidth: 0, height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: channel.color, boxShadow: channel.key === 'offline' ? 'inset -1px 0 rgba(255,255,255,0.75)' : 'none', transition: 'flex-basis 0.35s ease' }}
            >
              {percentage >= 12 && <span style={{ padding: '0 4px', color: '#fff', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(15,23,42,0.25)' }}>{percentage.toFixed(0)}%</span>}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isMobile ? '10px 12px' : 16, marginTop: 14 }}>
        {CHANNELS.map(channel => {
          const amount = contributions[channel.key]
          const percentage = total > 0 ? amount / total * 100 : 0
          return (
            <div key={channel.key} style={{ minWidth: 0, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 2, background: channel.color }} />
                <span style={{ color: '#1e293b', fontSize: 10, fontWeight: 700, lineHeight: 1.3 }}>{channel.label}</span>
              </div>
              <div style={{ color: channel.color, fontSize: 12, fontWeight: 800 }}>{percentage.toFixed(1)}%</div>
              <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{formatRupiahFull(amount)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
