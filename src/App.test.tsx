import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as api from './api'
import App from './App'
import { AuthProvider } from './auth'

vi.mock('./api')

const alice = { id: 1, email: 'alice@example.com' }

beforeEach(() => {
  vi.mocked(api.listAds).mockResolvedValue([])
})

afterEach(() => {
  vi.resetAllMocks()
})

function renderApp() {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  )
}

test('registering shows the signed-in email', async () => {
  vi.mocked(api.getCurrentUser).mockResolvedValue(null)
  vi.mocked(api.register).mockResolvedValue(alice)
  renderApp()

  await userEvent.click(await screen.findByRole('button', { name: 'Register' }))
  await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: 'Register' }))

  expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Register' })).not.toBeInTheDocument()
})

test('signing out shows Sign in again', async () => {
  vi.mocked(api.getCurrentUser).mockResolvedValue(alice)
  vi.mocked(api.logout).mockResolvedValue()
  renderApp()

  await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument()
})

test('failed sign-in shows the error and stays signed out', async () => {
  vi.mocked(api.getCurrentUser).mockResolvedValue(null)
  vi.mocked(api.login).mockRejectedValue(new Error('Invalid email or password'))
  renderApp()

  await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
  await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
})

test('the ads section is shown while signed out', async () => {
  vi.mocked(api.getCurrentUser).mockResolvedValue(null)
  renderApp()

  expect(await screen.findByText('No ads yet.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add ad' })).toBeInTheDocument()
})
