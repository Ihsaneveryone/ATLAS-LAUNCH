export interface IncentiveConditionalItem {
  label: string
  amount: number
  status: string
}

export interface IncentiveConditionalRow {
  nik: string
  nama: string
  tokoValue: number
  challengeValue: number
  status: string
  items: Array<{ label: string; amount: number; status: string }>
  fields: Array<{ label: string; value: string }>
}

export interface IncentiveUnconditionalRow {
  nik: string
  nama: string
  category: string
  value: number
  items: Array<{ label: string; amount: number }>
  fields: Array<{ label: string; value: string }>
}

export interface IncentiveSkuRow {
  sku: string
  name: string
  requirement: string
  incentiveValue: number
  per: string
  imageUrl: string
}

export interface IncentiveSyaratRow {
  jenis: string
  syarat: string
  note: string
  targetQty?: number
  articleList: string[]
  acvValue: number
  incentiveValuePerQty: number
  fields: Array<{ label: string; value: string }>
}

export interface IncentiveBoomsaleRow {
  artikel: string
  name: string
  departemen: string
  price: number
  priceSource: 'e' | 'f' | 'none'
  incentivePercent: number
  incentiveNominal: number
  incentiveValue: number
  incentiveIsPercentage: boolean
  targetQty?: number
  actualQty?: number
  remark: string
  category: string
  imageUrl: string
  fields: Array<{ label: string; value: string }>
}

export interface IncentiveReceiptRow {
  no: string
  departemen: string
  targetValue: number
  percentage: number
  fields: Array<{ label: string; value: string }>
}

export interface IncentiveSalesRow {
  nik: string
  nama: string
  artikel: string
  productName: string
  qty: number
}

export interface ParsedIncentiveData {
  conditional: { rows: IncentiveConditionalRow[]; totalTarget: number; totalAchieved: number }
  unconditional: { rows: IncentiveUnconditionalRow[]; totalTarget: number; totalAchieved: number }
  sku: { rows: IncentiveSkuRow[]; totalTarget: number; totalAchieved: number }
  syarat: { rows: IncentiveSyaratRow[] }
  boomsale: { rows: IncentiveBoomsaleRow[] }
  receipt: { rows: IncentiveReceiptRow[] }
  sales: { rows: IncentiveSalesRow[] }
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeArticleKey(value: string): string {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function toNumber(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/Rp\.?\s*/gi, '').replace(/\./g, '').replace(',', '.')
  return Number.parseFloat(cleaned) || 0
}

function evaluateRowReference(reference: string, row: string[], dataRowIndex: number): string {
  const normalized = reference.trim().toUpperCase()
  const match = normalized.match(/^([A-Z]+)(\d+)$/)
  if (!match) return ''

  const colLetters = match[1]
  const targetRowNumber = Number(match[2])
  const currentSheetRowNumber = dataRowIndex + 2

  if (targetRowNumber !== currentSheetRowNumber) return ''

  let colIndex = 0
  for (let i = 0; i < colLetters.length; i++) {
    colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64)
  }
  colIndex -= 1
  return row[colIndex] ?? ''
}

function evaluateConcatExpression(expression: string, row: string[], dataRowIndex: number): string {
  return expression.split(/\s*&\s*/g).map(part => {
    const trimmed = part.trim()
    if (!trimmed) return ''

    const quoted = trimmed.match(/^"([\s\S]*)"$/)
    if (quoted) return quoted[1]

    const refValue = evaluateRowReference(trimmed, row, dataRowIndex)
    if (refValue) return refValue

    return trimmed
  }).join('')
}

