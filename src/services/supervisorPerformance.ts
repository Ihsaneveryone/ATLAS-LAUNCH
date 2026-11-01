import type { User } from "../data/mockData"

import type { DeptMetric, DeptPeriodData } from "./deptApi"

import { niksMatch } from "./nik"
import { normalizeJobTitle } from "./jobTitle"

function normalizeDepartment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\(zona\)/g, "")
    .replace(/[^a-z0-9]/g, "")
}

export function supervisorTeam(users: User[], supervisor: User): User[] {
  return users.filter(
    (user) =>
      user.supervisorNik && niksMatch(user.supervisorNik, supervisor.nik),
  )
}

export function managerSupervisors(users: User[], manager: User): User[] {
  return users.filter(
    (user) =>
      normalizeJobTitle(user.jobTitle) === "SUPERVISOR" &&
      user.supervisorNik &&
      niksMatch(user.supervisorNik, manager.nik),
  )
}

export interface UserLeadership {
  leader?: User
  manager?: User
}

export function userLeaders(users: User[], user: User): UserLeadership {
  const jobTitle = normalizeJobTitle(user.jobTitle).toUpperCase()
  const isSupervisor = jobTitle === "SUPERVISOR"
  const isAdvisor = jobTitle === "ADVISOR" || jobTitle.includes("ADVISOR")
  if (!isSupervisor && !isAdvisor) return {}

  const directSupervisor =
    !isSupervisor && user.supervisorNik
      ? users.find(
          (candidate) =>
            niksMatch(candidate.nik, user.supervisorNik ?? "") &&
            normalizeJobTitle(candidate.jobTitle) === "SUPERVISOR",
        )
      : undefined

  const managerReference = isSupervisor
    ? user.supervisorNik
    : directSupervisor?.supervisorNik
  const manager = managerReference
    ? users.find(
        (candidate) =>
          niksMatch(candidate.nik, managerReference) &&
          normalizeJobTitle(candidate.jobTitle) === "MANAGER",
      )
    : undefined

  return isSupervisor
    ? { leader: manager }
    : { leader: directSupervisor, manager }
}

export function managerDepartments(users: User[], manager: User): string[] {
  const departments = new Map<string, string>()

  for (const user of users) {
    if (
      !user.supervisorDepartment ||
      !user.managerDepartmentNik ||
      !niksMatch(user.managerDepartmentNik, manager.nik)
    )
      continue

    const key = normalizeDepartment(user.supervisorDepartment)

    if (key && !departments.has(key))
      departments.set(key, user.supervisorDepartment.trim())
  }

  return [...departments.values()]
}

export function supervisorDepartments(
  users: User[],
  supervisor: User,
): string[] {
  const departments = new Map<string, string>()

  for (const user of users) {
    if (
      !user.supervisorDepartment ||
      !user.departmentSupervisorNik ||
      !niksMatch(user.departmentSupervisorNik, supervisor.nik)
    )
      continue

    const key = normalizeDepartment(user.supervisorDepartment)

    if (key && !departments.has(key))
      departments.set(key, user.supervisorDepartment.trim())
  }

  return [...departments.values()]
}

export function departmentSupervisors(
  users: User[],
  departmentName: string,
): User[] {
  const departmentKey = normalizeDepartment(departmentName)
  if (!departmentKey) return []

  const supervisorNiks = new Set(
    users
      .filter(
        (user) =>
          user.supervisorDepartment &&
          normalizeDepartment(user.supervisorDepartment) === departmentKey &&
          user.departmentSupervisorNik,
      )
      .map((user) => user.departmentSupervisorNik ?? "")
      .filter(Boolean),
  )

  const supervisors = new Map<string, User>()
  for (const nik of supervisorNiks) {
    const supervisor = users.find(
      (user) =>
        normalizeJobTitle(user.jobTitle) === "SUPERVISOR" &&
        niksMatch(user.nik, nik),
    )
    if (supervisor) supervisors.set(supervisor.nik, supervisor)
  }

  return [...supervisors.values()]
}

export function supervisorDepartmentMetrics(
  period: DeptPeriodData | null,
  departmentNames: string[],
): DeptMetric[] {
  if (!period || departmentNames.length === 0) return []

  const wanted = new Set(departmentNames.map(normalizeDepartment))

  const selectedZones = period.zones

    .filter((zone) => wanted.has(normalizeDepartment(zone.zone)))

    .map((zone) => ({
      label: zone.zone,

      kind: "zone" as const,

      zone: zone.zone,

      value: zone.value,

      target: zone.target,

      achievement: zone.achievement,
    }))

  const selectedZoneKeys = new Set(
    selectedZones.map((zone) => normalizeDepartment(zone.zone)),
  )

  const selectedDepartments = period.departments.filter(
    (metric) =>
      metric.kind !== "zone" &&
      wanted.has(normalizeDepartment(metric.label)) &&
      !selectedZoneKeys.has(normalizeDepartment(metric.zone)),
  )

  const matched = [...selectedZones, ...selectedDepartments]

  const unique = [
    ...new Map(
      matched.map((metric) => [
        `${metric.kind}:${normalizeDepartment(metric.label)}`,
        metric,
      ]),
    ).values(),
  ]

  return unique
}

export function departmentZoneMetrics(
  period: DeptPeriodData | null,
  departmentNames: string[],
): DeptMetric[] {
  if (!period || departmentNames.length === 0) return []

  const wantedDepartments = new Set(departmentNames.map(normalizeDepartment))
  const ownedZones = new Set(
    period.departments
      .filter(
        (department) =>
          department.kind !== "zone" &&
          wantedDepartments.has(normalizeDepartment(department.label)),
      )
      .map((department) => normalizeDepartment(department.zone)),
  )

  return period.zones
    .filter((zone) => ownedZones.has(normalizeDepartment(zone.zone)))
    .map((zone) => ({
      label: zone.zone,
      kind: "zone",
      zone: zone.zone,
      value: zone.value,
      target: zone.target,
      achievement: zone.achievement,
    }))
}
