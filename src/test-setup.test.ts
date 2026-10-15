import { expect, test, vi } from 'vitest'

test('the dialog stub opens on showModal and closes with a close event', () => {
  const dialog = document.createElement('dialog')
  const onClose = vi.fn()
  dialog.addEventListener('close', onClose)

  dialog.showModal()
  expect(dialog.open).toBe(true)

  dialog.close()
  expect(dialog.open).toBe(false)
  expect(onClose).toHaveBeenCalledTimes(1)
})
