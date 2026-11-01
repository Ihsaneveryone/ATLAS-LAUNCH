import { useMemo } from "react"

import type { User } from "../data/mockData"

import { formatRupiahFull } from "../data/mockData"

import { useAtlasData } from "../context/useAtlasData"

import { useMobile } from "../hooks/useMobile"

import { achievementColor } from "../services/achievementColor"

import { niksMatch } from "../services/nik"

import {
  managerOtherDepartments,
  managerOtherTeam,
  managerSupervisors,
  managerTrackedDepartments,
  supervisorDepartments,
  supervisorTeam,
} from "../services/supervisorPerformance"

const border = "#e8edf8"

const text = "#1e293b"

const muted = "#94a3b8"

const sub = "#64748b"

export default function ManagerTeamOverview({ user }: { user: User }) {
  const { users, teamTodayEmployees, loading } = useAtlasData()

  const isMobile = useMobile()
  const departments = useMemo(
    () => managerTrackedDepartments(users, user),
    [users, user],
  )
  const otherDepartments = useMemo(
    () => managerOtherDepartments(users, user),
    [users, user],
  )
  const otherMembers = useMemo(
    () =>
      managerOtherTeam(users, user)
        .map((member) => ({
          member,
          performance: teamTodayEmployees.find((employee) =>
            niksMatch(employee.nik, member.nik),
          ),
        }))
        .sort(
          (left, right) =>
            (right.performance?.sales ?? 0) - (left.performance?.sales ?? 0),
        ),
    [teamTodayEmployees, user, users],
  )

  const groups = useMemo(
    () =>
      managerSupervisors(users, user).map((supervisor) => ({
        supervisor,

        departments: supervisorDepartments(users, supervisor),

        members: supervisorTeam(users, supervisor).map((member) => ({
          member,

          performance: teamTodayEmployees.find((employee) =>
            niksMatch(employee.nik, member.nik),
          ),
        })),
      })),

    [teamTodayEmployees, user, users],
  )

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
          background: "#fff",

          border: `1px solid ${border}`,

          borderRadius: 18,

          overflow: "hidden",

          boxShadow: "0 3px 14px rgba(30,41,59,0.05)",
        }}
      >
        <div
          style={{
            padding: "17px 18px",

            borderBottom: `1px solid ${border}`,

            background: "linear-gradient(120deg, #fff 0%, #f5f8ff 100%)",
          }}
        >
          <div style={{ color: text, fontWeight: 800, fontSize: 15 }}>
            Struktur Tim · Supervisor & Under SPV
          </div>
          <div style={{ color: muted, fontSize: 11, marginTop: 4 }}>
            Menampilkan departemen yang dipegang setiap SPV dan anggota timnya.
            Sales SPV tidak ditampilkan.
          </div>
        </div>

        {!loading && (
          <div
            style={{
              margin: isMobile ? 12 : 16,
              padding: 14,
              border: `1px solid ${border}`,
              borderRadius: 14,
              background: "#f8faff",
            }}
          >
            <div
              style={{
                color: sub,
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Departemen Utama yang dipegang Manajer
            </div>
            {departments.length === 0 ? (
              <div style={{ color: muted, fontSize: 11 }}>
                Belum ada departemen utama yang terhubung ke NIK Manajer{" "}
                {user.nik} di kolom M.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {departments.map((department) => (
                  <span
                    key={department}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 8,
                      color: "#334155",
                      background: "#eef2ff",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {department}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && (otherDepartments.length > 0 || otherMembers.length > 0) && (
          <div
            style={{
              margin: isMobile ? 12 : 16,
              marginTop: 0,
              padding: 14,
              border: `1px solid ${border}`,
              borderRadius: 14,
              background: "#f8faff",
            }}
          >
            <div
              style={{
                color: sub,
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Lainnya · Tanggung jawab langsung Manajer
            </div>
            {otherDepartments.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: otherMembers.length > 0 ? 12 : 0,
                }}
              >
                {otherDepartments.map((department) => (
                  <span
                    key={department}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 8,
                      color: "#334155",
                      background: "#eef2ff",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {department}
                  </span>
                ))}
              </div>
            )}
            {otherMembers.length > 0 && (
              <div
                style={{
                  marginTop: otherDepartments.length > 0 ? 12 : 0,
                  border: `1px solid ${border}`,
                  borderRadius: 12,
                  background: "#fff",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: `1px solid ${border}`,
                  }}
                >
                  <div style={{ color: text, fontSize: 12, fontWeight: 800 }}>
                    Karyawan di Luar Departemen · SBD
                  </div>
                  <div style={{ color: muted, fontSize: 10, marginTop: 3 }}>
                    Tanggung jawab langsung Manajer · tanpa Supervisor
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: isMobile ? 540 : 0,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8faff", textAlign: "left" }}>
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
                              padding: "9px 12px",
                              color: muted,
                              fontSize: 9,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {otherMembers.map(({ member, performance }) => {
                        const achievement = performance?.achievement ?? 0
                        const color = achievementColor(achievement)

                        return (
                          <tr
                            key={member.nik}
                            style={{ borderTop: `1px solid ${border}` }}
                          >
                            <td style={{ padding: "10px 12px" }}>
                              <div
                                style={{
                                  color: text,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {member.nama}
                              </div>
                              <div style={{ color: muted, fontSize: 9, marginTop: 2 }}>
                                {member.nik} · {member.jobTitle}
                                {member.departmentUser
                                  ? ` · ${member.departmentUser}`
                                  : ""}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color: text,
                                fontSize: 11,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatRupiahFull(performance?.sales ?? 0)}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color: sub,
                                fontSize: 11,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatRupiahFull(performance?.targetSales ?? 0)}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color,
                                fontSize: 11,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {achievement.toFixed(1)}%
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color: text,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {(performance?.proteksi ?? 0).toLocaleString("id-ID")}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 18, color: muted, fontSize: 13 }}>
            Memuat data tim…
          </div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 18, color: sub, fontSize: 13 }}>
            Belum ada Supervisor yang terhubung ke NIK Manajer {user.nik} di
            kolom I sheet User.
          </div>
        ) : (
          <div
            style={{
              padding: isMobile ? 12 : 16,

              display: "grid",

              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(auto-fit, minmax(400px, 1fr))",

              gap: 14,
            }}
          >
            {groups.map(({ supervisor, departments, members }, index) => (
              <article
                key={supervisor.nik}
                style={{
                  minWidth: 0,

                  border: `1px solid ${border}`,

                  borderRadius: 16,

                  overflow: "hidden",

                  background: "linear-gradient(145deg, #fff 0%, #f8faff 100%)",

                  boxShadow: "0 4px 12px rgba(30,41,59,0.045)",
                }}
              >
                <div
                  style={{
                    padding: 15,

                    display: "flex",

                    alignItems: "center",

                    gap: 11,

                    borderBottom: `1px solid ${border}`,
                  }}
                >
                  <div
                    style={{
                      width: 38,

                      height: 38,

                      display: "grid",

                      placeItems: "center",

                      borderRadius: 12,

                      background: "#eef2ff",

                      color: "#4f46e5",

                      fontSize: 12,

                      fontWeight: 900,

                      flexShrink: 0,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: text, fontSize: 14, fontWeight: 800 }}>
                      {supervisor.nama}
                    </div>
                    <div style={{ color: muted, fontSize: 10, marginTop: 3 }}>
                      {supervisor.nik} · {supervisor.jobTitle}
                    </div>
                  </div>
                  <span
                    style={{
                      color: sub,

                      background: "#f1f5f9",

                      borderRadius: 9,

                      padding: "6px 9px",

                      fontSize: 10,

                      fontWeight: 800,

                      whiteSpace: "nowrap",
                    }}
                  >
                    {members.length} anggota
                  </span>
                </div>

                <div style={{ padding: 14 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        color: muted,

                        fontSize: 9,

                        fontWeight: 800,

                        textTransform: "uppercase",

                        marginBottom: 6,
                      }}
                    >
                      Departemen yang dipegang
                    </div>
                    {departments.length === 0 ? (
                      <div style={{ color: muted, fontSize: 11 }}>
                        Belum ada departemen yang terhubung ke SPV ini.
                      </div>
                    ) : (
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        {departments.map((department) => (
                          <span
                            key={department}
                            style={{
                              padding: "5px 8px",

                              borderRadius: 8,

                              color: "#334155",

                              background: "#eef2ff",

                              fontSize: 10,

                              fontWeight: 700,
                            }}
                          >
                            {department}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderTop: `1px solid ${border}`,

                      paddingTop: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",

                        justifyContent: "space-between",

                        color: sub,

                        fontSize: 10,

                        fontWeight: 800,

                        textTransform: "uppercase",

                        marginBottom: 7,
                      }}
                    >
                      <span>Anggota Under SPV</span>
                      <span>SBD</span>
                    </div>
                    {members.length === 0 ? (
                      <div style={{ color: muted, fontSize: 11 }}>
                        Belum ada anggota yang terhubung ke NIK SPV di kolom I.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",

                          flexDirection: "column",

                          gap: 6,
                        }}
                      >
                        {members.map(({ member, performance }) => {
                          const achievement = performance?.achievement ?? 0

                          const color = achievementColor(achievement)

                          return (
                            <div
                              key={member.nik}
                              style={{
                                display: "flex",

                                alignItems: "center",

                                gap: 8,

                                padding: "8px 9px",

                                borderRadius: 10,

                                background: "#fff",

                                border: `1px solid ${border}`,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    color: text,

                                    fontSize: 11,

                                    fontWeight: 700,
                                  }}
                                >
                                  {member.nama}
                                </div>
                                <div
                                  style={{
                                    color: muted,

                                    fontSize: 9,

                                    marginTop: 2,
                                  }}
                                >
                                  {member.nik} · {member.jobTitle}
                                </div>
                              </div>
                              <span
                                style={{
                                  color: text,

                                  fontSize: 10,

                                  fontWeight: 700,

                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatRupiahFull(performance?.sales ?? 0)}
                              </span>
                              <span
                                style={{
                                  minWidth: 48,

                                  textAlign: "right",

                                  color,

                                  fontSize: 10,

                                  fontWeight: 900,
                                }}
                              >
                                {achievement.toFixed(1)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
