import { Suspense, lazy, useEffect, useState } from 'react'
import { DataProvider } from './context/DataContext'
import { AdminSettingsProvider } from './context/AdminSettingsContext'
import { useAtlasData } from './context/useAtlasData'
import LoginPage from './components/LoginPage'
import MenuPage from './components/MenuPage'
import type { User } from './data/mockData'
import { loadYesterdayMgbReviews } from './services/mgbReviewApi'

const PerformanceSales = lazy(() => import('./components/PerformanceSales'))
const ForecastingInsentif = lazy(() => import('./components/ForecastingInsentif'))
const PencapaianToko = lazy(() => import('./components/PencapaianToko'))
const SearchReceipt = lazy(() => import('./components/SearchReceipt'))
const SpreadsheetGuide = lazy(() => import('./components/SpreadsheetGuide'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))

type Page = 'login' | 'menu' | 'performance' | 'forecasting' | 'toko' | 'search-receipt' | 'spreadsheet' | 'admin'

function getJakartaMonthKey(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value ?? ''
  const month = parts.find(part => part.type === 'month')?.value ?? ''
  return `${year}-${month}`
}

function AppInner() {
  const [page, setPage] = useState<Page>('login')
  const [user, setUser] = useState<User | null>(null)
  const { reload } = useAtlasData()

  useEffect(() => {
    if (!user) return

    let loadedMonth = getJakartaMonthKey()
    const reloadForNewMonth = () => {
      const currentMonth = getJakartaMonthKey()
      if (currentMonth === loadedMonth) return
      loadedMonth = currentMonth
      void reload(user.nik)
    }
    const interval = window.setInterval(reloadForNewMonth, 60_000)
    document.addEventListener('visibilitychange', reloadForNewMonth)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', reloadForNewMonth)
    }
  }, [reload, user])

  const handleLogin = (u: User) => {
    if (u.role === 'admin') {
      setUser(u)
      setPage('admin')
      reload(u.nik)
      return
    }

    setUser(u)
    setPage('menu')
    void reload(u.nik)
    void loadYesterdayMgbReviews(u)
  }

  const handleLogout = () => {
    setUser(null)
    setPage('login')
  }

  if (page === 'login' || !user) return <LoginPage onLogin={handleLogin} />
  if (page === 'menu') return <MenuPage user={user} onNavigate={p => setPage(p as Page)} onLogout={handleLogout} />

  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f0f4ff', color: '#64748b', fontWeight: 700 }}>
          Memuat halaman...
        </div>
      }
    >
      {page === 'performance' ? <PerformanceSales user={user} onBack={() => setPage('menu')} /> : null}
      {page === 'forecasting' ? <ForecastingInsentif user={user} onBack={() => setPage('menu')} /> : null}
      {page === 'toko' ? <PencapaianToko user={user} onBack={() => setPage('menu')} /> : null}
      {page === 'search-receipt' ? <SearchReceipt user={user} onBack={() => setPage('menu')} /> : null}
      {page === 'spreadsheet' ? <SpreadsheetGuide user={user} onBack={() => setPage('menu')} /> : null}
      {page === 'admin' ? <AdminDashboard user={user} onLogout={handleLogout} /> : null}
    </Suspense>
  )
}

export default function App() {
  return (
    <DataProvider>
      <AdminSettingsProvider>
        <AppInner />
      </AdminSettingsProvider>
    </DataProvider>
  )
}
