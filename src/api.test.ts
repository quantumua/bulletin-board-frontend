import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  ApiError,
  createAd,
  CSRF_EXPIRED_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  getMe,
  listAds,
  login,
  logout,
  onSessionEnded,
  REQUEST_TIMEOUT_MS,
  SESSION_ENDED_MESSAGE,
  signup,
  updateAd,
  type Ad,
} from './api'

const MARKER_PASSWORD = 'Marker-P4ss-123'

function makeAd(overrides: Partial<Ad> = {}): Ad {
  return {
    id: 1,
    title: 'Bike for sale',
    description: 'Almost new',
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    authorName: 'Ann',
    ownedByMe: false,
    ...overrides,
  }
}

function makeUser() {
  return { id: 7, email: 'ann@example.com', displayName: 'Ann' }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, problem: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ status, title: 'Error', ...problem }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function setCookie(value: string) {
  document.cookie = `XSRF-TOKEN=${value}; path=/`
}

function clearCookie() {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

let fetchMock: Mock<typeof fetch>

function callUrl(index: number): string {
  return String(fetchMock.mock.calls[index][0])
}

function callInit(index: number): RequestInit {
  return fetchMock.mock.calls[index][1] ?? {}
}

function callHeaders(index: number): Record<string, string> {
  return (callInit(index).headers ?? {}) as Record<string, string>
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Expected the request to fail')
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearCookie()
})

describe('ApiClient transport', () => {
  it('calls relative /api/v1 URLs with same-origin credentials', async () => {
    const ads = [makeAd()]
    fetchMock.mockResolvedValueOnce(jsonResponse(ads))

    await expect(listAds()).resolves.toEqual(ads)

    expect(callUrl(0)).toBe('/api/v1/ads')
    expect(callInit(0)).toMatchObject({ method: 'GET', credentials: 'same-origin' })
  })

  it('sends no anti-forgery header on a GET', async () => {
    setCookie('abc')
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: null }))

    await getMe()

    expect(callUrl(0)).toBe('/api/v1/auth/me')
    expect(callHeaders(0)).not.toHaveProperty('X-XSRF-TOKEN')
  })

  it('re-reads the anti-forgery cookie for every POST and PUT', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeAd(), 201))
      .mockResolvedValueOnce(jsonResponse(makeAd({ title: 'Changed' })))

    setCookie('first-token')
    await createAd({ title: 'Bike for sale', description: 'Almost new' })
    setCookie('second-token')
    await updateAd(1, { title: 'Changed', description: 'Almost new' })

    expect(callInit(0).method).toBe('POST')
    expect(callHeaders(0)['X-XSRF-TOKEN']).toBe('first-token')
    expect(callUrl(1)).toBe('/api/v1/ads/1')
    expect(callInit(1).method).toBe('PUT')
    expect(callHeaders(1)['X-XSRF-TOKEN']).toBe('second-token')
    expect(callInit(1).body).toBe(JSON.stringify({ title: 'Changed', description: 'Almost new' }))
  })

  it('resolves a 204 log-out without reading a body', async () => {
    setCookie('abc')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(logout()).resolves.toBeUndefined()

    expect(callUrl(0)).toBe('/api/v1/auth/logout')
    expect(callHeaders(0)['X-XSRF-TOKEN']).toBe('abc')
  })

  it('posts sign-up and log-in to the auth endpoints and returns the user', async () => {
    const user = makeUser()
    fetchMock.mockResolvedValueOnce(jsonResponse(user, 201)).mockResolvedValueOnce(jsonResponse(user))

    await expect(signup({ email: user.email, displayName: 'Ann', password: MARKER_PASSWORD })).resolves.toEqual(user)
    await expect(login({ email: user.email, password: MARKER_PASSWORD })).resolves.toEqual(user)

    expect(callUrl(0)).toBe('/api/v1/auth/signup')
    expect(callUrl(1)).toBe('/api/v1/auth/login')
  })
})