function extractImageUrl(value: string, row: string[], dataRowIndex: number): string {
  const raw = normalizeText(value)
  if (!raw) return ''

  const imageFormula = raw.match(/=\s*IMAGE\s*\((([\s\S]*))\)/i)
  if (imageFormula?.[1]) {
    const content = imageFormula[1].trim()
    const url = evaluateConcatExpression(content, row, dataRowIndex)
    if (/^https?:\/\//i.test(url)) return url
  }

  const hyperlinkFormula = raw.match(/=\s*HYPERLINK\s*\((([\s\S]*))\)/i)
  if (hyperlinkFormula?.[1]) {
    const content = hyperlinkFormula[1].trim()
    const url = evaluateConcatExpression(content, row, dataRowIndex)
    if (/^https?:\/\//i.test(url)) return url
  }

  if (raw.startsWith('=')) {
    const content = raw.slice(1).trim()
    const url = evaluateConcatExpression(content, row, dataRowIndex)
    if (/^https?:\/\//i.test(url)) return url
  }

  const urlMatch = raw.match(/(https?:\/\/[^\s"]+)/i)
  return urlMatch?.[1] ?? ''
}

function findHeaderIndex(headers: string[], matcher: RegExp | RegExp[]): number {
  const matchers = Array.isArray(matcher) ? matcher : [matcher]
  for (const candidate of matchers) {
    const index = headers.findIndex(header => candidate.test(header))
    if (index >= 0) return index
  }
  return -1
}

function parseConditionalRow(row: string[], headers: string[]): IncentiveConditionalRow {
  const normalizedHeaders = headers.map(normalizeText)
  const nikIndex = findHeaderIndex(normalizedHeaders, /\bnik\b/i)
  const namaIndex = findHeaderIndex(normalizedHeaders, /\b(nama|name)\b/i)
  const fallbackNikIndex = nikIndex >= 0
    ? nikIndex
    : (/^\d[\d\s.-]*$/.test(normalizeText(row[0] ?? '')) ? 0 : -1)
  const fallbackNamaIndex = namaIndex >= 0
    ? namaIndex
    : (fallbackNikIndex === 0 && normalizeText(row[1] ?? '') ? 1 : -1)

  const items: Array<{ label: string; amount: number; status: string }> = []
  let i = 0
  while (i < normalizedHeaders.length) {
    if (i === fallbackNikIndex || i === fallbackNamaIndex) {
      i += 1
      continue
    }

    const header = normalizedHeaders[i]
    if (/\bstatus\b/i.test(header) && items.length > 0) {
      items[items.length - 1].status = normalizeText(row[i] ?? '')
      i += 1
      continue
    }

    const amount = toNumber(row[i] ?? '')
    const statusIndex = i + 1
    const statusHeader = normalizedHeaders[statusIndex] ?? ''
    const statusValue = statusIndex < row.length && /\bstatus\b/i.test(statusHeader) ? normalizeText(row[statusIndex] ?? '') : ''
    const label = normalizeText(headers[i] ?? '')

    if (label && !/\bstatus\b/i.test(label)) {
      items.push({ label: headers[i] ?? '', amount, status: statusValue })
      i += statusValue ? 2 : 1
    } else {
      i += 1
    }
  }

  const tokoItem = items.find(item => /\btoko\b/i.test(item.label)) ?? items[0]
  const challengeItem = items.find(item => /\b(challenge|challeng)\b/i.test(item.label)) ?? items[1] ?? tokoItem
  const tokoValue = tokoItem?.amount ?? 0
  const challengeValue = challengeItem?.amount ?? 0
  const status = normalizeText(challengeItem?.status || tokoItem?.status || '')

  const nik = fallbackNikIndex >= 0 ? normalizeText(row[fallbackNikIndex] ?? '') : ''
  const nama = fallbackNamaIndex >= 0 ? normalizeText(row[fallbackNamaIndex] ?? '') : ''
  const fields = headers.map((header, index) => ({ label: header, value: normalizeText(row[index] ?? '') }))
  return { nik, nama, tokoValue, challengeValue, status, items, fields }
}

function parseUnconditionalRow(row: string[], headers: string[]): IncentiveUnconditionalRow {
  const normalizedHeaders = headers.map(normalizeText)
  const nikIndex = findHeaderIndex(normalizedHeaders, /\bnik\b/i)
  const namaIndex = findHeaderIndex(normalizedHeaders, /\b(nama|name)\b/i)
  const categoryIndex = findHeaderIndex(normalizedHeaders, /\b(kategori|category|item|jenis|nama insentif|insentif kategori)\b/i)

  const items: Array<{ label: string; amount: number }> = []
  normalizedHeaders.forEach((_, index) => {
    if (index === nikIndex || index === namaIndex || index === categoryIndex) return
    const amount = toNumber(row[index] ?? '')
    if (amount > 0) {
      const label = normalizeText(headers[index] ?? '') || normalizeText(row[index] ?? '')
      items.push({ label, amount })
    }
  })

  const value = items.reduce((sum, item) => sum + item.amount, 0)
  const category = normalizeText(row[categoryIndex] ?? '')
  const nik = normalizeText(row[nikIndex] ?? '')
  const nama = normalizeText(row[namaIndex] ?? '')
  const fields = headers.map((header, index) => ({ label: header, value: normalizeText(row[index] ?? '') }))
  return { nik, nama, category, value, items, fields }
}

function parseSyaratRow(row: string[], headers: string[], compareByArtikel: Map<string, number>): IncentiveSyaratRow {
  const normalizedHeaders = headers.map(normalizeText)
  const jenisIndex = findHeaderIndex(normalizedHeaders, /\b(jenis insentif|jenis|type|category)\b/i)
  const syaratIndex = findHeaderIndex(normalizedHeaders, /\b(syarat|requirement|terms|condition)\b/i)
  const noteIndex = findHeaderIndex(normalizedHeaders, /\b(note|keterangan|catatan)\b/i)
  const targetQtyIndex = findHeaderIndex(normalizedHeaders, /\b(target qty|target quantity|target|qty target|qty)\b/i)
  const articleIndex = findHeaderIndex(normalizedHeaders, /\b(artikel|artikels|article|sku|kode)\b/i)
  const incentiveValuePerQtyIndex = findHeaderIndex(normalizedHeaders, /\b(value per qty|insentif per qty|per qty|value qty|value per)\b/i)

  const resolvedJenisIndex = jenisIndex >= 0 ? jenisIndex : 0
  const resolvedSyaratIndex = syaratIndex >= 0 ? syaratIndex : 1
  const resolvedTargetQtyIndex = targetQtyIndex >= 0 ? targetQtyIndex : 2
  const resolvedArticleIndex = articleIndex >= 0 ? articleIndex : 3
  const resolvedIncentiveValuePerQtyIndex = incentiveValuePerQtyIndex >= 0 ? incentiveValuePerQtyIndex : 4

  const jenis = normalizeText(row[resolvedJenisIndex] ?? '')
  const syarat = normalizeText(row[resolvedSyaratIndex] ?? '')
  const note = normalizeText(row[noteIndex >= 0 ? noteIndex : 1] ?? '')
  const targetQtyValue = normalizeText(row[resolvedTargetQtyIndex] ?? '')
  const targetQty = Number.parseInt(targetQtyValue, 10)
  const articleRaw = normalizeText(row[resolvedArticleIndex] ?? '')
  const articleList = articleRaw
    .split(/\s*[\/\\]\s*|\s*,\s*|\s*\|\s*|\s*;\s*/)
    .map(part => normalizeText(part))
    .filter(Boolean)
  const acvValue = articleList.reduce((sum, article) => sum + (compareByArtikel.get(normalizeArticleKey(article)) ?? 0), 0)
  const incentiveValuePerQty = toNumber(row[resolvedIncentiveValuePerQtyIndex] ?? '')
  const fields = headers.map((header, index) => ({ label: header, value: normalizeText(row[index] ?? '') }))
  return { jenis, syarat, note, targetQty: Number.isNaN(targetQty) ? undefined : targetQty, articleList, acvValue, incentiveValuePerQty, fields }
}

function parseBoomsaleRow(row: string[], headers: string[]): IncentiveBoomsaleRow {
  const normalizedHeaders = headers.map(normalizeText)
  const artikelIndex = findHeaderIndex(normalizedHeaders, /\b(artikel|sku|kode)\b/i)
  const nameIndex = findHeaderIndex(normalizedHeaders, /\b(nama produk|nama|product name|description)\b/i)
  const departemenIndex = findHeaderIndex(normalizedHeaders, /\b(departemen|department|dept)\b/i)
  const priceEIndex = findHeaderIndex(normalizedHeaders, /\b(harga.*e|price.*e|kolom e|harga e|price e)\b/i)
  const priceFIndex = findHeaderIndex(normalizedHeaders, /\b(harga.*f|price.*f|kolom f|harga f|price f)\b/i)
  const percentIndex = findHeaderIndex(normalizedHeaders, /\b(persentase|persen|%|persentase insentif)\b/i)
  const nominalIndex = findHeaderIndex(normalizedHeaders, /\b(nominal|nominal insentif|insentif nominal|value|amount)\b/i)
  const targetIndex = findHeaderIndex(normalizedHeaders, /\b(qty penjualan toko|target qty|target quantity|target|qty target|qty)\b/i)
  const remarkIndex = findHeaderIndex(normalizedHeaders, /\b(remark|catatan|keterangan|note)\b/i)
  const categoryIndex = findHeaderIndex(normalizedHeaders, /\b(kategori|category|product category|type)\b/i)
  const imageIndex = findHeaderIndex(normalizedHeaders, /\b(gambar|image|foto|photo)\b/i)

  const artikel = normalizeText(row[2] ?? row[artikelIndex] ?? '')
  const departemen = normalizeText(row[1] ?? row[departemenIndex] ?? '')
  const name = normalizeText(row[3] ?? row[nameIndex] ?? '')
  const priceE = toNumber(row[4] ?? row[priceEIndex] ?? '')
  const priceF = toNumber(row[5] ?? row[priceFIndex] ?? '')
  const price = priceF > 0 ? priceF : priceE
  const priceSource = priceF > 0 ? 'f' : priceE > 0 ? 'e' : 'none'

  const percentRaw = normalizeText(row[6] ?? row[percentIndex] ?? '')
  const percentValue = percentRaw.replace('%', '').replace(/[^0-9,.-]/g, '')
  const incentivePercent = percentValue ? Number.parseFloat(percentValue.replace(',', '.')) || 0 : 0
  const nominalRaw = normalizeText(row[7] ?? row[nominalIndex] ?? '')
  const incentiveNominal = toNumber(nominalRaw)
  const incentiveIsPercentage = Boolean(percentRaw) && !nominalRaw
  const incentiveValue = incentiveIsPercentage ? Math.round(price * (incentivePercent / 100)) : incentiveNominal
  const targetQty = Number.parseInt(normalizeText(row[13] ?? row[targetIndex] ?? ''), 10)
  const remark = normalizeText(row[14] ?? row[remarkIndex] ?? '')
  const category = normalizeText(row[15] ?? row[categoryIndex] ?? '') || 'Tanpa Kategori'
  const imageUrl = extractImageUrl(row[16] ?? row[imageIndex] ?? '', row, 0)
  const fields = headers.map((header, index) => ({ label: header, value: normalizeText(row[index] ?? '') }))
  return { artikel, name, departemen, price, priceSource, incentivePercent, incentiveNominal, incentiveValue, incentiveIsPercentage, targetQty: Number.isNaN(targetQty) ? undefined : targetQty, remark, category, imageUrl, fields }
}

function parseReceiptRow(row: string[], headers: string[]): IncentiveReceiptRow {
  const normalizedHeaders = headers.map(normalizeText)
  const noIndex = findHeaderIndex(normalizedHeaders, /^no$/i)
  const departemenIndex = findHeaderIndex(normalizedHeaders, /\b(departemen|department|dept|dept grp|department group|nama departemen|name department)\b/i)
  const targetValueIndex = findHeaderIndex(normalizedHeaders, /\b(minimum receipt value|minimum value receipt|target value receipt|target receipt|target value|target|value receipt)\b/i)
  const percentageIndex = findHeaderIndex(normalizedHeaders, [/INCENTIVE\s*%/i, /incentive percentage/i, /persentase insentif/i, /persentase/i, /percentage/i, /insentif/i])

  const no = normalizeText(row[noIndex] ?? '')
  const departemen = normalizeText(row[departemenIndex] ?? '')
  const targetValue = toNumber(row[targetValueIndex] ?? '')
  const percentageRaw = normalizeText(row[percentageIndex] ?? '')
  const percentageValue = percentageRaw.replace('%', '')
  const percentage = percentageValue ? Number.parseFloat(percentageValue.replace(',', '.')) || 0 : 0
  const fields = headers.map((header, index) => ({ label: header, value: normalizeText(row[index] ?? '') }))
  return { no, departemen, targetValue, percentage, fields }
}

export function parseIncentiveSheets(sheets: Record<string, string[][]>): ParsedIncentiveData {
  const conditionalRows: IncentiveConditionalRow[] = []
  const unconditionalRows: IncentiveUnconditionalRow[] = []
  const skuRows: IncentiveSkuRow[] = []
  const syaratRows: IncentiveSyaratRow[] = []
  const boomsaleRows: IncentiveBoomsaleRow[] = []
  const receiptRows: IncentiveReceiptRow[] = []
  const salesRows: IncentiveSalesRow[] = []

  const conditionalSheet = sheets['INSENTIF BERSYARAT'] ?? []
  const unconditionalSheet = sheets['INSENTIF TANPA SYARAT'] ?? []
  const skuSheet = sheets['SKU INSENTIF'] ?? []
  const syaratSheet = sheets['SYARAT INSENTIF'] ?? []
  const boomsaleSheet = sheets['INSENTIF BOOMSALE'] ?? []
  const receiptSheet = sheets['INSENTIF RECEIPT DEPT'] ?? []
  const compareSheet = sheets['COPAS S2'] ?? sheets['COMPARE DATA COPAS S2'] ?? []

  const conditionalHeaders = conditionalSheet[0]?.map(normalizeText) ?? []
  const unconditionalHeaders = unconditionalSheet[0]?.map(normalizeText) ?? []
  const skuHeaders = skuSheet[0]?.map(normalizeText) ?? []
  const syaratHeaders = syaratSheet[0]?.map(normalizeText) ?? []
  const boomsaleHeaders = boomsaleSheet[0]?.map(normalizeText) ?? []
  const receiptHeaders = receiptSheet[0]?.map(normalizeText) ?? []
  const compareHeaders = compareSheet[0]?.map(normalizeText) ?? []

  const compareArtikelIndex = findHeaderIndex(compareHeaders, [/(^|\b)artikel(\b|$)/i, /sku/i])
  const compareQtyIndex = findHeaderIndex(compareHeaders, [/(qty actual|actual qty|actual|qty)/i])
  const compareNikIndex = findHeaderIndex(compareHeaders, /\bnik\b/i)
  const compareNamaIndex = findHeaderIndex(compareHeaders, /\b(nama|name)\b/i)
  const compareProductNameIndex = findHeaderIndex(compareHeaders, /\b(nama produk|product name|deskripsi|description|nama barang|item)\b/i)
  const compareQtyByArtikel = new Map<string, number>()
  const compareActualQtyByArtikel = new Map<string, number>()
  for (const row of compareSheet.slice(1)) {
    if (!row.some(cell => normalizeText(cell))) continue
    const artikel = normalizeText(row[compareArtikelIndex >= 0 ? compareArtikelIndex : 4] ?? '')
    if (!artikel) continue
    const artikelKey = normalizeArticleKey(artikel)
    const resolvedQtyIndex = compareQtyIndex >= 0 ? compareQtyIndex : 7
    const qtyValue = Number.parseInt(normalizeText(row[resolvedQtyIndex] ?? ''), 10)
    const actualQty = Number.isNaN(qtyValue) ? 0 : qtyValue
    const nik = normalizeText(row[compareNikIndex >= 0 ? compareNikIndex : 0] ?? '')
    const nama = normalizeText(row[compareNamaIndex >= 0 ? compareNamaIndex : 1] ?? '')
    const productName = normalizeText(row[compareProductNameIndex >= 0 ? compareProductNameIndex : 5] ?? '')
    compareQtyByArtikel.set(artikelKey, (compareQtyByArtikel.get(artikelKey) ?? 0) + actualQty)
    compareActualQtyByArtikel.set(artikelKey, (compareActualQtyByArtikel.get(artikelKey) ?? 0) + actualQty)
    salesRows.push({ nik, nama, artikel, productName, qty: actualQty > 0 ? actualQty : 0 })
  }

  for (const row of conditionalSheet.slice(1)) {
    if (!row.some(cell => normalizeText(cell))) continue
    const parsedRow = parseConditionalRow(row, conditionalHeaders)
    if (!parsedRow.nik && !parsedRow.nama) continue
    conditionalRows.push(parsedRow)
  }

  for (const row of unconditionalSheet.slice(1)) {
    if (!row.some(cell => normalizeText(cell))) continue
    const parsedRow = parseUnconditionalRow(row, unconditionalHeaders)
    if (!parsedRow.nik && !parsedRow.nama) continue
    unconditionalRows.push(parsedRow)
  }

  for (const row of syaratSheet.slice(1)) {
    if (!row.some(cell => normalizeText(cell))) continue
    const parsedRow = parseSyaratRow(row, syaratHeaders, compareQtyByArtikel)
    if (!parsedRow.jenis && !parsedRow.syarat && !parsedRow.note) continue
    syaratRows.push(parsedRow)
  }

  for (const row of boomsaleSheet.slice(1)) {
    if (!row.some(cell => normalizeText(cell))) continue
    const parsedRow = parseBoomsaleRow(row, boomsaleHeaders)
    if (!parsedRow.artikel && !parsedRow.name) continue
    const actualQty = compareActualQtyByArtikel.get(normalizeArticleKey(parsedRow.artikel))
    if (typeof actualQty === 'number') {
      parsedRow.actualQty = actualQty > 0 ? actualQty : 0
    }
    boomsaleRows.push(parsedRow)
  }

  for (const row of receiptSheet.slice(1)) {
    if (!row.some(cell => normalizeText(cell))) continue
    const parsedRow = parseReceiptRow(row, receiptHeaders)
    if (!parsedRow.departemen) continue
    receiptRows.push(parsedRow)
  }

  const skuPerIndex = findHeaderIndex(skuHeaders, /\bper\b/i)
  for (const [rowIndex, row] of skuSheet.slice(1).entries()) {
    if (!row.some(cell => normalizeText(cell))) continue
    const sku = normalizeText(row[0] ?? '')
    const name = normalizeText(row[1] ?? '')
    const requirement = normalizeText(row[2] ?? '')
    const incentiveValue = toNumber(row[3] ?? '')
    const per = skuPerIndex >= 0 ? normalizeText(row[skuPerIndex] ?? '') : ''
    const imageUrl = extractImageUrl(row[5] ?? '', row, rowIndex)
    if (!sku && !name) continue
    skuRows.push({ sku, name, requirement, incentiveValue, per, imageUrl })
  }

  return {
    conditional: {
      rows: conditionalRows,
      totalTarget: conditionalRows.reduce((acc, row) => acc + row.items.reduce((sum, item) => sum + item.amount, 0), 0),
      totalAchieved: conditionalRows.reduce((acc, row) => acc + row.items.filter(item => item.status.toLowerCase().includes('terpenuhi')).reduce((sum, item) => sum + item.amount, 0), 0),
    },
    unconditional: {
      rows: unconditionalRows,
      totalTarget: unconditionalRows.reduce((acc, row) => acc + row.items.reduce((sum, item) => sum + item.amount, 0), 0),
      totalAchieved: unconditionalRows.reduce((acc, row) => acc + row.items.reduce((sum, item) => sum + item.amount, 0), 0),
    },
    syarat: { rows: syaratRows },
    boomsale: { rows: boomsaleRows },
    receipt: { rows: receiptRows },
    sales: { rows: salesRows },
    sku: {
      rows: skuRows,
      totalTarget: 0,
      totalAchieved: 0,
    },
  }
}
