import { getConfiguredColumnIndex } from './columnMappingService'

const SHEET_ID = '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38'

function parseCSV(text: string): string[][] {
  // Iterasi seluruh teks (bukan split per baris dulu) — sel yang mengandung
  // enter literal di dalam tanda kutip tidak boleh memecah baris data.
  const rows: string[][] = []
  let cells: string[] = []
  let cell = ''
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuote = false } }
      else { cell += ch }
      continue
    }
    if (ch === '"') { inQuote = true }
    else if (ch === ',') { cells.push(cell); cell = '' }
    else if (ch === '\r') { /* diabaikan, \n yang menandai akhir baris */ }
    else if (ch === '\n') {
      cells.push(cell); cell = ''
      if (cells.some(v => v.trim())) rows.push(cells)
      cells = []
    } else { cell += ch }
  }
  if (cell !== '' || cells.length > 0) {
    cells.push(cell)
    if (cells.some(v => v.trim())) rows.push(cells)
  }
  return rows
}

function n(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/Rp\.?\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()) || 0
}

function g(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

export interface TokoRow {
  date:             string
  // Daily
  salesDaily:       number
  targetDaily:      number
  traffic:          number
  targetTraffic:    number
  transaksi:        number
  targetTransaksi:  number
  newMember:        number
  targetNewMember:  number
  instantUpgrade:   number
  proteksi:         number
  targetProteksi:   number
  salesOnline:      number
  targetOnline:     number
  salesOffline:     number
  basketSize:       number
  targetBasketSize: number
  // MTD
  salesMTD:            number
  targetMTD:           number
  trafficMTD:          number
  targetTrafficMTD:    number
  transaksiMTD:        number
  targetTransaksiMTD:  number
  proteksiMTD:         number
  targetProteksiMTD:   number
  newMemberMTD:        number
  targetNewMemberMTD:  number
  basketSizeMTD:       number
  targetBasketSizeMTD: number
  salesOnlineMTD:      number
  targetOnlineMTD:     number
}

export async function fetchPencapaianToko(): Promise<TokoRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Pencapaian Toko')}&_t=${Date.now()}`
  const res  = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok || text.trimStart().startsWith('<!')) throw new Error('Sheet "Pencapaian Toko" tidak bisa dibaca')
  const raw = parseCSV(text)
  const dateIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_DATE', 1)
  const salesDailyIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_SALES_DAILY', 9)
  const targetDailyIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_SALES_DAILY', 8)
  const trafficIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TRAFFIC_DAILY', 3)
  const targetTrafficIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_TRAFFIC_DAILY', 17)
  const transaksiIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TRANSAKSI_DAILY', 4)
  const targetTransaksiIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_TRANSAKSI_DAILY', 22)
  // Hard override per user requirement: daily F=Proteksi, G=New Member, H=Instant Upgrade.
  // Do not read these three from shared column mapping because legacy remote overrides can swap them.
  const proteksiIdx = 5
  const newMemberIdx = 6
  const instantUpgradeIdx = 7
  const targetNewMemberIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_NEW_MEMBER_DAILY', 38)
  const targetProteksiIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_PROTEKSI_DAILY', 33)
  const salesOnlineIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_SALES_ONLINE_DAILY', 16)
  const targetOnlineIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_ONLINE_DAILY', 15)
  const salesOfflineIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_SALES_OFFLINE_DAILY', 14)
  const basketSizeIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_BASKET_SIZE_DAILY', 28)
  const targetBasketSizeIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_BASKET_SIZE_DAILY', 27)
  const salesMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_SALES_MTD', 12)
  const targetMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_SALES_MTD', 11)
  const trafficMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TRAFFIC_MTD', 20)
  const targetTrafficMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_TRAFFIC_MTD', 19)
  const transaksiMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TRANSAKSI_MTD', 25)
  const targetTransaksiMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_TRANSAKSI_MTD', 24)
  const proteksiMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_PROTEKSI_MTD', 36)
  const targetProteksiMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_PROTEKSI_MTD', 35)
  const newMemberMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_NEW_MEMBER_MTD', 41)
  const targetNewMemberMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_NEW_MEMBER_MTD', 40)
  const basketSizeMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_BASKET_SIZE_MTD', 31)
  const targetBasketSizeMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_BASKET_SIZE_MTD', 30)
  const salesOnlineMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_SALES_ONLINE_MTD', 49)
  const targetOnlineMTDIdx = getConfiguredColumnIndex('Pencapaian Toko', 'TOKO_TARGET_ONLINE_MTD', 48)

  // Debug: log semua baris dengan kolom B & U untuk cek date vs trafficMTD
  const dataRows = raw.slice(2).filter(r => g(r, dateIdx))
  dataRows.forEach((r, i) => {
    const b = g(r, dateIdx), u = g(r, trafficMTDIdx), t = g(r, targetTrafficMTDIdx)
    if (u || i < 15) console.warn(`[TOKO ROW ${i+1}] date=${b} | T(tgtTrafficMTD)=${t} | U(trafficMTD)=${u}`)
  })
  // Data mulai baris ke-3 (index 2)
  return dataRows.map(r => ({
    date:             g(r, dateIdx),
    salesDaily:       n(g(r, salesDailyIdx)),
    targetDaily:      n(g(r, targetDailyIdx)),
    traffic:          n(g(r, trafficIdx)),
    targetTraffic:    n(g(r, targetTrafficIdx)),
    transaksi:        n(g(r, transaksiIdx)),
    targetTransaksi:  n(g(r, targetTransaksiIdx)),
    newMember:        n(g(r, newMemberIdx)),
    targetNewMember:  n(g(r, targetNewMemberIdx)),
    instantUpgrade:   n(g(r, instantUpgradeIdx)),
    proteksi:         n(g(r, proteksiIdx)),
    targetProteksi:   n(g(r, targetProteksiIdx)),
    salesOnline:      n(g(r, salesOnlineIdx)),
    targetOnline:     n(g(r, targetOnlineIdx)),
    salesOffline:     n(g(r, salesOfflineIdx)),
    basketSize:       n(g(r, basketSizeIdx)),
    targetBasketSize: n(g(r, targetBasketSizeIdx)),
    salesMTD:            n(g(r, salesMTDIdx)),
    targetMTD:           n(g(r, targetMTDIdx)),
    trafficMTD:          n(g(r, trafficMTDIdx)),
    targetTrafficMTD:    n(g(r, targetTrafficMTDIdx)),
    transaksiMTD:        n(g(r, transaksiMTDIdx)),
    targetTransaksiMTD:  n(g(r, targetTransaksiMTDIdx)),
    proteksiMTD:         n(g(r, proteksiMTDIdx)),
    targetProteksiMTD:   n(g(r, targetProteksiMTDIdx)),
    newMemberMTD:        n(g(r, newMemberMTDIdx)),
    targetNewMemberMTD:  n(g(r, targetNewMemberMTDIdx)),
    basketSizeMTD:       n(g(r, basketSizeMTDIdx)),
    targetBasketSizeMTD: n(g(r, targetBasketSizeMTDIdx)),
    salesOnlineMTD:      n(g(r, salesOnlineMTDIdx)),
    targetOnlineMTD:     n(g(r, targetOnlineMTDIdx)),
  }))
}