describe('ApiClient errors', () => {
  it('turns a coded problem into an ApiError with field errors', async () => {
    fetchMock.mockResolvedValueOnce(
      problemResponse(400, {
        code: 'validation_failed',
        detail: 'One or more fields are invalid',
        errors: [
          { field: 'password', message: 'must be at least 8 characters' },
          { field: 'displayName', message: 'must not be blank' },
        ],
      }),
    )

    const error = await captureError(signup({ email: 'a@b.c', displayName: ' ', password: 'short12' }))

    expect(error.status).toBe(400)
    expect(error.code).toBe('validation_failed')
    expect(error.detail).toBe('One or more fields are invalid')
    expect(error.fieldErrors).toEqual({
      password: 'must be at least 8 characters',
      displayName: 'must not be blank',
    })
  })

  it('falls back to the HTTP status when the problem has no code', async () => {
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)
    fetchMock
      .mockResolvedValueOnce(problemResponse(401, { detail: 'Email or password is incorrect' }))
      .mockResolvedValueOnce(problemResponse(409, { detail: 'Email already registered' }))
      .mockResolvedValueOnce(problemResponse(423, { detail: 'Account temporarily locked' }))
      .mockResolvedValueOnce(problemResponse(401, { detail: 'Full authentication is required' }))
      .mockResolvedValueOnce(problemResponse(500, { detail: 'NullPointerException at line 42' }))

    const loginError = await captureError(login({ email: 'a@b.c', password: MARKER_PASSWORD }))
    const signupError = await captureError(signup({ email: 'a@b.c', displayName: 'A', password: MARKER_PASSWORD }))
    const lockedError = await captureError(login({ email: 'a@b.c', password: MARKER_PASSWORD }))
    expect(ended).not.toHaveBeenCalled()
    const adsError = await captureError(createAd({ title: 't', description: 'd' }))
    const serverError = await captureError(listAds())
    unsubscribe()

    expect(loginError.detail).toBe('Email or password is incorrect')
    expect(signupError.detail).toBe('Email already registered')
    expect(lockedError.detail).toBe('Account temporarily locked')
    expect(adsError.detail).toBe(SESSION_ENDED_MESSAGE)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(serverError.detail).toBe(GENERIC_ERROR_MESSAGE)
    expect(serverError.code).toBeUndefined()
  })

  it('signals a session end for not_authenticated on ads but not for bad_credentials at log-in', async () => {
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)
    fetchMock
      .mockResolvedValueOnce(problemResponse(401, { code: 'bad_credentials', detail: 'Email or password is incorrect' }))
      .mockResolvedValueOnce(problemResponse(401, { code: 'not_authenticated', detail: 'Not logged in' }))

    const loginError = await captureError(login({ email: 'a@b.c', password: MARKER_PASSWORD }))
    expect(loginError.code).toBe('bad_credentials')
    expect(ended).not.toHaveBeenCalled()

    const updateError = await captureError(updateAd(3, { title: 't', description: 'd' }))
    expect(updateError.code).toBe('not_authenticated')
    expect(updateError.detail).toBe(SESSION_ENDED_MESSAGE)
    expect(ended).toHaveBeenCalledTimes(1)

    unsubscribe()
    fetchMock.mockResolvedValueOnce(problemResponse(401, { code: 'not_authenticated', detail: 'Not logged in' }))
    await captureError(listAds())
    expect(ended).toHaveBeenCalledTimes(1)
  })

  it('refreshes the token once on csrf_invalid and rejects without resending the write', async () => {
    setCookie('stale-token')
    fetchMock
      .mockResolvedValueOnce(problemResponse(403, { code: 'csrf_invalid', detail: 'Invalid CSRF token' }))
      .mockResolvedValueOnce(jsonResponse({ user: makeUser() }))

    const error = await captureError(createAd({ title: 'Bike', description: 'Almost new' }))

    expect(error.status).toBe(403)
    expect(error.code).toBe('csrf_invalid')
    expect(error.message).toBe(CSRF_EXPIRED_MESSAGE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callUrl(1)).toBe('/api/v1/auth/me')
    expect(callInit(1).method).toBe('GET')
  })

  it('shows the generic message for a network failure or a non-JSON body', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }))
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))

    const networkError = await captureError(listAds())
    const gatewayError = await captureError(listAds())
    const parseError = await captureError(listAds())

    expect(networkError.detail).toBe(GENERIC_ERROR_MESSAGE)
    expect(gatewayError.detail).toBe(GENERIC_ERROR_MESSAGE)
    expect(gatewayError.status).toBe(502)
    expect(parseError.detail).toBe(GENERIC_ERROR_MESSAGE)
  })

  it('aborts a request with no answer after 10 seconds', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )

    const pending = captureError(listAds())
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(signal?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const error = await pending

    expect(signal?.aborted).toBe(true)
    expect(error.detail).toBe(GENERIC_ERROR_MESSAGE)
  })

  it('never touches browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    setCookie('abc')
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ user: null }))
      .mockResolvedValueOnce(jsonResponse(makeUser()))
      .mockResolvedValueOnce(problemResponse(401, { code: 'bad_credentials', detail: 'Email or password is incorrect' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await getMe()
    await login({ email: 'ann@example.com', password: MARKER_PASSWORD })
    await captureError(login({ email: 'ann@example.com', password: MARKER_PASSWORD }))
    await logout()

    expect(setItem).not.toHaveBeenCalled()
    expect(getItem).not.toHaveBeenCalled()
  })
})
