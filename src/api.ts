export interface Ad {
  id: number
  title: string
  description: string
  author: string | null
  createdAt: string
  updatedAt: string
}

export interface AdInput {
  title: string
  description: string
}

export interface User {
  id: number
  username: string
}

export interface Credentials {
  username: string
  password: string
}

// Empty in development (requests go through the Vite proxy); set VITE_API_BASE_URL for other setups
const API_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`
const ADS_URL = `${API_URL}/ads`
const AUTH_URL = `${API_URL}/auth`

// Login and register run before a session exists, so the API does not require the CSRF header
const CSRF_EXEMPT = [`${AUTH_URL}/login`, `${AUTH_URL}/register`]

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Read on every call: the token can change when the session starts or ends
function csrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if ((method === 'POST' || method === 'PUT') && !CSRF_EXEMPT.includes(url)) {
    const token = csrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token
  }
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { ...headers, ...init?.headers },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new ApiError(
      problem?.detail ?? `Request failed with status ${response.status}`,
      response.status,
    )
  }
  if (response.status === 204) return undefined as T
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

export function getMe(): Promise<User> {
  return request(`${AUTH_URL}/me`)
}

export function login(credentials: Credentials): Promise<User> {
  return request(`${AUTH_URL}/login`, { method: 'POST', body: JSON.stringify(credentials) })
}

export function register(credentials: Credentials): Promise<User> {
  return request(`${AUTH_URL}/register`, { method: 'POST', body: JSON.stringify(credentials) })
}

export function logout(): Promise<void> {
  return request(`${AUTH_URL}/logout`, { method: 'POST' })
}
