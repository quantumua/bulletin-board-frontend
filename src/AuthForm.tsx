import { useState, type FormEvent } from 'react'
import { useAuth } from './auth'

interface AuthFormProps {
  mode: 'login' | 'register'
  onCancel?: () => void
}

export default function AuthForm({ mode, onCancel }: AuthFormProps) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const isRegister = mode === 'register'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const submit = isRegister ? auth.register : auth.login
      await submit({ email: email.trim(), password })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} aria-label={isRegister ? 'Register' : 'Sign in'}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          autoComplete="email"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={isRegister ? 8 : undefined}
          maxLength={72}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={saving}>
          {isRegister ? 'Register' : 'Sign in'}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
