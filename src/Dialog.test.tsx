import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import Dialog from './Dialog'

afterEach(cleanup)

test('opening shows the content in a modal', () => {
  render(
    <Dialog open onClose={() => {}} label="Example">
      <p>Hello</p>
    </Dialog>,
  )
  const dialog = screen.getByRole('dialog', { name: 'Example' }) as HTMLDialogElement
  expect(dialog.open).toBe(true)
  expect(screen.getByText('Hello')).toBeTruthy()
})

test('children stay mounted while the dialog is closed', () => {
  const { rerender } = render(
    <Dialog open onClose={() => {}} label="Example">
      <input aria-label="Title" />
    </Dialog>,
  )
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'draft' } })

  rerender(
    <Dialog open={false} onClose={() => {}} label="Example">
      <input aria-label="Title" />
    </Dialog>,
  )
  expect(screen.queryByRole('dialog')).toBeNull()

  rerender(
    <Dialog open onClose={() => {}} label="Example">
      <input aria-label="Title" />
    </Dialog>,
  )
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('draft')
})

test('Esc (the native close event) calls onClose', () => {
  const onClose = vi.fn()
  render(
    <Dialog open onClose={onClose} label="Example">
      <p>Hello</p>
    </Dialog>,
  )
  ;(screen.getByRole('dialog') as HTMLDialogElement).close()
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('closing through the open prop does not call onClose', () => {
  const onClose = vi.fn()
  const { rerender } = render(
    <Dialog open onClose={onClose} label="Example">
      <p>Hello</p>
    </Dialog>,
  )
  rerender(
    <Dialog open={false} onClose={onClose} label="Example">
      <p>Hello</p>
    </Dialog>,
  )
  expect(onClose).not.toHaveBeenCalled()
})

test('a backdrop click calls onClose but a click inside does not', () => {
  const onClose = vi.fn()
  render(
    <Dialog open onClose={onClose} label="Example">
      <p>Hello</p>
    </Dialog>,
  )
  fireEvent.click(screen.getByText('Hello'))
  expect(onClose).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('dialog'))
  expect(onClose).toHaveBeenCalledTimes(1)
})
