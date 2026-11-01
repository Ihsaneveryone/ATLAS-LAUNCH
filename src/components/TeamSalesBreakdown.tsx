import { formatRupiahFull } from "../data/mockData"

import {
  SALES_CONTRIBUTION_GROUPS,
  salesContributionKeyForZone,
} from "../services/rawDataApi"
import { bestProductDepartmentForCategory } from "../services/bestProductApi"

interface Props {
  totalSales: number

  departmentUser?: string

  userZone?: string

  salesByDepartment: Record<string, number>

  salesContributions: Record<string, number>

  salesChannelContributions: Record<"online" | "offline", number>

  isMobile: boolean
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function share(value: number, total: number) {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%"
}

export default function TeamSalesBreakdown({
  totalSales,

  departmentUser,

  userZone,

  salesByDepartment,

  salesContributions,

  salesChannelContributions,

  isMobile,
}: Props) {
  const department = departmentUser?.trim() || userZone?.trim() || "Departemen"

  const departmentEntries = Object.entries(salesByDepartment).filter(
    ([name]) =>
      normalize(name) === normalize(department) ||
      normalize(bestProductDepartmentForCategory(name) ?? "") ===
        normalize(department),
  )

  const isAssignedZone = SALES_CONTRIBUTION_GROUPS.some(
    (group) => normalize(group.label) === normalize(departmentUser ?? ""),
  )
  const contributionKey = isAssignedZone
    ? salesContributionKeyForZone(departmentUser)
    : departmentUser
      ? null
      : salesContributionKeyForZone(userZone)

  const contributionGroup = SALES_CONTRIBUTION_GROUPS.find(
    (group) => group.key === contributionKey,
  )

  const departmentLabel =
    departmentEntries.length > 0
      ? department
      : (contributionGroup?.label ?? department)
  const departmentSales = Math.min(
    totalSales,
    Math.max(
      0,
      departmentEntries.length > 0
        ? departmentEntries.reduce((total, [, value]) => total + value, 0)
        : contributionGroup
          ? (salesContributions[contributionGroup.key] ?? 0)
          : 0,
    ),
  )

  const salesOutsideDepartment = Math.max(0, totalSales - departmentSales)

  const channels = [
    { key: "offline" as const, label: "Offline", color: "#16a34a" },

    { key: "online" as const, label: "Online", color: "#dc2626" },
  ]

  const metrics = [
    {
      label: departmentLabel,

      amount: departmentSales,

      color: "#2563eb",
    },

    {
      label: "Di luar departemen",

      amount: salesOutsideDepartment,

      color: "#dc2626",
    },
  ]

  return (
    <div
      style={{
        display: "grid",

        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",

        gap: 12,
      }}
    >
      <section
        style={{
          border: "1px solid #e8edf8",

          borderRadius: 12,

          padding: 14,

          background: "#fff",
        }}
      >
        <div
          style={{
            fontSize: 10,

            fontWeight: 800,

            textTransform: "uppercase",

            color: "#64748b",

            marginBottom: 10,
          }}
        >
          Kontribusi Departemen · Total {formatRupiahFull(totalSales)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div
                style={{
                  display: "flex",

                  justifyContent: "space-between",

                  gap: 8,

                  fontSize: 11,

                  marginBottom: 4,
                }}
              >
                <span style={{ color: "#334155", fontWeight: 700 }}>
                  {metric.label}
                </span>
                <span style={{ color: metric.color, fontWeight: 800 }}>
                  {share(metric.amount, totalSales)} ·{" "}
                  {formatRupiahFull(metric.amount)}
                </span>
              </div>
              <div
                style={{
                  height: 7,

                  borderRadius: 5,

                  background: "#edf1f5",

                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: share(metric.amount, totalSales),

                    height: "100%",

                    background: metric.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e8edf8",

          borderRadius: 12,

          padding: 14,

          background: "#fff",
        }}
      >
        <div
          style={{
            fontSize: 10,

            fontWeight: 800,

            textTransform: "uppercase",

            color: "#64748b",

            marginBottom: 10,
          }}
        >
          Penjualan Online · Offline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {channels.map((channel) => {
            const amount = salesChannelContributions[channel.key]

            return (
              <div key={channel.key}>
                <div
                  style={{
                    display: "flex",

                    justifyContent: "space-between",

                    gap: 8,

                    fontSize: 11,

                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "#334155", fontWeight: 700 }}>
                    {channel.label}
                  </span>
                  <span style={{ color: channel.color, fontWeight: 800 }}>
                    {share(amount, totalSales)} · {formatRupiahFull(amount)}
                  </span>
                </div>
                <div
                  style={{
                    height: 7,

                    borderRadius: 5,

                    background: "#edf1f5",

                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: share(amount, totalSales),

                      height: "100%",

                      background: channel.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
