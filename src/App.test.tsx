import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Ad, CurrentUser } from './api'
import App from './App'
import CurrentUserProvider from './auth/CurrentUserContext'

// Integration: real CurrentUserProvider and ApiClient, only `fetch` is mocked

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

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return { id: 7, email: 'ann@example.com', displayName: 'Ann', ...overrides }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problem(status: number, code: string, detail: string): Response {
  return new Response(JSON.stringify({ status, title: 'Error', code, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

type Handler = () => Response | Promise<Response>

let fetchMock: Mock<typeof fetch>
let handlers: Record<string, Handler>

function requestKey(index: number): string {
  const [input, init] = fetchMock.mock.calls[index]
  return `${init?.method ?? 'GET'} ${String(input)}`
}

function requestKeys(): string[] {
  return fetchMock.mock.calls.map((_call, index) => requestKey(index))
}

function renderBoard() {
  const user = userEvent.setup()
  render(
    <CurrentUserProvider>
      <App />
    </CurrentUserProvider>,
  )
  return user
}

const twoAds = [
  makeAd({ id: 2, title: 'Mine', authorName: 'Ann', ownedByMe: true }),
  makeAd({ id: 1, title: 'Theirs', authorName: 'Bob', ownedByMe: false }),
]

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token-1; path=/'
  handlers = {
    'GET /api/v1/auth/me': () => json({ user: null }),
    'GET /api/v1/ads': () => json(twoAds.map((ad) => ({ ...ad, ownedByMe: false }))),
  }
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request ${key}`)
    return handler()
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('AdBoard', () => {
  it('shows ads and authors to a visitor but no New ad form and no Edit buttons', async () => {
    renderBoard()

    expect(await screen.findByText('Theirs')).toBeInTheDocument()
    await screen.findByTestId('auth-login-open-button')
    expect(screen.getByText('by Bob')).toBeInTheDocument()
    expect(screen.getByText('by Ann')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'New ad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows New ad to a logged-in user and Edit only on their own ads', async () => {
    handlers['GET /api/v1/auth/me'] = () => json({ user: makeUser() })
    handlers['GET /api/v1/ads'] = () => json(twoAds)
    renderBoard()

    expect(await screen.findByRole('heading', { name: 'New ad' })).toBeInTheDocument()
    const cards = await screen.findAllByTestId('ad-card')
    const mine = cards.find((card) => within(card).queryByText('Mine'))!
    const theirs = cards.find((card) => within(card).queryByText('Theirs'))!
    expect(within(mine).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(theirs).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
  })

  it('shows "Unknown" as the author of an unowned ad', async () => {
    handlers['GET /api/v1/ads'] = () => json([makeAd({ title: 'Old ad', authorName: 'Unknown' })])
    renderBoard()

    expect(await screen.findByText('Old ad')).toBeInTheDocument()
    expect(screen.getByTestId('ad-card-author')).toHaveTextContent('by Unknown')
  })

  it('makes exactly two requests on page load, sent in parallel', async () => {
    let releaseMe!: () => void
    const meAnswered = new Promise<void>((resolve) => {
      releaseMe = resolve
    })
    handlers['GET /api/v1/auth/me'] = async () => {
      await meAnswered
      return json({ user: null })
    }
    renderBoard()

    // Both requests leave before /auth/me has answered
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    releaseMe()

    await screen.findByTestId('auth-login-open-button')
    await screen.findByText('Theirs')
    expect(requestKeys().sort()).toEqual(['GET /api/v1/ads', 'GET /api/v1/auth/me'])
  })

  it('reloads the list after log-in so Edit appears on own ads', async () => {
    const user = renderBoard()
    await screen.findByText('Mine')
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    handlers['POST /api/v1/auth/login'] = () => json(makeUser())
    handlers['GET /api/v1/ads'] = () => json(twoAds)
    await user.click(screen.getByTestId('auth-login-open-button'))
    const panel = screen.getByTestId('auth-login-panel')
    await user.type(within(panel).getByLabelText('Email'), 'ann@example.com')
    await user.type(within(panel).getByLabelText('Password'), `${MARKER_PASSWORD}{Enter}`)

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(requestKeys().filter((key) => key === 'GET /api/v1/ads')).toHaveLength(2)
    const loginCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/v1/auth/login')
    const loginHeaders = (loginCall?.[1]?.headers ?? {}) as Record<string, string>
    expect(loginHeaders['X-XSRF-TOKEN']).toBe('token-1')
  })

  it('hides New ad and Edit again after log-out', async () => {
    handlers['GET /api/v1/auth/me'] = () => json({ user: makeUser() })
    handlers['GET /api/v1/ads'] = () => json(twoAds)
    handlers['POST /api/v1/auth/logout'] = () => new Response(null, { status: 204 })
    const user = renderBoard()
    await screen.findByRole('button', { name: 'Edit' })

    handlers['GET /api/v1/ads'] = () => json(twoAds.map((ad) => ({ ...ad, ownedByMe: false })))
    await user.click(screen.getByTestId('auth-logout-button'))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'New ad' })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByText('Mine')).toBeInTheDocument()
  })

  it('keeps the edited text and asks to log in when the session has ended on Save', async () => {
    handlers['GET /api/v1/auth/me'] = () => json({ user: makeUser() })
    handlers['GET /api/v1/ads'] = () => json(twoAds)
    handlers['PUT /api/v1/ads/2'] = () => problem(401, 'not_authenticated', 'Not logged in')
    const user = renderBoard()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const form = screen.getAllByTestId('ad-form').find((f) => within(f).queryByRole('button', { name: 'Save' }))!
    const title = within(form).getByTestId('ad-form-title-input')
    await user.clear(title)
    await user.type(title, 'Mine, now cheaper')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByTestId('auth-session-ended-alert')).toHaveTextContent(
      'Your session ended. Please log in again.',
    )
    expect(screen.getByTestId('auth-login-panel')).toBeInTheDocument()
    expect(within(form).getByTestId('ad-form-title-input')).toHaveValue('Mine, now cheaper')
    expect(within(form).getByTestId('ad-form-error')).toHaveTextContent('Your session ended. Please log in again.')
  })
})
