import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from './api'
import type { Credentials, User } from './api'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null)) // 401 means anonymous; other failures also leave the user logged out
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (credentials: Credentials) => {
    setUser(await api.login(credentials))
    setSessionExpired(false)
  }, [])

  const register = useCallback(async (credentials: Credentials) => {
    await api.register(credentials) // no session is created, so the user stays anonymous
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setSessionExpired(false)
    }
  }, [])

  const expireSession = useCallback(() => {
    setUser(null)
    setSessionExpired(true)
  }, [])

  const value = useMemo(
    () => ({ user, loading, sessionExpired, login, register, logout, expireSession }),
    [user, loading, sessionExpired, login, register, logout, expireSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
