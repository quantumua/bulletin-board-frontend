import { useAuth } from './useAuth'

export default function AuthBar({ onLogin }: { onLogin: () => void }) {
  const { user, loading, logout } = useAuth()

  if (loading) return <span className="muted">Checking session…</span>

  if (!user) {
    return (
      <button type="button" onClick={onLogin}>
        Log in
      </button>
    )
  }

  return (
    <div className="auth-bar">
      <span>
        Signed in as <strong>{user.username}</strong>
      </span>
      <button type="button" className="secondary" onClick={() => logout().catch(() => {})}>
        Log out
      </button>
    </div>
  )
}
