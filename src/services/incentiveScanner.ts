import type { ParsedIncentiveData } from './incentiveParser'

export interface ScanMatchResult {
  scannedCode: string
  isIncentive: boolean
  skuMatch: {
    sku: string
    name: string
    requirement: string
    incentiveValue: number
    per: string
  } | null
  boomsaleMatch: {
    artikel: string
    name: string
    category: string
    departemen: string
    incentiveValue: number
    incentivePercent: number
    remark: string
  } | null
  matchingSyaratRows: Array<{
    jenis: string
    syarat: string
    note: string
    incentiveValuePerQty: number
    articleList: string[]
  }>
  summary: string
}

function normalizeCode(value: string): string {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function normalizeSearchText(value: string): string {
  return normalizeCode(value)
}

export function resolveScanResult(scannedCode: string, data: ParsedIncentiveData | null): ScanMatchResult {
  const normalizedCode = normalizeCode(scannedCode)
  const safeData = data ?? {
    conditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
    unconditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
    sku: { rows: [], totalTarget: 0, totalAchieved: 0 },
    syarat: { rows: [] },
    boomsale: { rows: [] },
    receipt: { rows: [] },
  }

  const skuMatch = safeData.sku.rows.find(row => normalizeCode(row.sku) === normalizedCode || normalizeCode(row.name) === normalizedCode)
  const boomsaleMatch = safeData.boomsale.rows.find(row => normalizeCode(row.artikel) === normalizedCode || normalizeCode(row.name) === normalizedCode)
  const matchingSyaratRows = safeData.syarat.rows.filter(row => {
    const haystack = normalizeSearchText([row.jenis, row.syarat, row.note, ...(row.articleList || [])].join(' '))
    return haystack.includes(normalizedCode)
  })

  const isIncentive = Boolean(skuMatch || boomsaleMatch || matchingSyaratRows.length)

  const summary = isIncentive
    ? `${skuMatch ? 'SKU terdeteksi sebagai insentif.' : boomsaleMatch ? 'Artikel boomsale terdeteksi.' : 'Kode cocok dengan syarat insentif.'}`
    : 'Kode tidak terdaftar dalam daftar insentif saat ini.'

  return {
    scannedCode,
    isIncentive,
    skuMatch: skuMatch
      ? {
          sku: skuMatch.sku,
          name: skuMatch.name,
          requirement: skuMatch.requirement,
          incentiveValue: skuMatch.incentiveValue,
          per: skuMatch.per,
        }
      : null,
    boomsaleMatch: boomsaleMatch
      ? {
          artikel: boomsaleMatch.artikel,
          name: boomsaleMatch.name,
          category: boomsaleMatch.category,
          departemen: boomsaleMatch.departemen,
          incentiveValue: boomsaleMatch.incentiveValue,
          incentivePercent: boomsaleMatch.incentivePercent,
          remark: boomsaleMatch.remark,
        }
      : null,
    matchingSyaratRows: matchingSyaratRows.map(row => ({
      jenis: row.jenis,
      syarat: row.syarat,
      note: row.note,
      incentiveValuePerQty: row.incentiveValuePerQty,
      articleList: row.articleList,
    })),
    summary,
  }
}
