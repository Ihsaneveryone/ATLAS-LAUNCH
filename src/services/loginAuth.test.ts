import { describe, expect, it } from "vitest"

import type { User } from "../data/mockData"

import { findAuthenticatedUser } from "./loginAuth"

const userAccount: User = {
  nik: "191924",

  nama: "Manager",

  role: "user",

  jobTitle: "Manajer",

  password: "user-pass",
}

describe("findAuthenticatedUser", () => {
  it("checks duplicate NIK accounts and returns the manager profile", () => {
    const accounts: User[] = [
      { ...userAccount, role: "admin", jobTitle: "", password: "admin-pass" },

      userAccount,
    ]

    expect(findAuthenticatedUser(accounts, "191924", "user-pass")).toEqual(
      userAccount,
    )
  })

  it("rejects credentials that do not match any account for the NIK", () => {
    expect(findAuthenticatedUser([userAccount], "191924", "wrong-pass")).toBe(
      undefined,
    )
  })
})
