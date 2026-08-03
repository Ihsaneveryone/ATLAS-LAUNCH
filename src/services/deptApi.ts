const SHEET_ID = '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const cells: string[] = []
    let inQuote = false
    let cell = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuote = !inQuote
        }
      } else if (c === ',' && !inQuote) {
        cells.push(cell)
        cell = ''
      } else {
        cell += c
      }
    }
    cells.push(cell)
    rows.push(cells)
  }
  return rows
}

function n(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/Rp\.?\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(cleaned) || 0
}

function g(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

function parseDay(value: string): number {
  const text = (value ?? '').trim()
  if (!text) return 0

  // Handles date formats used across sheets:
  // - DD-MM-YYYY (sales header)
  // - MM/DD/YYYY (MTD target rows)
  // - YYYY-MM-DD
  if (text.includes('/')) {
    const parts = text.split('/')
    if (parts.length === 3) {
      const day = Number(parts[1])
      if (Number.isFinite(day) && day > 0 && day <= 31) return day
    }
  }

  if (text.includes('-')) {
    const parts = text.split('-')
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const day = Number(parts[2])
        if (Number.isFinite(day) && day > 0 && day <= 31) return day
      }
      const day = Number(parts[0])
      if (Number.isFinite(day) && day > 0 && day <= 31) return day
    }
  }

  const match = text.match(/(\d{1,2})/)
  if (match) return Number(match[1])
  return 0
}

type DeptKind = 'zone' | 'dept'

interface DeptNodeDef {
  label: string
  kind: DeptKind
  zone: string
}

interface DeptGroupDef {
  zone: string
  start: number
  end: number
}

