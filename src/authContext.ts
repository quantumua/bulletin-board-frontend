import { createContext } from 'react'
import type { Credentials, User } from './api'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  // True after a write reported the session is gone; cleared by the next login or logout
  sessionExpired: boolean
  login: (credentials: Credentials) => Promise<void>
  register: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
  // Called when the API reports the session is gone (401 on a write)
  expireSession: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
