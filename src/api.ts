export interface Ad {
  id: number
  title: string
  description: string
  createdAt: string
  updatedAt: string
  // Poster's display name, or "Unknown" for an ad without an owner
  authorName: string
  // True only when the caller is logged in and owns the ad
  ownedByMe: boolean
}

export interface AdInput {
  title: string
  description: string
}

export interface CurrentUser {
  id: number
  email: string
  displayName: string
}

export interface SignupInput {
  email: string
  displayName: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface MeResponse {
  user: CurrentUser | null
}

interface ApiErrorOptions {
  code?: string
  detail: string
  fieldErrors?: Record<string, string>
}

// A refused or failed request. `detail` is the text to show the user; behaviour keys on `code`.
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly detail: string
  readonly fieldErrors: Record<string, string>

  constructor(status: number, { code, detail, fieldErrors = {} }: ApiErrorOptions) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
    this.fieldErrors = fieldErrors
  }
}

export const GENERIC_ERROR_MESSAGE = 'Something went wrong, please try again.'
export const SESSION_ENDED_MESSAGE = 'Your session ended. Please log in again.'
export const CSRF_EXPIRED_MESSAGE = 'Your session security token expired. Please try again.'
export const REQUEST_TIMEOUT_MS = 10_000

// Empty in development (requests go through the Vite proxy). VITE_API_BASE_URL must point to the
// same origin as the page: the session and anti-forgery cookies are only sent same-origin.
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`
const XSRF_COOKIE = 'XSRF-TOKEN'
const XSRF_HEADER = 'X-XSRF-TOKEN'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// ---- Session-ended signal (FR3.4) ----

type SessionEndedListener = () => void

const sessionEndedListeners = new Set<SessionEndedListener>()

// Called when a non-auth request is refused because the caller is no longer logged in.
// Returns a function that removes the listener.
export function onSessionEnded(listener: SessionEndedListener): () => void {
  sessionEndedListeners.add(listener)
  return () => {
    sessionEndedListeners.delete(listener)
  }
}

function notifySessionEnded() {
  for (const listener of [...sessionEndedListeners]) {
    listener()
  }
}

// ---- Cookies ----

// Reads a script-readable cookie. The anti-forgery token is rotated by the backend after sign-up,
// log-in and log-out, so callers must read it fresh for every request.
export function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const entry = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  if (entry === undefined) return null
  const raw = entry.slice(prefix.length)
  try {
    return decodeURIComponent(raw)
  } catch {
    // Not percent-encoded; the raw value is the token
    return raw
  }
}

// ---- Problem details ----

interface ParsedProblem {
  code?: string
  detail?: string
  fieldErrors: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseFieldErrors(errors: unknown): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  if (!Array.isArray(errors)) return fieldErrors
  for (const item of errors) {
    if (!isRecord(item) || typeof item.field !== 'string' || typeof item.message !== 'string') continue
    // Keep the first message per field
    if (!Object.hasOwn(fieldErrors, item.field)) fieldErrors[item.field] = item.message
  }
  return fieldErrors
}

function parseProblem(body: unknown): ParsedProblem {
  if (!isRecord(body)) return { fieldErrors: {} }
  return {
    code: typeof body.code === 'string' && body.code !== '' ? body.code : undefined,
    detail: typeof body.detail === 'string' && body.detail.trim() !== '' ? body.detail : undefined,
    fieldErrors: parseFieldErrors(body.errors),
  }
}

function isAuthPath(path: string): boolean {
  return path.startsWith('/auth/')
}

// Keyed on `code`; falls back to the HTTP status only when the backend sent no `code`.
function endsSession(path: string, status: number, code?: string): boolean {
  if (isAuthPath(path)) return false
  return code === 'not_authenticated' || (code === undefined && status === 401)
}

function messageFor(path: string, status: number, problem: ParsedProblem): string {
  const { code, detail } = problem
  if (endsSession(path, status, code)) return SESSION_ENDED_MESSAGE
  if (code === 'csrf_invalid') return CSRF_EXPIRED_MESSAGE
  if (code === 'internal_error') return GENERIC_ERROR_MESSAGE
  if (code !== undefined) return detail ?? GENERIC_ERROR_MESSAGE
  if ([401, 403, 409, 423].includes(status)) return detail ?? GENERIC_ERROR_MESSAGE
  return GENERIC_ERROR_MESSAGE
}

// Fetches a fresh anti-forgery cookie. Failures are ignored on purpose: the caller already
// rejects with the "token expired" message, and the user's next attempt reports any real problem.
async function refreshCsrfToken() {
  try {
    await request<MeResponse>('/auth/me')
  } catch {
    // see above
  }
}

async function problemError(path: string, response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null)
  const problem = parseProblem(body)
  if (problem.code === 'csrf_invalid') {
    // Never resend the write automatically (contract: no automatic retries)
    await refreshCsrfToken()
  }
  if (endsSession(path, response.status, problem.code)) notifySessionEnded()
  return new ApiError(response.status, {
    code: problem.code,
    detail: messageFor(path, response.status, problem),
    fieldErrors: problem.fieldErrors,
  })
}

// ---- Transport ----

function buildHeaders(method: string, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (hasBody) headers['Content-Type'] = 'application/json'
  if (!SAFE_METHODS.has(method)) {
    const token = readCookie(XSRF_COOKIE)
    if (token !== null) headers[XSRF_HEADER] = token
  }
  return headers
}

interface RequestOptions {
  method?: string
  body?: unknown
}

async function request<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: buildHeaders(method, body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw await problemError(path, response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    // Network failures, timeouts and unreadable bodies all get the generic message
    if (error instanceof ApiError) throw error
    throw new ApiError(0, { detail: GENERIC_ERROR_MESSAGE })
  } finally {
    clearTimeout(timer)
  }
}

// ---- Ads ----

export function listAds(): Promise<Ad[]> {
  return request('/ads')
}

export function createAd(input: AdInput): Promise<Ad> {
  return request('/ads', { method: 'POST', body: input })
}

export function updateAd(id: number, input: AdInput): Promise<Ad> {
  return request(`/ads/${id}`, { method: 'PUT', body: input })
}

// ---- Authentication ----

// Also issues the XSRF-TOKEN cookie, so call it before the first write
export async function getMe(): Promise<MeResponse> {
  const response = await request<unknown>('/auth/me')
  if (!isRecord(response) || !('user' in response)) {
    throw new ApiError(0, { detail: GENERIC_ERROR_MESSAGE })
  }
  return { user: isRecord(response.user) ? (response.user as unknown as CurrentUser) : null }
}

export function signup(input: SignupInput): Promise<CurrentUser> {
  return request('/auth/signup', { method: 'POST', body: input })
}

export function login(input: LoginInput): Promise<CurrentUser> {
  return request('/auth/login', { method: 'POST', body: input })
}

export function logout(): Promise<void> {
  return request('/auth/logout', { method: 'POST' })
}
