import { useEffect, useState } from "react"

import type { User } from "../data/mockData"

import { formatRupiahFull } from "../data/mockData"

import { useAtlasData } from "../context/useAtlasData"

import { useMobile } from "../hooks/useMobile"
import { achievementColor } from "../services/achievementColor"

import {
  fetchPencapaianDept,
  type DeptMetric,
  type DeptPeriodData,
} from "../services/deptApi"

import { niksMatch } from "../services/nik"

import {
  departmentZoneMetrics,
  managerDepartments,
  supervisorDepartments,
  supervisorTeam,
  supervisorDepartmentMetrics,
} from "../services/supervisorPerformance"
import { normalizeJobTitle } from "../services/jobTitle"

const S = {
  bg: "#f0f4ff",
  card: "#fff",
  border: "#e8edf8",
  muted: "#94a3b8",
  text: "#1e293b",
  sub: "#64748b",
}

export function SupervisorDepartmentCards({
  departments,
  periodLabel,
  workingDays,
  isMobile,
  salesLabel,
  targetLabel,
  showDailyAverage = true,
}: {
  departments: DeptMetric[]
  periodLabel: string
  workingDays: number
  isMobile: boolean
  salesLabel?: string
  targetLabel?: string
  showDailyAverage?: boolean
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "1fr"
          : "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 12,
      }}
    >
      {departments.map((department, index) => {
        const achievement =
          department.target && department.target > 0
            ? (department.value / department.target) * 100
            : null
        const targetDifference =
          department.target === undefined
            ? null
            : department.value - department.target
        const differenceColor =
          targetDifference === null || targetDifference === 0
            ? S.sub
            : targetDifference > 0
              ? "#15803d"
              : "#dc2626"
        const color =
          achievement === null ? "#94a3b8" : achievementColor(achievement)

        return (
          <article
            key={`${department.kind}-${department.label}`}
            style={{
              background: "linear-gradient(145deg, #fff 0%, #f8faff 100%)",
              border: `1px solid ${S.border}`,
              borderRadius: 16,
              padding: isMobile ? 15 : 17,
              boxShadow: "0 3px 12px rgba(30,41,59,0.045)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 9,
                    background: "#fff1ed",
                    color: "#D93119",
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <div
                    style={{
                      color: S.text,
                      fontSize: 13,
                      lineHeight: 1.35,
                      fontWeight: 800,
                    }}
                  >
                    {department.label}
                  </div>
                  <div
                    style={{
                      color: S.muted,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      marginTop: 2,
                    }}
                  >
                    {department.kind === "zone" ? "Zona" : "Departemen"} ·{" "}
                    {periodLabel}
                  </div>
                </div>
              </div>
              <span
                style={{
                  color,
                  background: `${color}12`,
                  border: `1px solid ${color}25`,
                  borderRadius: 8,
                  padding: "5px 7px",
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {achievement === null ? "—" : `${achievement.toFixed(1)}%`}
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: "#e8edf8",
                borderRadius: 5,
                overflow: "hidden",
                marginBottom: 13,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(achievement ?? 0, 100)}%`,
                  background: color,
                  borderRadius: 5,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 12px",
              }}
            >
              {[
                {
                  label: salesLabel ?? `Sales ${periodLabel}`,
                  value: formatRupiahFull(department.value),
                  color: S.text,
                },
                {
                  label: targetLabel ?? `Target ${periodLabel}`,
                  value:
                    department.target === undefined
                      ? "Belum tersedia"
                      : formatRupiahFull(department.target),
                  color: S.sub,
                },
                ...(showDailyAverage
                  ? [
                      {
                        label: "ACV / hari",
                        value: formatRupiahFull(
                          department.value / Math.max(workingDays, 1),
                        ),
                        color: "#7c3aed",
                      },
                    ]
                  : []),
                {
                  label: "Status target",
                  value:
                    achievement === null
                      ? "Target belum tersedia"
                      : achievement >= 100
                        ? "Achieved"
                        : "Not Achieved",
                  color,
                },
              ].map((item) => (
                <div key={item.label} style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: S.muted,
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      color: item.color,
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 800,
                      lineHeight: 1.35,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 12,
                padding: "9px 10px",
                borderRadius: 10,
                background:
                  targetDifference === null
                    ? "#f8fafc"
                    : targetDifference > 0
                      ? "#f0fdf4"
                      : targetDifference < 0
                        ? "#fef2f2"
                        : "#f8fafc",
                border: `1px solid ${
                  targetDifference === null || targetDifference === 0
                    ? S.border
                    : `${differenceColor}30`
                }`,
              }}
            >
              <span
                style={{
                  color: S.sub,
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Selisih Sales - Target
              </span>
              <span
                style={{
                  color: differenceColor,
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {targetDifference === null
                  ? "Target belum tersedia"
                  : `${targetDifference > 0 ? "+" : targetDifference < 0 ? "-" : ""}${formatRupiahFull(Math.abs(targetDifference))}`}
              </span>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function SupervisorDeptBar({ user }: { user: User }) {
  const { users, loading } = useAtlasData()

  const isMobile = useMobile()
  const isManager = normalizeJobTitle(user.jobTitle) === "MANAGER"

  const [sbd, setSbd] = useState<DeptPeriodData | null>(null)

  const [error, setError] = useState<string | null>(null)

  const departmentNames = isManager
    ? managerDepartments(users, user)
    : supervisorDepartments(users, user)

  useEffect(() => {
    let active = true

    setError(null)

    fetchPencapaianDept()

      .then((result) => {
        if (active) setSbd(result.sbd)
      })

      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason))
      })

    return () => {
      active = false
    }
  }, [user.nik])

  const departmentMetrics = supervisorDepartmentMetrics(sbd, departmentNames)
  const zoneMetrics = isManager
    ? departmentZoneMetrics(sbd, departmentNames)
    : []

  return (
    <section
      style={{
        background: "#fff",
        borderBottom: `1px solid ${S.border}`,
        padding: isMobile ? "14px 16px" : "18px 32px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                color: S.text,
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                marginBottom: 3,
              }}
            >
              {isManager
                ? "Pencapaian Zona Manajer · SBD"
                : "Performance Departemen"}
            </div>
            <div style={{ color: S.muted, fontSize: 11 }}>
              {isManager
                ? "Pencapaian zona dan departemen yang Anda pegang, berdasarkan pemetaan Pencapaian Dept."
                : "Rincian pencapaian setiap departemen yang Anda pegang"}
            </div>
          </div>
          <span
            style={{
              color: "#9a3412",
              background: "#fff1ed",
              border: "1px solid #fed7cc",
              padding: "6px 9px",
              borderRadius: 9,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            SBD{loading ? " · MEMUAT" : sbd?.date ? ` · ${sbd.date}` : ""}
          </span>
        </div>
        {error ? (
          <div role="alert" style={{ color: "#9a3412", fontSize: 13 }}>
            Data departemen gagal dimuat: {error}
          </div>
        ) : departmentNames.length === 0 ? (
          <div style={{ color: S.sub, fontSize: 13 }}>
            {isManager
              ? `Belum ada departemen yang terhubung ke NIK Manajer ${user.nik} di kolom K–M sheet User.`
              : "Belum ada departemen yang terhubung ke NIK Supervisor ini di kolom K–L sheet User."}
          </div>
        ) : departmentMetrics.length === 0 &&
          zoneMetrics.length === 0 ? (
          <div style={{ color: S.sub, fontSize: 13 }}>
            Data departemen {departmentNames.join(", ")} belum ditemukan di
            sheet Pencapaian Dept.
          </div>
        ) : (
          <>
            {zoneMetrics.length > 0 && (
              <div
                style={{ marginBottom: departmentMetrics.length > 0 ? 14 : 0 }}
              >
                {isManager && (
                  <div
                    style={{
                      color: S.sub,
                      fontSize: 10,
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    ZONA SESUAI DEPARTEMEN YANG DIPEGANG
                  </div>
                )}
                <SupervisorDepartmentCards
                  departments={zoneMetrics}
                  periodLabel="SBD"
                  workingDays={1}
                  isMobile={isMobile}
                />
              </div>
            )}
            {departmentMetrics.length > 0 && (
              <>
                {isManager && (
                  <div
                    style={{
                      color: S.sub,
                      fontSize: 10,
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    DEPARTEMEN YANG DIPEGANG
                  </div>
                )}
                <SupervisorDepartmentCards
                  departments={departmentMetrics}
                  periodLabel="SBD"
                  workingDays={1}
                  isMobile={isMobile}
                />
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export function SupervisorTeamToday({ user }: { user: User }) {
  const { users, teamTodayEmployees, loading } = useAtlasData()

  const isMobile = useMobile()

  const team = supervisorTeam(users, user)

  const members = team

    .map((member) => ({
      member,

      performance: teamTodayEmployees.find((row) =>
        niksMatch(row.nik, member.nik),
      ),
    }))

    .filter(
      (entry): entry is typeof entry & {
        performance: NonNullable<typeof entry.performance>
      } => Boolean(entry.performance),
    )

    .sort((a, b) => b.performance.sales - a.performance.sales)

  return (
    <section
      style={{
        maxWidth: 1100,
        margin: "16px auto 0",
        padding: isMobile ? "0 16px" : "0 32px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <div
        style={{
          background: S.card,
          border: `1px solid ${S.border}`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${S.border}`,
          }}
        >
          <div style={{ color: S.text, fontWeight: 800, fontSize: 14 }}>
            Pencapaian SID Team · SBD
          </div>
          <div style={{ color: S.muted, fontSize: 11, marginTop: 3 }}>
            Sales dan proteksi anggota tim berdasarkan NIK Supervisor di kolom I
          </div>
        </div>
        {team.length === 0 ? (
          <div style={{ padding: 18, color: S.sub, fontSize: 13 }}>
            Belum ada anggota tim yang terhubung ke NIK {user.nik} di kolom I
            sheet User.
          </div>
        ) : loading ? (
          <div style={{ padding: 18, color: S.muted, fontSize: 13 }}>
            Memuat pencapaian tim…
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: 18, color: S.sub, fontSize: 13 }}>
            Data sales SBD anggota tim belum tersedia.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: isMobile ? 500 : 0,
              }}
            >
              <thead>
                <tr style={{ background: S.bg, textAlign: "left" }}>
                  {[
                    "Nama",
                    "Sales SBD",
                    "Target SBD",
                    "Pencapaian",
                    "Proteksi",
                  ].map((label) => (
                    <th
                      key={label}
                      style={{
                        padding: "9px 14px",
                        color: S.muted,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(({ member, performance }) => {
                  const color = achievementColor(performance.achievement)

                  return (
                    <tr
                      key={member.nik}
                      style={{ borderTop: `1px solid ${S.border}` }}
                    >
                      <td style={{ padding: "11px 14px" }}>
                        <div
                          style={{
                            color: S.text,
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {member.nama}
                        </div>
                        <div style={{ color: S.muted, fontSize: 10 }}>
                          {member.nik} · {member.jobTitle}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          color: S.text,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {formatRupiahFull(performance.sales)}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          color: S.sub,
                          fontSize: 12,
                        }}
                      >
                        {formatRupiahFull(performance.targetSales)}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          color,
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {performance.achievement.toFixed(1)}%
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          color: S.text,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {performance.proteksi.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
