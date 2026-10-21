import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdForm from './AdForm'
import { ApiError, SESSION_ENDED_MESSAGE, type Ad, type AdInput } from './api'

function makeAd(overrides: Partial<Ad> = {}): Ad {
  return {
    id: 1,
    title: 'Bike for sale',
    description: 'Almost new',
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    authorName: 'Ann',
    ownedByMe: true,
    ...overrides,
  }
}

function renderForm(onSubmit: (input: AdInput) => Promise<void>, ad?: Ad, onCancel?: () => void) {
  const user = userEvent.setup()
  render(<AdForm ad={ad} onSubmit={onSubmit} onCancel={onCancel} />)
  return user
}

async function replaceText(user: ReturnType<typeof userEvent.setup>, testId: string, text: string) {
  const field = screen.getByTestId(testId)
  await user.clear(field)
  await user.type(field, text)
}

describe('AdForm', () => {
  it('shows a not_owner refusal on Save and keeps the input', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(403, { code: 'not_owner', detail: 'You can only edit your own ads' }),
    )
    const user = renderForm(onSubmit, makeAd())

    await replaceText(user, 'ad-form-title-input', 'Changed title')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You can only edit your own ads')
    expect(screen.getByTestId('ad-form-title-input')).toHaveValue('Changed title')
    expect(screen.getByTestId('ad-form-description-input')).toHaveValue('Almost new')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('keeps the input when the session has ended on Save', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(401, { code: 'not_authenticated', detail: SESSION_ENDED_MESSAGE }),
    )
    const user = renderForm(onSubmit)

    await replaceText(user, 'ad-form-title-input', 'Lamp')
    await replaceText(user, 'ad-form-description-input', 'Works fine')
    await user.click(screen.getByRole('button', { name: 'Add ad' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_ENDED_MESSAGE)
    expect(screen.getByTestId('ad-form-title-input')).toHaveValue('Lamp')
    expect(screen.getByTestId('ad-form-description-input')).toHaveValue('Works fine')
  })

  it('clears the form after a successful create and sends trimmed values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = renderForm(onSubmit)

    await replaceText(user, 'ad-form-title-input', '  Lamp  ')
    await replaceText(user, 'ad-form-description-input', 'Works fine ')
    await user.click(screen.getByRole('button', { name: 'Add ad' }))

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Lamp', description: 'Works fine' })
    expect(screen.getByTestId('ad-form-title-input')).toHaveValue('')
    expect(screen.getByTestId('ad-form-description-input')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps its values after a successful edit and offers Cancel', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()
    const user = renderForm(onSubmit, makeAd(), onCancel)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Bike for sale', description: 'Almost new' })
    expect(screen.getByTestId('ad-form-title-input')).toHaveValue('Bike for sale')

    await user.click(screen.getByTestId('ad-form-cancel-button'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows the generic message for an unexpected failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('internal detail that must not be shown'))
    const user = renderForm(onSubmit, makeAd())

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong, please try again.')
    expect(alert).not.toHaveTextContent('internal detail')
  })
})
