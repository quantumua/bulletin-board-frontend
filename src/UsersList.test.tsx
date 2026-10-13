import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import UsersList from './UsersList'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('shows loading, then users in the order returned', async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify([
        { id: 1, username: 'zed', createdAt: '2026-01-01T00:00:00Z' },
        { id: 3, username: 'amy', createdAt: '2026-03-01T00:00:00Z' },
        { id: 2, username: 'bob', createdAt: '2026-02-01T00:00:00Z' },
      ]),
      { status: 200 },
    ),
  )
  render(<UsersList onUnauthorized={() => {}} />)
  expect(screen.getByText('Loading users…')).toBeTruthy()

  const names = (await screen.findAllByRole('listitem')).map((li) => li.querySelector('strong')?.textContent)
  expect(names).toEqual(['zed', 'amy', 'bob'])
  expect(screen.getByText(`Joined ${new Date('2026-01-01T00:00:00Z').toLocaleString()}`)).toBeTruthy()
  expect(screen.queryByText('Loading users…')).toBeNull()
})

test('shows an inline error for non-401 failures', async () => {
  const onUnauthorized = vi.fn()
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Boom' }), { status: 500 }))
  render(<UsersList onUnauthorized={onUnauthorized} />)
  expect(await screen.findByText('Could not load users: Boom')).toBeTruthy()
  expect(onUnauthorized).not.toHaveBeenCalled()
})

test('401 calls onUnauthorized and shows no user data', async () => {
  const onUnauthorized = vi.fn()
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }))
  render(<UsersList onUnauthorized={onUnauthorized} />)
  await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.queryByText(/Could not load users/)).toBeNull()
})
