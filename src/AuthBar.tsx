import AuthForm from './AuthForm'
import { useAuth } from './useAuth'

export default function AuthBar() {
  const { user, loading, logout } = useAuth()

  if (loading) return <p className="muted">Checking session…</p>

  if (!user) {
    return (
      <section>
        <AuthForm />
      </section>
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
