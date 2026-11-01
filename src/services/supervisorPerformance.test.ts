import { describe, expect, it } from "vitest"

import type { User } from "../data/mockData"

import {
  departmentZoneMetrics,
  departmentSupervisors,
  managerDepartments,
  managerSupervisors,
  supervisorDepartments,
  supervisorTeam,
  supervisorDepartmentMetrics,
  userLeaders,
} from "./supervisorPerformance"

const supervisor: User = {
  nik: "101902",
  nama: "Supervisor",
  role: "user",
  jobTitle: "SPV",
  password: "",
}

describe("supervisor performance selectors", () => {
  it("finds direct supervisors of a manager by the supervisor NIK relationship", () => {
    const manager: User = {
      nik: "500001",
      nama: "Manager",
      role: "user",
      jobTitle: "Manager",
      password: "",
    }
    const users: User[] = [
      {
        nik: "101902",
        nama: "SPV A",
        role: "user",
        jobTitle: "SPV",
        password: "",
        supervisorNik: "500001",
      },
      {
        nik: "101903",
        nama: "SPV B",
        role: "user",
        jobTitle: "Supervisor",
        password: "",
        supervisorNik: "I500001",
      },
      {
        nik: "201001",
        nama: "Advisor",
        role: "user",
        jobTitle: "Advisor",
        password: "",
        supervisorNik: "I01902",
      },
      {
        nik: "201002",
        nama: "Advisor B",
        role: "user",
        jobTitle: "Advisor",
        password: "",
        supervisorNik: "101903",
      },
    ]

    const supervisors = managerSupervisors(users, manager)

    expect(supervisors.map((user) => user.nik)).toEqual(["101902", "101903"])
    expect(
      supervisors.map((user) =>
        supervisorTeam(users, user).map((member) => member.nik),
      ),
    ).toEqual([["201001"], ["201002"]])
  })

  it("finds the Advisor's Supervisor and Manager leaders", () => {
    const manager: User = {
      nik: "500001",
      nama: "Muhammad Ihsan",
      role: "user",
      jobTitle: "Manajer",
      password: "",
    }
    const leader: User = {
      nik: "101902",
      nama: "Achmad Dani",
      role: "user",
      jobTitle: "Supervisor",
      password: "",
      supervisorNik: "I500001",
    }
    const advisor: User = {
      nik: "201001",
      nama: "Abdur Rosid",
      role: "user",
      jobTitle: "Sales Advisor",
      password: "",
      supervisorNik: "I01902",
    }

    expect(userLeaders([manager, leader, advisor], advisor)).toMatchObject({
      leader: { nama: "Achmad Dani" },
      manager: { nama: "Muhammad Ihsan" },
    })
    expect(userLeaders([manager, leader, advisor], leader)).toMatchObject({
      leader: { nama: "Muhammad Ihsan" },
    })
  })

  it("finds Manager departments from the department name and Manager NIK columns", () => {
    const manager: User = {
      nik: "500001",
      nama: "Manager",
      role: "user",
      jobTitle: "Manager",
      password: "",
    }
    const users: User[] = [
      {
        ...supervisor,
        supervisorDepartment: "Cleaning",
        managerDepartmentNik: "I500001",
      },
      {
        ...supervisor,
        nik: "201001",
        supervisorDepartment: "Home Comfort",
        managerDepartmentNik: "500001",
      },
      {
        ...supervisor,
        nik: "201002",
        supervisorDepartment: "Kitchenware",
        managerDepartmentNik: "500002",
      },
      {
        ...supervisor,
        nik: "201003",
        managerDepartmentNik: "500001",
      },
    ]

    expect(managerDepartments(users, manager)).toEqual([
      "Cleaning",
      "Home Comfort",
    ])
  })

  it("finds team members by the supervisor NIK relationship", () => {
    const users: User[] = [
      {
        nik: "201001",
        nama: "Team A",
        role: "user",
        jobTitle: "Advisor",
        password: "",
        supervisorNik: "I01902",
      },

      {
        nik: "201002",
        nama: "Other Team",
        role: "user",
        jobTitle: "Advisor",
        password: "",
        supervisorNik: "101903",
      },
    ]

    expect(supervisorTeam(users, supervisor).map((user) => user.nik)).toEqual([
      "201001",
    ])
  })

  it("finds unique departments assigned to the supervisor NIK", () => {
    const users: User[] = [
      {
        nik: "101902",
        nama: "Supervisor",
        role: "user",
        jobTitle: "SPV",
        password: "",
        supervisorDepartment: "Cleaning",
        departmentSupervisorNik: "101902",
      },

      {
        nik: "201001",
        nama: "Team A",
        role: "user",
        jobTitle: "Advisor",
        password: "",
        supervisorDepartment: "Cleaning",
        departmentSupervisorNik: "I01902",
      },

      {
        nik: "201002",
        nama: "Other Team",
        role: "user",
        jobTitle: "Advisor",
        password: "",
        supervisorDepartment: "Kitchenware",
        departmentSupervisorNik: "101903",
      },
    ]

    expect(supervisorDepartments(users, supervisor)).toEqual(["Cleaning"])
  })

  it("finds SPVs responsible for a TV department", () => {
    const users: User[] = [
      {
        ...supervisor,
        supervisorDepartment: "Cleaning",
        departmentSupervisorNik: "I01902",
      },
      {
        nik: "101903",
        nama: "Supervisor B",
        role: "user",
        jobTitle: "Supervisor",
        password: "",
        supervisorDepartment: "Cleaning",
        departmentSupervisorNik: "101903",
      },
      {
        nik: "201001",
        nama: "Team member",
        role: "user",
        jobTitle: "Advisor",
        password: "",
        supervisorDepartment: "Kitchenware",
        departmentSupervisorNik: "101902",
      },
    ]

    expect(
      departmentSupervisors(users, "cleaning").map((user) => user.nama),
    ).toEqual(["Supervisor", "Supervisor B"])
  })

  it("selects mapped zone performance without its duplicate department rows", () => {
    const result = supervisorDepartmentMetrics(
      {
        total: 250,

        departments: [
          {
            label: "Home Living (ZONA)",
            kind: "zone",
            zone: "Home Living",
            value: 150,
            target: 200,
          },

          {
            label: "Cleaning",
            kind: "dept",
            zone: "Home Living",
            value: 100,
            target: 120,
          },

          {
            label: "Kitchenware",
            kind: "dept",
            zone: "Home Living",
            value: 50,
            target: 80,
          },
        ],

        zones: [
          { zone: "Home Living", value: 150, target: 200, departments: [] },
        ],
      },
      ["Home Living (ZONA)"],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      label: "Home Living",
      value: 150,
      target: 200,
    })
  })

  it("selects only zones that contain the Manager's owned departments", () => {
    const result = departmentZoneMetrics(
      {
        total: 250,
        departments: [
          {
            label: "Cleaning",
            kind: "dept",
            zone: "Home Living",
            value: 100,
            target: 120,
          },
          {
            label: "Tools & Hardware",
            kind: "dept",
            zone: "Home Improvement",
            value: 50,
            target: 80,
          },
          {
            label: "Automotive",
            kind: "dept",
            zone: "Hobbies & Lifestyle",
            value: 100,
            target: 150,
          },
        ],
        zones: [
          {
            zone: "Hobbies & Lifestyle",
            value: 100,
            target: 300,
            departments: [],
          },
          {
            zone: "Home Improvement",
            value: 50,
            target: 100,
            departments: [],
          },
          {
            zone: "Home Living",
            value: 100,
            target: 200,
            departments: [],
          },
        ],
      },
      ["Cleaning", "Tools & Hardware"],
    )

    expect(result).toMatchObject([
      { label: "Home Improvement", value: 50, target: 100 },
      { label: "Home Living", value: 100, target: 200 },
    ])
  })

  it("keeps multiple assigned departments as separate performance rows", () => {
    const result = supervisorDepartmentMetrics(
      {
        total: 250,
        departments: [
          {
            label: "Cleaning",
            kind: "dept",
            zone: "Home Living",
            value: 100,
            target: 120,
          },
          {
            label: "Kitchenware",
            kind: "dept",
            zone: "Home Living",
            value: 150,
            target: 180,
          },
        ],
        zones: [],
      },
      ["Cleaning", "Kitchenware"],
    )

    expect(result).toMatchObject([
      { label: "Cleaning", value: 100, target: 120 },
      { label: "Kitchenware", value: 150, target: 180 },
    ])
  })
})