// Parse date parts from sheet date string (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD)
export function parseDateParts(dateStr: string): { day: number; month: number; year: number } | null {
  if (!dateStr) return null
  const parts = dateStr.split(/[-\/]/)
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return { day: parseInt(parts[2], 10), month: parseInt(parts[1], 10), year: parseInt(parts[0], 10) }
    }
    return { day: parseInt(parts[0], 10), month: parseInt(parts[1], 10), year: parseInt(parts[2], 10) }
  }
  return null
}

export function jakartaDateParts(now = new Date()): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  return {
    day: Number(parts.find(part => part.type === 'day')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
    year: Number(parts.find(part => part.type === 'year')?.value),
  }
}

function dateKey(date: { day: number; month: number; year: number }): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

// Untuk TODAY: baris tanggal hari ini
export function todayTokoRow(rows: TokoRow[]): TokoRow | null {
  if (rows.length === 0) return null
  const today = jakartaDateParts()
  const todayKey = dateKey(today)
  for (let i = rows.length - 1; i >= 0; i--) {
    const date = parseDateParts(rows[i].date)
    if (date && dateKey(date) === todayKey) {
      return rows[i]
    }
  }
  // fallback: baris terdekat ≤ hari ini yang ada data
  return null
}

// Untuk MTD: H-1 (kemarin), karena data toko MTD baru final setelah hari tutup
export function latestTokoRow(rows: TokoRow[]): TokoRow | null {
  if (rows.length === 0) return null
  const today = jakartaDateParts()
  const yesterday = new Date(Date.UTC(today.year, today.month - 1, today.day - 1))
  const yesterdayParts = {
    day: yesterday.getUTCDate(), month: yesterday.getUTCMonth() + 1, year: yesterday.getUTCFullYear(),
  }
  if (yesterdayParts.year !== today.year || yesterdayParts.month !== today.month) return null
  const yesterdayKey = dateKey(yesterdayParts)

  // Cari baris H-1
  for (let i = rows.length - 1; i >= 0; i--) {
    const date = parseDateParts(rows[i].date)
    if (date && dateKey(date) === yesterdayKey) return rows[i]
  }
  // fallback: baris terdekat ≤ H-1 pada bulan yang sama
  for (let i = rows.length - 1; i >= 0; i--) {
    const date = parseDateParts(rows[i].date)
    if (date && date.year === yesterdayParts.year && date.month === yesterdayParts.month && date.day <= yesterdayParts.day && (rows[i].salesMTD > 0 || rows[i].salesDaily > 0)) return rows[i]
  }
  return null
}

// Untuk FULL MONTH: target dari baris terakhir bulan berjalan, bukan baris terakhir global.
export function fullMonthTokoRow(rows: TokoRow[]): TokoRow | null {
  const today = jakartaDateParts()
  return rows.reduce<TokoRow | null>((latest, row) => {
    const date = parseDateParts(row.date)
    if (!date || date.year !== today.year || date.month !== today.month) return latest
    if (!latest) return row
    const latestDate = parseDateParts(latest.date)
    return latestDate && date.day > latestDate.day ? row : latest
  }, null)
}
