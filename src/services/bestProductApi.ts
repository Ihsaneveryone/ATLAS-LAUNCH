import { fetchCopasS2TableData } from "./rawDataApi"

let productRowsCache: string[][] | null = null
let productRowsRequest: Promise<string[][]> | null = null

export type BestProductPeriod = "sbd" | "mtd"

export interface BestProductArticle {
  article: string

  description: string

  qty: number

  value: number
}

export interface BestProductDepartment {
  name: string

  articles: BestProductArticle[]

  articleCount: number

  totalQty: number

  totalValue: number

  transactionCount: number
}

export interface BestProductReport {
  departments: BestProductDepartment[]

  transactionCount: number

  unmatchedCategories: string[]
}

const DEPARTMENT_CATEGORIES: Array<{
  department: string
  categories: string[]
}> = [
  {
    department: "Cleaning",
    categories: ["Cleaning Supplies", "Cleaning Appliances"],
  },

  { department: "Home Storage", categories: ["Home Storage"] },

  { department: "Kitchenware", categories: ["Kitchenware"] },

  { department: "Appliances", categories: ["Appliances", "Horecaba Supplies"] },

  {
    department: "Home Comfort",
    categories: ["Home Decor & Fragrance", "Home Textile"],
  },

  {
    department: "Paint Ladder BM",
    categories: ["Paint & Sundries", "Building Supplies", "Ladder"],
  },

  {
    department: "Safe, Office, Security System",

    categories: ["Safes, Office, & Security Systems"],
  },

  {
    department: "Plumbing & Sanitary",
    categories: ["Plumbing", "Sanitary Ware"],
  },

  { department: "Tools & Hardware", categories: ["Hardware", "Tools"] },

  {
    department: "Racking, Locker & Cabinet",

    categories: ["Locker, Cabinet, & Racking"],
  },

  { department: "Lighting", categories: ["Lighting"] },

  { department: "Fans & Air Treatment", categories: ["Fans & Air Treatment"] },

  { department: "Electrical", categories: ["Power Supply"] },

  { department: "Automotive", categories: ["Automotive"] },

  {
    department: "LG & AquaPet",
    categories: ["Lawn Garden", "Outdoor Living", "Aqua Pet"],
  },

  {
    department: "Sporting & health",
    categories: ["Sports", "Health Supports"],
  },

  { department: "Outdoor Comfort", categories: ["Outdoor Comfort"] },

  {
    department: "Travels, Seasonal, Baby & Kids",

    categories: ["Travels, Seasonal, Baby & Kids"],
  },

  { department: "Trendy Goods", categories: ["Trendy Goods"] },
]

function normalizeCategory(value: string): string {
  return value

    .normalize("NFKC")

    .toLowerCase()

    .replace(/&/g, "and")

    .replace(/[^a-z0-9]/g, "")
}

const CATEGORY_TO_DEPARTMENT = new Map(
  DEPARTMENT_CATEGORIES.flatMap(({ department, categories }) =>
    categories.map(
      (category) => [normalizeCategory(category), department] as const,
    ),
  ),
)

export function bestProductDepartmentForCategory(
  category: string,
): string | null {
  return CATEGORY_TO_DEPARTMENT.get(normalizeCategory(category)) ?? null
}

function parseAmount(value: string): number {
  let normalized = value.replace(/[^\d,.-]/g, "")

  if (!normalized) return 0

  const commaIndex = normalized.lastIndexOf(",")

  const dotIndex = normalized.lastIndexOf(".")

  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized =
      commaIndex > dotIndex
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "")
  } else if (commaIndex >= 0) {
    normalized =
      normalized.length - commaIndex - 1 === 3
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".")
  } else if (dotIndex >= 0 && normalized.length - dotIndex - 1 === 3) {
    normalized = normalized.replace(/\./g, "")
  }

  const result = Number(normalized)

  return Number.isFinite(result) ? result : 0
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function parseTransactionDate(value: string, today: Date): Date | null {
  const text = value.trim().split(/[ T]/)[0]

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)

  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))

  const numeric = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)

  if (numeric) {
    const first = Number(numeric[1])

    const second = Number(numeric[2])

    const year = Number(numeric[3])

    const dayFirst = new Date(year, second - 1, first)

    const monthFirst = new Date(year, first - 1, second)

    if (first > 12) return dayFirst

    if (second > 12) return monthFirst

    if (sameDay(dayFirst, today) || sameDay(monthFirst, today)) {
      return sameDay(monthFirst, today) ? monthFirst : dayFirst
    }

    if (
      dayFirst.getFullYear() === today.getFullYear() &&
      dayFirst.getMonth() === today.getMonth() &&
      dayFirst <= today
    )
      return dayFirst

    if (
      monthFirst.getFullYear() === today.getFullYear() &&
      monthFirst.getMonth() === today.getMonth() &&
      monthFirst <= today
    )
      return monthFirst

    return dayFirst
  }

  const abbreviated = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)

  if (abbreviated) {
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,

      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,

      mei: 4,
      agu: 7,
      okt: 9,
      des: 11,
    }

    const month = months[abbreviated[2].toLowerCase()]

    if (month !== undefined)
      return new Date(Number(abbreviated[3]), month, Number(abbreviated[1]))
  }

  return null
}

function jakartaToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",

    year: "numeric",

    month: "numeric",

    day: "numeric",
  }).formatToParts(now)

  const year = Number(parts.find((part) => part.type === "year")?.value)

  const month = Number(parts.find((part) => part.type === "month")?.value)

  const day = Number(parts.find((part) => part.type === "day")?.value)

  return new Date(year, month - 1, day)
}

export function buildBestProductReport(
  rows: string[][],

  period: BestProductPeriod,

  now = new Date(),
): BestProductReport {
  const today = jakartaToday(now)

  const articleGroups = new Map<string, Map<string, BestProductArticle>>()

  const unmatchedCategories = new Set<string>()

  let transactionCount = 0

  for (const row of rows) {
    const article = (row[4] ?? "").trim()

    const category = (row[14] ?? "").trim()

    const department = CATEGORY_TO_DEPARTMENT.get(normalizeCategory(category))

    if (!department) {
      if (category) unmatchedCategories.add(category)

      continue
    }

    if (!article) continue

    const date = parseTransactionDate(row[13] ?? "", today)

    if (!date) continue

    if (
      period === "sbd"
        ? !sameDay(date, today)
        : date.getFullYear() !== today.getFullYear() ||
          date.getMonth() !== today.getMonth() ||
          date > today
    )
      continue

    const qty = parseAmount(row[7] ?? "")

    const value = parseAmount(row[11] ?? "")

    const description = (row[5] ?? "").trim()

    const groupKey = normalizeCategory(department)

    const articleKey = article.toUpperCase()

    const departmentArticles = articleGroups.get(groupKey) ?? new Map()

    const current = departmentArticles.get(articleKey)

    if (current) {
      current.qty += qty

      current.value += value

      if (!current.description && description) current.description = description
    } else {
      departmentArticles.set(articleKey, { article, description, qty, value })
    }

    articleGroups.set(groupKey, departmentArticles)

    transactionCount++
  }

  const departments = DEPARTMENT_CATEGORIES.map(({ department }) => {
    const articles = [
      ...(articleGroups.get(normalizeCategory(department))?.values() ?? []),
    ]

      .sort((left, right) => right.value - left.value || right.qty - left.qty)

    return {
      name: department,

      articles,

      articleCount: articles.length,

      totalQty: articles.reduce((sum, item) => sum + item.qty, 0),

      totalValue: articles.reduce((sum, item) => sum + item.value, 0),

      transactionCount: articles.length,
    }
  })

    .filter((department) => department.articles.length > 0)

  return {
    departments,

    transactionCount,

    unmatchedCategories: [...unmatchedCategories].sort((a, b) =>
      a.localeCompare(b),
    ),
  }
}

export async function fetchBestProductRows(
  refresh = false,
): Promise<string[][]> {
  if (refresh) {
    productRowsCache = null
    productRowsRequest = null
  }
  if (productRowsCache) return productRowsCache

  if (!productRowsRequest) {
    productRowsRequest = fetchCopasS2TableData()
      .then((data) => {
        productRowsCache = data.rows
        return data.rows
      })
      .finally(() => {
        productRowsRequest = null
      })
  }
  return productRowsRequest
}

export async function fetchBestProductReport(
  period: BestProductPeriod,
): Promise<BestProductReport> {
  const rows = await fetchBestProductRows()
  return buildBestProductReport(rows, period)
}
