import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as api from './api'
import { AuthProvider } from './auth'
import AuthForm from './AuthForm'

vi.mock('./api')

beforeEach(() => {
  vi.mocked(api.getCurrentUser).mockResolvedValue(null)
})

afterEach(() => {
  vi.resetAllMocks()
})

async function fillAndSubmit(email: string, password: string, button: string) {
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: button }))
}

test('register mode calls the register API', async () => {
  vi.mocked(api.register).mockResolvedValue({ id: 1, email: 'alice@example.com' })
  render(
    <AuthProvider>
      <AuthForm mode="register" />
    </AuthProvider>,
  )

  await fillAndSubmit('alice@example.com', 'secret123', 'Register')

  expect(api.register).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'secret123' })
  expect(api.login).not.toHaveBeenCalled()
})

test('login mode calls the login API', async () => {
  vi.mocked(api.login).mockResolvedValue({ id: 1, email: 'alice@example.com' })
  render(
    <AuthProvider>
      <AuthForm mode="login" />
    </AuthProvider>,
  )

  await fillAndSubmit('alice@example.com', 'secret123', 'Sign in')

  expect(api.login).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'secret123' })
  expect(api.register).not.toHaveBeenCalled()
})

test('shows the server error when sign-in fails', async () => {
  vi.mocked(api.login).mockRejectedValue(new Error('Invalid email or password'))
  render(
    <AuthProvider>
      <AuthForm mode="login" />
    </AuthProvider>,
  )

  await fillAndSubmit('alice@example.com', 'wrong-password', 'Sign in')

  expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})