const DEPT_NODES: DeptNodeDef[] = [
  { label: 'Hobbies & Lifestyle (ZONA)', kind: 'zone', zone: 'Hobbies & Lifestyle' },
  { label: 'Automotive', kind: 'dept', zone: 'Hobbies & Lifestyle' },
  { label: 'LG Aquapet OL', kind: 'dept', zone: 'Hobbies & Lifestyle' },
  { label: 'Outdoor Comfort', kind: 'dept', zone: 'Hobbies & Lifestyle' },
  { label: 'Sports & Health', kind: 'dept', zone: 'Hobbies & Lifestyle' },
  { label: 'Travels, Seasonal, Baby & Kids', kind: 'dept', zone: 'Hobbies & Lifestyle' },
  { label: 'Trendy Goods', kind: 'dept', zone: 'Hobbies & Lifestyle' },
  { label: 'Home Improvement (ZONA)', kind: 'zone', zone: 'Home Improvement' },
  { label: 'Electrical', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Fans & Air Treatment', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Lighting', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Locker, Cabinet, & Racking', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Paint Ladder BM', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Plumbing & Sanitary', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Safes, Office, & Security Systems', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Tools & Hardware', kind: 'dept', zone: 'Home Improvement' },
  { label: 'Home Living (ZONA)', kind: 'zone', zone: 'Home Living' },
  { label: 'Appliances', kind: 'dept', zone: 'Home Living' },
  { label: 'Cleaning', kind: 'dept', zone: 'Home Living' },
  { label: 'Home Comfort', kind: 'dept', zone: 'Home Living' },
  { label: 'Home Storage', kind: 'dept', zone: 'Home Living' },
  { label: 'Kitchenware', kind: 'dept', zone: 'Home Living' },
]

const DEPT_GROUPS: DeptGroupDef[] = [
  { zone: 'Hobbies & Lifestyle', start: 0, end: 7 },
  { zone: 'Home Improvement', start: 7, end: 16 },
  { zone: 'Home Living', start: 16, end: 22 },
]

export interface DeptMetric {
  label: string
  kind: DeptKind
  zone: string
  value: number
  target?: number
  achievement?: number
}

export interface DeptPeriodZone {
  zone: string
  value: number
  target?: number
  achievement?: number
  departments: DeptMetric[]
}

export interface DeptPeriodData {
  date?: string
  total: number
  target?: number
  achievement?: number
  zones: DeptPeriodZone[]
  departments: DeptMetric[]
}

export interface DeptPerformanceData {
  sbd: DeptPeriodData | null
  mtd: DeptPeriodData | null
}

function buildPeriodData(date: string | undefined, labels: string[], values: string[], targetsByIndex?: number[]): DeptPeriodData {
  const departments: DeptMetric[] = labels.map((label, index) => {
    const node = DEPT_NODES[index]
    const value = n(values[index] ?? '')
    const target = targetsByIndex?.[index]
    return {
      label: label || node?.label || `Item ${index + 1}`,
      kind: node?.kind ?? (/zona/i.test(label) ? 'zone' : 'dept'),
      zone: node?.zone ?? '',
      value,
      target,
      achievement: target && target > 0 ? parseFloat(((value / target) * 100).toFixed(1)) : undefined,
    }
  })

  const zones: DeptPeriodZone[] = DEPT_GROUPS.map(group => {
    const zoneDepartments = departments.slice(group.start + 1, group.end)
    const zoneValue = zoneDepartments.reduce((sum, item) => sum + item.value, 0)
    const zoneTarget = zoneDepartments.reduce((sum, item) => sum + (item.target ?? 0), 0)
    return {
      zone: group.zone,
      value: zoneValue,
      target: zoneTarget > 0 ? zoneTarget : undefined,
      achievement: zoneTarget > 0 ? parseFloat(((zoneValue / zoneTarget) * 100).toFixed(1)) : undefined,
      departments: zoneDepartments,
    }
  })

  const leafDepartments = departments.filter(item => item.kind !== 'zone')
  const total = leafDepartments.reduce((sum, item) => sum + item.value, 0)
  const target = leafDepartments.some(item => typeof item.target === 'number')
    ? leafDepartments.reduce((sum, item) => sum + (item.target ?? 0), 0)
    : undefined
  return {
    date,
    total,
    target,
    achievement: target && target > 0 ? parseFloat(((total / target) * 100).toFixed(1)) : undefined,
    zones,
    departments,
  }
}

function findLatestDateColumn(headerRow: string[]): { index: number; date: string; day: number } | null {
  let latest: { index: number; date: string; day: number } | null = null
  for (let col = 2; col <= 32; col++) {
    const date = g(headerRow, col)
    const day = parseDay(date)
    if (!day) continue
    if (!latest || day > latest.day || (day === latest.day && col > latest.index)) {
      latest = { index: col, date, day }
    }
  }
  return latest
}

function findLatestSalesDateColumn(headerRow: string[], dataRows: string[][]): { index: number; date: string; day: number } | null {
  let latest: { index: number; date: string; day: number } | null = null
  for (let col = 2; col <= 32; col++) {
    const date = g(headerRow, col)
    const day = parseDay(date)
    if (!day) continue

    let totalSales = 0
    for (let rowIndex = 0; rowIndex < DEPT_NODES.length; rowIndex++) {
      if (DEPT_NODES[rowIndex].kind === 'zone') continue
      totalSales += n(g(dataRows[rowIndex] ?? [], col))
    }

    if (totalSales > 0) {
      latest = { index: col, date, day }
    }
  }
  return latest
}

function findRowByDay(rows: string[][], day: number): { row: string[]; date: string; day: number } | null {
  for (const row of rows) {
    const date = g(row, 20)
    if (parseDay(date) === day) {
      return { row, date, day }
    }
  }
  return null
}

function findLatestTargetRow(rows: string[][]): { row: string[]; date: string; day: number } | null {
  let latest: { row: string[]; date: string; day: number } | null = null
  for (const row of rows) {
    const date = g(row, 20)
    const day = parseDay(date)
    if (!day) continue
    if (!latest || day > latest.day) {
      latest = { row, date, day }
    }
  }
  return latest
}

function buildTargetValues(row: string[] | null | undefined): number[] | undefined {
  if (!row) return undefined
  const targets: number[] = []
  for (let index = 0; index < DEPT_NODES.length; index++) {
    targets.push(n(g(row, 21 + index)))
  }
  return targets
}

function buildFlatSBDTargets(row: string[] | null | undefined): number[] | undefined {
  if (!row) return undefined
  const targets: number[] = []
  // Read from columns V (22), W (23), X (24), ... AQ (33) for SBD flat targets
  for (let index = 0; index < DEPT_NODES.length; index++) {
    targets.push(n(g(row, 22 + index)))
  }
  return targets
}

export async function fetchPencapaianDept(): Promise<DeptPerformanceData> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Pencapaian Dept')}&_t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok || text.trimStart().startsWith('<!')) throw new Error('Sheet "Pencapaian Dept" tidak bisa dibaca')

  const raw = parseCSV(text)
  if (raw.length < 40) return { sbd: null, mtd: null }

  // Sales harian: baris 81 = tanggal, baris 82:103 = nama zone/dept + sales harian
  const sbdHeaderRow = raw[80] ?? []
  const sbdDataRows = raw.slice(81, 103)
  const sbdLabels = sbdDataRows.map(row => g(row, 1))
  const sbdDateInfo = findLatestDateColumn(sbdHeaderRow)
  const mtdSalesDateInfo = findLatestSalesDateColumn(sbdHeaderRow, sbdDataRows) ?? sbdDateInfo

  const mtdDateRows = raw.slice(2, 33)
  const latestTargetRow = mtdSalesDateInfo ? findRowByDay(mtdDateRows, mtdSalesDateInfo.day) ?? findLatestTargetRow(mtdDateRows) : findLatestTargetRow(mtdDateRows)
  
  // SBD uses flat targets from columns V3:AQ3 and shows TODAY label
  const sbdFlatTargetRow = mtdDateRows[0] ?? null
  const sbdTargetValues = buildFlatSBDTargets(sbdFlatTargetRow)
  const mtdTargetValues = buildTargetValues(latestTargetRow?.row)

  const sbd = sbdDateInfo
    ? buildPeriodData(
        'TODAY',
        sbdLabels,
        sbdDataRows.map(row => g(row, sbdDateInfo.index)),
        sbdTargetValues,
      )
    : null

  const referenceDailyInfo = mtdSalesDateInfo
  const cumulativeValues = referenceDailyInfo
    ? DEPT_NODES.map((_, deptIndex) => {
        let total = 0
        for (let col = 2; col <= referenceDailyInfo.index; col++) {
          total += n(g(sbdDataRows[deptIndex] ?? [], col))
        }
        return String(total)
      })
    : DEPT_NODES.map(() => '0')

  const mtd = latestTargetRow
    ? buildPeriodData(
        latestTargetRow.date,
        sbdLabels,
        cumulativeValues,
        mtdTargetValues,
      )
    : null

  return { sbd, mtd }
}
