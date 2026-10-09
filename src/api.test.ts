import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError, createAd, getMe, listAds, login, logout, register, updateAd } from './api'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return { url: url as string, init: init as RequestInit, headers: init.headers as Record<string, string> }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('request', () => {
  test('sends credentials on every request', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await listAds()
    expect(lastCall().init.credentials).toBe('include')
  })

  test('does not parse a body for 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(logout()).resolves.toBeUndefined()
  })

  test('throws ApiError with status and problem detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Nope' }, 403))
    const error = await createAd({ title: 't', description: 'd' }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.message).toBe('Nope')
  })

  test('falls back to a generic message without a problem body', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 500 }))
    await expect(listAds()).rejects.toMatchObject({ status: 500, message: 'Request failed with status 500' })
  })
})

describe('CSRF header', () => {
  test('is sent on POST and PUT when the cookie is present', async () => {
    document.cookie = 'XSRF-TOKEN=abc%3D123; path=/'
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})))
    await createAd({ title: 't', description: 'd' })
    expect(lastCall().headers['X-XSRF-TOKEN']).toBe('abc=123')
    await updateAd(1, { title: 't', description: 'd' })
    expect(lastCall().headers['X-XSRF-TOKEN']).toBe('abc=123')
  })

  test('is read fresh on each call', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})))
    document.cookie = 'XSRF-TOKEN=first; path=/'
    await createAd({ title: 't', description: 'd' })
    document.cookie = 'XSRF-TOKEN=second; path=/'
    await createAd({ title: 't', description: 'd' })
    expect(lastCall().headers['X-XSRF-TOKEN']).toBe('second')
  })

  test('is omitted when there is no cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await createAd({ title: 't', description: 'd' })
    expect(lastCall().headers).not.toHaveProperty('X-XSRF-TOKEN')
  })

  test('is omitted for login and register', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/'
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})))
    await login({ username: 'u', password: 'p' })
    expect(lastCall().headers).not.toHaveProperty('X-XSRF-TOKEN')
    await register({ username: 'u', password: 'p' })
    expect(lastCall().headers).not.toHaveProperty('X-XSRF-TOKEN')
  })

  test('is omitted for GET', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/'
    fetchMock.mockResolvedValue(jsonResponse([]))
    await listAds()
    expect(lastCall().headers).not.toHaveProperty('X-XSRF-TOKEN')
  })

  test('is sent on logout', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/'
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await logout()
    expect(lastCall().headers['X-XSRF-TOKEN']).toBe('abc')
  })
})

describe('auth endpoints', () => {
  test('getMe calls GET /api/auth/me', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, username: 'ann' }))
    await expect(getMe()).resolves.toEqual({ id: 1, username: 'ann' })
    expect(lastCall().url).toBe('/api/auth/me')
    expect(lastCall().init.method).toBeUndefined()
  })

  test('getMe surfaces 401 as ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Unauthorized' }, 401))
    await expect(getMe()).rejects.toMatchObject({ name: 'ApiError', status: 401 })
  })

  test('login posts credentials to /api/auth/login', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, username: 'ann' }))
    await login({ username: 'ann', password: 'secret123' })
    expect(lastCall().url).toBe('/api/auth/login')
    expect(lastCall().init.method).toBe('POST')
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ username: 'ann', password: 'secret123' })
  })

  test('register posts credentials to /api/auth/register', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 2, username: 'bob' }, 201))
    await register({ username: 'bob', password: 'secret123' })
    expect(lastCall().url).toBe('/api/auth/register')
    expect(lastCall().init.method).toBe('POST')
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ username: 'bob', password: 'secret123' })
  })

  test('logout posts to /api/auth/logout', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await logout()
    expect(lastCall().url).toBe('/api/auth/logout')
    expect(lastCall().init.method).toBe('POST')
  })
})
