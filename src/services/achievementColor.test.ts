import { describe, expect, it } from "vitest"

import { achievementColor } from "./achievementColor"

describe("achievementColor", () => {
  it.each([
    [79.9, "#dc2626"],

    [80, "#db2777"],

    [89.9, "#db2777"],

    [90, "#ca8a04"],

    [94.9, "#ca8a04"],

    [95, "#16a34a"],

    [99.9, "#16a34a"],

    [100, "#2563eb"],
  ])("returns the configured color for %s%%", (value, color) => {
    expect(achievementColor(value)).toBe(color)
  })
})
