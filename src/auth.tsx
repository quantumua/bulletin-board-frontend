import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from './api'
import type { Credentials, User } from './api'

interface AuthState {
  // 'loading' until the current user has been fetched on mount
  user: User | null | 'loading'
  login: (credentials: Credentials) => Promise<void>
  register: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | 'loading'>('loading')

  useEffect(() => {
    // Also makes the backend issue the XSRF-TOKEN cookie needed for later POSTs
    api
      .getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  const value: AuthState = {
    user,
    login: async (credentials) => setUser(await api.login(credentials)),
    register: async (credentials) => setUser(await api.register(credentials)),
    logout: async () => {
      await api.logout()
      setUser(null)
    },
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

// oxlint-disable-next-line react/only-export-components -- hook belongs with its provider
export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return auth
}
