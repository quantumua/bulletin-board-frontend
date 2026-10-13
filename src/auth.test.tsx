import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from './auth'
import { useAuth } from './useAuth'

const fetchMock = vi.fn()
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

test('401 from /me yields an anonymous user', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }))
  const { result } = renderHook(() => useAuth(), { wrapper })
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.user).toBeNull()
})

test('200 from /me yields the user', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 1, username: 'ann' }), { status: 200 }))
  const { result } = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.user).toEqual({ id: 1, username: 'ann' })
})

test('login sets the user, logout and expireSession clear it', async () => {
  fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
  const { result } = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))

  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'ann' }), { status: 200 }))
  await act(() => result.current.login({ username: 'ann', password: 'secret123' }))
  expect(result.current.user).toEqual({ id: 1, username: 'ann' })

  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
  await act(() => result.current.logout())
  expect(result.current.user).toBeNull()

  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'ann' }), { status: 200 }))
  await act(() => result.current.login({ username: 'ann', password: 'secret123' }))
  act(() => result.current.expireSession())
  expect(result.current.user).toBeNull()
})

test('register does not log the user in', async () => {
  fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
  const { result } = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))

  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 2, username: 'bob' }), { status: 201 }))
  await act(() => result.current.register({ username: 'bob', password: 'secret123' }))
  expect(result.current.user).toBeNull()
})
