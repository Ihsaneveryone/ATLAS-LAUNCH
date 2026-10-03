import { formatRupiahFull } from '../data/mockData'
import { SALES_CONTRIBUTION_GROUPS, salesContributionKeyForZone } from '../services/rawDataApi'

interface Props {
  salesContributions?: Record<string, number>
  totalSales: number
  userZone?: string
  periodLabel: string
  isMobile: boolean
  cardRadius?: number
}

export default function SalesContributionBar({
  salesContributions = { homeLiving: 0, homeImprovement: 0, hobbiesLifestyle: 0, other: 0 },
  totalSales,
  userZone,
  periodLabel,
  isMobile,
  cardRadius = 16,
}: Props) {
  const userZoneKey = salesContributionKeyForZone(userZone)
  const userZoneGroup = SALES_CONTRIBUTION_GROUPS.find(group => group.key === userZoneKey)
  const knownZoneSales = SALES_CONTRIBUTION_GROUPS
    .filter(group => group.key !== 'other')
    .reduce((total, group) => total + (salesContributions[group.key] ?? 0), 0)
  const contributionAmounts: Record<string, number> = {
    ...salesContributions,
    other: Math.max(salesContributions.other ?? 0, totalSales - knownZoneSales),
  }
  const contributionTotal = SALES_CONTRIBUTION_GROUPS.reduce((total, group) => total + (contributionAmounts[group.key] ?? 0), 0)
  const otherContributionGroups = SALES_CONTRIBUTION_GROUPS
    .filter(group => group.key !== userZoneKey && group.key !== 'other')
    .sort((left, right) => (contributionAmounts[right.key] ?? 0) - (contributionAmounts[left.key] ?? 0))
  const primaryContributionGroup = userZoneGroup ?? otherContributionGroups[0]
  const contributionGroups = [
    ...(primaryContributionGroup ? [primaryContributionGroup] : []),
    ...otherContributionGroups.filter(group => group.key !== primaryContributionGroup?.key),
    SALES_CONTRIBUTION_GROUPS.find(group => group.key === 'other')!,
  ]

  return (
    <section style={{ background: '#fff', border: '1px solid #e8edf8', borderRadius: `${cardRadius}px`, padding: isMobile ? '16px' : '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bar Kontribusi Penjualan · 100%</div>
        <div style={{ color: '#64748b', fontSize: 11 }}>{periodLabel} · Total {formatRupiahFull(totalSales)}</div>
      </div>
      <div style={{ position: 'relative', width: '100%', marginTop: userZoneGroup ? 24 : 0 }}>
        {userZoneGroup && <div style={{ position: 'absolute', zIndex: 2, left: '80%', top: -5, bottom: -5, borderLeft: '2px dashed #1e293b', pointerEvents: 'none' }} />}
        <div aria-label="Komposisi penjualan 100 persen" style={{ display: 'flex', width: '100%', height: 30, overflow: 'hidden', borderRadius: 8, background: '#edf1f5', boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.12)' }}>
          {contributionGroups.map((group, index) => {
            const amount = contributionAmounts[group.key] ?? 0
            const percentage = contributionTotal > 0 ? amount / contributionTotal * 100 : 0
            return (
              <div
                key={group.key}
                title={`${group.label}: ${formatRupiahFull(amount)} (${percentage.toFixed(1)}%)`}
                style={{ flex: `0 0 ${percentage}%`, minWidth: 0, height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: group.color, boxShadow: index < contributionGroups.length - 1 ? 'inset -1px 0 rgba(255,255,255,0.75)' : 'none', transition: 'flex-basis 0.35s ease' }}
              >
                {percentage >= 12 && <span style={{ padding: '0 4px', color: group.key === 'homeImprovement' ? '#422006' : '#fff', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap', textShadow: group.key === 'homeImprovement' ? 'none' : '0 1px 2px rgba(15,23,42,0.25)' }}>{percentage.toFixed(0)}%</span>}
              </div>
            )
          })}
        </div>
      </div>
      {userZoneGroup && (
        <div style={{ position: 'relative', height: 18, marginTop: 7 }}>
          <span style={{ position: 'absolute', left: '80%', transform: 'translateX(-50%)', color: '#334155', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>Target 80% Kontribusi Zona</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: isMobile ? '10px 12px' : 16, marginTop: 14 }}>
        {contributionGroups.map(group => {
          const amount = contributionAmounts[group.key] ?? 0
          const percentage = contributionTotal > 0 ? amount / contributionTotal * 100 : 0
          return (
            <div key={group.key} style={{ minWidth: 0, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 2, background: group.color }} />
                <span style={{ color: '#1e293b', fontSize: 10, fontWeight: 700, lineHeight: 1.3 }}>{group.label}</span>
              </div>
              <div style={{ color: group.color, fontSize: 12, fontWeight: 800 }}>{percentage.toFixed(1)}%</div>
              <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{formatRupiahFull(amount)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
