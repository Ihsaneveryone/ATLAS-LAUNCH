import { YTD_PERFORMANCE, type User, type PerformanceData, type EmployeeRank, type KPIItem } from '../data/mockData'

const SHEET_ID = '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38'
let usersRequestInFlight: Promise<User[]> | null = null
const IS_DEV = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)

function sheetUrl(name: string, bust = false) {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`
  return bust ? `${base}&_t=${Date.now()}` : base
}

async function fetchCSV(sheetName: string, bustCache = false): Promise<string[][]> {
  const url = sheetUrl(sheetName, bustCache)
  if (IS_DEV) console.warn(`[ATLAS] Fetching: "${sheetName}"`, url)
  const res = await fetch(url, bustCache ? { cache: 'no-store' } : {})
  const text = await res.text()
  if (IS_DEV) console.warn(`[ATLAS] "${sheetName}" → status=${res.status}, length=${text.length}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} untuk sheet "${sheetName}"`)
  if (text.trimStart().startsWith('<!')) throw new Error(`Sheet "${sheetName}" mengembalikan halaman HTML — pastikan spreadsheet di-share "Anyone with the link can view" (bukan hanya link biasa)`)
  const rows = parseCSV(text)
  if (IS_DEV) console.warn(`[ATLAS] "${sheetName}" → ${rows.length} baris berhasil di-parse`)
  return rows
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let inQuote = false
    let cell = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++ }
        else { inQuote = !inQuote }
      } else if (c === ',' && !inQuote) {
        cells.push(cell); cell = ''
      } else {
        cell += c
      }
    }
    cells.push(cell)
    rows.push(cells)
  }
  return rows
}

// Parse number — handles Rp prefix, thousands dots, comma decimals
function num(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/Rp\.?\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(cleaned) || 0
}

function col(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

// Column letter to 0-based index
function ci(letter: string): number {
  letter = letter.toUpperCase()
  if (letter.length === 1) return letter.charCodeAt(0) - 65
  return (letter.charCodeAt(0) - 64) * 26 + (letter.charCodeAt(1) - 65)
}


// ─── USERS sheet ────────────────────────────────────────────────────────────
// A=NIK, B=NAMA, C=ROLE, D=JOBTITLE, E=PASSWORD (data from row 2)

export async function fetchUsers(): Promise<User[]> {
  if (!usersRequestInFlight) {
    usersRequestInFlight = (async () => {
      const rows = await fetchCSV('USERS', true)
      const users = rows.slice(1).filter(r => col(r, 0) || col(r, 1)).map(r => ({
        nik:      col(r, ci('A')),
        nama:     col(r, ci('B')),
        role:     (col(r, ci('C')).toLowerCase() === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
        jobTitle: col(r, ci('D')),
        password: col(r, ci('E')),
      })).filter(u => u.nama)

      if (IS_DEV) console.warn('[USERS] Total:', users.length)
      return users
    })().finally(() => {
      usersRequestInFlight = null
    })
  }

  return usersRequestInFlight
}

// ─── DAILY SALES raw row ────────────────────────────────────────────────────
export interface DailySalesRow {
  nik: string; nama: string; jobTitle: string
  totalSales: number; targetSales: number
  transaksi: number; qtyItem: number
  aur: number; upt: number; basketSize: number
  proteksi: number; instantUpgrade: number; newMember: number
}

// DAILY SALES: Row1=title (date at T=col19), Row2=headers, Row3+=data
// A=NIK, B=NAMA, C=JOB TITLE, F=TOTAL SALES, G=TARGET SALES,
// K=TRANSAKSI, O=QTY ITEM, P=AUR, Q=UPT, R=BASKET SIZE,
// S=PROTEKSI, T=INSTANT UPGRADE, U=NEW MEMBER, T1=TANGGAL
export async function fetchDailySales(): Promise<{ date: string; rows: DailySalesRow[] }> {
  const raw = await fetchCSV('DAILY SALES')

  // Date at T1 = row 0, col T (index 19)
  const dateCell = col(raw[0] ?? [], ci('T'))

  // Data from row 3 (CSV index 2)
  const dataRows = raw.slice(2).filter(r => col(r, ci('A')))
  const rows: DailySalesRow[] = dataRows.map(r => {
    const ts = num(col(r, ci('F')))
    const tr = num(col(r, ci('K')))
    const qi = num(col(r, ci('O')))
    return {
      nik:            col(r, ci('A')),
      nama:           col(r, ci('B')),
      jobTitle:       col(r, ci('C')),
      totalSales:     ts,
      targetSales:    num(col(r, ci('G'))),
      transaksi:      tr,
      qtyItem:        qi,
      aur:            num(col(r, ci('P'))) || (qi > 0 ? Math.round(ts / qi) : 0),
      upt:            num(col(r, ci('Q'))) || (tr > 0 ? parseFloat((qi / tr).toFixed(2)) : 0),
      basketSize:     num(col(r, ci('R'))) || (tr > 0 ? Math.round(ts / tr) : 0),
      proteksi:       num(col(r, ci('S'))),
      instantUpgrade: num(col(r, ci('T'))),
      newMember:      num(col(r, ci('U'))),
    }
  })
  return { date: dateCell, rows }
}

// ─── MTD raw row ─────────────────────────────────────────────────────────────
export interface MTDRow {
  nik: string; nama: string; jobTitle: string
  sales: number; target: number
  transaksi: number; basketSize: number
  proteksi: number; newMember: number; instantUpgrade: number
  total5Strategy: number; offCuti: number
}

// MONTH TO DATE: Row1 (B1=FROM date, C1=TO date), Row2=headers, Row3+=data
// A=NIK, B=NAMA, C=JOB TITLE, E=SALES, G=TARGET,
// J=TRANSAKSI, O=BASKET SIZE, S=PROTEKSI, T=NEW MEMBER,
// U=INSTANT UPGRADE, AB=TOTAL 5 STRATEGY, AC=OFF/CUTI
export async function fetchMTD(): Promise<{ dateFrom: string; dateTo: string; rows: MTDRow[] }> {
  const raw = await fetchCSV('MONTH TO DATE')

  const dateFrom = col(raw[0] ?? [], ci('B'))
  const dateTo   = col(raw[0] ?? [], ci('C'))

  const rows = raw.slice(2).filter(r => col(r, ci('A'))).map(r => ({
    nik:            col(r, ci('A')),
    nama:           col(r, ci('B')),
    jobTitle:       col(r, ci('C')),
    sales:          num(col(r, ci('E'))),
    target:         num(col(r, ci('G'))),
    transaksi:      num(col(r, ci('J'))),
    basketSize:     num(col(r, ci('O'))),
    proteksi:       num(col(r, ci('S'))),
    newMember:      num(col(r, ci('T'))),
    instantUpgrade: num(col(r, ci('U'))),
    total5Strategy: num(col(r, ci('AB'))),
    offCuti:        num(col(r, ci('AC'))),
  }))
  return { dateFrom, dateTo, rows }
}

// ─── Build PerformanceData from sheet rows ───────────────────────────────────

function buildRanking(rows: { nik: string; nama: string; jobTitle: string; actual: number; target: number }[]): EmployeeRank[] {
  // Deduplicate by NIK — keep the row with the highest actual sales
  const byNik = new Map<string, typeof rows[0]>()
  for (const r of rows) {
    const existing = byNik.get(r.nik)
    if (!existing || r.actual > existing.actual) byNik.set(r.nik, r)
  }
  return [...byNik.values()]
    .filter(r => r.target > 0)
    .sort((a, b) => (b.actual / b.target) - (a.actual / a.target))
    .map((r, i) => ({
      rank:        i + 1,
      nik:         r.nik,
      nama:        r.nama,
      jobTitle:    r.jobTitle,
      value:       r.actual,
      achievement: parseFloat(((r.actual / r.target) * 100).toFixed(1)),
    }))
}

import { niksMatch } from './nik'

function normNik(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

export function buildTodayPerf(rows: DailySalesRow[], currentNik: string): PerformanceData {
  const safeRows = Array.isArray(rows) ? rows : []
  const nc = normNik(currentNik)
  const my  = safeRows.find(r => niksMatch(r.nik, currentNik)) ?? safeRows.find(r => normNik(r.nik) === nc) ?? safeRows[0]
  const tgt = my?.targetSales ?? 1

  const src     = my ?? { totalSales: 0, targetSales: 1, transaksi: 0, qtyItem: 0, aur: 0, upt: 0, basketSize: 0, proteksi: 0, instantUpgrade: 0, newMember: 0 }
  const actual  = src.totalSales
  const ach     = tgt > 0 ? parseFloat(((actual / tgt) * 100).toFixed(1)) : 0

  const kpis: KPIItem[] = [
    { label: 'Transaksi',        value: src.transaksi,     target: Math.max(1, Math.round(src.transaksi / (ach / 100 || 1))), unit: 'trx' },
    { label: 'Qty Item',         value: src.qtyItem,       target: Math.max(1, Math.round(src.qtyItem   / (ach / 100 || 1))), unit: 'item' },
    { label: 'AUR',              value: src.aur,            target: Math.round(src.aur * 0.9),             unit: 'Rp'  },
    { label: 'UPT',              value: src.upt,            target: Math.max(2, parseFloat((src.upt * 1.1).toFixed(1))),       unit: 'x'   },
    { label: 'Basket Size',      value: src.basketSize,    target: Math.round(src.basketSize * 1.05),     unit: 'Rp'  },
    { label: 'Proteksi',         value: src.proteksi,      target: Math.max(1, Math.round(src.proteksi  / (ach / 100 || 1))), unit: 'trx' },
    { label: 'Instant Upgrade',  value: src.instantUpgrade,target: Math.max(1, Math.round(src.instantUpgrade / (ach / 100 || 1))), unit: 'trx' },
    { label: 'New Member',       value: src.newMember,     target: Math.max(1, Math.round(src.newMember / (ach / 100 || 1))), unit: 'org' },
  ]

  return {
    achievement: ach,
    target:      tgt,
    actual,
    acv:         actual,  // 1 day
    workingDays: 1,
    kpis,
    ranking: buildRanking(safeRows.map(r => ({ nik: r.nik, nama: r.nama, jobTitle: r.jobTitle, actual: r.totalSales, target: r.targetSales }))),
    dailyTrend: [{ date: 'Hari Ini', actual, target: tgt }],
  }
}

export function buildMTDPerf(rows: MTDRow[], currentNik: string, dateFrom = '', dateTo = ''): PerformanceData {
  const safeRows = Array.isArray(rows) ? rows : []
  const nc = normNik(currentNik)
  const my  = safeRows.find(r => niksMatch(r.nik, currentNik)) ?? safeRows.find(r => normNik(r.nik) === nc) ?? safeRows[0]
  const src = my ?? { sales: 0, target: 1, transaksi: 0, basketSize: 0, proteksi: 0, newMember: 0, instantUpgrade: 0, total5Strategy: 0, offCuti: 0 }

  const actual  = src.sales
  const tgt     = src.target || 1
  const ach     = parseFloat(((actual / tgt) * 100).toFixed(1))

  // Compute working days from sheet dates (FROM → TO), fallback to calendar days
  let wdays = new Date().getDate()
  if (dateFrom && dateTo) {
    const parseDate = (s: string) => {
      // Handle DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD
      const parts = s.split(/[\/\-]/)
      if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`)
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`) // assume DD/MM/YYYY
      }
      return new Date(s)
    }
    const from = parseDate(dateFrom)
    const to   = parseDate(dateTo)
    const diff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (diff > 0) wdays = diff
  }

  const mtdTarget = (v: number) => Math.max(1, Math.round(v / (ach / 100 || 1)))
  const periodLabel = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : `1–${wdays} ${new Date().toLocaleString('id-ID', { month: 'short' })}`

  const kpis: KPIItem[] = [
    { label: 'Transaksi',         value: src.transaksi,      target: mtdTarget(src.transaksi),          unit: 'trx'  },
    { label: 'Basket Size',       value: src.basketSize,     target: Math.round(src.basketSize * 1.05), unit: 'Rp'  },
    { label: 'Proteksi',          value: src.proteksi,       target: mtdTarget(src.proteksi),           unit: 'trx' },
    { label: 'New Member',        value: src.newMember,      target: mtdTarget(src.newMember),          unit: 'org' },
    { label: 'Instant Upgrade',   value: src.instantUpgrade, target: mtdTarget(src.instantUpgrade),     unit: 'trx' },
    { label: 'Total 5 Strategy',  value: src.total5Strategy, target: mtdTarget(src.total5Strategy),     unit: 'poin' },
    { label: 'Off/Cuti',          value: src.offCuti,        target: 0, unit: 'hari', noTarget: true },
  ]

  return {
    achievement: ach,
    target:      tgt,
    actual,
    acv:         wdays > 0 ? Math.round(actual / wdays) : 0,
    workingDays: wdays,
    kpis,
    ranking:     buildRanking(safeRows.map(r => ({ nik: r.nik, nama: r.nama, jobTitle: r.jobTitle, actual: r.sales, target: r.target }))),
    monthlyTrend: [{ date: periodLabel, actual, target: tgt }],
  }
}

// ─── Full fetch ──────────────────────────────────────────────────────────────
export interface AtlasSheetData {
  users:       User[]
  todayPerf:   PerformanceData
  mtdPerf:     PerformanceData
  ytdPerf:     PerformanceData
  dailyDate:   string
}

export async function fetchAllSheetData(currentNik: string): Promise<AtlasSheetData> {
  const [users, { date, rows: dailyRows }, { dateFrom, dateTo, rows: mtdRows }] = await Promise.all([
    fetchUsers(),
    fetchDailySales(),
    fetchMTD(),
  ])
  return {
    users,
    todayPerf: buildTodayPerf(dailyRows, currentNik),
    mtdPerf:   buildMTDPerf(mtdRows,     currentNik, dateFrom, dateTo),
    ytdPerf:   YTD_PERFORMANCE,
    dailyDate: date,
  }
}
