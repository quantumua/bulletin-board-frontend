import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import * as api from './api'
import { AuthProvider, useAuth } from './auth'

vi.mock('./api')

function ShowUser() {
  const { user, logout } = useAuth()
  if (user === 'loading') return <p>Loading</p>
  return (
    <>
      <p>{user ? `Signed in as ${user.email}` : 'Signed out'}</p>
      <button onClick={() => logout()}>Sign out</button>
    </>
  )
}

afterEach(() => {
  vi.resetAllMocks()
})

test('restores the signed-in user from the session on mount', async () => {
  vi.mocked(api.getCurrentUser).mockResolvedValue({ id: 1, email: 'alice@example.com' })

  render(
    <AuthProvider>
      <ShowUser />
    </AuthProvider>,
  )

  expect(screen.getByText('Loading')).toBeInTheDocument()
  expect(await screen.findByText('Signed in as alice@example.com')).toBeInTheDocument()
})

test('is signed out when there is no session', async () => {
  vi.mocked(api.getCurrentUser).mockResolvedValue(null)

  render(
    <AuthProvider>
      <ShowUser />
    </AuthProvider>,
  )

  expect(await screen.findByText('Signed out')).toBeInTheDocument()
})

test('logout clears the user', async () => {
  vi.mocked(api.getCurrentUser).mockResolvedValue({ id: 1, email: 'alice@example.com' })
  vi.mocked(api.logout).mockResolvedValue()

  render(
    <AuthProvider>
      <ShowUser />
    </AuthProvider>,
  )
  await screen.findByText('Signed in as alice@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByText('Signed out')).toBeInTheDocument()
  expect(api.logout).toHaveBeenCalledOnce()
})
