import { useEffect, useMemo, useState } from "react"

import azkoLogo from "../imports/logo-azko_ratio-16x9__1_.jpg"

import type { User } from "../data/mockData"

import { formatRupiahFull } from "../data/mockData"

import { useAtlasData } from "../context/useAtlasData"

import { useMobile } from "../hooks/useMobile"

import {
  fetchPencapaianDept,
  type DeptPerformanceData,
  type DeptPeriodData,
} from "../services/deptApi"

import { fetchAllYTD, type YTDEmployee } from "../services/rawDataApi"

import { niksMatch } from "../services/nik"
import { achievementColor } from "../services/achievementColor"
import { normalizeJobTitle } from "../services/jobTitle"

import {
  departmentZoneMetrics,
  supervisorDepartments,
  managerDepartments,
  managerSupervisors,
  supervisorTeam,
  supervisorDepartmentMetrics,
} from "../services/supervisorPerformance"
import { SupervisorDepartmentCards } from "./SupervisorHomeSections"
import TeamSalesBreakdown from "./TeamSalesBreakdown"
import { YTDContent } from "./YTDPage"

type Period = "sbd" | "mtd" | "fullmonth" | "ytd"

interface Props {
  user: User
  onBack: () => void
}

const S = {
  bg: "#f0f4ff",
  card: "#fff",
  border: "#e8edf8",
  muted: "#94a3b8",
  text: "#1e293b",
  sub: "#64748b",
}

const PERIODS: { key: Period label: string }[] = [
  { key: "sbd", label: "SBD" },

  { key: "mtd", label: "MTD" },

  { key: "fullmonth", label: "Full Month" },

  { key: "ytd", label: "YTD" },
]

function getDepartmentPeriod(
  data: DeptPerformanceData | null,
  period: Period,
): DeptPeriodData | null {
  if (!data || period === "ytd") return null

  return period === "sbd"
    ? data.sbd
    : period === "mtd"
      ? data.mtd
      : data.fullMonth
}

