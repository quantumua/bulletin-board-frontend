import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdForm from './AdForm'
import type { Ad, AdInput } from './api'

// Build and Test addition (code review): a pending save cannot be sent twice from the UI

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

function pendingSubmit() {
  let resolve!: () => void
  const onSubmit = vi.fn<(input: AdInput) => Promise<void>>(
    () =>
      new Promise<void>((done) => {
        resolve = done
      }),
  )
  return { onSubmit, resolve: () => resolve() }
}

describe('AdForm double submit', () => {
  it('sends one create request for a double click while the first is pending', async () => {
    const { onSubmit, resolve } = pendingSubmit()
    const user = userEvent.setup()
    render(<AdForm onSubmit={onSubmit} />)

    await user.type(screen.getByTestId('ad-form-title-input'), 'Lamp')
    await user.type(screen.getByTestId('ad-form-description-input'), 'Works fine')
    await user.dblClick(screen.getByRole('button', { name: 'Add ad' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Add ad' })).toBeDisabled()

    resolve()
    expect(await screen.findByRole('button', { name: 'Add ad' })).toBeEnabled()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not resubmit an edit when Enter is pressed while Save is pending', async () => {
    const { onSubmit, resolve } = pendingSubmit()
    const user = userEvent.setup()
    render(<AdForm ad={makeAd()} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.type(screen.getByTestId('ad-form-title-input'), '{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ad-form-cancel-button')).toBeDisabled()

    resolve()
    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('allows a new save once the previous one has finished', async () => {
    const onSubmit = vi.fn<(input: AdInput) => Promise<void>>().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AdForm ad={makeAd()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledTimes(2)
  })
})
