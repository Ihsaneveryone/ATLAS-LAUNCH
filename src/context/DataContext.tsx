import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { YTD_PERFORMANCE } from '../data/mockData'
import { fetchUsers } from '../services/sheetsApi'
import type { TeamEmployeeSummary } from '../services/rawDataApi'
import { buildRawPerformance, fetchMenuConfig } from '../services/rawDataApi'
import { fetchPencapaianToko, type TokoRow } from '../services/tokoApi'
import { niksMatch } from '../services/nik'
import type { User, PerformanceData, DailyTrend, KPIItem } from '../data/mockData'

function emptyPerformance(workingDays = 1): PerformanceData {
  const safeDays = Math.max(workingDays, 1)
  return {
    achievement: 0,
    target: 0,
    targetMTD: 0,
    actual: 0,
    acv: 0,
    workingDays: safeDays,
    kpis: [] as KPIItem[],
    ranking: [],
    dailyTrend: [],
    monthlyTrend: [],
  }
}

export interface AtlasData {
  users:            User[]
  todayPerf:        PerformanceData
  mtdPerf:          PerformanceData
  ytdPerf:          PerformanceData
  dailyDate:        string
  teamTodayTrend:   DailyTrend[]
  teamMtdTrend:     DailyTrend[]
  teamTodayEmployees: TeamEmployeeSummary[]
  teamMtdEmployees: TeamEmployeeSummary[]
  loading:          boolean
  error:            string | null
  usingLive:        boolean
  debugLog:         string[]
  menuConfig:       Record<string, boolean>
  tokoRows:         TokoRow[]
  reload:           (nik: string) => void
  reloadMenuConfig: () => void
}

export const DataContext = createContext<AtlasData>({
  users:            [],
  todayPerf:        emptyPerformance(1),
  mtdPerf:          emptyPerformance(1),
  ytdPerf:          YTD_PERFORMANCE,
  dailyDate:        '',
  teamTodayTrend:   [],
  teamMtdTrend:     [],
  teamTodayEmployees: [],
  teamMtdEmployees: [],
  loading:          false,
  error:            null,
  usingLive:        false,
  debugLog:         [],
  menuConfig:       {},
  tokoRows:         [],
  reload:           () => {},
  reloadMenuConfig: () => {},
})

