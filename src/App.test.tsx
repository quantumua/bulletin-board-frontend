import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const anonymous = () => json({ detail: 'Unauthorized' }, 401)

// Routes the stubbed fetch by URL; `me` and `usersResponse` decide the session and the directory result,
// and `extra` answers first (return undefined to fall through), for writes and login
function stubApi({
  me,
  usersResponse,
  extra,
}: {
  me: () => Response
  usersResponse?: () => Response
  extra?: (url: string, init?: RequestInit) => Response | undefined
}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const answer = extra?.(url, init)
    if (answer) return Promise.resolve(answer)
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
  stubApi({ me: anonymous })
  renderApp()
  expect(await screen.findByText('Bike')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Users' })).toBeNull()
  expect(fetchMock).not.toHaveBeenCalledWith('/api/users', expect.anything())
})

test('the anonymous header offers Log in and + New ad', async () => {
  stubApi({ me: anonymous })
  renderApp()
  await screen.findByText('Bike')
  expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '+ New ad' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Users' })).toBeNull()
})

test('the logged-in header shows the user, Log out, both tabs and + New ad', async () => {
  stubApi({ me: () => json(ann) })
  renderApp()
  expect(await screen.findByText('ann', { selector: 'strong' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ads' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Users' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '+ New ad' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull()
})

function loginRoutes(url: string) {
  if (url === '/api/auth/login') return json(ann)
  if (url === '/api/auth/register') return json({ id: 3, username: 'cat' }, 201)
}

function fillCredentials(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText('Username'), { target: { value: 'ann' } })
  fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'password123' } })
}

test('Log in opens the login dialog and a successful login closes it', async () => {
  stubApi({ me: anonymous, extra: loginRoutes })
  renderApp()
  await screen.findByText('Bike')
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

  const dialog = screen.getByRole('dialog', { name: 'Account' })
  fillCredentials(dialog)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log in' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText('ann', { selector: 'strong' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy()
})

test('registering keeps the login dialog open on the login form with a notice', async () => {
  stubApi({ me: anonymous, extra: loginRoutes })
  renderApp()
  await screen.findByText('Bike')
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

  const dialog = screen.getByRole('dialog', { name: 'Account' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Need an account?' }))
  fillCredentials(dialog)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Register' }))

  expect(await within(dialog).findByText('Account created. Log in to continue.')).toBeTruthy()
  expect(screen.getByRole('dialog', { name: 'Account' })).toBeTruthy()
  expect(within(dialog).getByRole('heading', { name: 'Log in' })).toBeTruthy()
})

test('ads render as a grid list and are replaced by the Users list on that tab', async () => {
  stubApi({ me: () => json(ann) })
  renderApp()
  expect((await screen.findByText('Bike')).closest('ul')?.className).toBe('ad-list')

  fireEvent.click(screen.getByRole('button', { name: 'Users' }))
  await screen.findByText('bob')
  expect(screen.queryByText('Bike')).toBeNull()
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

const created = { id: 2, title: 'Sofa', description: 'Blue', author: 'ann', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' }

function writeRoutes(url: string, init?: RequestInit) {
  if (url === '/api/ads' && init?.method === 'POST') return json(created, 201)
  if (url === '/api/ads/1' && init?.method === 'PUT') return json({ ...ads[0], title: 'Bike 2' })
}

function titleField(dialog: HTMLElement) {
  return within(dialog).getByLabelText('Title') as HTMLInputElement
}

function openNewAd() {
  fireEvent.click(screen.getByRole('button', { name: '+ New ad' }))
  return screen.getByRole('dialog', { name: 'New ad' })
}

function openEdit() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  return screen.getByRole('dialog', { name: 'Edit ad' })
}

function fillAd(dialog: HTMLElement, title: string) {
  fireEvent.change(titleField(dialog), { target: { value: title } })
  fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'Details' } })
}

test('a new-ad draft survives closing and reopening the dialog', async () => {
  stubApi({ me: () => json(ann) })
  renderApp()
  await screen.findByText('Bike')

  const dialog = openNewAd()
  fillAd(dialog, 'Half typed')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  expect(titleField(openNewAd()).value).toBe('Half typed')
})

test('saving a new ad closes the dialog, shows the card and clears the draft', async () => {
  stubApi({ me: () => json(ann), extra: writeRoutes })
  renderApp()
  await screen.findByText('Bike')

  const dialog = openNewAd()
  fillAd(dialog, 'Sofa')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add ad' }))

  expect(await screen.findByText('Sofa')).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(titleField(openNewAd()).value).toBe('')
})

test('a failed save keeps the new-ad dialog open with the error and the text', async () => {
  stubApi({
    me: () => json(ann),
    extra: (url, init) =>
      url === '/api/ads' && init?.method === 'POST' ? json({ detail: 'Title is not allowed' }, 400) : undefined,
  })
  renderApp()
  await screen.findByText('Bike')

  const dialog = openNewAd()
  fillAd(dialog, 'Bad')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add ad' }))

  expect(await within(dialog).findByText('Title is not allowed')).toBeTruthy()
  expect(screen.getByRole('dialog', { name: 'New ad' })).toBeTruthy()
  expect(titleField(dialog).value).toBe('Bad')
})

test('anonymous + New ad opens the login dialog and no new-ad form', async () => {
  stubApi({ me: anonymous })
  renderApp()
  await screen.findByText('Bike')

  fireEvent.click(screen.getByRole('button', { name: '+ New ad' }))
  expect(screen.getByRole('dialog', { name: 'Account' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'New ad' })).toBeNull()
})

test('Edit opens a dialog prefilled with the ad', async () => {
  stubApi({ me: () => json(ann) })
  renderApp()
  await screen.findByText('Bike')

  expect(titleField(openEdit()).value).toBe('Bike')
})

test('an unsaved edit is discarded when the dialog is closed', async () => {
  stubApi({ me: () => json(ann) })
  renderApp()
  await screen.findByText('Bike')

  const dialog = openEdit()
  fireEvent.change(titleField(dialog), { target: { value: 'Changed' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  expect(titleField(openEdit()).value).toBe('Bike')
})

test('saving an edit closes the dialog and updates the card', async () => {
  stubApi({ me: () => json(ann), extra: writeRoutes })
  renderApp()
  await screen.findByText('Bike')

  const dialog = openEdit()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Bike 2')).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('editing an ad leaves the new-ad draft alone', async () => {
  stubApi({ me: () => json(ann), extra: writeRoutes })
  renderApp()
  await screen.findByText('Bike')

  const draft = openNewAd()
  fillAd(draft, 'My draft')
  fireEvent.click(within(draft).getByRole('button', { name: 'Cancel' }))

  fireEvent.click(within(openEdit()).getByRole('button', { name: 'Save' }))
  await screen.findByText('Bike 2')

  expect(titleField(openNewAd()).value).toBe('My draft')
})

test('an expired session while saving closes the dialog and keeps the draft for the next login', async () => {
  stubApi({
    me: () => json(ann),
    extra: (url, init) => {
      if (url === '/api/ads' && init?.method === 'POST') return anonymous()
      return loginRoutes(url)
    },
  })
  renderApp()
  await screen.findByText('Bike')

  const dialog = openNewAd()
  fillAd(dialog, 'Kept text')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add ad' }))

  expect(await screen.findByText('Your session has ended. Please log in again.')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  const login = screen.getByRole('dialog', { name: 'Account' })
  fillCredentials(login)
  fireEvent.click(within(login).getByRole('button', { name: 'Log in' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

  expect(titleField(openNewAd()).value).toBe('Kept text')
})
