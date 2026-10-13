import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth'

const fetchMock = vi.fn()

const ann = { id: 1, username: 'ann' }
const ads = [
  { id: 1, title: 'Bike', description: 'Red', author: 'ann', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
]
const users = [
  { id: 2, username: 'bob', createdAt: '2026-02-01T00:00:00Z' },
  { id: 1, username: 'ann', createdAt: '2026-01-01T00:00:00Z' },
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

// Routes the stubbed fetch by URL; `me` and `usersResponse` decide the session and the directory result
function stubApi({ me, usersResponse }: { me: () => Response; usersResponse?: () => Response }) {
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/ads') return Promise.resolve(json(ads))
    if (url === '/api/auth/me') return Promise.resolve(me())
    if (url === '/api/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
    if (url === '/api/users') return Promise.resolve((usersResponse ?? (() => json(users)))())
    return Promise.reject(new Error(`unexpected request ${url}`))
  })
}

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('anonymous visitors see the ad list and no Users tab', async () => {
  stubApi({ me: () => json({ detail: 'Unauthorized' }, 401) })
  renderApp()
  expect(await screen.findByText('Bike')).toBeTruthy()
  expect(screen.getByText('Log in to post an ad.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Users' })).toBeNull()
  expect(fetchMock).not.toHaveBeenCalledWith('/api/users', expect.anything())
})

test('logged in users see the Users tab and it opens the list', async () => {
  stubApi({ me: () => json(ann) })
  renderApp()
  fireEvent.click(await screen.findByRole('button', { name: 'Users' }))
  expect(await screen.findByText('bob')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ads' })).toBeTruthy()
})

test('logging out returns to Ads and removes the Users tab', async () => {
  stubApi({ me: () => json(ann) })
  renderApp()
  fireEvent.click(await screen.findByRole('button', { name: 'Users' }))
  await screen.findByText('bob')

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Users' })).toBeNull())
  expect(screen.queryByText('bob')).toBeNull()
  expect(screen.getByText('Bike')).toBeTruthy()
})

test('a 401 from /api/users ends the session and returns to the ads view', async () => {
  stubApi({ me: () => json(ann), usersResponse: () => json({ detail: 'Unauthorized' }, 401) })
  renderApp()
  fireEvent.click(await screen.findByRole('button', { name: 'Users' }))

  expect(await screen.findByText('Your session has ended. Please log in again.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Users' })).toBeNull()
  expect(screen.queryByText('bob')).toBeNull()
  expect(screen.getByText('Bike')).toBeTruthy()
})
