export function normalizeJobTitle(value?: string): string {
  const raw = (value ?? "").trim()

  if (!raw) return ""

  const key = raw.toUpperCase().replace(/\s+/g, " ")

  const map: Record<string, string> = {
    SPV: "SUPERVISOR",

    SUPERVISOR: "SUPERVISOR",

    MANAGER: "MANAGER",

    MANAJER: "MANAGER",

    MGR: "MANAGER",

    ADV: "ADVISOR",

    ADVISOR: "ADVISOR",

    CCR: "CASHIER",

    CASHIER: "CASHIER",

    CS: "CUSTOMER SERVICE",

    "CUSTOMER SERVICE": "CUSTOMER SERVICE",
  }

  return map[key] ?? raw
}

export function isSupervisorJobTitle(value?: string): boolean {
  const title = normalizeJobTitle(value).toUpperCase()

  return (
    title === "SUPERVISOR" ||
    title.includes("SUPERVISOR") ||
    /\bSPV\b/.test(title)
  )
}
