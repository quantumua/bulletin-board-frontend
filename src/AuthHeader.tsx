import { useState } from 'react'
import { useAuth } from './auth'
import AuthForm from './AuthForm'

export default function AuthHeader() {
  const { user, logout } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleLogout() {
    setError(null)
    try {
      await logout()
      setMode(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (user === 'loading') {
    return <header className="auth-header" />
  }

  if (user) {
    return (
      <header className="auth-header">
        <span>
          Signed in as <strong>{user.email}</strong>
        </span>
        <button type="button" className="secondary" onClick={handleLogout}>
          Sign out
        </button>
        {error && <p className="error">{error}</p>}
      </header>
    )
  }

  return (
    <header className="auth-header">
      {mode ? (
        <AuthForm key={mode} mode={mode} onCancel={() => setMode(null)} />
      ) : (
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setMode('login')}>
            Sign in
          </button>
          <button type="button" className="secondary" onClick={() => setMode('register')}>
            Register
          </button>
        </div>
      )}
    </header>
  )
}
