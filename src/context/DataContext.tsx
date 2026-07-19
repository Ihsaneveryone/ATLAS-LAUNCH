import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { TODAY_PERFORMANCE, MTD_PERFORMANCE, YTD_PERFORMANCE, USERS as MOCK_USERS } from '../data/mockData'
import { fetchUsers } from '../services/sheetsApi'
import { buildRawPerformance, fetchMenuConfig } from '../services/rawDataApi'
import { fetchPencapaianToko, type TokoRow } from '../services/tokoApi'
import type { User, PerformanceData, DailyTrend } from '../data/mockData'

export interface AtlasData {
  users:            User[]
  todayPerf:        PerformanceData
  mtdPerf:          PerformanceData
  ytdPerf:          PerformanceData
  dailyDate:        string
  teamTodayTrend:   DailyTrend[]
  teamMtdTrend:     DailyTrend[]
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
  users:            MOCK_USERS,
  todayPerf:        TODAY_PERFORMANCE,
  mtdPerf:          MTD_PERFORMANCE,
  ytdPerf:          YTD_PERFORMANCE,
  dailyDate:        '',
  teamTodayTrend:   [],
  teamMtdTrend:     [],
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
    users:      MOCK_USERS,
    todayPerf:  TODAY_PERFORMANCE,
    mtdPerf:    MTD_PERFORMANCE,
    ytdPerf:    YTD_PERFORMANCE,
    dailyDate:  '',
    teamTodayTrend: [],
    teamMtdTrend:   [],
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

    try {
      log('Test koneksi ke Google…')
      const ping = await fetch('https://docs.google.com/favicon.ico', { mode: 'no-cors' })
      log(`Koneksi OK (mode: no-cors, type: ${ping.type})`)
    } catch (pingErr: any) {
      log(`GAGAL koneksi: ${pingErr?.message ?? pingErr}`)
      setData(prev => ({
        ...prev, loading: false, usingLive: false,
        error: `Tidak bisa terhubung ke internet dari sandbox ini: ${pingErr?.message}`,
      }))
      return
    }

    // ── USERS ────────────────────────────────────────────────────
    let liveUsers = MOCK_USERS
    try {
      log('Mengambil data users…')
      const fetched = await fetchUsers()
      log(`✅ USERS: ${fetched.length} karyawan`)
      if (fetched.length > 0) liveUsers = fetched
    } catch (e: any) {
      log(`❌ USERS gagal: ${e?.message ?? e}`)
    }

    // ── RAW DATA (COPAS S2) ───────────────────────────────────────
    let todayPerf = TODAY_PERFORMANCE
    let mtdPerf   = MTD_PERFORMANCE
    let dailyDate = ''
    let teamTodayTrend: DailyTrend[] = []
    let teamMtdTrend: DailyTrend[] = []
    try {
      log('Mengolah data mentah COPAS S2…')
      // Hanya NIK dengan role 'user' yang masuk ranking — exclude admin & NIK anomali
      const validNiks = new Set(liveUsers.filter(u => u.role === 'user').map(u => u.nik))
      const result = await buildRawPerformance(nik, log, validNiks)
      todayPerf = result.todayPerf
      mtdPerf   = result.mtdPerf
      dailyDate = result.dailyDate
      teamTodayTrend = result.teamTodayTrend
      teamMtdTrend = result.teamMtdTrend
    } catch (e: any) { log(`❌ Error: ${e?.message ?? e}`) }

    // ── PENCAPAIAN TOKO ───────────────────────────────────────────
    let tokoRows: TokoRow[] = []
    try {
      log('Mengambil data Pencapaian Toko…')
      tokoRows = await fetchPencapaianToko()
      log(`✅ Pencapaian Toko: ${tokoRows.length} baris`)
    } catch (e: any) { log(`❌ Pencapaian Toko gagal: ${e?.message ?? e}`) }

    const anyLive = liveUsers !== MOCK_USERS || todayPerf !== TODAY_PERFORMANCE || mtdPerf !== MTD_PERFORMANCE
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
      tokoRows,
      loading:   false,
      error:     null,
      usingLive: anyLive,
      debugLog:  [...prev.debugLog, `[${ts}] ${anyLive ? '✅ Selesai (live)' : '⚠ Selesai (mock)'}`],
    }))
  }, [log])

  return (
    <DataContext.Provider value={{ ...data, reload, reloadMenuConfig }}>
      {children}
    </DataContext.Provider>
  )
}