export function useAtlasData() {
  return useContext(DataContext)
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Omit<AtlasData, 'reload' | 'reloadMenuConfig'>>({
    users:      [],
    todayPerf:  emptyPerformance(1),
    mtdPerf:    emptyPerformance(1),
    ytdPerf:    YTD_PERFORMANCE,
    dailyDate:  '',
    teamTodayTrend: [],
    teamMtdTrend:   [],
    teamTodayEmployees: [],
    teamMtdEmployees: [],
    loading:    false,
    error:      null,
    usingLive:  false,
    debugLog:   [],
    menuConfig: {},
    tokoRows:   [],
  })

  const reloadMenuConfig = useCallback(() => {
    fetchMenuConfig().then(menuConfig => {
      console.warn('[MENU-CONFIG] Polled:', JSON.stringify(menuConfig))
      setData(prev => ({ ...prev, menuConfig }))
    }).catch(() => {})
  }, [])

  // Fetch users + menu config on mount, then poll every 30s
  // Also re-fetch when tab becomes visible (handles background throttling)
  useEffect(() => {
    fetchUsers().then(users => {
      if (users.length > 0) setData(prev => ({ ...prev, users }))
    }).catch(() => {})
    reloadMenuConfig()
    const interval = setInterval(reloadMenuConfig, 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') reloadMenuConfig() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [reloadMenuConfig])

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('id-ID')
    console.warn(`[ATLAS ${ts}] ${msg}`)
    setData(prev => ({ ...prev, debugLog: [...prev.debugLog.slice(-19), `[${ts}] ${msg}`] }))
  }, [])

  const reload = useCallback(async (nik: string) => {
    setData(prev => ({ ...prev, loading: true, error: null, debugLog: [`[${new Date().toLocaleTimeString('id-ID')}] reload() untuk NIK: ${nik}`] }))

    log('Test koneksi ke Google…')
    void fetch('https://docs.google.com/favicon.ico', { mode: 'no-cors' })
      .then(ping => log(`Koneksi OK (mode: no-cors, type: ${ping.type})`))
      .catch((pingErr: any) => log(`GAGAL koneksi: ${pingErr?.message ?? pingErr}`))

    const tokoRowsPromise = fetchPencapaianToko()

    // ── USERS ────────────────────────────────────────────────────
    let liveUsers: User[] = []
    try {
      log('Mengambil data users…')
      const fetched = await fetchUsers()
      log(`✅ USERS: ${fetched.length} karyawan`)
      if (fetched.length > 0) liveUsers = fetched
    } catch (e: any) {
      log(`❌ USERS gagal: ${e?.message ?? e}`)
    }

    // ── RAW DATA (COPAS S2) ───────────────────────────────────────
    let todayPerf = emptyPerformance(1)
    let mtdPerf   = emptyPerformance(1)
    let dailyDate = ''
    let teamTodayTrend: DailyTrend[] = []
    let teamMtdTrend: DailyTrend[] = []
    let teamTodayEmployees: TeamEmployeeSummary[] = []
    let teamMtdEmployees: TeamEmployeeSummary[] = []
    let rawPerfError: string | null = null
    try {
      log('Mengolah data mentah COPAS S2…')
      // Hanya NIK dengan role 'user' yang masuk ranking — exclude admin & NIK anomali
      const validNiks = new Set(liveUsers.filter(u => u.role === 'user').map(u => u.nik))
      const result = await buildRawPerformance(nik, log, validNiks)
      const todayRanking = result.todayPerf.ranking.map(employee => {
        const user = liveUsers.find(candidate => niksMatch(candidate.nik, employee.nik))
        return user?.nama?.trim() ? { ...employee, nama: user.nama.trim() } : employee
      })
      todayPerf = { ...result.todayPerf, ranking: todayRanking }
      mtdPerf   = result.mtdPerf
      dailyDate = result.dailyDate
      teamTodayTrend = result.teamTodayTrend
      teamMtdTrend = result.teamMtdTrend
      // Today memakai nama resmi USERS agar nama placeholder seperti Default
      // dari transaksi tidak menimpa nama karyawan.
      teamTodayEmployees = result.teamTodayEmployees.map(employee => {
        const user = liveUsers.find(candidate => niksMatch(candidate.nik, employee.nik))
        return user?.nama?.trim() ? { ...employee, nama: user.nama.trim() } : employee
      })
      const officialName = (nik: string) => liveUsers.find(candidate => niksMatch(candidate.nik, nik))?.nama?.trim()
      teamMtdEmployees = result.teamMtdEmployees.map(employee => {
        const name = officialName(employee.nik)
        return name ? { ...employee, nama: name } : employee
      })
      mtdPerf = {
        ...mtdPerf,
        ranking: mtdPerf.ranking.map(employee => {
          const name = officialName(employee.nik)
          return name ? { ...employee, nama: name } : employee
        }),
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      rawPerfError = `Gagal ambil data performa spreadsheet: ${msg}`
      log(`❌ Error: ${msg}`)
    }

    // ── PENCAPAIAN TOKO ───────────────────────────────────────────
    let tokoRows: TokoRow[] = []
    try {
      log('Mengambil data Pencapaian Toko…')
      tokoRows = await tokoRowsPromise
      log(`✅ Pencapaian Toko: ${tokoRows.length} baris`)
    } catch (e: any) { log(`❌ Pencapaian Toko gagal: ${e?.message ?? e}`) }

    const anyLive = liveUsers.length > 0 || todayPerf.actual > 0 || mtdPerf.actual > 0
    const ts = new Date().toLocaleTimeString('id-ID')
    setData(prev => ({
      ...prev,
      users: liveUsers,
      todayPerf,
      mtdPerf,
      ytdPerf:   YTD_PERFORMANCE,
      dailyDate,
      teamTodayTrend,
      teamMtdTrend,
      teamTodayEmployees,
      teamMtdEmployees,
      tokoRows,
      loading:   false,
      error:     rawPerfError,
      usingLive: anyLive,
      debugLog:  [...prev.debugLog, `[${ts}] ${anyLive ? '✅ Selesai (live)' : '⚠ Selesai (fallback kosong)'}`],
    }))
  }, [log])

  return (
    <DataContext.Provider value={{ ...data, reload, reloadMenuConfig }}>
      {children}
    </DataContext.Provider>
  )
}
