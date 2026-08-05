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

/**
 * Extract potential article numbers from a barcode string.
 * Handles cases where barcode contains article as substring.
 * Example: "1C110584724" -> ["1C110584724", "110584724", "10584724", "0584724", "584724"]
 */
function extractArticleVariants(barcode: string): string[] {
  const normalized = normalizeCode(barcode)
  const variants = new Set<string>()
  
  // Add the full code
  variants.add(normalized)
  
  // Try removing common prefixes (EAN13 check digit, country codes, etc)
  // Remove leading 1-3 digits and try
  for (let i = 1; i <= Math.min(3, normalized.length - 6); i++) {
    variants.add(normalized.substring(i))
  }
  
  // Try removing trailing check digits (last 1-2 digits)
  if (normalized.length > 8) {
    variants.add(normalized.substring(0, normalized.length - 1))
    variants.add(normalized.substring(0, normalized.length - 2))
  }
  
  return Array.from(variants).filter(v => v.length >= 6) // Only keep codes with 6+ digits
}

export function resolveScanResult(scannedCode: string, data: ParsedIncentiveData | null): ScanMatchResult {
  const barcodeVariants = extractArticleVariants(scannedCode)
  const normalizedCode = normalizeCode(scannedCode)
  const safeData = data ?? {
    conditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
    unconditional: { rows: [], totalTarget: 0, totalAchieved: 0 },
    sku: { rows: [], totalTarget: 0, totalAchieved: 0 },
    syarat: { rows: [] },
    boomsale: { rows: [] },
    receipt: { rows: [] },
    sales: { rows: [] },
  }

  // Try to match against article variants (handles barcode prefixes)
  const skuMatch = safeData.sku.rows.find(row => {
    const normalized = normalizeCode(row.sku)
    return barcodeVariants.includes(normalized) || normalizeCode(row.name) === normalizedCode
  })
  const boomsaleMatch = safeData.boomsale.rows.find(row => {
    const normalized = normalizeCode(row.artikel)
    return barcodeVariants.includes(normalized) || normalizeCode(row.name) === normalizedCode
  })
  const matchingSyaratRows = safeData.syarat.rows.filter(row => {
    const haystack = normalizeSearchText([row.jenis, row.syarat, row.note, ...(row.articleList || [])].join(' '))
    // Check if any variant matches the article list
    return barcodeVariants.some(variant => haystack.includes(variant))
  })

  const isIncentive = Boolean(skuMatch || boomsaleMatch || matchingSyaratRows.length)

  const summary = isIncentive
    ? `${skuMatch ? 'SKU terdeteksi sebagai insentif.' : boomsaleMatch ? 'Produk insentif bulan ini terdeteksi.' : 'Kode cocok dengan syarat insentif.'}`
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
