/**
 * Raw data pipeline:
 * - COPAS S2: raw transactions (NIK, NAMA, TANGGAL, RECEIPT NO, ARTIKEL, DESKRIPSI, KODE, QTY, ..., TOTAL VALUE@L)
 * - KUNCIAN SKU: article→category mapping (TERUS HEMATIK, TEMATIK, NEW PRODUCT, RAINBOW, ITEM STD, PROTEKSI)
 * - TARGET: NIK, NAMA, TARGET_HARIAN (optional — falls back to DEFAULT_TARGET)
 */

import type { DailyTrend, PerformanceData, KPIItem } from '../data/mockData'
import { YTD_PERFORMANCE } from '../data/mockData'
import { getConfiguredColumnIndex } from './columnMappingService'
import { niksMatch, canonicalNik, looksLikeNik } from './nik'

const SHEET_ID = '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38'
const DEFAULT_DAILY_TARGET = 5_000_000

function sheetUrl(name: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}&_t=${Date.now()}`
}

async function fetchCSV(name: string): Promise<string[][]> {
  const res = await fetch(sheetUrl(name), { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok || text.trimStart().startsWith('<!')) throw new Error(`Sheet "${name}" tidak bisa dibaca`)
  return parseCSV(text)
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const cells: string[] = []
    let inQ = false, cell = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { if (inQ && line[i+1] === '"') { cell += '"'; i++ } else { inQ = !inQ } }
      else if (c === ',' && !inQ) { cells.push(cell); cell = '' }
      else { cell += c }
    }
    cells.push(cell)
    rows.push(cells)
  }
  return rows
}

function c(row: string[], idx: number) { return (row[idx] ?? '').trim() }

function numVal(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/Rp\.?\s*/gi, '').replace(/\./g, '').replace(',', '.')) || 0
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  // Indonesian abbreviations
  mei:4, agu:7, okt:9, des:11,
}

function parseDate(s: string): Date | null {
  if (!s) return null
  const str = s.split(' ')[0].trim()

  // Format "D-MMM" atau "D-MMM-YYYY" e.g. "1-Jul", "11-Jul-2026"
  const mAbbr = str.match(/^(\d{1,2})-([A-Za-z]{3})(?:-(\d{4}))?$/i)
  if (mAbbr) {
    const day = +mAbbr[1]
    const mo  = MONTH_MAP[mAbbr[2].toLowerCase()]
    const yr  = mAbbr[3] ? +mAbbr[3] : new Date().getFullYear()
    if (mo !== undefined) return new Date(yr, mo, day)
  }

  // Format "DD/MM/YYYY" atau "DD-MM-YYYY"
  const mNum = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mNum) {
    const a = +mNum[1], b = +mNum[2], y = +mNum[3]
    if (a > 12) return new Date(y, b - 1, a)  // DD/MM/YYYY pasti
    if (b > 12) return new Date(y, a - 1, b)  // M/D/YYYY pasti
    return new Date(y, b - 1, a)              // asumsi DD/MM/YYYY
  }

  // ISO format YYYY-MM-DD
  const mIso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (mIso) {
    const y = +mIso[1], mo = +mIso[2], d = +mIso[3]
    return new Date(y, mo - 1, d)
  }

  return null
}

// gviz US format fallback (M/D/YYYY)
function parseDateUS(s: string): Date | null {
  if (!s) return null
  const m = s.split(' ')[0].match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (!m) return null
  return new Date(+m[3], +m[1] - 1, +m[2])
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

// ─── Raw transaction row ──────────────────────────────────────────────────────

interface RawTxn {
  nik: string; nama: string; tanggal: string; date: Date | null
  receiptNo: string; artikel: string; qty: number; totalValue: number
}

// ─── SKU category sets ────────────────────────────────────────────────────────

interface SkuMap {
  proteksi:   Set<string>
  newProduct: Set<string>
  categories: Array<{ name: string; articles: Set<string> }>
}

// ─── Fetch KUNCIAN SKU ────────────────────────────────────────────────────────
// Row 0 = header names (dynamic: TERUS HEMATIK, TEMATIK, NEW PRODUCT, SKU PRODUK, RAINBOW SKU, ITEM STD, PROTEKSI, ...)
// Row 1+ = article codes per column

export async function fetchSkuMap(): Promise<SkuMap> {
  const raw = await fetchCSV('KUNCIAN SKU')
  if (raw.length === 0) return { proteksi: new Set(), newProduct: new Set(), categories: [] }

  // Build dynamic category sets from header row
  const headers = raw[0].map(h => h.trim())
  const categories = headers.map(name => ({ name, articles: new Set<string>() }))

  for (const row of raw.slice(1)) {
    row.forEach((val, ci) => {
      const v = val.trim()
      if (v && categories[ci]) categories[ci].articles.add(v)
    })
  }

  // Find category by header name (case-insensitive partial match)
  const find = (keyword: string): Set<string> => {
    const cat = categories.find(cat => cat.name.toLowerCase().includes(keyword.toLowerCase()))
    return cat?.articles ?? new Set<string>()
  }

  console.warn('[ATLAS SKU] Headers:', headers.join(' | '))
  console.warn('[ATLAS SKU] Kolom:', categories.map(cat => `${cat.name}(${cat.articles.size} SKU)`).join(', '))

  return {
    categories,
    proteksi:   find('proteksi'),
    newProduct: find('new product'),
  }
}

// ─── Fetch COPAS S2 ───────────────────────────────────────────────────────────
// Row 1 = header, Row 2+ = data
// A=NIK, B=NAMA, C=TANGGAL, D=RECEIPT NO, E=ARTIKEL, F=DESKRIPSI, G=KODE, H=QTY, L=TOTAL VALUE

// Fetch NIK->NAMA mapping dari ATLAS DATABASE atau COPAS sheet sebagai fallback
async function fetchNikNameMapping(): Promise<Map<string, string>> {
  try {
    // Try ATLAS DATABASE first (punya explicit NIK-NAMA mapping)
    let raw = await fetchCSV('ATLAS DATABASE').catch(() => null)
    
    if (!raw) {
      // Fallback ke COPAS (aggregated sheet)
      raw = await fetchCSV('COPAS')
    }
    
    if (!raw) {
      console.warn('[NIK Mapping] Neither ATLAS DATABASE nor COPAS available')
      return new Map()
    }
    
    const nikNameMap = new Map<string, string>()
    
    // Sheet structure: A=NIK, B=NAMA, ...
    for (const row of raw.slice(1)) {
      const nik = c(row, 0).trim()
      const nama = c(row, 1).trim()
      // Support: 101902 (digit 1 + 4 more digits) or I01902 (letter I + 5 digits)
      if (nik && nama && /^(I\d{5}|\d{4,})$/i.test(nik)) {
        nikNameMap.set(nik, nama)
      }
    }
    
    // Fallback: jika target names tidak semua ditemukan, coba USERS sheet
    let found = 0
    for (const [, nama] of nikNameMap) {
      if (nama.includes('GWEN') || nama.includes('ADITYA') || nama.includes('ROZIAN')) found++
    }
    
    if (found < 3) {
      console.warn('[NIK Mapping] Incomplete target names in primary source, checking USERS sheet...')
      try {
        const usersRaw = await fetchCSV('USERS').catch(() => null)
        if (usersRaw) {
          for (const row of usersRaw.slice(1)) {
            const nik = c(row, 0).trim()
            const nama = c(row, 1).trim()
            if (nik && nama && /^(I\d{5}|\d{4,})$/i.test(nik)) {
              // Only add if not already in map (ATLAS takes precedence)
              if (!nikNameMap.has(nik)) {
                nikNameMap.set(nik, nama)
              }
            }
          }
          console.warn('[NIK Mapping] Added from USERS sheet, total now:', nikNameMap.size)
        }
      } catch (e2) {
        console.warn('[NIK Mapping] USERS sheet fallback failed:', e2)
      }
    }
    
    console.warn('[NIK Mapping] Loaded:', nikNameMap.size, 'entries')
    // Log sample entries
    const debugEntries = Array.from(nikNameMap.entries()).slice(0, 5)
    console.warn('[NIK Mapping] Sample:', debugEntries.map(([k,v]) => `${k}→${v}`).join(', '))
    // Check target names
    found = 0
    for (const [nik, nama] of nikNameMap) {
      if (nama.includes('GWEN') || nama.includes('ADITYA') || nama.includes('ROZIAN')) {
        console.warn(`[NIK Mapping] TARGET: ${nik} = ${nama}`)
        found++
      }
    }
    console.warn(`[NIK Mapping] Found ${found} target names (GWEN/ADITYA/ROZIAN)`)
    // Hardcoded fallbacks for known mixed-format NIKs that sometimes
    // appear blank or with an I-prefix in the COPAS S2 sheet export.
    // This ensures the parser can associate sales rows (even if A is empty)
    // to the correct numeric NIK used throughout the app.
    const hardcoded: Record<string, string> = {
      'GWEN MALIKA': '101902', // I01902
      'ADITYA PUTRA': '101903',       // I01903
      'MOCH.ROZIAN NAUFAL': '101904',     // I01904
    }
    for (const [name, nik] of Object.entries(hardcoded)) {
      if (!nikNameMap.has(nik)) {
        console.warn(`[NIK Mapping] Adding hardcoded fallback: ${nik} -> ${name}`)
        nikNameMap.set(nik, name)
      }
    }

    return nikNameMap
  } catch (e) {
    console.warn('[NIK Mapping] Failed:', e)
    return new Map()
  }
}



function normalizeNameForMatch(s: string): string {
  return s.toUpperCase().replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ').trim()
}

function looksLikeDateHeader(value: string): boolean {
  const s = value.trim()
  return /^\d{1,2}[\/\-\.](\d{1,2}|[A-Za-z]{3})[\/\-\.](\d{4})?$/.test(s)
}

function parseMatrixDailySheet(rows: string[][], nikNameMap: Map<string, string>): RawTxn[] {
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.trim())
  const nikIdx = headers.findIndex(h => h.toUpperCase() === 'NIK')
  const namaIdx = headers.findIndex(h => h.toUpperCase() === 'NAMA')
  const dateIndices = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => looksLikeDateHeader(header))
    .map(({ index }) => index)

  if (dateIndices.length === 0) return []

  const nameToNik = new Map<string, string>()
  for (const row of rows.slice(1)) {
    const nik = c(row, nikIdx)
    const nama = c(row, namaIdx)
    if (nik && nama) {
      nameToNik.set(normalizeNameForMatch(nama), canonicalNik(nik))
    }
  }

  const resolveNik = (row: string[]) => {
    const rawNik = c(row, nikIdx)
    if (rawNik) return canonicalNik(rawNik)

    const nama = c(row, namaIdx)
    if (!nama) return ''

    const normalizedNama = normalizeNameForMatch(nama)
    if (nameToNik.has(normalizedNama)) return nameToNik.get(normalizedNama) ?? ''

    for (const [mappedNik, mappedNama] of nikNameMap) {
      if (normalizeNameForMatch(mappedNama) === normalizedNama) {
        return canonicalNik(mappedNik)
      }
    }

    return ''
  }

  const txns: RawTxn[] = []
  for (const row of rows.slice(1)) {
    const nik = resolveNik(row)
    const nama = c(row, namaIdx)
    if (!nik || !nama) continue

    for (const idx of dateIndices) {
      const rawValue = c(row, idx)
      const val = Number.parseFloat(rawValue.replace(/[^0-9.-]/g, '')) || 0
      if (val <= 0) continue

      txns.push({
        nik,
        nama,
        tanggal: headers[idx],
        date: parseDate(headers[idx]),
        receiptNo: '',
        artikel: '',
        qty: val,
        totalValue: val,
      })
    }
  }

  return txns
}

export async function fetchRawTransactions(): Promise<{ txns: RawTxn[], debugRows: string[] }> {
  const nikNameMap = await fetchNikNameMapping()
  const candidates = ['COPAS S2', 'COPAS', 'COPAS S2 ', 'COPAS S2 (1)', 'COPAS S2 (2)', 'RAW DATA', 'TRANSAKSI', 'DAILY SALES']

  const debugRows: string[] = []
  let raw: string[][] | null = null
  let usedSheet = ''

  // Prefer a "raw" row-based sheet (has TANGGAL / RECEIPT) over a
  // matrix-style sheet (dates as columns). If no raw sheet is found,
  // fall back to the first matrix-style candidate.
  let matrixFallback: { rows: string[][]; name: string } | null = null
  for (const candidate of candidates) {
    try {
      const candidateRows = await fetchCSV(candidate)
      const firstRow = candidateRows[0]?.map(v => v.trim()) ?? []
      const isReferenceSheet = candidateRows.some(row => row.some(cell => cell.includes('#REF!')))
      const headerText = firstRow.join(' | ').toUpperCase()
      const looksLikeMatrix = firstRow.some(h => looksLikeDateHeader(h)) && headerText.includes('NIK') && headerText.includes('NAMA')
      const looksLikeRaw = firstRow.some(h => h.toUpperCase().includes('TANGGAL')) || firstRow.some(h => h.toUpperCase().includes('RECEIPT'))

      if (!candidateRows.length || isReferenceSheet) continue
      if (looksLikeRaw) {
        raw = candidateRows
        usedSheet = candidate
        break
      }
      if (looksLikeMatrix && !matrixFallback) {
        matrixFallback = { rows: candidateRows, name: candidate }
      }
    } catch {
      // Try next candidate sheet name
    }
  }

  if (!raw && matrixFallback) {
    raw = matrixFallback.rows
    usedSheet = matrixFallback.name
  }

  if (!raw) {
    debugRows.push('Tidak ada sheet transaksi yang valid ditemukan')
    return { txns: [], debugRows }
  }

  debugRows.push(`Source transaksi: ${usedSheet}`)
  for (let i = 0; i < Math.min(4, raw.length); i++) {
    debugRows.push(`Row${i}: ${raw[i].slice(0, 8).map((v,ci) => `[${ci}]=${v||'∅'}`).join(' ')}`)
  }

  const headers = raw[0]?.map((h) => h.trim().toUpperCase()) ?? []
  const headerText = headers.join(' | ')
  const looksLikeMatrix = headers.some(h => looksLikeDateHeader(h)) && headerText.includes('NIK') && headerText.includes('NAMA')

  if (looksLikeMatrix) {
    const txns = parseMatrixDailySheet(raw, nikNameMap)
    debugRows.push(`Parsed as matrix daily sheet: ${txns.length} transaksi`)
    return { txns, debugRows }
  }

  // Auto-detect baris data: cari baris pertama di mana kolom A berisi angka ≥ 4 digit (format NIK)
  // Row0 = header, Row1+ = data tapi NIK hanya di baris pertama tiap blok (sparse/fill-down)
  let dataStart = 1  // skip header row
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    if (/^[A-Z]/.test((raw[i][0] ?? '').trim())) { dataStart = i + 1; break }
  }
  debugRows.push(`dataStart: baris ${dataStart}`)

  // Find NIK column dynamically from header
  let nikIdx = headers.findIndex(h => h.includes('NIK'))
  if (nikIdx < 0) nikIdx = getConfiguredColumnIndex('COPAS S2', 'COPAS_S2_NIK', 0)

  // FILL-DOWN NIK: NIK hanya terisi di baris pertama tiap karyawan, baris selanjutnya kosong
  let lastNik  = ''
  let lastNama = ''
  const txns: RawTxn[] = []

  const namaIdx = getConfiguredColumnIndex('COPAS S2', 'COPAS_S2_NAMA', 1)
  const tanggalIdx = getConfiguredColumnIndex('COPAS S2', 'COPAS_S2_TANGGAL', 2)
  const receiptIdx = getConfiguredColumnIndex('COPAS S2', 'COPAS_S2_RECEIPT_NO', 3)
  const artikelIdx = getConfiguredColumnIndex('COPAS S2', 'COPAS_S2_ARTIKEL', 4)
  const qtyIdx = getConfiguredColumnIndex('COPAS S2', 'COPAS_S2_QTY', 7)
  const totalValueIdx = getConfiguredColumnIndex('COPAS S2', 'COPAS_S2_TOTAL_VALUE', 11)

  for (const row of raw.slice(dataStart)) {
    const nikVal  = c(row, nikIdx)
    const namaVal = c(row, namaIdx)
    const tgl     = c(row, tanggalIdx)

    // Row NONAME = transaksi sistem/retur tanpa pemilik — reset fill-down agar tidak terpakai
    if (namaVal.toUpperCase() === 'NONAME') { lastNik = ''; lastNama = ''; continue }

    // Update NIK & NAMA kalau ada nilai baru
    // Accept: \d{4,} (pure digits) or I\d{5} (I-prefix format like I01902)
    if (/^(I\d{5}|\d{4,})$/i.test(nikVal)) lastNik = canonicalNik(nikVal)
    if (namaVal && namaVal !== lastNama && !/^\d/.test(namaVal)) lastNama = namaVal.replace(/^[A-Z]{2,3}-/i, '').trim()

    // Fallback: Kalau NIK kosong tapi NAMA ada, cari NIK dari nikNameMap
    if (!lastNik && lastNama && nikNameMap.size > 0) {
      const normalizedLastNama = normalizeNameForMatch(lastNama)
      let found = false
      for (const [nik, nama] of nikNameMap) {
        if (normalizeNameForMatch(nama) === normalizedLastNama) {
          lastNik = nik
          found = true
          console.warn(`[COPAS S2 Fallback] Match: "${lastNama}" → NIK "${nik}"`)
          break
        }
      }
      if (!found && (lastNama.includes('GWEN') || lastNama.includes('ADITYA') || lastNama.includes('ROZIAN'))) {
        console.warn(`[COPAS S2 Fallback] NO EXACT MATCH for "${lastNama}"`)
        for (const [nik, nama] of nikNameMap) {
          const normNama = normalizeNameForMatch(nama)
          if (normNama.includes(normalizedLastNama) || normalizedLastNama.includes(normNama)) {
            lastNik = nik
            console.warn(`[COPAS S2 Fallback] Fuzzy match: "${lastNama}" → NIK "${nik}"`)
            break
          }
        }
      }
    }

    // Skip kalau NIK belum terisi atau tidak ada tanggal
    if (!lastNik || !tgl) continue

    // Skip transaksi dengan nilai negatif (retur sistem, bukan transaksi penjualan)
    const tv = numVal(c(row, totalValueIdx))
    if (tv < 0) continue

    txns.push({
      nik:        lastNik,
      nama:       lastNama,
      tanggal:    tgl,
      date:       null,
      receiptNo:  c(row, receiptIdx),
      artikel:    c(row, artikelIdx),
      qty:        numVal(c(row, qtyIdx)),
      totalValue: tv,
    })
  }

  return { txns, debugRows }
}


// ─── Fetch SETTING ────────────────────────────────────────────────────────────
// Sheet SETTING: A=SECTION, B=NAMA, C=AKTIF, D=TARGET_TYPE, E=TARGET_VALUE, F=UNIT, G=KETERANGAN
// SECTION: KPI | KATEGORI
// TARGET_TYPE: sheet | per_trx | pct_harian | per_hari | tetap

export interface KPISetting {
  section: 'KPI' | 'KATEGORI'
  nama: string
  aktif: boolean
  targetType: 'sheet' | 'per_trx' | 'pct_harian' | 'per_hari' | 'tetap'
  targetValue: number
  unit: string
  keterangan: string
}

export async function fetchSettings(): Promise<KPISetting[]> {
  try {
    const rows = await fetchCSV('SETTING')
    if (rows.length < 2) return []

    const sectionIdx = getConfiguredColumnIndex('SETTING', 'SETTING_SECTION', 0)
    const namaIdx = getConfiguredColumnIndex('SETTING', 'SETTING_NAMA', 1)
    const aktifIdx = getConfiguredColumnIndex('SETTING', 'SETTING_AKTIF', 2)
    const targetTypeIdx = getConfiguredColumnIndex('SETTING', 'SETTING_TARGET_TYPE', 3)
    const targetValueIdx = getConfiguredColumnIndex('SETTING', 'SETTING_TARGET_VALUE', 4)
    const unitIdx = getConfiguredColumnIndex('SETTING', 'SETTING_UNIT', 5)
    const keteranganIdx = getConfiguredColumnIndex('SETTING', 'SETTING_KETERANGAN', 6)

    return rows.slice(1)
      .map(row => ({
        section: (c(row, sectionIdx).toUpperCase()) as 'KPI' | 'KATEGORI',
        nama:         c(row, namaIdx),
        aktif:        c(row, aktifIdx).toUpperCase() !== 'FALSE',
        targetType:   (c(row, targetTypeIdx).toLowerCase() || 'tetap') as KPISetting['targetType'],
        targetValue:  parseFloat(c(row, targetValueIdx).replace(',', '.')) || 0,
        unit:         c(row, unitIdx).toLowerCase(),
        keterangan:   c(row, keteranganIdx),
      }))
      .filter(s => (s.section === 'KPI' || s.section === 'KATEGORI') && s.nama)
  } catch {
    return []
  }
}

// ─── Fetch Menu Config dari SETTING sheet ─────────────────────────────────────
// Baris format: CONFIG | MENU_FORECASTING | FALSE | keterangan
// Berlaku global untuk semua device yang baca sheet ini
export async function fetchMenuConfig(): Promise<Record<string, boolean>> {
  try {
    const rows = await fetchCSV('SETTING')
    const cfg: Record<string, boolean> = {}
    const sectionIdx = getConfiguredColumnIndex('SETTING', 'SETTING_SECTION', 0)
    const namaIdx = getConfiguredColumnIndex('SETTING', 'SETTING_NAMA', 1)
    const aktifIdx = getConfiguredColumnIndex('SETTING', 'SETTING_AKTIF', 2)
    for (const row of rows) {
      const section = c(row, sectionIdx).toUpperCase().trim()
      const key     = c(row, namaIdx).toUpperCase().trim()
      const val     = c(row, aktifIdx).toUpperCase().trim()
      if (section === 'CONFIG' && key.startsWith('MENU_')) {
        // MENU_FORECASTING → 'forecasting'
        cfg[key.replace('MENU_', '').toLowerCase()] = val !== 'FALSE'
      }
    }
    return cfg
  } catch {
    return {}
  }
}

// ─── Fetch TARGET ─────────────────────────────────────────────────────────────
// Sheet TARGET: A=NIK, B=NAMA, C=TARGET SALES DAILY, D=TARGET SALES BULAN, E=TARGET TRANSAKSI DAILY, F=TARGET TRANSAKSI MONTHLY, G=TARGET BASKET SIZE DAILY, H=TARGET BASKET SIZE MONTHLY

export interface TargetData {
  daily: number; monthly: number; nama?: string; jobTitle?: string
  targetTrxDaily?:   number  // kolom E — target transaksi harian
  targetTrxMonthly?: number  // kolom F — target transaksi bulanan
  targetBasketSizeDaily?:   number  // kolom G — target basket size harian
  targetBasketSizeMonthly?: number  // kolom H — target basket size bulanan
}

function setTargetEntry(map: Map<string, TargetData>, key: string, entry: TargetData): void {
  if (!key) return
  if (map.has(key)) return
  map.set(key, entry)
}

export async function fetchTargets(): Promise<Map<string, TargetData>> {
  try {
    console.warn('[TARGET] fetching...')
    const raw = await fetchCSV('TARGET')
    const nikNameMapping = await fetchNikNameMapping()  // Get ATLAS DATABASE mapping for reverse lookup
    const headers = (raw[0] ?? []).map(value => value.trim().toUpperCase())

    const findTargetHeaderIndex = (patterns: RegExp[], fallbackIndex: number): number => {
      const headerIndex = headers.findIndex(header => patterns.some(pattern => pattern.test(header)))
      return headerIndex >= 0 ? headerIndex : fallbackIndex
    }
    
    console.warn('[TARGET] rows:', raw.length, '| tail 5 col0:', raw.slice(-5).map(r=>JSON.stringify(r[0])+'/'+JSON.stringify(r[1])).join(', '))
    // Log baris dengan NIK kosong (intern biasanya null di gviz)
    const emptyNikRows = raw.slice(1).filter(r => !c(r, 0) && c(r, 1))
    if (emptyNikRows.length > 0) console.warn('[TARGET] Baris NIK kosong (nama-only):', emptyNikRows.map(r=>JSON.stringify(c(r,1))).join(', '))
    const normN = (s: string) => s.toUpperCase().replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ').trim()
    const map = new Map<string, TargetData>()
    const nikIdx = findTargetHeaderIndex([/^NIK$/i], getConfiguredColumnIndex('TARGET', 'TARGET_NIK', 0))
    const namaIdx = findTargetHeaderIndex([/^NAMA$/i, /^NAME$/i], getConfiguredColumnIndex('TARGET', 'TARGET_NAMA', 1))
    const dailyIdx = findTargetHeaderIndex([/TARGET SALES DAILY/i, /TARGET HARIAN/i], getConfiguredColumnIndex('TARGET', 'TARGET_DAILY', 2))
    const monthlyIdx = findTargetHeaderIndex([/TARGET SALES BULAN/i, /TARGET SATU BULAN/i, /TARGET MONTH/i], getConfiguredColumnIndex('TARGET', 'TARGET_MONTHLY', 3))
    const trxDailyIdx = findTargetHeaderIndex([/TARGET TRANSAKSI DAILY/i, /TARGET TRX DAILY/i], getConfiguredColumnIndex('TARGET', 'TARGET_TRX_DAILY', 4))
    const trxMonthlyIdx = findTargetHeaderIndex([/TARGET TRANSAKSI BULAN/i, /TARGET TRANSAKSI SATU BULAN/i, /TARGET TRX MONTH/i], getConfiguredColumnIndex('TARGET', 'TARGET_TRX_MONTHLY', 5))
    const basketSizeDailyIdx = findTargetHeaderIndex([/TARGET BASKET SIZE DAILY/i], getConfiguredColumnIndex('TARGET', 'TARGET_BASKET_SIZE_DAILY', 6))
    const basketSizeMonthlyIdx = findTargetHeaderIndex([/TARGET BASKET SIZE BULAN/i, /TARGET BASKET SIZE SATU BULAN/i, /TARGET BASKET SIZE MONTH/i], getConfiguredColumnIndex('TARGET', 'TARGET_BASKET_SIZE_MONTHLY', 7))
    const jobTitleIdx = findTargetHeaderIndex([/JOB TITLE/i, /JABATAN/i], getConfiguredColumnIndex('TARGET', 'TARGET_JOB_TITLE', 8))

    for (const row of raw.slice(1)) {
      let nik  = c(row, nikIdx)
      const nama = c(row, namaIdx).replace(/^[A-Z]{2,3}-/i, '').trim()
      const daily          = numVal(c(row, dailyIdx))
      const monthly        = numVal(c(row, monthlyIdx)) || daily * 26
      const targetTrxDaily   = numVal(c(row, trxDailyIdx)) || 0
      const targetTrxMonthly = numVal(c(row, trxMonthlyIdx)) || 0
      const targetBasketSizeDaily = numVal(c(row, basketSizeDailyIdx)) || 0
      const targetBasketSizeMonthly = numVal(c(row, basketSizeMonthlyIdx)) || 0
      const jobTitle         = c(row, jobTitleIdx) || ''
      if (daily <= 0) continue
      
      // Jika NIK kosong di TARGET sheet, cari NIK dari ATLAS DATABASE menggunakan nama
      if (!nik && nama && nikNameMapping.size > 0) {
        const normalizedNama = normN(nama)
        for (const [mappedNik, mappedNama] of nikNameMapping) {
          if (normN(mappedNama) === normalizedNama) {
            nik = mappedNik
            console.warn(`[TARGET fallback] NAMA "${nama}" → NIK "${nik}" dari ATLAS`)
            break
          }
        }
      }
      
      const entry: TargetData = { daily, monthly, nama, jobTitle,
        targetTrxDaily:   targetTrxDaily   || undefined,
        targetTrxMonthly: targetTrxMonthly || undefined,
        targetBasketSizeDaily: targetBasketSizeDaily || undefined,
        targetBasketSizeMonthly: targetBasketSizeMonthly || undefined,
      }
      // Simpan by NIK (kalau NIK terbaca oleh gviz atau sudah ditemukan dari fallback)
      // Support: I01902 (I + 5 digits) atau 101902+ (4+ digits)
      if (nik && /^(I\d{5}|\d{4,})$/i.test(nik)) {
        setTargetEntry(map, nik, entry)
        setTargetEntry(map, canonicalNik(nik), entry)
      }
      // Selalu simpan by NAMA sebagai fallback (nama biasanya terbaca meski NIK null)
      if (nama) setTargetEntry(map, `NAMA:${normN(nama)}`, entry)
    }
    return map
  } catch (e) {
    console.warn('[TARGET] ERROR:', e)
    return new Map()
  }
}

// ─── Fetch MEMBER ─────────────────────────────────────────────────────────────
// Sheet MEMBER has 2 tables:
// Table 1: B=TANGGAL, E=type (count rows where E="NEW MEMBER"), F=NAMA
// Table 2: H=TANGGAL, J=NIK, K=NEW MEMBER (count value)

interface MemberEntry { date: Date; nikOrNama: string; count: number; byNik: boolean }

export async function fetchMemberData(): Promise<MemberEntry[]> {
  try {
    const raw = await fetchCSV('MEMBER')
    const entries: MemberEntry[] = []
    const table1TanggalIdx = getConfiguredColumnIndex('MEMBER', 'MEMBER_TABLE1_TANGGAL', 1)
    const table1LabelIdx = getConfiguredColumnIndex('MEMBER', 'MEMBER_TABLE1_LABEL', 4)
    const table1NamaIdx = getConfiguredColumnIndex('MEMBER', 'MEMBER_TABLE1_NAMA', 5)
    const table2TanggalIdx = getConfiguredColumnIndex('MEMBER', 'MEMBER_TABLE2_TANGGAL', 7)
    const table2NikIdx = getConfiguredColumnIndex('MEMBER', 'MEMBER_TABLE2_NIK', 9)
    const table2CountIdx = getConfiguredColumnIndex('MEMBER', 'MEMBER_TABLE2_COUNT', 10)

    // Skip header row — find it by looking for 'TANGGAL' in the configured date columns
    const dataStart = raw.findIndex(r =>
      c(r, table1TanggalIdx).toUpperCase().includes('TANGGAL') || c(r, table2TanggalIdx).toUpperCase().includes('TANGGAL')
    )
    const rows = raw.slice(dataStart >= 0 ? dataStart + 1 : 1)

    for (const row of rows) {
      // ── Table 1 ───────────────────────────────────────────────────────
      const tgl1   = c(row, table1TanggalIdx)
      const label1 = c(row, table1LabelIdx).toUpperCase()
      const nama   = c(row, table1NamaIdx)
      if (tgl1 && label1.includes('NEW MEMBER') && nama) {
        const date = parseDate(tgl1) ?? parseDateUS(tgl1)
        if (date) entries.push({ date, nikOrNama: nama.toUpperCase(), count: 1, byNik: false })
      }

      // ── Table 2 ───────────────────────────────────────────────────────
      const tgl2   = c(row, table2TanggalIdx)
      const nik    = c(row, table2NikIdx)
      const kVal   = c(row, table2CountIdx)
      if (tgl2 && nik && kVal) {
        const numK = numVal(kVal)
        const count = numK > 0 ? numK : kVal.toUpperCase().includes('NEW MEMBER') ? 1 : 0
        if (count > 0) {
          const date = parseDate(tgl2) ?? parseDateUS(tgl2)
          if (date) entries.push({ date, nikOrNama: nik, count, byNik: true })
        }
      }
    }
    return entries
  } catch {
    return []
  }
}

// ─── Aggregate transactions for a set of employees ───────────────────────────

interface EmpPerf {
  nik: string; nama: string
  sales: number; qty: number; transaksi: number
  basketSize: number; upt: number; aur: number
  newMember:     number
  categorySales: Record<string, number>  // category name → total value (Rp)
  categoryQty:   Record<string, number>  // category name → sum of qty
}

function aggregate(txns: RawTxn[], skuMap: SkuMap): EmpPerf[] {
  // Build article→category index for fast lookup
  const articleToCategories = new Map<string, string[]>()
  for (const cat of skuMap.categories) {
    for (const art of cat.articles) {
      const existing = articleToCategories.get(art) ?? []
      existing.push(cat.name)
      articleToCategories.set(art, existing)
    }
  }

  const byNik = new Map<string, {
    nik: string; nama: string; sales: number; qty: number
    receipts: Set<string>
    categorySales: Map<string, number>
    categoryQty:   Map<string, number>
  }>()

  for (const t of txns) {
    if (!t.nik) continue
    if (!byNik.has(t.nik)) {
      byNik.set(t.nik, {
        nik: t.nik, nama: t.nama, sales: 0, qty: 0,
        receipts: new Set(),
        categorySales: new Map(),
        categoryQty:   new Map(),
      })
    }
    const e = byNik.get(t.nik)!
    e.sales += t.totalValue
    e.qty   += t.qty
    if (t.receiptNo) e.receipts.add(t.receiptNo)

    const cats = articleToCategories.get(t.artikel)
    if (cats) {
      for (const catName of cats) {
        e.categorySales.set(catName, (e.categorySales.get(catName) ?? 0) + t.totalValue)
        e.categoryQty.set(catName,   (e.categoryQty.get(catName)   ?? 0) + t.qty)
      }
    }
  }

  return [...byNik.values()].map(e => {
    const tr = e.receipts.size
    const categorySales: Record<string, number> = {}
    const categoryQty:   Record<string, number> = {}
    for (const [name, val] of e.categorySales) categorySales[name] = val
    for (const [name, val] of e.categoryQty)   categoryQty[name]   = val
    return {
      nik: e.nik, nama: e.nama,
      sales:       e.sales,
      qty:         e.qty,
      transaksi:   tr,
      newMember:   0,  // filled after merging MEMBER sheet
      categorySales,
      categoryQty,
      basketSize:  tr > 0 ? Math.round(e.sales / tr) : 0,
      upt:         tr > 0 ? Math.round(e.qty / tr) : 0,
      aur:         e.qty > 0 ? Math.round(e.sales / e.qty) : 0,
    }
  })
}

// ─── Build PerformanceData from aggregated data ───────────────────────────────

function makeKPIs(
  e: EmpPerf,
  dailyTarget: number,
  isMTD: boolean,
  workingDays: number,
  categories: SkuMap['categories'],
  tgtData?: TargetData,
  settings: KPISetting[] = [],
): KPIItem[] {
  const days         = isMTD ? workingDays : 1
  const trxDailyBase = tgtData?.targetTrxDaily || Math.max(1, Math.round(dailyTarget / 450_000))
  const targetTr     = Math.max(1, trxDailyBase * days)
  const targetBsBase = tgtData?.targetBasketSizeDaily ?? Math.round(dailyTarget * 0.7)

  const kpiSettings = settings.filter(s => s.section === 'KPI' && s.aktif)
  const katSettings = settings.filter(s => s.section === 'KATEGORI')
  const normalizeKpiName = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

  // Hitung target dari sebuah setting row
  function calcBaseTarget(s: KPISetting, sheetBase: number): number {
    switch (s.targetType) {
      case 'sheet':      return Math.max(1, sheetBase)
      case 'per_trx':    return Math.max(1, Math.round(targetTr * s.targetValue))
      case 'pct_harian': return Math.max(1, Math.round(dailyTarget * s.targetValue * days))
      case 'per_hari':   return Math.max(1, Math.round(s.targetValue * days))
      case 'tetap':      return Math.max(1, s.targetValue)
    }
  }

  const targetUpt = 5
  const targetQty = Math.max(1, Math.round(targetUpt * targetTr))
  const targetAur = 200000

  function calcTarget(s: KPISetting): number {
    const normalizedName = normalizeKpiName(s.nama)
    if (normalizedName === 'transaksi') return targetTr
    if (normalizedName === 'qty item' || normalizedName === 'qty') return targetQty
    if (normalizedName === 'aur') return targetAur
    if (normalizedName === 'upt') return targetUpt
    if (normalizedName === 'basket size') return Math.max(1, targetBsBase)
    return calcBaseTarget(s, targetTr)
  }

  // Mapping nama KPI → nilai aktual dari EmpPerf
  const KPI_VAL: Record<string, number> = {
    'transaksi': e.transaksi, 'qty item': e.qty, 'qty': e.qty,
    'aur': e.aur, 'upt': e.upt,
    'basket size': e.basketSize, 'new member': e.newMember,
  }

  // ── KPI Utama ──
  let kpis: KPIItem[]
  if (kpiSettings.length > 0) {
    kpis = kpiSettings.map(s => ({
      label:  s.nama,
      value:  KPI_VAL[s.nama.toLowerCase()] ?? 0,
      target: calcTarget(s),
      unit:   s.unit,
    }))
  } else {
    // fallback hardcoded jika SETTING belum ada
    kpis = [
      { label: 'Transaksi',   value: e.transaksi,  target: targetTr,                      unit: 'trx'  },
      { label: 'Qty Item',    value: e.qty,         target: targetQty,                     unit: 'item' },
      { label: 'AUR',         value: e.aur,         target: targetAur,                     unit: 'Rp'   },
      { label: 'UPT',         value: e.upt,         target: targetUpt,                     unit: 'x'    },
      { label: 'Basket Size', value: e.basketSize,  target: Math.max(1, targetBsBase),     unit: 'Rp'   },
      { label: 'New Member',  value: e.newMember,   target: Math.max(1, 2 * days),         unit: 'org'  },
    ]
  }

  // ── Kategori SKU ──
  for (const cat of categories) {
    if (!cat.name) continue
    const lower = cat.name.toLowerCase()

    // Cari setting yang cocok berdasarkan keyword (case-insensitive, partial match)
    const setting = katSettings.find(s => {
      const sL = s.nama.toLowerCase()
      return lower.includes(sL) || sL.split(' ').some(w => w.length > 3 && lower.includes(w))
    })

    let catTarget: number
    let unit: string

    if (setting) {
      if (!setting.aktif) continue
      catTarget = calcTarget(setting)
      unit      = setting.unit
    } else {
      // fallback hardcoded per keyword
      const isProteksi = lower.includes('proteksi')
      const isIU       = lower.includes('instant')
      if (isProteksi)   { catTarget = Math.max(1, 2 * days); unit = 'qty' }
      else if (isIU)    { catTarget = Math.max(1, 1 * days); unit = 'iu'  }
      else if (lower.includes('new product')) { catTarget = Math.round(dailyTarget * 0.15 * days); unit = 'Rp' }
      else if (lower.includes('tematik'))     { catTarget = Math.round(dailyTarget * 0.10 * days); unit = 'Rp' }
      else if (lower.includes('fokus'))       { catTarget = Math.round(dailyTarget * 0.10 * days); unit = 'Rp' }
      else if (lower.includes('tebus'))       { catTarget = Math.round(dailyTarget * 0.03 * days); unit = 'Rp' }
      else if (lower.includes('krisbow'))     { catTarget = Math.round(dailyTarget * 0.05 * days); unit = 'Rp' }
      else                                    { catTarget = Math.round(dailyTarget * 0.10 * days); unit = 'Rp' }
    }

    const isQty = unit === 'qty' || unit === 'iu'
    kpis.push({
      label:  cat.name,
      value:  Math.max(0, isQty ? (e.categoryQty[cat.name] ?? 0) : (e.categorySales[cat.name] ?? 0)),
      target: catTarget,
      unit,
    })
  }
  return kpis
}

// Strip store/cost-center prefixes (KR-, KS-, KB-, dll) dari nama
function cleanNama(raw: string): string {
  return raw.replace(/^[A-Z]{2,3}-/i, '').trim()
}

function findTargetByNik(targets: Map<string, TargetData>, nik: string): TargetData | undefined {
  // Coba exact match terlebih dahulu
  const exact = targets.get(nik)
  if (exact) return exact

  const canonical = canonicalNik(nik)
  const canonicalExact = targets.get(canonical)
  if (canonicalExact) return canonicalExact

  // Coba NIK matching untuk format variants (I01902 vs 101902)
  for (const [key, value] of targets.entries()) {
    if (key.startsWith('NAMA:')) continue
    if (niksMatch(key, nik)) return value
  }

  return undefined
}

function buildRanking(
  perfs: EmpPerf[],
  targets: Map<string, TargetData>,
  workingDays = 1,
  includeZeroSales = false,
  ensureNik?: string,
) {
  const completedPerfs = [...perfs]

  if (includeZeroSales && ensureNik) {
    const ensured = canonicalNik(ensureNik).toLowerCase()
    const alreadyExists = completedPerfs.some(entry => canonicalNik(entry.nik).toLowerCase() === ensured)
    if (!alreadyExists) {
      const targetData = findTargetByNik(targets, ensured)
      completedPerfs.push({
        nik: ensured,
        nama: targetData?.nama ?? ensured,
        sales: 0,
        qty: 0,
        transaksi: 0,
        newMember: 0,
        categorySales: {},
        categoryQty: {},
        basketSize: 0,
        upt: 0,
        aur: 0,
      })
    }
  }

  return completedPerfs
  .filter(e => includeZeroSales || e.sales > 0)
  .sort((a, b) => {
    const ta = (findTargetByNik(targets, a.nik)?.daily ?? DEFAULT_DAILY_TARGET) * workingDays
    const tb = (findTargetByNik(targets, b.nik)?.daily ?? DEFAULT_DAILY_TARGET) * workingDays
    return (b.sales / tb) - (a.sales / ta)
  })
    .map((e, i) => {
      const tData = findTargetByNik(targets, e.nik)
      const tgt   = (tData?.daily ?? DEFAULT_DAILY_TARGET) * workingDays
      // Gunakan nama dari targets sheet jika nama transaksi kosong/tidak valid
      const rawNama = e.nama && e.nama.trim() && e.nama.trim().toUpperCase() !== 'NONAME'
        ? e.nama
        : (tData?.nama ?? e.nik)
      return {
        rank: i + 1, nik: e.nik, nama: cleanNama(rawNama), jobTitle: tData?.jobTitle ?? '',
        value: e.sales, target: tgt,
        achievement: parseFloat(((e.sales / tgt) * 100).toFixed(1)),
      }
    })
}

export interface TeamEmployeeSummary {
  rank: number
  nik: string
  nama: string
  jobTitle: string
  sales: number
  targetSales: number
  achievement: number
  transaksi: number
  targetTransaksi: number
  trafficEst: number
  qty: number
  upt: number
  aur: number
  basketSize: number
  targetBasketSize: number
  newMember: number
}

function buildTeamEmployeeSummary(perfs: EmpPerf[], targets: Map<string, TargetData>, workingDays = 1, validNiks: Set<string> = new Set()): TeamEmployeeSummary[] {
  const normalizedValidNiks = new Set([...validNiks].map(n => canonicalNik(n).toLowerCase()))
  const filteredPerfs = perfs
    .filter(e => validNiks.size === 0 || normalizedValidNiks.has(canonicalNik(e.nik).toLowerCase()))

  const perfsByNik = new Map(filteredPerfs.map(entry => [canonicalNik(entry.nik).toLowerCase(), entry]))
  const completedPerfs = [...filteredPerfs]

  for (const key of normalizedValidNiks) {
    if (perfsByNik.has(key)) continue
    const targetData = findTargetByNik(targets, key)
    completedPerfs.push({
      nik: key,
      nama: targetData?.nama ?? key,
      sales: 0,
      qty: 0,
      transaksi: 0,
      newMember: 0,
      categorySales: {},
      categoryQty: {},
      basketSize: 0,
      upt: 0,
      aur: 0,
    })
  }

  const rows = completedPerfs.map(e => {
    const tData = findTargetByNik(targets, e.nik)
    const dailyTarget = tData?.daily ?? DEFAULT_DAILY_TARGET
    const targetSales = dailyTarget * workingDays
    const trxDailyBase = tData?.targetTrxDaily ?? Math.max(1, Math.round(dailyTarget / 450_000))
    const targetTransaksi = Math.max(1, trxDailyBase * workingDays)
    const targetBasketSize = Math.max(1, tData?.targetBasketSizeDaily ?? Math.round(dailyTarget * 0.7))
    const rawNama = e.nama && e.nama.trim() && e.nama.trim().toUpperCase() !== 'NONAME'
      ? e.nama
      : (tData?.nama ?? e.nik)

    return {
      rank: 0,
      nik: e.nik,
      nama: cleanNama(rawNama),
      jobTitle: tData?.jobTitle ?? '',
      sales: e.sales,
      targetSales,
      achievement: targetSales > 0 ? parseFloat(((e.sales / targetSales) * 100).toFixed(1)) : 0,
      transaksi: e.transaksi,
      targetTransaksi,
      trafficEst: e.transaksi,
      qty: e.qty,
      upt: e.upt,
      aur: e.aur,
      basketSize: e.basketSize,
      targetBasketSize,
      newMember: e.newMember,
    }
  })

  return rows
    .sort((a, b) => b.achievement - a.achievement || b.sales - a.sales)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

// ─── Public builders ──────────────────────────────────────────────────────────

export interface RawPerfResult {
  todayPerf: PerformanceData
  mtdPerf:   PerformanceData
  dailyDate: string
  dateFrom:  string
  dateTo:    string
  teamTodayTrend: DailyTrend[]
  teamMtdTrend:   DailyTrend[]
  teamTodayEmployees: TeamEmployeeSummary[]
  teamMtdEmployees: TeamEmployeeSummary[]
}

function normNik(nik: string): string {
  return (nik ?? '').trim().toLowerCase()
}

export async function buildRawPerformance(currentNik: string, onLog?: (s: string) => void, validNiks: Set<string> = new Set()): Promise<RawPerfResult> {
  const log = (s: string) => { console.warn('[ATLAS RAW]', s); onLog?.(s) }
  // Normalize currentNik to canonical format (I01902 → 101902) so it matches transaction NIKs
  const canonicalCurrent = canonicalNik(currentNik)
  const normCurrent = normNik(canonicalCurrent)

  const [{ txns: rawTxns, debugRows }, skuMap, targets, memberEntries, settings] = await Promise.all([
    fetchRawTransactions(),
    fetchSkuMap(),
    fetchTargets(),
    fetchMemberData(),
    fetchSettings(),
  ])
  log(`SETTING: ${settings.length} baris (KPI=${settings.filter(s=>s.section==='KPI').length}, KATEGORI=${settings.filter(s=>s.section==='KATEGORI').length})`)
  log(`TARGET: ${targets.size} entri — NIK intern: ${['I01902','I01903','I01904'].map(n=>{const f=findTargetByNik(targets,n);return`${n}=${f?f.daily:'❌'}`}).join(', ')}`)

  // Log raw structure
  debugRows.forEach(r => log(r))
  log(`COPAS S2: ${rawTxns.length} baris setelah fill-down NIK`)
  log(`KUNCIAN SKU: ${skuMap.categories.map(cat => `${cat.name}(${cat.articles.size})`).join(', ')}`)
  log(`Proteksi SKU: ${skuMap.proteksi.size} | New Product SKU: ${skuMap.newProduct.size}`)

  // Verifikasi: tampilkan baris pertama milik currentNik (semua kolom raw)
  const myFirstRaw = rawTxns.find(t => normNik(t.nik) === normCurrent)
  if (myFirstRaw) {
    log(`Contoh baris NIK ${currentNik}: tgl=${myFirstRaw.tanggal} qty=${myFirstRaw.qty} totalValue=${myFirstRaw.totalValue} receipt=${myFirstRaw.receiptNo} artikel=${myFirstRaw.artikel}`)
    // Check if artikel matches any SKU category
    const inProteksi = skuMap.proteksi.has(myFirstRaw.artikel)
    const inNewProd  = skuMap.newProduct.has(myFirstRaw.artikel)
    log(`  → artikel "${myFirstRaw.artikel}" proteksi=${inProteksi} newProduct=${inNewProd}`)
  } else {
    log(`⚠ NIK ${currentNik} tidak ditemukan setelah fill-down`)
  }

  const txns = rawTxns

  // ── Auto-detect date format ─────────────────────────────────────────────
  const sampleDates = txns.slice(0, 5).map(t => t.tanggal)
  log(`Sample tanggal: ${sampleDates.join(' | ')}`)

  // Gunakan timezone WIB (UTC+7)
  const nowWIB = new Date(new Date().getTime() + 7 * 60 * 60 * 1000)
  const today = new Date(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth(), nowWIB.getUTCDate())
  const todayDD = today.getDate(), todayMM = today.getMonth() + 1

  // Cek apakah format DD/MM/YYYY atau M/D/YYYY dengan test hari ini
  let useUSFormat = false
  for (const raw of sampleDates) {
    const m = raw.split(' ')[0].match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
    if (!m) continue
    const a = +m[1], b = +m[2]
    // Kalau a == bulan sekarang & b == hari sekarang → M/D/YYYY (gviz US format)
    if (a === todayMM && b === todayDD) { useUSFormat = true; break }
    // Kalau a == hari sekarang & b == bulan sekarang → DD/MM/YYYY
    if (a === todayDD && b === todayMM) { useUSFormat = false; break }
  }

  log(`Format tanggal terdeteksi: ${useUSFormat ? 'M/D/YYYY (gviz US)' : 'DD/MM/YYYY (ID)'}`)

  // Re-parse semua tanggal dengan format yang benar
  const parsedTxns = txns.map(t => ({
    ...t,
    date: useUSFormat ? parseDateUS(t.tanggal) : parseDate(t.tanggal),
  }))

  // ── NIK diagnostics ─────────────────────────────────────────────────────
  const allNiks = [...new Set(parsedTxns.map(t => t.nik))]
  log(`NIK di data (${allNiks.length}): ${allNiks.join(', ')}`)
  log(`NIK login: "${currentNik}" (canonical: "${canonicalCurrent}")`)
  const nikMatch = parsedTxns.some(t => normNik(t.nik) === normCurrent)
  log(`NIK match: ${nikMatch ? 'YA ✅' : 'TIDAK ❌ — cek format NIK'}`)

  // ── Date diagnostics ────────────────────────────────────────────────────
  const todayStr = `${String(todayDD).padStart(2,'0')}/${String(todayMM).padStart(2,'0')}/${today.getFullYear()}`
  const todayTxns = parsedTxns.filter(t => t.date && sameDay(t.date, today))
  const todayTxnsCount = todayTxns.length
  log(`Transaksi hari ini (${todayStr}): ${todayTxnsCount} baris`)

  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  const fmtLabel = (d: Date) => `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'short' })}`

  let dailyTxns = todayTxns
  if (todayTxns.length === 0) {
    dailyTxns = []
    log(`Tidak ada transaksi untuk tanggal ${fmt(today)}; daily view dikosongkan`) 
  }

  // MTD = H-1: data s.d. kemarin agar angka MTD sudah final (bukan setengah hari)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const mtdTxns   = parsedTxns.filter(t => t.date && sameMonth(t.date, today) && t.date <= yesterday)
  log(`Transaksi MTD (s.d. H-1 / ${yesterday.getDate()}): ${mtdTxns.length} baris`)

  const dailyPerfs = aggregate(dailyTxns, skuMap)
  const mtdPerfs   = aggregate(mtdTxns,   skuMap)

  const normalizedValidNiks = new Set([...validNiks].map(n => canonicalNik(n).toLowerCase()))

  const teamDailyTarget = [...normalizedValidNiks].reduce((sum, nik) => {
    const t = findTargetByNik(targets, nik)
    return sum + (t?.daily ?? DEFAULT_DAILY_TARGET)
  }, 0)

  const validTeam = (t: RawTxn) => normalizedValidNiks.has(canonicalNik(t.nik).toLowerCase())
  const teamTodayTotal = todayTxns.filter(validTeam).reduce((sum, t) => sum + t.totalValue, 0)

  const teamMtdTxns = parsedTxns.filter(t =>
    t.date && sameMonth(t.date, today) && t.date <= yesterday && validTeam(t)
  )
  const teamSalesByDay = new Map<string, number>()
  for (const t of teamMtdTxns) {
    if (!t.date) continue
    const key = fmt(t.date)
    teamSalesByDay.set(key, (teamSalesByDay.get(key) ?? 0) + t.totalValue)
  }
  const teamMtdTrend = [...teamSalesByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, actual]) => {
      const [dd, mm, yyyy] = key.split('/').map(Number)
      return { date: fmtLabel(new Date(yyyy, mm - 1, dd)), actual, target: teamDailyTarget }
    })

  const wdays = yesterday.getDate() // hari berjalan = kemarin

  // Build NAMA→NIK map from raw txns for table-1 matching
  // Build NAMA→NIK map from raw txns (fill-down NAMA already applied)
  const namaToNik = new Map<string, string>()
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim()
  for (const t of parsedTxns) {
    if (t.nik && t.nama) namaToNik.set(norm(t.nama), t.nik)
  }
  log(`namaToNik: ${namaToNik.size} entri — ${[...namaToNik.keys()].slice(0, 6).join(', ')}`)
  log(`MEMBER entries: ${memberEntries.length} (byNama=${memberEntries.filter(e=>!e.byNik).length} byNIK=${memberEntries.filter(e=>e.byNik).length})`)

  // Resolve NAMA→NIK with flexible matching (exact, then startsWith, then contains)
  const resolveNama = (memberNama: string): string | undefined => {
    const key = norm(memberNama)
    if (namaToNik.has(key)) return namaToNik.get(key)
    // Try partial: member name starts with copas name or vice versa
    for (const [copasNama, nik] of namaToNik) {
      if (key.startsWith(copasNama) || copasNama.startsWith(key)) return nik
    }
    return undefined
  }

  // ── Compute new member counts from MEMBER sheet ───────────────────────────
  const sumMember = (entries: typeof memberEntries, nik: string, dateFilter: (d: Date) => boolean): number => {
    let total = 0
    for (const entry of entries) {
      if (!entry.date || !dateFilter(entry.date)) continue
      if (entry.byNik) {
        if (niksMatch(entry.nikOrNama, nik)) total += entry.count
      } else {
        const resolvedNik = resolveNama(entry.nikOrNama)
        if (resolvedNik && niksMatch(resolvedNik, nik)) total += entry.count
      }
    }
    return total
  }

  // Find current user's perf
  const emptyPerf = () => ({ nik: canonicalCurrent, nama: '', sales: 0, qty: 0, transaksi: 0, newMember: 0, categorySales: {}, categoryQty: {}, basketSize: 0, upt: 0, aur: 0 })
  const myDaily = dailyPerfs.find(e => niksMatch(e.nik, canonicalCurrent)) ?? dailyPerfs.find(e => normNik(e.nik) === normCurrent) ?? emptyPerf()
  const myMTD   = mtdPerfs.find(e => niksMatch(e.nik, canonicalCurrent))   ?? mtdPerfs.find(e => normNik(e.nik) === normCurrent)   ?? emptyPerf()

  // Attach new member counts
  myDaily.newMember = sumMember(memberEntries, canonicalCurrent, d => sameDay(d, today))
  myMTD.newMember   = sumMember(memberEntries, canonicalCurrent, d => sameMonth(d, today) && d <= yesterday)

  // Debug: show member entries that SHOULD belong to currentNik
  const myNamaInCopas = [...namaToNik.entries()].find(([,v]) => normNik(v) === normCurrent)?.[0] ?? '(tidak ada)'
  log(`Nama di COPAS S2 untuk NIK ${canonicalCurrent}: "${myNamaInCopas}"`)
  const relatedEntries = memberEntries.filter(e =>
    e.byNik ? normNik(e.nikOrNama) === normNik(canonicalCurrent) : normNik(resolveNama(e.nikOrNama) ?? '') === normCurrent
  )
  log(`MEMBER entries untuk NIK ini: ${relatedEntries.length} — ${relatedEntries.map(e => `${e.nikOrNama}(${e.date?.toLocaleDateString('id-ID')})`).slice(0,5).join(', ')}`)
  log(`New Member today=${myDaily.newMember} MTD=${myMTD.newMember}`)

  for (const perf of dailyPerfs) {
    perf.newMember = sumMember(memberEntries, perf.nik, d => sameDay(d, today))
  }
  for (const perf of mtdPerfs) {
    perf.newMember = sumMember(memberEntries, perf.nik, d => sameMonth(d, today) && d <= yesterday)
  }

  // Cari target: coba by NIK dulu, lalu by NAMA (fallback jika NIK null di gviz)
  const normN = (s: string) => s.toUpperCase().replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ').trim()
  const myNamaForTarget = normN(myMTD.nama || myDaily.nama || '')
  const byNik  = findTargetByNik(targets, canonicalCurrent)
  const byNama = myNamaForTarget ? targets.get(`NAMA:${myNamaForTarget}`) : undefined
  // Fuzzy fallback: cari nama TARGET yang paling mirip (cocok sebagian)
  let byFuzzy: TargetData | undefined
  if (!byNik && !byNama && myNamaForTarget) {
    for (const [k, v] of targets.entries()) {
      if (!k.startsWith('NAMA:')) continue
      const tNama = k.slice(5)
      if (tNama.includes(myNamaForTarget) || myNamaForTarget.includes(tNama)) {
        byFuzzy = v; break
      }
    }
  }
  log(`TARGET lookup NIK="${currentNik}" → byNIK=${byNik?'✅':'❌'}, NAMA="${myNamaForTarget}" → byNAMA=${byNama?'✅':'❌'}, byFuzzy=${byFuzzy?'✅':'❌'}`)
  const tgtData = byNik ?? byNama ?? byFuzzy
  const dailyTarget     = tgtData?.daily   ?? DEFAULT_DAILY_TARGET
  const fullMonthTarget = tgtData?.monthly ?? dailyTarget * 30  // full month target (untuk Full Month tab)
  const mtdTargetProrated = dailyTarget * wdays                 // prorated: daily × hari berjalan

  const dailyAch = dailyTarget         > 0 ? parseFloat(((myDaily.sales / dailyTarget)          * 100).toFixed(1)) : 0
  const mtdAch   = mtdTargetProrated   > 0 ? parseFloat(((myMTD.sales   / mtdTargetProrated)    * 100).toFixed(1)) : 0

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  // ── Build daily trend: sum sales per day for currentNik, sorted by date ──
  const myMtdTxns = mtdTxns.filter(t => niksMatch(t.nik, currentNik))
  const salesByDay = new Map<string, number>()
  for (const t of myMtdTxns) {
    if (!t.date) continue
    const key = fmt(t.date)
    salesByDay.set(key, (salesByDay.get(key) ?? 0) + t.totalValue)
  }
  const mtdTrend = [...salesByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, actual]) => {
      const [dd, mm, yyyy] = key.split('/').map(Number)
      return { date: fmtLabel(new Date(yyyy, mm - 1, dd)), actual, target: dailyTarget }
    })

  const todayTrendEntry = todayTxns.length > 0
    ? [{ date: fmtLabel(today), actual: myDaily.sales, target: dailyTarget }]
    : [{ date: fmtLabel(today), actual: 0, target: dailyTarget }]

  log(`Trend harian: ${mtdTrend.length} hari data`)

  return {
    dailyDate:      fmt(today),
    dateFrom:       fmt(firstOfMonth),
    dateTo:         fmt(yesterday),
    teamTodayTrend: [{ date: fmt(today), actual: teamTodayTotal, target: teamDailyTarget }],
    teamMtdTrend,
    teamTodayEmployees: buildTeamEmployeeSummary(dailyPerfs, targets, 1, validNiks),
    teamMtdEmployees: buildTeamEmployeeSummary(mtdPerfs, targets, wdays, validNiks),

    todayPerf: {
      achievement: dailyAch,
      target:      dailyTarget,
      actual:      myDaily.sales,
      acv:         myDaily.sales,
      workingDays: 1,
      kpis:        makeKPIs(myDaily, dailyTarget, false, 1, skuMap.categories, tgtData, settings),
      ranking:     buildRanking(dailyPerfs, targets, 1),
      dailyTrend:  todayTrendEntry,
    },

    mtdPerf: {
      achievement: mtdAch,
      target:      fullMonthTarget,
      targetMTD:   mtdTargetProrated,
      actual:      myMTD.sales,
      acv:         wdays > 0 ? Math.round(myMTD.sales / wdays) : 0,
      workingDays: wdays,
      kpis:        makeKPIs(myMTD, dailyTarget, true, wdays, skuMap.categories, tgtData, settings),
      ranking:     buildRanking(mtdPerfs, targets, wdays, true, canonicalCurrent),
      monthlyTrend: mtdTrend.length > 0 ? mtdTrend : [{ date: `${fmt(firstOfMonth)} – ${fmt(yesterday)}`, actual: myMTD.sales, target: mtdTargetProrated }],
    },
  }
}

// Re-export for USERS (unchanged)
export { fetchUsers } from './sheetsApi'
export { YTD_PERFORMANCE }

// ─── YTD types & fetch ────────────────────────────────────────────────────────

export interface YTDMonth {
  month:          string
  colorZone:      string   // from sheet: HIJAU, MERAH, KUNING, BIRU
  quadrant:       string   // from sheet: Kuadran 1..4
  sales:          number   // % achievement
  trx:            number   // %
  bs:             number   // %
  aur:            number
  upt:            number
  newMember: number
  proteksi:  number
  hasData:   boolean
}

export interface YTDEmployee {
  nik:       string
  nama:      string
  months:    YTDMonth[]
  // YTD summary columns (D,E,F,H)
  ytdQuadrant:  string
  ytdScore:     number
  ytdColorZone: string
  ytdSalesPct:  number
  // computed averages
  avgSales:  number
  avgTrx:    number
  avgBS:     number
}

// Sheet column layout (fixed):
// A(0)=NIK  B(1)=NAMA  D(3)=Kuadran YTD  E(4)=Score YTD  F(5)=Color Zone YTD  H(7)=%Sales YTD
// Monthly blocks — each 9 cols wide, starting at J(9):
//   +0 COLOR ZONE SID  +1 KUADRAN  +2 %SALES  +3 %TRX  +4 %BS
//   +5 AUR  +6 UPT  +7 NEW MEMBER  +8 INSTANT UPGRADE
// Jan=J(9), Feb=S(18), Mar=AB(27), Apr=AK(36) … col = 9 + month_index * 9

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export async function fetchYTDData(currentNik: string): Promise<YTDEmployee | null> {
  try {
    const raw = await fetchCSV('YEAR TO DATE')
    if (raw.length < 2) return null

    const nikIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_NIK', 0)
    const namaIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_NAMA', 1)
    const quadrantIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_QUADRANT', 3)
    const scoreIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_SCORE', 4)
    const colorZoneIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_COLOR_ZONE', 5)
    const salesPctIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_SALES_PCT', 7)
    const monthlyBlockStart = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_MONTHLY_BLOCK_START', 9)

    // Some sheets use 1 header row, others use 2 rows.
    // Detect first data row from a valid-looking NIK to avoid skipping first employee.
    const firstDataIndex = raw.findIndex((row, index) => index > 0 && looksLikeNik((row[nikIdx] ?? '').trim()))
    const dataStart = firstDataIndex >= 0 ? firstDataIndex : 1

    // Find employee row
    const row = raw.slice(dataStart).find(r => {
      const rowNik = (r[nikIdx] ?? '').trim()
      return niksMatch(rowNik, currentNik)
    })
    if (!row) return null

    const nama = (row[namaIdx] ?? '').trim()

    // YTD summary columns
    const ytdQuadrant  = (row[quadrantIdx] ?? '').trim()
    const ytdScore     = numVal(row[scoreIdx] ?? '')
    const ytdColorZone = (row[colorZoneIdx] ?? '').trim()
    const ytdSalesPct  = numVal(row[salesPctIdx] ?? '')

    // Monthly blocks: 12 months, each block 9 cols starting from the configured base column
    const months: YTDMonth[] = MONTH_NAMES.map((name, mi) => {
      const base = monthlyBlockStart + mi * 9
      const zone = (row[base + 0] ?? '').trim()
      const quad = (row[base + 1] ?? '').trim()
      const sv   = numVal(row[base + 2] ?? '')
      const tv   = numVal(row[base + 3] ?? '')
      const bv   = numVal(row[base + 4] ?? '')
      const up   = numVal(row[base + 5] ?? '')
      const ar   = numVal(row[base + 6] ?? '')
      const nm   = numVal(row[base + 7] ?? '')
      const iu   = numVal(row[base + 8] ?? '')
      const has  = sv > 0 || tv > 0 || bv > 0
      return {
        month: name, colorZone: zone, quadrant: quad,
        sales: sv, trx: tv, bs: bv, aur: ar, upt: up,
        newMember: nm, proteksi: iu, hasData: has,
      }
    })

    const active   = months.filter(m => m.hasData)
    const avg      = (vals: number[]) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    const avgSales = avg(active.map(m => m.sales))
    const avgTrx   = avg(active.map(m => m.trx))
    const avgBS    = avg(active.map(m => m.bs))

    return {
      nik: currentNik, nama,
      months,
      ytdQuadrant, ytdScore, ytdColorZone, ytdSalesPct,
      avgSales, avgTrx, avgBS,
    }
  } catch (e) {
    console.warn('[ATLAS YTD] Error:', e)
    return null
  }
}

export async function fetchAllYTD(): Promise<YTDEmployee[]> {
  try {
    const raw = await fetchCSV('YEAR TO DATE')
    if (raw.length < 2) return []

    const nikIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_NIK', 0)
    const namaIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_NAMA', 1)
    const quadrantIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_QUADRANT', 3)
    const scoreIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_SCORE', 4)
    const colorZoneIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_COLOR_ZONE', 5)
    const salesPctIdx = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_SALES_PCT', 7)
    const monthlyBlockStart = getConfiguredColumnIndex('YEAR TO DATE', 'YTD_MONTHLY_BLOCK_START', 9)

    const firstDataIndex = raw.findIndex((row, index) => index > 0 && looksLikeNik((row[nikIdx] ?? '').trim()))
    const dataStart = firstDataIndex >= 0 ? firstDataIndex : 1
    const results: YTDEmployee[] = []
    for (const row of raw.slice(dataStart)) {
      const nik = (row[nikIdx] ?? '').trim()
      if (!nik) continue
      const nama         = (row[namaIdx] ?? '').trim()
      const ytdQuadrant  = (row[quadrantIdx] ?? '').trim()
      const ytdScore     = numVal(row[scoreIdx] ?? '')
      const ytdColorZone = (row[colorZoneIdx] ?? '').trim()
      const ytdSalesPct  = numVal(row[salesPctIdx] ?? '')
      const months: YTDMonth[] = MONTH_NAMES.map((name, mi) => {
        const base = monthlyBlockStart + mi * 9
        const zone = (row[base + 0] ?? '').trim()
        const quad = (row[base + 1] ?? '').trim()
        const sv   = numVal(row[base + 2] ?? '')
        const tv   = numVal(row[base + 3] ?? '')
        const bv   = numVal(row[base + 4] ?? '')
        const up   = numVal(row[base + 5] ?? '')
        const ar   = numVal(row[base + 6] ?? '')
        const nm   = numVal(row[base + 7] ?? '')
        const iu   = numVal(row[base + 8] ?? '')
        return { month: name, colorZone: zone, quadrant: quad, sales: sv, trx: tv, bs: bv, aur: ar, upt: up, newMember: nm, proteksi: iu, hasData: sv > 0 || tv > 0 || bv > 0 }
      })
      const active   = months.filter(m => m.hasData)
      const avg      = (vals: number[]) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      results.push({ nik, nama, months, ytdQuadrant, ytdScore, ytdColorZone, ytdSalesPct, avgSales: avg(active.map(m => m.sales)), avgTrx: avg(active.map(m => m.trx)), avgBS: avg(active.map(m => m.bs)) })
    }
    return results
  } catch (e) {
    console.warn('[ATLAS YTD ALL] Error:', e)
    return []
  }
}
