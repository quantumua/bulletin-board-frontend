import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createAd, getCurrentUser, listAds, login, logout, register, updateAd } from './api'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function lastRequest(): { url: string; init: RequestInit; headers: Record<string, string> } {
  const [url, init] = fetchMock.mock.lastCall!
  return { url: url as string, init: init!, headers: init!.headers as Record<string, string> }
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  document.cookie = 'XSRF-TOKEN=csrf-123'
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('ad requests', () => {
  test('createAd sends credentials and the CSRF header from the cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1, title: 't', description: 'd' }))

    await createAd({ title: 't', description: 'd' })

    const { url, init, headers } = lastRequest()
    expect(url).toBe('/api/ads')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.body).toBe(JSON.stringify({ title: 't', description: 'd' }))
    expect(headers).toEqual({ 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-123' })
  })

  test('updateAd sends the CSRF header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 7 }))

    await updateAd(7, { title: 't', description: 'd' })

    const { url, init, headers } = lastRequest()
    expect(url).toBe('/api/ads/7')
    expect(init.method).toBe('PUT')
    expect(headers['X-XSRF-TOKEN']).toBe('csrf-123')
  })

  test('listAds is a plain GET without the CSRF header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []))

    await expect(listAds()).resolves.toEqual([])

    const { url, init, headers } = lastRequest()
    expect(url).toBe('/api/ads')
    expect(init.method).toBeUndefined()
    expect(init.credentials).toBe('include')
    expect(headers).toEqual({ 'Content-Type': 'application/json' })
  })

  test('omits the CSRF header when no token cookie is set', async () => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1 }))

    await createAd({ title: 't', description: 'd' })

    expect(lastRequest().headers).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('auth requests', () => {
  const alice = { id: 1, email: 'alice@example.com' }

  test('register posts the credentials and returns the user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, alice))

    await expect(register({ email: 'alice@example.com', password: 'secret123' })).resolves.toEqual(alice)

    const { url, init, headers } = lastRequest()
    expect(url).toBe('/api/auth/register')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'alice@example.com', password: 'secret123' }))
    expect(headers['X-XSRF-TOKEN']).toBe('csrf-123')
  })

  test('login returns the user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, alice))

    await expect(login({ email: 'alice@example.com', password: 'secret123' })).resolves.toEqual(alice)
    expect(lastRequest().url).toBe('/api/auth/login')
  })

  test('login surfaces the problem-detail message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { status: 401, detail: 'Invalid email or password' }))

    await expect(login({ email: 'alice@example.com', password: 'wrong' })).rejects.toThrow(
      'Invalid email or password',
    )
  })

  test('register surfaces the problem-detail message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { status: 409, detail: 'Email is already registered' }))

    await expect(register({ email: 'alice@example.com', password: 'secret123' })).rejects.toThrow(
      'Email is already registered',
    )
  })

  test('logout handles an empty 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(logout()).resolves.toBeUndefined()

    const { url, init, headers } = lastRequest()
    expect(url).toBe('/api/auth/logout')
    expect(init.method).toBe('POST')
    expect(headers['X-XSRF-TOKEN']).toBe('csrf-123')
  })

  test('getCurrentUser returns the signed-in user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, alice))

    await expect(getCurrentUser()).resolves.toEqual(alice)
    expect(lastRequest().url).toBe('/api/auth/me')
  })

  test('getCurrentUser maps 401 to null', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { status: 401, detail: 'Not signed in' }))

    await expect(getCurrentUser()).resolves.toBeNull()
  })

  test('getCurrentUser maps 404 to null', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(getCurrentUser()).resolves.toBeNull()
  })

  test('getCurrentUser rethrows other errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { status: 500, detail: 'Boom' }))

    await expect(getCurrentUser()).rejects.toThrow('Boom')
  })
})
