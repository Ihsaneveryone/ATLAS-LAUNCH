import { useState } from 'react'
import type { CSSProperties } from 'react'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import { USERS as MOCK_USERS, type User } from '../data/mockData'
import { useAtlasData } from '../context/useAtlasData'
import { fetchUsers } from '../services/sheetsApi'
import { trackLogin } from '../services/loginTracker'

interface Props { onLogin: (user: User) => void }

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function LoginPage({ onLogin }: Props) {
  const { users: liveUsers } = useAtlasData()
  const USERS = liveUsers.length > 0 ? liveUsers : MOCK_USERS

  const [nik, setNik]           = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)
  const [focused, setFocused]   = useState<string | null>(null)

  const passwordManagerIgnoreProps = {
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
  } as const

  const passwordMaskStyle = {
    WebkitTextSecurity: showPw ? 'none' : 'disc',
  } as CSSProperties & { WebkitTextSecurity: 'none' | 'disc' }

  const normNik = (s: string) => s.trim().toLowerCase()
  const normPw = (s: string) => s.trim().toLowerCase()

  const buildAuthCandidates = (users: User[]) => {
    const authCandidates = [...users]
    const fallbackAdmin = MOCK_USERS.find(u => u.role === 'admin')
    if (fallbackAdmin && !authCandidates.some(u => normNik(u.nik) === normNik(fallbackAdmin.nik))) {
      authCandidates.unshift(fallbackAdmin)
    }
    return authCandidates
  }

  const findAuthenticatedUser = (users: User[], inputNik: string, inputPassword: string) => {
    const authCandidates = buildAuthCandidates(users)
    const match = authCandidates.find(u => normNik(u.nik) === inputNik)
    return match && normPw(match.password) === inputPassword ? match : undefined
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const inputNik = normNik(nik)
    const inputPassword = normPw(password)

    // Fast path: use already loaded users so returning users/admins can enter immediately.
    let user = findAuthenticatedUser(USERS, inputNik, inputPassword)

    // Slow path only when cached data does not match, so newly added users can still log in.
    if (!user) {
      try {
        const fetched = await fetchUsers()
        if (fetched.length > 0) user = findAuthenticatedUser(fetched, inputNik, inputPassword)
      } catch {
        // fallback to cached auth result above
      }
    }

    if (user) { trackLogin(user.nik, user.nama).catch(() => {}); onLogin(user) } else {
      setError('NIK atau password salah. Silakan coba lagi.')
      setLoading(false)
    }
  }

  const ring = (name: string) => focused === name

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(145deg, #e8f0ff 0%, #f5f0ff 40%, #fff0f0 100%)',
    }}>
      {/* Left panel - branding */}
      <div style={{
        display: 'none',
        flex: 1,
        background: 'linear-gradient(145deg, #D93119 0%, #7c1409 100%)',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        padding: 48, gap: 24,
      }} className="login-left">
          <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginBottom: 8 }}>ATLAS A321</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 280, lineHeight: 1.6 }}>
            Sales Performance Dashboard<br/>A321
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px',
      }}>
        <div style={{
          width: '100%', maxWidth: 420,
          background: '#fff', borderRadius: 24, padding: '40px 36px',
          boxShadow: '0 20px 60px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          border: '1px solid rgba(255,255,255,0.9)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <img src={azkoLogo} alt="Azko" style={{
              width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center',
              boxShadow: '0 4px 14px rgba(217,49,25,0.3)',
            }}/>
            <div>
              <div style={{ color: '#1e293b', fontWeight: 800, fontSize: 17, letterSpacing: '0.05em' }}>ATLAS A321</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Sales Performance · A321</div>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ color: '#1e293b', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Selamat Datang</h1>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Masuk dengan NIK dan password Anda</p>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" {...passwordManagerIgnoreProps} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* NIK */}
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>NIK Karyawan</label>
              <input
                type="text" value={nik} onChange={e => setNik(e.target.value)} required
                name="atlas-nik"
                autoComplete="off" inputMode="numeric" placeholder="Masukkan NIK Anda"
                onFocus={() => setFocused('nik')} onBlur={() => setFocused(null)}
                {...passwordManagerIgnoreProps}
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 15, outline: 'none',
                  background: ring('nik') ? '#fff' : '#f8faff',
                  border: `1.5px solid ${ring('nik') ? '#D93119' : '#dde3f0'}`,
                  color: '#1e293b', transition: 'all 0.18s',
                  boxShadow: ring('nik') ? '0 0 0 3px rgba(217,49,25,0.1)' : 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text" value={password} onChange={e => setPassword(e.target.value)} required
                  name="atlas-access-code"
                  autoComplete="new-password" placeholder="Masukkan password"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                  {...passwordManagerIgnoreProps}
                  style={{
                    width: '100%', padding: '13px 48px 13px 16px', borderRadius: 12, fontSize: 15, outline: 'none',
                    background: ring('pw') ? '#fff' : '#f8faff',
                    border: `1.5px solid ${ring('pw') ? '#D93119' : '#dde3f0'}`,
                    color: '#1e293b', transition: 'all 0.18s',
                    boxShadow: ring('pw') ? '0 0 0 3px rgba(217,49,25,0.1)' : 'none',
                    ...passwordMaskStyle,
                    boxSizing: 'border-box',
                  }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', padding: 0, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '11px 14px', borderRadius: 10, background: '#fff5f5', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
                ⚠ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '14px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #D93119 0%, #ff5733 100%)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1,
              transition: 'all 0.2s', boxShadow: '0 6px 20px rgba(217,49,25,0.35)',
            }}>
              {loading ? 'Memverifikasi…' : 'Masuk →'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', color: '#cbd5e1', fontSize: 12 }}>
            © 2026 ATLAS A321 · Sales Performance Dashboard
          </div>
        </div>
      </div>
    </div>
  )
}
