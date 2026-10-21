import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  onSessionEnded,
  signup as signupRequest,
  type CurrentUser,
  type LoginInput,
  type SignupInput,
} from '../api'

export interface CurrentUserState {
  // The logged-in user, or null for a visitor. Always derived from the backend, never stored.
  user: CurrentUser | null
  // True until the first /auth/me answer (or failure)
  loading: boolean
  // True after a protected request was refused because the session had ended
  sessionEnded: boolean
  // Increases on every sign-up, log-in and log-out, so views can reload session-dependent data
  sessionVersion: number
  signup: (input: SignupInput) => Promise<void>
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
  clearSessionEnded: () => void
}

const CurrentUserContext = createContext<CurrentUserState | null>(null)

export default function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionVersion, setSessionVersion] = useState(0)

  // One /auth/me on page load: restores a login after reload and issues the anti-forgery cookie
  useEffect(() => {
    let active = true
    getMe()
      .then((me) => {
        if (active) setUser(me.user)
      })
      .catch((error: Error) => {
        // Treat the visitor as logged out; the message never contains user data
        console.warn('Could not check the current session:', error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // State changes only: children stay mounted, so typed form input survives (FR3.4)
  useEffect(
    () =>
      onSessionEnded(() => {
        setUser(null)
        setSessionEnded(true)
      }),
    [],
  )

  const startSession = useCallback((nextUser: CurrentUser) => {
    setUser(nextUser)
    setSessionEnded(false)
    setSessionVersion((version) => version + 1)
  }, [])

  const signup = useCallback(
    async (input: SignupInput) => startSession(await signupRequest(input)),
    [startSession],
  )

  const login = useCallback(
    async (input: LoginInput) => startSession(await loginRequest(input)),
    [startSession],
  )

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
    setSessionEnded(false)
    setSessionVersion((version) => version + 1)
  }, [])

  const clearSessionEnded = useCallback(() => setSessionEnded(false), [])

  const value = useMemo<CurrentUserState>(
    () => ({ user, loading, sessionEnded, sessionVersion, signup, login, logout, clearSessionEnded }),
    [user, loading, sessionEnded, sessionVersion, signup, login, logout, clearSessionEnded],
  )

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

// eslint-disable-next-line react/only-export-components -- the hook belongs with its provider
export function useCurrentUser(): CurrentUserState {
  const state = useContext(CurrentUserContext)
  if (state === null) {
    throw new Error('useCurrentUser must be used inside <CurrentUserProvider>')
  }
  return state
}