export default function SupervisorPerformanceSales({ user, onBack }: Props) {
  const {
    users,
    teamTodayEmployees,
    teamMtdEmployees,
    teamFullMonthEmployees,
    mtdPerf,
    loading,
    error,
  } = useAtlasData()

  const isMobile = useMobile()

  const [period, setPeriod] = useState<Period>("sbd")

  const [deptData, setDeptData] = useState<DeptPerformanceData | null>(null)

  const [deptError, setDeptError] = useState<string | null>(null)

  const [ytdData, setYtdData] = useState<YTDEmployee[]>([])

  const [ytdLoading, setYtdLoading] = useState(false)

  const [ytdError, setYtdError] = useState<string | null>(null)

  const team = useMemo(() => supervisorTeam(users, user), [users, user])
  const isManager = normalizeJobTitle(user.jobTitle) === "MANAGER"
  const managedSupervisors = useMemo(
    () => (isManager ? managerSupervisors(users, user) : []),
    [isManager, users, user],
  )

  const managedTeam = useMemo(
    () =>
      isManager
        ? managedSupervisors.flatMap((supervisor) =>
            supervisorTeam(users, supervisor),
          )
        : team,
    [isManager, managedSupervisors, team, users],
  )

  const departmentNames = useMemo(() => {
    if (!isManager) return supervisorDepartments(users, user)
    return managerDepartments(users, user)
  }, [isManager, users, user])

  useEffect(() => {
    let active = true

    setDeptError(null)

    fetchPencapaianDept()

      .then((result) => {
        if (active) setDeptData(result)
      })

      .catch((reason) => {
        if (active)
          setDeptError(
            reason instanceof Error ? reason.message : String(reason),
          )
      })

    return () => {
      active = false
    }
  }, [user.nik])

  useEffect(() => {
    let active = true

    setYtdLoading(true)

    setYtdError(null)

    fetchAllYTD()

      .then((rows) => {
        if (!active) return

        setYtdData(rows)

        if (rows.length === 0)
          setYtdError("Data YTD belum tersedia di sheet YEAR TO DATE.")
      })

      .catch((reason) => {
        if (active)
          setYtdError(reason instanceof Error ? reason.message : String(reason))
      })

      .finally(() => {
        if (active) setYtdLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const deptPeriod = getDepartmentPeriod(deptData, period)

  const deptMetrics = supervisorDepartmentMetrics(deptPeriod, departmentNames)
  const zoneMetrics = isManager
    ? departmentZoneMetrics(deptPeriod, departmentNames)
    : []

  const rows = managedTeam
    .map((member) => {
      const daily = teamTodayEmployees.find((row) =>
        niksMatch(row.nik, member.nik),
      )

      const mtd = teamMtdEmployees.find((row) => niksMatch(row.nik, member.nik))
      const fullMonth = teamFullMonthEmployees.find((row) =>
        niksMatch(row.nik, member.nik),
      )

      if (period === "ytd") {
        const ytd = ytdData.find((row) => niksMatch(row.nik, member.nik))

        return {
          member,
          sales: null,
          target: null,
          achievement: ytd?.ytdSalesPct ?? 0,
          proteksi: null,
          ytd,
          salesBreakdown: undefined,
        }
      }

      const selected =
        period === "sbd" ? daily : period === "fullmonth" ? fullMonth : mtd

      const target =
        period === "fullmonth"
          ? (selected?.fullMonthTargetSales ?? 0)
          : (selected?.targetSales ?? 0)

      return {
        member,

        sales: selected?.sales ?? 0,

        target,

        achievement: target > 0 ? ((selected?.sales ?? 0) / target) * 100 : 0,

        proteksi: selected?.proteksi ?? 0,

        ytd: undefined,
        salesBreakdown: selected,
      }
    })
    .sort(
      (a, b) =>
        b.achievement - a.achievement || (b.sales ?? 0) - (a.sales ?? 0),
    )

  const totalSales = rows.reduce((sum, row) => sum + (row.sales ?? 0), 0)

  const totalTarget = rows.reduce((sum, row) => sum + (row.target ?? 0), 0)

  const ytdRows = rows.filter((row) => row.ytd)

  const averageYtd =
    ytdRows.length > 0
      ? ytdRows.reduce((sum, row) => sum + row.achievement, 0) / ytdRows.length
      : 0

  const teamAchievement =
    period === "ytd"
      ? averageYtd
      : totalTarget > 0
        ? (totalSales / totalTarget) * 100
        : 0

  const departmentAcvDays =
    period === "sbd" ? 1 : Math.max(mtdPerf.workingDays, 1)

  const periodLabel =
    PERIODS.find((item) => item.key === period)?.label ?? period

  const performanceGroups = isManager
    ? managedSupervisors.map((supervisor) => ({
        supervisor,
        rows: rows.filter(
          ({ member }) =>
            member.supervisorNik &&
            niksMatch(member.supervisorNik, supervisor.nik),
        ),
      }))
    : [{ supervisor: null, rows }]

  const px = isMobile ? "16px" : "32px"

  return (
    <div style={{ minHeight: "100vh", background: S.bg }}>
      <header
        style={{
          background: S.card,
          borderBottom: `1px solid ${S.border}`,
          padding: `12px ${px}`,
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <img
            src={azkoLogo}
            alt="Azko"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <span
            style={{
              color: S.text,
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: "0.06em",
            }}
          >
            ATLAS
          </span>
          <div style={{ width: 1, height: 18, background: S.border }} />
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: S.muted,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
              padding: 0,
            }}
          >
            ← Menu
          </button>
          {!isMobile && (
            <>
              <div style={{ width: 1, height: 18, background: S.border }} />
              <span style={{ color: S.text, fontWeight: 700, fontSize: 13 }}>
                Your Team's Performance
              </span>
              <span style={{ color: S.muted, fontSize: 12 }}>{user.nama}</span>
            </>
          )}
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              background: S.bg,
              borderRadius: 10,
              border: `1px solid ${S.border}`,
            }}
          >
            {PERIODS.map((item) => (
              <button
                key={item.key}
                onClick={() => setPeriod(item.key)}
                style={{
                  padding: isMobile ? "6px 10px" : "7px 14px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",

                  fontWeight: 700,
                  fontSize: isMobile ? 11 : 12,
                  whiteSpace: "nowrap",

                  background: period === item.key ? "#D93119" : "transparent",

                  color: period === item.key ? "#fff" : S.muted,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {isMobile && (
          <div style={{ marginTop: 5, color: S.muted, fontSize: 11 }}>
            {user.nama} · {user.jobTitle}
          </div>
        )}
      </header>

      {loading && (
        <div
          style={{
            background: "#eff6ff",
            borderBottom: "1px solid #bfdbfe",
            padding: `8px ${px}`,
            fontSize: 13,
            color: "#2563eb",
          }}
        >
          Memuat data sales…
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            background: "#fffbeb",
            borderBottom: "1px solid #fde68a",
            padding: `8px ${px}`,
            fontSize: 13,
            color: "#92400e",
          }}
        >
          Data sales: {error}
        </div>
      )}
      {deptError && (
        <div
          role="alert"
          style={{
            background: "#fff7ed",
            borderBottom: "1px solid #fed7aa",
            padding: `8px ${px}`,
            fontSize: 13,
            color: "#9a3412",
          }}
        >
          Data departemen gagal dimuat: {deptError}
        </div>
      )}

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: isMobile ? "18px 16px" : "28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <section
          style={{
            background: S.card,
            border: `1px solid ${S.border}`,
            borderRadius: 18,
            padding: isMobile ? 18 : 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              color: S.muted,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            {periodLabel} · Pencapaian Sales Team
          </div>
          {period === "ytd" ? (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <strong
                style={{
                  color: achievementColor(teamAchievement),
                  fontSize: isMobile ? 25 : 32,
                }}
              >
                {teamAchievement.toFixed(1)}%
              </strong>
              <span style={{ color: S.muted, fontSize: 13 }}>
                rata-rata pencapaian sales YTD · {ytdRows.length} dari{" "}
                {managedTeam.length} anggota
              </span>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <strong style={{ color: S.text, fontSize: isMobile ? 23 : 30 }}>
                  {formatRupiahFull(totalSales)}
                </strong>
                <span style={{ color: S.muted, fontSize: 13 }}>
                  dari target {formatRupiahFull(totalTarget)}
                </span>
                <span
                  style={{
                    color: achievementColor(teamAchievement),
                    fontSize: 14,
                    fontWeight: 800,
                    background: `${achievementColor(teamAchievement)}15`,
                    padding: "2px 9px",
                    borderRadius: 8,
                  }}
                >
                  {teamAchievement.toFixed(1)}%
                </span>
              </div>
              <div
                style={{
                  height: 7,
                  background: "#e8edf8",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(teamAchievement, 100)}%`,
                    background: achievementColor(teamAchievement),
                    borderRadius: 4,
                  }}
                />
              </div>
            </>
          )}
        </section>

        <section
          style={{
            background: S.card,
            border: `1px solid ${S.border}`,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              padding: "15px 18px",
              borderBottom: `1px solid ${S.border}`,
            }}
          >
            <div style={{ color: S.text, fontSize: 14, fontWeight: 800 }}>
              {isManager
                ? `Pencapaian Team per SPV · ${periodLabel}`
                : `Pencapaian SID Team · ${periodLabel}`}
            </div>
            <div style={{ color: S.muted, fontSize: 11, marginTop: 3 }}>
              {isManager
                ? "Menampilkan pencapaian anggota di bawah setiap SPV. Sales SPV tidak ditampilkan."
                : "Anggota berdasarkan NIK Supervisor pada kolom I sheet User"}
            </div>
          </div>
          {managedTeam.length === 0 ? (
            <div style={{ padding: 18, color: S.sub, fontSize: 13 }}>
              Belum ada anggota tim yang terhubung ke NIK {user.nik} di kolom I
              sheet User.
            </div>
          ) : period === "ytd" && ytdLoading ? (
            <div style={{ padding: 18, color: S.muted, fontSize: 13 }}>
              Memuat data YTD…
            </div>
          ) : period === "ytd" && ytdError ? (
            <div
              role="alert"
              style={{ padding: 18, color: "#9a3412", fontSize: 13 }}
            >
              {ytdError}
            </div>
          ) : period === "ytd" ? (
            <div
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {performanceGroups.map(({ supervisor, rows: groupRows }) => (
                <section
                  key={supervisor?.nik ?? "supervisor-team"}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {supervisor && (
                    <div
                      style={{
                        margin: "4px 0 10px",
                        padding: "10px 12px",
                        borderRadius: 11,
                        color: S.text,
                        background: "#e8edf8",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      SPV · {supervisor.nama} · {supervisor.nik}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {groupRows.map(({ member, ytd }) =>
                      ytd ? (
                        <details
                          key={member.nik}
                          open
                          style={{
                            background: S.card,
                            border: `1px solid ${S.border}`,
                            borderRadius: 14,
                            overflow: "hidden",
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              padding: "14px 16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              flexWrap: "wrap",
                              background: S.bg,
                            }}
                          >
                            <span>
                              <strong
                                style={{
                                  display: "block",
                                  color: S.text,
                                  fontSize: 13,
                                }}
                              >
                                {member.nama}
                              </strong>
                              <span style={{ color: S.muted, fontSize: 10 }}>
                                {member.nik} · {member.jobTitle}
                              </span>
                            </span>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                color: achievementColor(ytd.ytdSalesPct),
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              Sales YTD {ytd.ytdSalesPct.toFixed(1)}% ·{" "}
                              {ytd.ytdColorZone || "Belum ada zona"}
                            </span>
                          </summary>
                          <div style={{ padding: isMobile ? 12 : 18 }}>
                            <YTDContent ytd={ytd} isMobile={isMobile} />
                          </div>
                        </details>
                      ) : null,
                    )}
                  </div>
                </section>
              ))}
              {ytdRows.length === 0 && (
                <div style={{ padding: 4, color: S.sub, fontSize: 13 }}>
                  Data YTD anggota tim belum tersedia di sheet YEAR TO DATE.
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: isMobile ? 12 : 16,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {performanceGroups.map(({ supervisor, rows: groupRows }) => (
                <section
                  key={supervisor?.nik ?? "supervisor-team"}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {supervisor && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 11,
                        color: S.text,
                        background: "#e8edf8",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      SPV · {supervisor.nama} · {supervisor.nik}
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : "repeat(auto-fit, minmax(420px, 1fr))",
                      gap: 14,
                    }}
                  >
                    {groupRows.map(
                      (
                        {
                          member,
                          sales,
                          target,
                          achievement,
                          proteksi,
                          salesBreakdown,
                        },
                        index,
                      ) => {
                        const color = achievementColor(achievement)
                        return (
                          <article
                            key={member.nik}
                            style={{
                              minWidth: 0,
                              overflow: "hidden",
                              background:
                                "linear-gradient(145deg, #ffffff 0%, #f8faff 100%)",
                              border: `1px solid ${S.border}`,
                              borderRadius: 18,
                              boxShadow: "0 5px 16px rgba(30,41,59,0.06)",
                            }}
                          >
                            <div
                              style={{
                                padding: isMobile ? 14 : 16,
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                borderBottom: `1px solid ${S.border}`,
                              }}
                            >
                              <div
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 13,
                                  display: "grid",
                                  placeItems: "center",
                                  flexShrink: 0,
                                  color,
                                  background: `${color}14`,
                                  fontSize: 13,
                                  fontWeight: 900,
                                }}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    color: S.text,
                                    fontSize: 14,
                                    fontWeight: 800,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {member.nama}
                                </div>
                                <div
                                  style={{
                                    color: S.muted,
                                    fontSize: 10,
                                    marginTop: 3,
                                  }}
                                >
                                  {member.nik} · {member.jobTitle}
                                </div>
                              </div>
                              <div
                                style={{
                                  textAlign: "right",
                                  flexShrink: 0,
                                  padding: "7px 10px",
                                  borderRadius: 11,
                                  color,
                                  background: `${color}12`,
                                  fontSize: 13,
                                  fontWeight: 900,
                                }}
                              >
                                {achievement.toFixed(1)}%
                              </div>
                            </div>

                            <div style={{ padding: isMobile ? 14 : 16 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  alignItems: "baseline",
                                  marginBottom: 7,
                                }}
                              >
                                <span
                                  style={{
                                    color: S.muted,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Pencapaian Sales
                                </span>
                                <span
                                  style={{
                                    color: S.sub,
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  Target {formatRupiahFull(target ?? 0)}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 9,
                                  marginBottom: 14,
                                  overflow: "hidden",
                                  borderRadius: 99,
                                  background: "#e8edf8",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(Math.max(achievement, 0), 100)}%`,
                                    height: "100%",
                                    borderRadius: 99,
                                    background: color,
                                    transition: "width 0.6s ease",
                                  }}
                                />
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                  gap: 9,
                                }}
                              >
                                {[
                                  {
                                    label: "Sales",
                                    value: formatRupiahFull(sales ?? 0),
                                    color: S.text,
                                  },
                                  {
                                    label: "Target",
                                    value: formatRupiahFull(target ?? 0),
                                    color: S.sub,
                                  },
                                  {
                                    label: "Proteksi",
                                    value: `${(proteksi ?? 0).toLocaleString("id-ID")} pcs`,
                                    color: "#7c3aed",
                                  },
                                  {
                                    label: "Pencapaian",
                                    value: `${achievement.toFixed(1)}%`,
                                    color,
                                  },
                                ].map((metric) => (
                                  <div
                                    key={metric.label}
                                    style={{
                                      minWidth: 0,
                                      padding: "10px 11px",
                                      border: `1px solid ${S.border}`,
                                      borderRadius: 12,
                                      background: "#fff",
                                    }}
                                  >
                                    <div
                                      style={{
                                        color: S.muted,
                                        fontSize: 9,
                                        fontWeight: 800,
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                        marginBottom: 5,
                                      }}
                                    >
                                      {metric.label}
                                    </div>
                                    <div
                                      style={{
                                        color: metric.color,
                                        fontSize: 12,
                                        fontWeight: 800,
                                        overflowWrap: "anywhere",
                                      }}
                                    >
                                      {metric.value}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {salesBreakdown && (
                                <div
                                  style={{
                                    marginTop: 12,
                                    paddingTop: 12,
                                    borderTop: `1px solid ${S.border}`,
                                  }}
                                >
                                  <TeamSalesBreakdown
                                    totalSales={salesBreakdown.sales}
                                    departmentUser={member.departmentUser}
                                    userZone={member.userZone}
                                    salesByDepartment={
                                      salesBreakdown.salesByDepartment
                                    }
                                    salesContributions={
                                      salesBreakdown.salesContributions
                                    }
                                    salesChannelContributions={
                                      salesBreakdown.salesChannelContributions
                                    }
                                    isMobile={isMobile}
                                  />
                                </div>
                              )}
                            </div>
                          </article>
                        )
                      },
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            background: S.card,
            border: `1px solid ${S.border}`,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              padding: "15px 18px",
              borderBottom: `1px solid ${S.border}`,
            }}
          >
            <div style={{ color: S.text, fontSize: 14, fontWeight: 800 }}>
              {isManager
                ? `Pencapaian Zona & Departemen · ${periodLabel}`
                : `Pencapaian Departemen · ${periodLabel}`}
            </div>
            <div style={{ color: S.muted, fontSize: 11, marginTop: 3 }}>
              {isManager
                ? "Zona mengikuti pemetaan departemen pada data Pencapaian Dept."
                : "Rincian sales, target, pencapaian, dan ACV tiap departemen"}
              {deptPeriod?.date ? ` · ${deptPeriod.date}` : ""}
            </div>
          </div>
          {period === "ytd" ? (
            <div style={{ padding: 18, color: S.sub, fontSize: 13 }}>
              Data YTD departemen belum tersedia pada sumber sheet “Pencapaian
              Dept”; angka tidak ditampilkan agar tidak menyesatkan.
            </div>
          ) : departmentNames.length === 0 ? (
            <div style={{ padding: 18, color: S.sub, fontSize: 13 }}>
              Belum ada departemen yang terhubung ke NIK {user.nik} pada kolom
              K–L sheet User.
            </div>
          ) : !deptPeriod ? (
            <div style={{ padding: 18, color: S.sub, fontSize: 13 }}>
              Data {periodLabel} departemen belum tersedia.
            </div>
          ) : deptMetrics.length === 0 && zoneMetrics.length === 0 ? (
            <div style={{ padding: 18, color: S.sub, fontSize: 13 }}>
              Departemen {departmentNames.join(", ")} belum ditemukan pada data{" "}
              {periodLabel}.
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              {zoneMetrics.length > 0 && (
                <div style={{ marginBottom: deptMetrics.length > 0 ? 18 : 0 }}>
                  {isManager && (
                    <div
                      style={{
                        color: S.sub,
                        fontSize: 11,
                        fontWeight: 800,
                        marginBottom: 9,
                      }}
                    >
                      ZONA SESUAI DEPARTEMEN YANG DIPEGANG
                    </div>
                  )}
                  <SupervisorDepartmentCards
                    departments={zoneMetrics}
                    periodLabel={periodLabel}
                    workingDays={departmentAcvDays}
                    isMobile={isMobile}
                  />
                </div>
              )}
              {deptMetrics.length > 0 && (
                <>
                  {isManager && (
                    <div
                      style={{
                        color: S.sub,
                        fontSize: 11,
                        fontWeight: 800,
                        marginBottom: 9,
                      }}
                    >
                      DEPARTEMEN YANG DIPEGANG
                    </div>
                  )}
                  <SupervisorDepartmentCards
                    departments={deptMetrics}
                    periodLabel={periodLabel}
                    workingDays={departmentAcvDays}
                    isMobile={isMobile}
                  />
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
