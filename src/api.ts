export interface Ad {
  id: number
  title: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface AdInput {
  title: string
  description: string
}

export interface User {
  id: number
  email: string
}

export interface Credentials {
  email: string
  password: string
}

// Empty in development (requests go through the Vite proxy); set VITE_API_BASE_URL for other setups
const API_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`
const ADS_URL = `${API_URL}/ads`
const AUTH_URL = `${API_URL}/auth`

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// The backend issues the CSRF token as a readable cookie and expects it back in a header
function readCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const csrfToken = method === 'GET' ? undefined : readCsrfToken()
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-XSRF-TOKEN': csrfToken }),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new ApiError(response.status, problem?.detail ?? `Request failed with status ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

export function listAds(): Promise<Ad[]> {
  return request(ADS_URL)
}

export function createAd(input: AdInput): Promise<Ad> {
  return request(ADS_URL, { method: 'POST', body: JSON.stringify(input) })
}

export function updateAd(id: number, input: AdInput): Promise<Ad> {
  return request(`${ADS_URL}/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function register(credentials: Credentials): Promise<User> {
  return request(`${AUTH_URL}/register`, { method: 'POST', body: JSON.stringify(credentials) })
}

export function login(credentials: Credentials): Promise<User> {
  return request(`${AUTH_URL}/login`, { method: 'POST', body: JSON.stringify(credentials) })
}

export function logout(): Promise<void> {
  return request(`${AUTH_URL}/logout`, { method: 'POST' })
}

// Resolves to null when nobody is signed in (401) or the backend has no auth endpoints yet (404)
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await request<User>(`${AUTH_URL}/me`)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
      return null
    }
    throw e
  }
}
