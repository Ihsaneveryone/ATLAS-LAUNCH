import { Suspense, lazy, useState } from 'react'
import { DataProvider } from './context/DataContext'
import { AdminSettingsProvider } from './context/AdminSettingsContext'
import { useAtlasData } from './context/useAtlasData'
import LoginPage from './components/LoginPage'
import MenuPage from './components/MenuPage'
import type { User } from './data/mockData'

const PerformanceSales = lazy(() => import('./components/PerformanceSales'))
const ForecastingInsentif = lazy(() => import('./components/ForecastingInsentif'))
const PencapaianToko = lazy(() => import('./components/PencapaianToko'))
const SpreadsheetGuide = lazy(() => import('./components/SpreadsheetGuide'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))

type Page = 'login' | 'menu' | 'performance' | 'forecasting' | 'toko' | 'spreadsheet' | 'admin'

function AppInner() {
  const [page, setPage] = useState<Page>('login')
  const [user, setUser] = useState<User | null>(null)
  const { reload } = useAtlasData()

  const handleLogin = (u: User) => {
    setUser(u)
    setPage(u.role === 'admin' ? 'admin' : 'menu')
    reload(u.nik)
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
