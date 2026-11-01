import { describe, expect, it } from "vitest"

import { isSupervisorJobTitle } from "./jobTitle"

describe("isSupervisorJobTitle", () => {
  it.each(["SPV", "Supervisor", "Sales Supervisor", "Senior SPV"])(
    "identifies %s as a supervisor title",

    (jobTitle) => {
      expect(isSupervisorJobTitle(jobTitle)).toBe(true)
    },
  )

  it.each(["Sales Advisor", "Customer Service", "Manager"])(
    "does not identify %s as a supervisor title",

    (jobTitle) => {
      expect(isSupervisorJobTitle(jobTitle)).toBe(false)
    },
  )
})
